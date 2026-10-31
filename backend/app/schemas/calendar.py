"""Pydantic schemas for Calendar Integration API."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CalendarConnectUrlResponse(BaseModel):
    """Response containing the OAuth 2.0 authorization URL."""
    auth_url: str


class CalendarCallbackRequest(BaseModel):
    """Request payload sent when exchanging an OAuth code for tokens."""
    code: str
    state: str
    redirect_uri: Optional[str] = None


class CalendarConnectionStatus(BaseModel):
    """Current calendar connection status for a user in a workspace."""
    connected: bool
    provider: Optional[str] = None
    account_email: Optional[str] = None
    last_synced_at: Optional[datetime] = None


class CalendarAttendee(BaseModel):
    """Meeting attendee extracted from calendar event."""
    email: str
    name: Optional[str] = None
    matched_user_id: Optional[UUID] = None
    is_workspace_member: bool = False


class CalendarEventItem(BaseModel):
    """Normalized calendar event representation."""
    id: str
    title: str
    description: Optional[str] = None
    starts_at: datetime
    ends_at: Optional[datetime] = None
    timezone: str = "Asia/Kolkata"
    conference_url: Optional[str] = None
    attendees: list[CalendarAttendee] = Field(default_factory=list)
    already_imported: bool = False
    existing_meeting_id: Optional[UUID] = None


class CalendarEventsResponse(BaseModel):
    """List of upcoming calendar events."""
    events: list[CalendarEventItem]
    synced_at: datetime
