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


class TranscriptUploadResponse(BaseModel):
    transcript_id: UUID
    segment_count: int
    word_count: int
