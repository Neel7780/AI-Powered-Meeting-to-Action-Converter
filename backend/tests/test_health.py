"""Tests for Health & Diagnostics endpoint (BE-4)."""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health_check_healthy():
    mock_db = MagicMock()
    query_mock = mock_db.table.return_value.select.return_value.limit.return_value
    query_mock.execute.return_value = MagicMock(data=[{"id": "1"}])

    with patch("app.api.health.get_supabase_client", return_value=mock_db):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"


def test_health_check_unhealthy():
    mock_db = MagicMock()
    mock_db.table.side_effect = RuntimeError("Postgres connection timeout")

    with patch("app.api.health.get_supabase_client", return_value=mock_db):
        response = client.get("/health")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["database"] == "disconnected"
        assert "timeout" in data["detail"].lower()
