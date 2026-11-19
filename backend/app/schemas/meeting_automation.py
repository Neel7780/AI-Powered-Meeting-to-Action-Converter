"""Read-only capability status for online transcript ingestion."""
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class ProviderType(str, Enum):
    GOOGLE_MEET = 'google_meet'
    ZOOM = 'zoom'
    TEAMS = 'teams'


class AutomationProviderStatus(BaseModel):
    provider: ProviderType
    name: str
    connected: bool = False
    account_email: str | None = None
    auto_ingest_enabled: bool = False
    capabilities: list[str] = Field(default_factory=list)
    limitations: str | None = None


class AutomationStatusResponse(BaseModel):
    workspace_id: UUID
    auto_ingest_global: bool = False
    providers: list[AutomationProviderStatus]
    total_automated_meetings: int = 0
    last_sync_at: str | None = None
