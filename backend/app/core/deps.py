"""Authentication and authorization dependencies for ActionPulse (BE-1 & Core).

Validates Supabase JWTs and enforces workspace/meeting role permissions.
Service-role key is used for data queries, so all permission checks
must be explicitly enforced here.
"""

from typing import Any
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import settings
from app.core.supabase import get_supabase_client

security = HTTPBearer(auto_error=True)

ORGANISER_ROLES: set[str] = {"admin", "organiser"}
DEV_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


class CurrentUser(BaseModel):
    id: UUID
    email: str


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security)
) -> CurrentUser:
    """Verify Supabase JWT from Authorization: Bearer <token>.
    
    Returns CurrentUser if valid; raises 401 on failure or expired token.
    """
    token = creds.credentials if creds else None
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # In development mode, allow instant one-click dev testing token
    if settings.ENVIRONMENT == "development" and token.startswith("dev-token"):
        return CurrentUser(
            id=DEV_USER_ID,
            email="dev@actionpulse.app"
        )

    client = get_supabase_client()
    try:
        user_response = client.auth.get_user(token)
        user = getattr(user_response, "user", None)
        if not user or not getattr(user, "id", None):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return CurrentUser(
            id=UUID(str(user.id)),
            email=getattr(user, "email", "") or ""
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed or token expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def require_role(
    workspace_id: UUID,
    allowed: set[str],
    user: CurrentUser
) -> str:
    """Check that user is a member of workspace_id with a role in allowed.
    
    Returns the user's role.
    Raises 404 if not a member (avoids leaking workspace existence).
    Raises 403 if role is not allowed.
    """
    # In development mode, bypass role check for dev testing user
    if settings.ENVIRONMENT == "development" and user.id == DEV_USER_ID:
        return "admin"

    client = get_supabase_client()
    resp = (
        client.table("workspace_members")
        .select("role")
        .eq("workspace_id", str(workspace_id))
        .eq("user_id", str(user.id))
        .execute()
    )
    members = resp.data or []
    if not members:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied"
        )
    role = members[0]["role"]
    if role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: insufficient permissions for this workspace"
        )
    return role


def require_meeting_role(
    meeting_id: UUID,
    allowed: set[str],
    user: CurrentUser
) -> dict[str, Any]:
    """Load meeting, check that user has an allowed role in its workspace.
    
    Returns the meeting record dict.
    Raises 404 if meeting doesn't exist or user is not in workspace.
    Raises 403 if user doesn't have an allowed role.
    """
    if settings.ENVIRONMENT == "development" and user.id == DEV_USER_ID:
        return {
            "id": str(meeting_id),
            "workspace_id": "00000000-0000-0000-0000-000000000002",
            "title": "Sprint 1 Architecture Review",
            "status": "ready"
        }

    client = get_supabase_client()
    resp = (
        client.table("meetings")
        .select("*")
        .eq("id", str(meeting_id))
        .execute()
    )
    meetings = resp.data or []
    if not meetings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    meeting = meetings[0]
    workspace_id = UUID(str(meeting["workspace_id"]))
    require_role(workspace_id, allowed, user)
    return meeting
