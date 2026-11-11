"""Tests for Online Meeting Automation API (Sprint 2 - Task 1 & Extension Automation: Madhav Chauhan)."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.meeting_automation import (
    get_automation_feed,
    get_automation_status,
    simulate_online_meeting,
    teams_webhook_receiver,
    update_automation_config,
    upload_extension_meeting,
    zoom_webhook_receiver,
)
from app.core.deps import CurrentUser
from app.schemas.meeting_automation import (
    AutomationConfigPayload,
    ExtensionMeetingUploadRequest,
    ExtensionSegment,
    ProviderType,
    SimulateMeetingRequest,
)


@pytest.fixture
def mock_auth_user():
    return CurrentUser(id=uuid4(), email="madhav@actionpulse.io")


def test_get_automation_status(mock_auth_user):
    """Verify get_automation_status returns provider connections and stats."""
    workspace_id = uuid4()
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        {"role": "organiser"}
    ]

    with patch("app.api.meeting_automation.get_supabase_client", return_value=mock_db), \
         patch("app.core.deps.get_supabase_client", return_value=mock_db):
        res = get_automation_status(workspace_id=workspace_id, user=mock_auth_user)
        assert res.auto_ingest_global is True
        assert len(res.providers) == 3
        providers = {p.provider: p for p in res.providers}
        assert ProviderType.GOOGLE_MEET in providers
        assert ProviderType.ZOOM in providers
        assert ProviderType.TEAMS in providers


def test_update_automation_config(mock_auth_user):
    """Verify update_automation_config updates preferences."""
    workspace_id = uuid4()
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        {"role": "admin"}
    ]

    payload = AutomationConfigPayload(
        auto_ingest_global=True,
        enabled_providers=[ProviderType.ZOOM, ProviderType.GOOGLE_MEET],
        auto_trigger_extraction=True,
        default_visibility="workspace",
    )

    with patch("app.core.deps.get_supabase_client", return_value=mock_db):
        res = update_automation_config(workspace_id=workspace_id, payload=payload, user=mock_auth_user)
        assert res["status"] == "success"
        assert res["config"]["auto_ingest_global"] is True


def test_simulate_online_meeting(mock_auth_user):
    """Verify simulate_online_meeting creates meeting, transcript, and extracted tasks."""
    workspace_id = uuid4()
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        {"role": "organiser"}
    ]
    mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[])
    mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    payload = SimulateMeetingRequest(
        workspace_id=workspace_id,
        provider=ProviderType.ZOOM,
        title="Automated Zoom Architecture Review",
        duration_minutes=30,
        auto_extract=True,
    )

    with patch("app.api.meeting_automation.get_supabase_client", return_value=mock_db), \
         patch("app.core.deps.get_supabase_client", return_value=mock_db):
        res = simulate_online_meeting(payload=payload, user=mock_auth_user)
        assert res.success is True
        assert res.title == "Automated Zoom Architecture Review"
        assert res.provider == ProviderType.ZOOM
        assert res.segment_count > 0
        assert res.extracted_items_count > 0
        assert "review" in res.review_url


def test_extension_upload_meeting_success(mock_auth_user):
    """Verify upload_extension_meeting ingests captions and generates tasks for Manager Review Gate."""
    workspace_id = uuid4()
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        {"role": "organiser"}
    ]
    mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[])
    mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    payload = ExtensionMeetingUploadRequest(
        workspace_id=workspace_id,
        provider=ProviderType.GOOGLE_MEET,
        title="Client Requirements Sync",
        conference_url="https://meet.google.com/abc-defg-hij",
        duration_minutes=20,
        segments=[
            ExtensionSegment(
                speaker="Neel Khatri",
                text="Welcome to the client requirements sync.",
                start_ms=0,
                end_ms=4000,
            ),
            ExtensionSegment(
                speaker="Madhav Chauhan",
                text="I will finalize the browser extension and push the updates before Friday.",
                start_ms=4500,
                end_ms=9000,
            ),
            ExtensionSegment(
                speaker="Bharat Odedara",
                text="I will prepare the UI review page and test dark theme integration.",
                start_ms=9500,
                end_ms=14000,
            ),
        ],
        auto_extract=True,
    )

    with patch("app.api.meeting_automation.get_supabase_client", return_value=mock_db), \
         patch("app.core.deps.get_supabase_client", return_value=mock_db):
        res = upload_extension_meeting(payload=payload, user=mock_auth_user)
        assert res.success is True
        assert res.title == "Client Requirements Sync"
        assert res.provider == ProviderType.GOOGLE_MEET
        assert res.segment_count == 3
        assert res.extracted_items_count >= 1
        assert "review" in res.review_url


def test_extension_upload_meeting_forbidden_for_non_manager(mock_auth_user):
    """Verify non-manager/non-organiser roles cannot upload transcripts via extension."""
    workspace_id = uuid4()
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        {"role": "member"}
    ]

    payload = ExtensionMeetingUploadRequest(
        workspace_id=workspace_id,
        provider=ProviderType.TEAMS,
        title="Unauthorized Upload Attempt",
        transcript_text="Speaker: Unauthorized text",
    )

    with patch("app.api.meeting_automation.get_supabase_client", return_value=mock_db), \
         patch("app.core.deps.get_supabase_client", return_value=mock_db):
        with pytest.raises(HTTPException) as exc_info:
            upload_extension_meeting(payload=payload, user=mock_auth_user)
        assert exc_info.value.status_code == 403


def test_zoom_webhook_url_validation():
    """Verify Zoom webhook responds to url_validation challenge."""
    import asyncio
    mock_request = AsyncMock()
    mock_request.body = AsyncMock(
        return_value=b'{"event": "endpoint.url_validation", "payload": {"plainToken": "sample_plain_token_123"}}'
    )
    mock_request.json = AsyncMock(
        return_value={"event": "endpoint.url_validation", "payload": {"plainToken": "sample_plain_token_123"}}
    )

    res = asyncio.run(zoom_webhook_receiver(request=mock_request))
    assert res["plainToken"] == "sample_plain_token_123"
    assert "encryptedToken" in res


def test_teams_webhook_validation_handshake():
    """Verify Microsoft Teams webhook lifecycle notification validation token handshake."""
    import asyncio
    mock_request = AsyncMock()
    res = asyncio.run(teams_webhook_receiver(request=mock_request, validationToken="test_validation_token_xyz"))
    assert res.body.decode() == "test_validation_token_xyz"


def test_get_automation_feed(mock_auth_user):
    """Verify get_automation_feed returns auto-ingested meetings."""
    workspace_id = uuid4()
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
        {"role": "member"}
    ]
    mock_meeting_row = {
        "id": str(uuid4()),
        "title": "Weekly Sprint Zoom Review",
        "starts_at": "2026-10-31T10:00:00Z",
        "timezone": "Asia/Kolkata",
        "status": "completed",
        "conference_url": "https://zoom.us/j/1234567890",
        "calendar_provider": "zoom",
        "created_at": "2026-10-31T10:30:00Z",
    }
    mock_db.table.return_value.select.return_value.eq.return_value.not_.is_.return_value.order.return_value.limit.return_value.execute.return_value.data = [
        mock_meeting_row
    ]

    with patch("app.api.meeting_automation.get_supabase_client", return_value=mock_db), \
         patch("app.core.deps.get_supabase_client", return_value=mock_db):
        res = get_automation_feed(workspace_id=workspace_id, user=mock_auth_user)
        assert len(res) >= 1
        assert res[0].provider == "zoom"
