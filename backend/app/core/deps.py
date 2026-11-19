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

from app.core.supabase import get_supabase_client

security = HTTPBearer(auto_error=True)

ORGANISER_ROLES: set[str] = {"admin", "organiser"}


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

    try:
        client = get_supabase_client()
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(503, "Authentication service is not configured") from exc
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
    if not filter_visible_meetings(client, [meeting], user):
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


def filter_visible_meetings(client, meetings: list[dict], user: CurrentUser) -> list[dict]:
    """Match private.user_can_view_meeting without trusting a service-role read."""
    private_ids = [str(m["id"]) for m in meetings if m.get("visibility") == "private"]
    visible_private = set()
    if private_ids:
        participants = (client.table("meeting_participants").select("meeting_id").in_("meeting_id", private_ids)
                        .eq("user_id", str(user.id)).execute().data or [])
        visible_private.update(str(p["meeting_id"]) for p in participants)
        assignments = client.table("task_assignees").select("task_id").eq("user_id", str(user.id)).execute().data or []
        if assignments:
            tasks = (client.table("tasks").select("meeting_id").in_("id", [a["task_id"] for a in assignments])
                     .in_("meeting_id", private_ids).execute().data or [])
            visible_private.update(str(t["meeting_id"]) for t in tasks)
    return [m for m in meetings if m.get("lifecycle") != "deleted" and (
        m.get("visibility") != "private" or str(m.get("organiser_id")) == str(user.id)
        or str(m["id"]) in visible_private)]
