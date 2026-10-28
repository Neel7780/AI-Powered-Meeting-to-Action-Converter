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
