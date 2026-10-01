from typing import Set, Dict, Any
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from app.core.supabase import get_supabase_client

security = HTTPBearer()

ORGANISER_ROLES = {"admin", "organiser"}

class CurrentUser(BaseModel):
    id: UUID
    email: str

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> CurrentUser:
    """
    Reads the Bearer token, verifies it with Supabase, and returns the CurrentUser.
    Raises 401 if the token is missing, invalid, or expired.
    """
    db = get_supabase_client()
    try:
        user_res = db.auth.get_user(creds.credentials)
        if not user_res or not user_res.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return CurrentUser(id=UUID(user_res.user.id), email=user_res.user.email)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_role(workspace_id: UUID, allowed: Set[str], user: CurrentUser = Depends(get_current_user)) -> str:
    """
    Ensures the current user is a member of the given workspace with one of the allowed roles.
    Returns 404 if not a member, 403 if the role isn't in `allowed`.
    """
    db = get_supabase_client()
    
    # Query workspace_members table using service role, but we filter by user.id
    res = (
        db.table("workspace_members")
        .select("role")
        .eq("workspace_id", str(workspace_id))
        .eq("user_id", str(user.id))
        .execute()
    )
    
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    
    user_role = res.data[0]["role"]
    if user_role not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        
    return user_role

def require_meeting_role(meeting_id: UUID, allowed: Set[str], user: CurrentUser = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Loads the meeting, verifies the user has the required role on its workspace.
    Returns the meeting row.
    """
    db = get_supabase_client()
    
    res = (
        db.table("meetings")
        .select("*")
        .eq("id", str(meeting_id))
        .execute()
    )
    
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
        
    meeting = res.data[0]
    workspace_id = UUID(meeting["workspace_id"])
    
    # Run the workspace role check
    require_role(workspace_id, allowed, user)
    
    return meeting
