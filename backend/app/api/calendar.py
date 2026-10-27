"""Calendar API Router for ActionPulse.

Endpoints:
- GET /calendar/connect-url: Generate Google OAuth authorization URL
- POST /calendar/callback: Exchange OAuth code for tokens and save connection
- GET /calendar/status: Check current calendar connection status
- DELETE /calendar/disconnect: Disconnect and delete stored tokens
- GET /calendar/events: Fetch upcoming calendar events with ActionPulse linkage
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import settings
from app.core.deps import CurrentUser, get_current_user, require_role
from app.core.supabase import get_supabase_client
from app.schemas.calendar import (
    CalendarCallbackRequest,
    CalendarConnectionStatus,
    CalendarConnectUrlResponse,
    CalendarEventsResponse,
)
from app.services.calendar import (
    encrypt_token,
    exchange_google_code,
    fetch_calendar_events,
    get_google_auth_url,
    get_google_user_email,
    verify_oauth_state,
)

logger = logging.getLogger(__name__)

router = APIRouter()

WORKSPACE_ROLES = {"admin", "organiser", "member"}


@router.get(
    "/connect-url",
    response_model=CalendarConnectUrlResponse,
    summary="Get Google OAuth 2.0 authorization URL",
)
def get_connect_url(
    workspace_id: UUID = Query(..., description="Workspace ID"),
    redirect_uri: Optional[str] = Query(None, description="Client redirect URI override"),
    user: CurrentUser = Depends(get_current_user),
) -> CalendarConnectUrlResponse:
    """Generate signed Google OAuth authorization URL for calendar read access."""
    require_role(workspace_id, WORKSPACE_ROLES, user)

    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Calendar integration is not configured (missing GOOGLE_CLIENT_ID)",
        )

    auth_url = get_google_auth_url(user.id, workspace_id, redirect_uri)
    return CalendarConnectUrlResponse(auth_url=auth_url)


@router.post(
    "/callback",
    summary="Handle OAuth callback and save encrypted tokens",
)
async def oauth_callback(
    payload: CalendarCallbackRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Exchange OAuth code for tokens, retrieve email, and store connection."""
    try:
        state_uid, state_wid = verify_oauth_state(payload.state)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    if state_uid != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User identity does not match OAuth state",
        )

    require_role(state_wid, WORKSPACE_ROLES, user)

    try:
        token_data = await exchange_google_code(payload.code, payload.redirect_uri)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Token exchange failed: {exc}",
        ) from exc

    refresh_token = token_data.get("refresh_token")
    access_token = token_data.get("access_token")
    expires_in = int(token_data.get("expires_in", 3600))

    if not refresh_token:
        # Check if an existing connection already has a refresh token
        client = get_supabase_client()
        existing = (
            client.table("calendar_connections")
            .select("encrypted_refresh_token")
            .eq("user_id", str(user.id))
            .eq("workspace_id", str(state_wid))
            .eq("provider", "google")
            .execute()
        )
        if existing.data and existing.data[0].get("encrypted_refresh_token"):
            encrypted_refresh_token = existing.data[0]["encrypted_refresh_token"]
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google did not return a refresh token. Please revoke app access in your Google Account and try again.",
            )
    else:
        encrypted_refresh_token = encrypt_token(refresh_token)

    try:
        account_email = await get_google_user_email(access_token)
    except Exception as exc:
        logger.warning(f"Failed to fetch user email from Google: {exc}")
        account_email = user.email

    now_iso = datetime.now(timezone.utc).isoformat()
    client = get_supabase_client()
    upsert_payload = {
        "user_id": str(user.id),
        "workspace_id": str(state_wid),
        "provider": "google",
        "account_email": account_email,
        "encrypted_refresh_token": encrypted_refresh_token,
        "access_token": access_token,
        "token_expires_at": (datetime.now(timezone.utc)).isoformat(),
        "sync_enabled": True,
        "last_synced_at": now_iso,
        "updated_at": now_iso,
    }

    resp = (
        client.table("calendar_connections")
        .upsert(upsert_payload, on_conflict="user_id,workspace_id,provider")
        .execute()
    )

    if not resp.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record calendar connection in database",
        )

    return {
        "success": True,
        "provider": "google",
        "account_email": account_email,
        "workspace_id": str(state_wid),
    }


@router.get(
    "/status",
    response_model=CalendarConnectionStatus,
    summary="Check calendar connection status",
)
def get_connection_status(
    workspace_id: UUID = Query(..., description="Workspace ID"),
    user: CurrentUser = Depends(get_current_user),
) -> CalendarConnectionStatus:
    """Retrieve connection status for the authenticated user and workspace."""
    require_role(workspace_id, WORKSPACE_ROLES, user)

    client = get_supabase_client()
    resp = (
        client.table("calendar_connections")
        .select("provider, account_email, last_synced_at, sync_enabled")
        .eq("user_id", str(user.id))
        .eq("workspace_id", str(workspace_id))
        .eq("provider", "google")
        .execute()
    )

    rows = resp.data or []
    if not rows or not rows[0].get("sync_enabled"):
        return CalendarConnectionStatus(connected=False)

    row = rows[0]
    return CalendarConnectionStatus(
        connected=True,
        provider=row.get("provider"),
        account_email=row.get("account_email"),
        last_synced_at=row.get("last_synced_at"),
    )


@router.delete(
    "/disconnect",
    summary="Disconnect calendar connection",
)
def disconnect_calendar(
    workspace_id: UUID = Query(..., description="Workspace ID"),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Delete stored calendar credentials for user in this workspace."""
    require_role(workspace_id, WORKSPACE_ROLES, user)

    client = get_supabase_client()
    client.table("calendar_connections").delete().eq(
        "user_id", str(user.id)
    ).eq("workspace_id", str(workspace_id)).eq("provider", "google").execute()

    return {"success": True, "message": "Calendar disconnected successfully"}


@router.get(
    "/events",
    response_model=CalendarEventsResponse,
    summary="Fetch upcoming calendar events",
)
async def get_upcoming_events(
    workspace_id: UUID = Query(..., description="Workspace ID"),
    days_ahead: int = Query(14, ge=1, le=30, description="Days ahead to fetch"),
    user: CurrentUser = Depends(get_current_user),
) -> CalendarEventsResponse:
    """Fetch upcoming events from connected Google Calendar with ActionPulse linkage."""
    require_role(workspace_id, WORKSPACE_ROLES, user)

    client = get_supabase_client()
    resp = (
        client.table("calendar_connections")
        .select("*")
        .eq("user_id", str(user.id))
        .eq("workspace_id", str(workspace_id))
        .eq("provider", "google")
        .execute()
    )

    rows = resp.data or []
    if not rows or not rows[0].get("sync_enabled"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No connected Google Calendar found for this workspace",
        )

    conn_row = rows[0]
    try:
        events = await fetch_calendar_events(conn_row, workspace_id, days_ahead)
    except Exception as exc:
        logger.error(f"Failed to fetch calendar events: {exc}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error communicating with Google Calendar: {exc}",
        ) from exc

    # Update last_synced_at
    now = datetime.now(timezone.utc)
    client.table("calendar_connections").update({
        "last_synced_at": now.isoformat(),
    }).eq("id", conn_row["id"]).execute()

    return CalendarEventsResponse(events=events, synced_at=now)
