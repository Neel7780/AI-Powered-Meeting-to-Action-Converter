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
