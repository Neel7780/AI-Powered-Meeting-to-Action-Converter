"""Unit tests for BE-2 Keep-Alive Tick Endpoint."""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.core.config import settings
from main import app

client = TestClient(app)


class TestInternalTick:
    """Tests for POST /internal/tick security and operation."""

    def test_tick_without_header_returns_401(self):
        response = client.post("/internal/tick")
        assert response.status_code == 401
        assert "tick secret" in response.json()["detail"].lower()

    def test_tick_with_wrong_secret_returns_401(self):
        with patch.object(settings, "INTERNAL_TICK_SECRET", "super-secret-key-that-is-32-chars-long"):
            response = client.post(
                "/internal/tick",
                headers={"X-Tick-Secret": "wrong-secret-key"}
            )
            assert response.status_code == 401
            assert "invalid" in response.json()["detail"].lower()

    @patch("app.api.internal.process_all_meeting_notifications")
    @patch("app.api.internal.get_supabase_client")
    def test_tick_with_valid_secret_returns_200(self, mock_get_client, mock_process_notifs):
        secret = "my-test-secret-key-minimum-32-characters"
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_client.table("profiles").select().limit().execute.return_value.data = [{"id": "user-1"}]
        mock_process_notifs.return_value = {"pre_meeting_reminders_sent": 1, "post_meeting_nudges_sent": 0}

        with patch.object(settings, "INTERNAL_TICK_SECRET", secret):
            response = client.post(
                "/internal/tick",
                headers={"X-Tick-Secret": secret}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "active"
            assert data["tick"] == "ok"
            assert data["db"] == "connected"
            assert "notifications" in data
            assert data["notifications"]["pre_meeting_reminders_sent"] == 1
            assert "timestamp" in data

    @patch("app.api.internal.process_all_meeting_notifications")
    def test_process_reminders_endpoint(self, mock_process_notifs):
        secret = "my-test-secret-key-minimum-32-characters"
        mock_process_notifs.return_value = {"pre_meeting_reminders_sent": 2, "post_meeting_nudges_sent": 1}

        with patch.object(settings, "INTERNAL_TICK_SECRET", secret):
            response = client.post(
                "/internal/process-reminders",
                headers={"X-Tick-Secret": secret}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert data["processed"]["pre_meeting_reminders_sent"] == 2
            assert data["processed"]["post_meeting_nudges_sent"] == 1

    @patch("app.api.internal.process_all_meeting_notifications")
    @patch("app.api.internal.get_supabase_client")
    def test_tick_database_failure_returns_degraded_not_500(self, mock_get_client, mock_process_notifs):
        secret = "my-test-secret-key-minimum-32-characters"
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_client.table("profiles").select().limit().execute.side_effect = Exception("DB timeout")
        mock_process_notifs.return_value = {"pre_meeting_reminders_sent": 0, "post_meeting_nudges_sent": 0}

        with patch.object(settings, "INTERNAL_TICK_SECRET", secret):
            response = client.post(
                "/internal/tick",
                headers={"X-Tick-Secret": secret}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "active"
            assert data["db"] == "degraded"
