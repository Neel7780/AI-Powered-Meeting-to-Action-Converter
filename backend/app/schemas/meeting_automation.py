"""Pydantic schemas for Online Meeting Automation API (Sprint 2 - Task 1).

Covers:
- Provider connection status (Google Meet, Zoom, Microsoft Teams)
- Auto-ingestion configuration & preferences
- Webhook payloads for meeting completion / transcript ready
- End-to-end simulation payloads for live testing & evaluation
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ProviderType(str, Enum):
    GOOGLE_MEET = "google_meet"
    ZOOM = "zoom"
    TEAMS = "teams"


class AutomationProviderStatus(BaseModel):
    provider: ProviderType
    name: str
    connected: bool
    account_email: Optional[str] = None
    auto_ingest_enabled: bool = True
    capabilities: List[str] = Field(default_factory=list)
    limitations: Optional[str] = None


class AutomationStatusResponse(BaseModel):
    workspace_id: UUID
    auto_ingest_global: bool = True
    providers: List[AutomationProviderStatus]
    total_automated_meetings: int = 0
    last_sync_at: Optional[datetime] = None


class AutomationConfigPayload(BaseModel):
    auto_ingest_global: Optional[bool] = Field(
        default=None, description="Master switch for automatic transcript ingestion"
    )
    enabled_providers: Optional[List[ProviderType]] = Field(
        default=None, description="List of providers enabled for auto-ingest"
    )
    auto_trigger_extraction: Optional[bool] = Field(
        default=True, description="Automatically trigger GenAI action item extraction upon ingestion"
    )
    default_visibility: Optional[str] = Field(
        default="workspace", description="Default meeting visibility ('workspace' or 'private')"
    )


class SimulateMeetingRequest(BaseModel):
    workspace_id: UUID = Field(..., description="Target workspace ID")
    provider: ProviderType = Field(default=ProviderType.ZOOM, description="Online meeting platform")
    title: str = Field(..., min_length=1, max_length=300, description="Meeting title")
    duration_minutes: int = Field(default=25, ge=1, le=480, description="Meeting duration in minutes")
    conference_url: Optional[str] = Field(default=None, description="Online meeting join URL")
    transcript_text: Optional[str] = Field(
        default=None, description="Custom transcript text (if omitted, realistic demo transcript is generated)"
    )
    auto_extract: bool = Field(default=True, description="Immediately trigger GenAI action item extraction")


class SimulateMeetingResponse(BaseModel):
    success: bool
    meeting_id: UUID
    title: str
    provider: ProviderType
    starts_at: datetime
    transcript_id: Optional[UUID] = None
    segment_count: int = 0
    extracted_items_count: int = 0
    message: str
    review_url: str


class ExtensionSegment(BaseModel):
    speaker: Optional[str] = Field(default="Speaker", description="Identified speaker from live captions")
    text: str = Field(..., description="Captured spoken text segment")
    timestamp: Optional[str] = Field(default=None, description="ISO timestamp or formatted time string")
    start_ms: Optional[int] = Field(default=None, description="Segment start in milliseconds")
    end_ms: Optional[int] = Field(default=None, description="Segment end in milliseconds")


class ExtensionMeetingUploadRequest(BaseModel):
    workspace_id: UUID = Field(..., description="Target workspace ID")
    provider: ProviderType = Field(default=ProviderType.GOOGLE_MEET, description="Online meeting platform (google_meet, zoom, teams)")
    title: str = Field(default="Automated Meeting Transcript", min_length=1, max_length=300, description="Meeting title")
    conference_url: Optional[str] = Field(default=None, description="Meeting URL (e.g. meet.google.com/xyz)")
    duration_minutes: int = Field(default=15, ge=1, le=480, description="Meeting duration in minutes")
    transcript_text: Optional[str] = Field(default=None, description="Formatted transcript text or WebVTT string")
    segments: Optional[List[ExtensionSegment]] = Field(default=None, description="Structured live caption segments")
    auto_extract: bool = Field(default=True, description="Trigger AI action item extraction for Manager Review Gate")


class ExtensionMeetingUploadResponse(BaseModel):
    success: bool
    meeting_id: UUID
    title: str
    provider: ProviderType
    starts_at: datetime
    transcript_id: Optional[UUID] = None
    segment_count: int = 0
    extracted_items_count: int = 0
    message: str
    review_url: str


class AutomatedMeetingFeedItem(BaseModel):
    id: UUID
    title: str
    provider: str
    starts_at: datetime
    timezone: str
    status: str
    conference_url: Optional[str] = None
    has_transcript: bool = False
    task_count: int = 0
    created_at: datetime
