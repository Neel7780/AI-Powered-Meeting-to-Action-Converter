"""Pydantic schemas for Meetings API (BE-4)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CreateMeetingRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=300, description="Meeting title (1-300 characters)")
    starts_at: datetime = Field(..., description="Scheduled start time in ISO 8601 format")
    timezone: str = Field(default="Asia/Kolkata", description="IANA timezone name, e.g. Asia/Kolkata")
    participant_user_ids: list[UUID] = Field(
        default_factory=list, description="UUIDs of workspace members participating"
    )
    external_participants: list[str] = Field(default_factory=list, description="Names of external participants")
    ai_processing: bool = Field(default=True, description="Whether AI processing is requested")
    ai_attestation: bool = Field(
        default=False, description="Consent attestation required when AI processing is enabled"
    )
    visibility: str = Field(default="workspace", description="Meeting visibility: 'workspace' or 'private'")


class MeetingResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    title: str
    starts_at: datetime
    timezone: str
    organiser_id: UUID
    ai_processing: bool
    status: str
    visibility: str = "workspace"
    lifecycle: str = "active"
    created_at: datetime


class MeetingParticipantResponse(BaseModel):
    id: UUID
    user_id: UUID | None = None
    external_name: str | None = None
    display_name: str | None = None
    email: str | None = None


class MeetingDetailResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    title: str
    starts_at: datetime
    timezone: str
    organiser_id: UUID
    organiser_name: str | None = None
    ai_processing: bool
    status: str
    visibility: str = "workspace"
    lifecycle: str = "active"
    participants: list[MeetingParticipantResponse] = Field(default_factory=list)
    has_transcript: bool = False
    task_count: int = 0
    created_at: datetime


class TranscriptUploadResponse(BaseModel):
    transcript_id: UUID
    segment_count: int
    word_count: int


class ManualTaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=500, description="Task title (1-500 chars)")
    description: str | None = Field(None, description="Task description or meeting context")
    assignee_user_id: UUID | None = Field(None, description="UUID of primary workspace assignee")
    priority: str = Field(default="normal", description="Task priority: low, normal, high, urgent")
    deadline_utc: datetime | None = Field(None, description="Task deadline in UTC")
    source_excerpt: str | None = Field(
        default="Manual task assignment (No-AI mode)", 
        description="Source excerpt or context linking to discussion"
    )


class ManualTaskResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    meeting_id: UUID
    title: str
    description: str | None = None
    priority: str
    status: str
    deadline_utc: datetime | None = None
    source_excerpt: str
    created_by: UUID
    assignee_user_id: UUID | None = None
    assignee_name: str | None = None
    assignee_email: str | None = None
    created_at: datetime


class ExtractMeetingResponse(BaseModel):
    meeting_id: UUID
    ai_processing: bool
    status: str
    message: str

