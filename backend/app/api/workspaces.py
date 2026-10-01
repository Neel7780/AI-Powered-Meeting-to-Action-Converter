import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.supabase import get_supabase_client
from app.core.deps import CurrentUser, get_current_user, require_role
from app.schemas.workspaces import InviteCreateRequest, InviteCreateResponse
from app.services.email import send_invite_email
from app.core.config import settings

router = APIRouter()

@router.post("/{workspace_id}/invites", response_model=InviteCreateResponse, status_code=status.HTTP_201_CREATED)
def create_invite(
    workspace_id: UUID,
    invite_req: InviteCreateRequest,
    user: CurrentUser = Depends(get_current_user)
):
    # 1. Require Admin Role
    require_role(workspace_id, {"admin"}, user)
    
    db = get_supabase_client()
    
    # Check if the user is already a member of the workspace
    # We query the `profiles` table to find the user's ID by email, 
    # then check `workspace_members`
    profile_res = db.table("profiles").select("id").eq("email", invite_req.email).execute()
    if profile_res.data:
        member_id = profile_res.data[0]["id"]
        member_check = (
            db.table("workspace_members")
            .select("role")
            .eq("workspace_id", str(workspace_id))
            .eq("user_id", member_id)
            .execute()
        )
        if member_check.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, 
                detail="User is already a member of this workspace"
            )
    
    # 2. Rate limit: check if > 20 invites in the last 24 hours for this workspace
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    recent_invites = (
        db.table("workspace_invites")
        .select("id", count="exact")
        .eq("workspace_id", str(workspace_id))
        .gte("created_at", yesterday)
        .execute()
    )
    if recent_invites.count and recent_invites.count >= 20:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, 
            detail="Too many invites created in the last 24 hours"
        )
        
    # 3. Delete any pending invite for the same email (re-invitation logic)
    (
        db.table("workspace_invites")
        .delete()
        .eq("workspace_id", str(workspace_id))
        .eq("email", invite_req.email)
        .is_("accepted_at", "null")
        .execute()
    )
    
    # 4. Generate token and insert new invite
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    
    insert_res = db.table("workspace_invites").insert({
        "workspace_id": str(workspace_id),
        "email": invite_req.email,
        "role": invite_req.role,
        "token_hash": token_hash,
        "invited_by": str(user.id)
    }).execute()
    
    if not insert_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to create invite"
        )
        
    new_invite = insert_res.data[0]
    invite_id = new_invite["id"]
    expires_at = new_invite["expires_at"]
    
    # Fetch workspace name to use in the email
    ws_res = db.table("workspaces").select("name").eq("id", str(workspace_id)).execute()
    workspace_name = ws_res.data[0]["name"] if ws_res.data else "the workspace"
    
    # Fetch inviter name from profile, fallback to email handle
    inviter_res = db.table("profiles").select("display_name").eq("id", str(user.id)).execute()
    inviter_name = None
    if inviter_res.data:
        inviter_name = inviter_res.data[0].get("display_name")
    if not inviter_name:
        inviter_name = user.email.split("@")[0]
        
    invite_link = f"{settings.APP_URL.rstrip('/')}/invite/{raw_token}"
    
    # 5. Send email
    try:
        send_invite_email(
            to=invite_req.email,
            workspace_name=workspace_name,
            inviter_name=inviter_name,
            link=invite_link
        )
    except Exception as e:
        # If sending fails, delete the row and return 502
        db.table("workspace_invites").delete().eq("id", invite_id).execute()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, 
            detail="Failed to send invite email"
        )
        
    return InviteCreateResponse(
        id=invite_id,
        email=invite_req.email,
        role=new_invite["role"],
        expires_at=expires_at
    )
