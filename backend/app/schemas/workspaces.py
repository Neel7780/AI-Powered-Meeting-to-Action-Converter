from typing import Literal
from pydantic import BaseModel, EmailStr

class InviteCreateRequest(BaseModel):
    email: EmailStr
    role: Literal["member", "organiser"]

class InviteCreateResponse(BaseModel):
    id: str
    email: EmailStr
    role: str
    expires_at: str

class MemberRoleUpdateRequest(BaseModel):
    role: Literal["admin", "organiser", "member"]

class MemberRoleUpdateResponse(BaseModel):
    workspace_id: str
    user_id: str
    role: str
