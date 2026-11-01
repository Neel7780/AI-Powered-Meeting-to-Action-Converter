"""Schemas for Meeting Follow-Up Drafting and Multi-Channel Dispatch."""

from enum import Enum
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class FollowUpTone(str, Enum):
    """Available tone presets for follow-up generation."""
    EXECUTIVE = "executive"
    ACTION_FOCUSED = "action_focused"
    CHAT = "chat"


class FollowUpParticipant(BaseModel):
    """Participant metadata for recipient selection."""
    user_id: Optional[UUID | str] = None
    name: str
    email: Optional[str] = None
    is_organiser: bool = False
    task_count: int = 0


class DraftFollowUpRequest(BaseModel):
    """Request payload to generate a follow-up draft."""
    target_user_id: Optional[UUID | str] = Field(
        default=None,
        description="Target user ID for personalized 1-to-1 follow-up; None for team-wide recap"
    )
    target_name: Optional[str] = Field(
        default=None,
        description="Optional display name override for the targeted member"
    )
    tone: FollowUpTone = Field(
        default=FollowUpTone.EXECUTIVE,
        description="Tone preset: 'executive' (concise brief), 'action_focused' (task table), or 'chat' (Slack/WhatsApp style)"
    )


class DraftFollowUpResponse(BaseModel):
    """Response containing generated follow-up content and dispatch previews."""
    meeting_id: UUID | str
    meeting_title: str
    target_user_id: Optional[UUID | str] = None
    target_name: Optional[str] = None
    tone: FollowUpTone
    subject: str
    content_markdown: str
    content_html: str
    whatsapp_share_url: str
    recipient_emails: List[str] = Field(default_factory=list)
    participants: List[FollowUpParticipant] = Field(default_factory=list)


class SendFollowUpRequest(BaseModel):
    """Request payload to dispatch a finalized follow-up via email."""
    recipient_emails: List[str] = Field(
        ...,
        min_length=1,
        description="List of recipient email addresses"
    )
    subject: str = Field(..., min_length=1)
    content_markdown: str = Field(..., min_length=1)
    content_html: Optional[str] = Field(
        default=None,
        description="Optional pre-rendered HTML body; if omitted, markdown will be converted"
    )


class SendFollowUpResponse(BaseModel):
    """Response acknowledging email dispatch."""
    success: bool
    recipients_count: int
    message: str
    failed_recipients: List[str] = Field(default_factory=list)
