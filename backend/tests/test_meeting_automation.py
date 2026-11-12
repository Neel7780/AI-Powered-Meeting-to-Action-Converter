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


def _make_table_db(table_map: dict):
    """Create a table-routing MagicMock Supabase client."""
    mock_db = MagicMock()

    def _table(name: str):
        tbl = MagicMock()
        entry = table_map.get(name, [])

        def _make_chain(res):
            q = MagicMock()
            q.execute.return_value = res
            q.not_ = q
            for m in ("select", "eq", "in_", "is_", "order", "limit", "insert", "update", "delete"):
                getattr(q, m).return_value = q
            return q

        if isinstance(entry, dict):
            select_res = entry.get("select", MagicMock(data=[], count=0))
            insert_res = entry.get("insert", MagicMock(data=[]))
            update_res = entry.get("update", MagicMock(data=[]))
            delete_res = entry.get("delete", MagicMock(data=[]))
        else:
            select_res = MagicMock(data=entry, count=len(entry) if isinstance(entry, list) else 0)
            insert_res = MagicMock(data=[])
            update_res = MagicMock(data=[])
            delete_res = MagicMock(data=[])

        tbl.select.return_value = _make_chain(select_res)
        tbl.insert.return_value = _make_chain(insert_res)
        tbl.update.return_value = _make_chain(update_res)
        tbl.delete.return_value = _make_chain(delete_res)
        return tbl

    mock_db.table.side_effect = _table
    return mock_db


def test_get_automation_status(mock_auth_user):
    """Verify get_automation_status returns real provider connections and stats."""
    workspace_id = uuid4()
    mock_db = _make_table_db({
        "workspace_members": [{"role": "organiser"}],
        "calendar_connections": [{"provider": "google", "account_email": "org@example.com"}],
        "meetings": {"select": MagicMock(data=[{"id": "m1"}], count=3)},
    })

    with patch("app.api.meeting_automation.get_supabase_client", return_value=mock_db), \
         patch("app.core.deps.get_supabase_client", return_value=mock_db):
        res = get_automation_status(workspace_id=workspace_id, user=mock_auth_user)
        assert res.auto_ingest_global is True
        assert res.total_automated_meetings == 3
        assert len(res.providers) == 3
        providers = {p.provider: p for p in res.providers}
        assert providers[ProviderType.GOOGLE_MEET].connected is True
        assert providers[ProviderType.GOOGLE_MEET].account_email == "org@example.com"
        assert providers[ProviderType.ZOOM].connected is False
        assert providers[ProviderType.TEAMS].connected is False


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
    """Verify simulate_online_meeting creates meeting, transcript, and invokes real LLM extraction."""
    workspace_id = uuid4()
    mock_db = _make_table_db({
        "workspace_members": [{"role": "organiser"}],
        "meetings": {"select": MagicMock(data=[{"status": "ready"}])},
        "extracted_items": {"select": MagicMock(data=[{"id": "i1"}, {"id": "i2"}], count=2)},
    })

    payload = SimulateMeetingRequest(
        workspace_id=workspace_id,
        provider=ProviderType.ZOOM,
        title="Automated Zoom Architecture Review",
        duration_minutes=30,
        auto_extract=True,
    )

    with patch("app.api.meeting_automation.get_supabase_client", return_value=mock_db), \
         patch("app.core.deps.get_supabase_client", return_value=mock_db), \
         patch("app.api.meeting_automation.llm_is_configured", return_value=True), \
         patch("app.api.meeting_automation.run_extraction") as mock_run:
        res = simulate_online_meeting(payload=payload, user=mock_auth_user)
        assert res.success is True
        assert res.title == "Automated Zoom Architecture Review"
        assert res.provider == ProviderType.ZOOM
        assert res.segment_count > 0
        assert res.extracted_items_count == 2
        assert "review" in res.review_url
        assert mock_run.call_count == 1


def test_simulate_meeting_returns_503_when_llm_unconfigured(mock_auth_user):
    """Verify simulate_online_meeting fails fast with 503 when LLM is unconfigured."""
    workspace_id = uuid4()
    mock_db = _make_table_db({"workspace_members": [{"role": "organiser"}]})

    payload = SimulateMeetingRequest(
        workspace_id=workspace_id,
        provider=ProviderType.ZOOM,
        title="Unconfigured LLM Test",
        duration_minutes=15,
        auto_extract=True,
    )

    with patch("app.api.meeting_automation.get_supabase_client", return_value=mock_db), \
         patch("app.core.deps.get_supabase_client", return_value=mock_db), \
         patch("app.api.meeting_automation.llm_is_configured", return_value=False):
        with pytest.raises(HTTPException) as exc_info:
            simulate_online_meeting(payload=payload, user=mock_auth_user)
        assert exc_info.value.status_code == 503


def test_extension_upload_meeting_success(mock_auth_user):
    """Verify upload_extension_meeting ingests captions and invokes real LLM extraction."""
    workspace_id = uuid4()
    mock_db = _make_table_db({
        "workspace_members": [{"role": "organiser"}],
        "profiles": [{"display_name": "Madhav Chauhan"}],
        "meetings": {"select": MagicMock(data=[{"status": "ready"}])},
        "extracted_items": {"select": MagicMock(data=[{"id": "i1"}], count=1)},
    })

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
                speaker="You",
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
         patch("app.core.deps.get_supabase_client", return_value=mock_db), \
         patch("app.api.meeting_automation.llm_is_configured", return_value=True), \
         patch("app.api.meeting_automation.run_extraction") as mock_run:
        res = upload_extension_meeting(payload=payload, user=mock_auth_user)
        assert res.success is True
        assert res.title == "Client Requirements Sync"
        assert res.provider == ProviderType.GOOGLE_MEET
        assert res.segment_count == 3
        assert res.extracted_items_count == 1
        assert "review" in res.review_url
        assert mock_run.call_count == 1


def test_extension_upload_empty_transcript_returns_422(mock_auth_user):
    """Verify upload_extension_meeting rejects empty transcripts instead of inserting fake cues."""
    workspace_id = uuid4()
    mock_db = _make_table_db({"workspace_members": [{"role": "organiser"}]})

    payload = ExtensionMeetingUploadRequest(
        workspace_id=workspace_id,
        provider=ProviderType.GOOGLE_MEET,
        title="Empty Capture",
        duration_minutes=10,
        transcript_text="",
        segments=[],
        auto_extract=True,
    )

    with patch("app.api.meeting_automation.get_supabase_client", return_value=mock_db), \
         patch("app.core.deps.get_supabase_client", return_value=mock_db):
        with pytest.raises(HTTPException) as exc_info:
            upload_extension_meeting(payload=payload, user=mock_auth_user)
        assert exc_info.value.status_code == 422


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


@pytest.mark.anyio
async def test_zoom_webhook_url_validation():
    """Verify Zoom webhook responds to url_validation challenge."""
    mock_request = AsyncMock()
    mock_request.body = AsyncMock(
        return_value=b'{"event": "endpoint.url_validation", "payload": {"plainToken": "sample_plain_token_123"}}'
    )
    mock_request.json = AsyncMock(
        return_value={"event": "endpoint.url_validation", "payload": {"plainToken": "sample_plain_token_123"}}
    )

    res = await zoom_webhook_receiver(request=mock_request)
    assert res["plainToken"] == "sample_plain_token_123"
    assert "encryptedToken" in res


@pytest.mark.anyio
async def test_teams_webhook_validation_handshake():
    """Verify Microsoft Teams webhook lifecycle notification validation token handshake."""
    mock_request = AsyncMock()
    res = await teams_webhook_receiver(request=mock_request, validationToken="test_validation_token_xyz")
    assert res.body.decode() == "test_validation_token_xyz"


def test_get_automation_feed(mock_auth_user):
    """Verify get_automation_feed returns real transcript and extracted_items counts."""
    workspace_id = uuid4()
    meeting_id = str(uuid4())
    mock_meeting_row = {
        "id": meeting_id,
        "title": "Weekly Sprint Zoom Review",
        "starts_at": "2026-10-31T10:00:00Z",
        "timezone": "Asia/Kolkata",
        "status": "ready",
        "conference_url": "https://zoom.us/j/1234567890",
        "calendar_provider": "zoom",
        "created_at": "2026-10-31T10:30:00Z",
    }
    mock_db = _make_table_db({
        "workspace_members": [{"role": "member"}],
        "meetings": [mock_meeting_row],
        "transcripts": [{"meeting_id": meeting_id}],
        "extracted_items": [{"meeting_id": meeting_id}, {"meeting_id": meeting_id}],
    })

    with patch("app.api.meeting_automation.get_supabase_client", return_value=mock_db), \
         patch("app.core.deps.get_supabase_client", return_value=mock_db):
        res = get_automation_feed(workspace_id=workspace_id, user=mock_auth_user)
        assert len(res) == 1
        assert res[0].provider == "zoom"
        assert res[0].has_transcript is True
        assert res[0].task_count == 2
