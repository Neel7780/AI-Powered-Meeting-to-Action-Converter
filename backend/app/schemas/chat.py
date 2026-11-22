"""Pydantic schemas for Meeting Chatbot API."""

from uuid import UUID
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., description="Message author role: 'user' or 'assistant'")
    content: str = Field(..., min_length=1, description="Message text content")


class ChatRequest(BaseModel):
    workspace_id: UUID = Field(..., description="Target workspace ID")
    meeting_id: UUID | None = Field(default=None, description="Optional meeting ID to scope search")
    query: str = Field(..., min_length=1, max_length=2000, description="User question")
    history: list[ChatMessage] = Field(default_factory=list, description="Prior conversation turns in current session")
    session_id: UUID | None = Field(default=None, description="Optional chat session ID for persistent history")


class ChatCitation(BaseModel):
    source_type: str = Field(..., description="'meeting', 'transcript', 'decision', 'action', 'task'")
    meeting_id: str | None = Field(default=None, description="Referenced meeting UUID if applicable")
    meeting_title: str | None = Field(default=None, description="Title of the referenced meeting")
    task_id: str | None = Field(default=None, description="Referenced task UUID if applicable")
    task_title: str | None = Field(default=None, description="Title of the referenced task")
    task_status: str | None = Field(default=None, description="Status of the task (todo, in_progress, blocked, done)")
    speaker: str | None = Field(default=None, description="Speaker name from transcript if available")
    excerpt: str = Field(..., description="Verbatim quote or factual grounding text")


class ChatResponse(BaseModel):
    answer: str = Field(..., description="Assistant answer formatted in markdown")
    citations: list[ChatCitation] = Field(default_factory=list, description="Supporting citations and excerpts")
    suggested_followups: list[str] = Field(default_factory=list, description="Suggested follow-up questions")
    meeting_context_count: int = Field(default=0, description="Number of meetings included in context")
    session_id: UUID | None = Field(default=None, description="Active session ID if persisted")


class ChatSessionSummary(BaseModel):
    id: UUID
    workspace_id: UUID
    title: str
    selected_meeting_id: UUID | None = None
    created_at: str
    updated_at: str


class ChatMessageRecord(BaseModel):
    id: UUID
    session_id: UUID
    role: str
    content: str
    citations: list[ChatCitation] = Field(default_factory=list)
    suggested_followups: list[str] = Field(default_factory=list)
    created_at: str


class ChatSessionDetail(BaseModel):
    id: UUID
    workspace_id: UUID
    title: str
    selected_meeting_id: UUID | None = None
    created_at: str
    updated_at: str
    messages: list[ChatMessageRecord] = Field(default_factory=list)


class CreateSessionRequest(BaseModel):
    workspace_id: UUID
    title: str = "New Conversation"
    selected_meeting_id: UUID | None = None


class UpdateSessionRequest(BaseModel):
    title: str | None = None
    selected_meeting_id: UUID | None = None


# ==============================================================================
# Phase 1: Workspace Chat Channel & Membership Management Schemas
# ==============================================================================

class UpdateChannelRequest(BaseModel):
    name: str | None = Field(default=None, max_length=80, description="New channel name (slugified)")
    topic: str | None = Field(default=None, max_length=250, description="Channel topic")
    description: str | None = Field(default=None, max_length=1000, description="Channel description")
    is_private: bool | None = Field(default=None, description="Change channel privacy (public <-> private)")


class ChannelResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    type: str
    name: str
    topic: str | None = None
    description: str | None = None
    is_private: bool
    created_by: UUID | None = None
    created_at: str
    updated_at: str


class ChannelDiscoveryItem(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    topic: str | None = None
    description: str | None = None
    is_private: bool
    created_at: str
    created_by: UUID | None = None
    member_count: int = 0
    is_member: bool = False


class AddChannelMemberRequest(BaseModel):
    user_id: UUID = Field(..., description="Target workspace user ID to add to channel")


class ChannelMemberProfile(BaseModel):
    id: UUID
    display_name: str
    email: str
    avatar_url: str | None = None


class ChannelMemberItem(BaseModel):
    conversation_id: UUID
    user_id: UUID
    joined_at: str
    last_read_at: str
    is_creator: bool = False
    profile: ChannelMemberProfile

