"""Capability reporting for transcript ingestion providers that are not implemented."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.deps import CurrentUser, get_current_user, require_role
from app.schemas.meeting_automation import AutomationProviderStatus, AutomationStatusResponse, ProviderType

router = APIRouter()


@router.get('/meetings/automation/status', response_model=AutomationStatusResponse)
def get_automation_status(workspace_id: UUID = Query(...), user: CurrentUser = Depends(get_current_user)):
    require_role(workspace_id, {'admin', 'organiser', 'member'}, user)
    return AutomationStatusResponse(
        workspace_id=workspace_id,
        auto_ingest_global=False,
        providers=[AutomationProviderStatus(
            provider=provider, name=name, connected=False, auto_ingest_enabled=False,
            capabilities=[], limitations='Automatic transcript ingestion is not available. Upload a transcript instead.'
        ) for provider, name in [(ProviderType.GOOGLE_MEET, 'Google Meet'),
                                  (ProviderType.ZOOM, 'Zoom'), (ProviderType.TEAMS, 'Microsoft Teams')]],
    )
