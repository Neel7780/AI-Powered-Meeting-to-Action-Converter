"""Tests for Online Meeting Automation API (Sprint 2 - Task 1: Madhav Chauhan)."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.deps import CurrentUser, get_current_user
from app.schemas.meeting_automation import ProviderType
from main import app

client = TestClient(app)


@pytest.fixture
def mock_auth_user():
    user_id = uuid4()
    mock_user = CurrentUser(id=user_id, email="madhav@actionpulse.io")
    app.dependency_overrides[get_current_user] = lambda: mock_user
    yield mock_user
    app.dependency_overrides.pop(get_current_user, None)


def test_get_automation_status(mock_auth_user):
    """Verify GET /api/meetings/automation/status returns provider connections and stats."""
    workspace_id = uuid4()

    mock_db = MagicMock()
    # Mock require_role in workspace_members
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
        MagicMock(data=[{"role": "organiser"}])
    )

    with patch("app.api.meeting_automation.get_supabase_client", return_value=mock_db), \
         patch("app.core.deps.get_supabase_client", return_value=mock_db):
        resp = client.get(f"/api/meetings/automation/status?workspace_id={workspace_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["auto_ingest_global"] is True
        assert len(data["providers"]) == 3
        providers = {p["provider"]: p for p in data["providers"]}
        assert "google_meet" in providers
        assert "zoom" in providers
        assert "teams" in providers


def test_update_automation_config(mock_auth_user):
    """Verify POST /api/meetings/automation/config updates preferences."""
    workspace_id = uuid4()
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
        MagicMock(data=[{"role": "admin"}])
    )

    payload = {
        "auto_ingest_global": True,
        "enabled_providers": ["zoom", "google_meet"],
        "auto_trigger_extraction": True,
        "default_visibility": "workspace",
    }

    with patch("app.core.deps.get_supabase_client", return_value=mock_db):
        resp = client.post(
            f"/api/meetings/automation/config?workspace_id={workspace_id}",
            json=payload,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["config"]["auto_ingest_global"] is True


def test_simulate_online_meeting(mock_auth_user):
    """Verify POST /api/meetings/automation/simulate creates meeting, transcript, and extracted tasks."""
    workspace_id = uuid4()
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
        MagicMock(data=[{"role": "organiser"}])
    )
    mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[])
    mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    payload = {
        "workspace_id": str(workspace_id),
        "provider": "zoom",
        "title": "Automated Zoom Architecture Review",
        "duration_minutes": 30,
        "auto_extract": True,
    }

    with patch("app.api.meeting_automation.get_supabase_client", return_value=mock_db), \
         patch("app.core.deps.get_supabase_client", return_value=mock_db):
        resp = client.post("/api/meetings/automation/simulate", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["success"] is True
        assert data["title"] == "Automated Zoom Architecture Review"
        assert data["provider"] == "zoom"
        assert data["segment_count"] > 0
        assert data["extracted_items_count"] > 0
        assert "review" in data["review_url"]


def test_zoom_webhook_url_validation():
    """Verify Zoom webhook responds to url_validation challenge."""
    challenge_payload = {
        "event": "endpoint.url_validation",
        "payload": {
            "plainToken": "sample_plain_token_123"
        }
    }
    resp = client.post("/api/meetings/automation/webhook/zoom", json=challenge_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["plainToken"] == "sample_plain_token_123"
    assert "encryptedToken" in data


def test_teams_webhook_validation_handshake():
    """Verify Microsoft Teams webhook lifecycle notification validation token handshake."""
    resp = client.post("/api/meetings/automation/webhook/teams?validationToken=test_validation_token_xyz")
    assert resp.status_code == 200
    assert resp.text == "test_validation_token_xyz"


def test_get_automation_feed(mock_auth_user):
    """Verify GET /api/meetings/automation/feed returns auto-ingested meetings."""
    workspace_id = uuid4()
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
        MagicMock(data=[{"role": "member"}])
    )
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
    mock_db.table.return_value.select.return_value.eq.return_value.not_.is_.return_value.order.return_value.limit.return_value.execute.return_value = (
        MagicMock(data=[mock_meeting_row])
    )

    with patch("app.api.meeting_automation.get_supabase_client", return_value=mock_db), \
         patch("app.core.deps.get_supabase_client", return_value=mock_db):
        resp = client.get(f"/api/meetings/automation/feed?workspace_id={workspace_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["provider"] == "zoom"
