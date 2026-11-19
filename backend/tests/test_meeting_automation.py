"""Unimplemented providers must report unavailable and never simulate ingestion."""
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.deps import CurrentUser, get_current_user
from main import app


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=uuid4(), email="member@example.com")
    with patch("app.api.meeting_automation.require_role", return_value="member"):
        yield TestClient(app)
    app.dependency_overrides.pop(get_current_user, None)


def test_automation_status_is_unavailable(client):
    response = client.get(f"/api/meetings/automation/status?workspace_id={uuid4()}")
    assert response.status_code == 200
    data = response.json()
    assert data["auto_ingest_global"] is False
    assert {p["provider"] for p in data["providers"]} == {"zoom", "teams", "google_meet"}
    assert all(not p["connected"] and not p["auto_ingest_enabled"] and not p["capabilities"] for p in data["providers"])


@pytest.mark.parametrize("path,method", [("config","post"),("simulate","post"),("feed","get"),("webhook/zoom","post"),("webhook/teams","post")])
def test_simulation_and_fake_settings_routes_removed(client, path, method):
    response = getattr(client,method)(f"/api/meetings/automation/{path}")
    assert response.status_code in (404,405)
