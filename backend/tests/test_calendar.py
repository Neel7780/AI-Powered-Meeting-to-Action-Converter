"""Tests for Calendar Integration API and Service."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.deps import CurrentUser, get_current_user
from app.services.calendar import (
    decrypt_token,
    encrypt_token,
    generate_oauth_state,
    verify_oauth_state,
)
from main import app

client = TestClient(app)


def test_token_encryption_decryption():
    """Verify symmetric token encryption and decryption."""
    raw_token = "1//04example_google_refresh_token_xyz_12345"
    encrypted = encrypt_token(raw_token)
    assert encrypted != raw_token
    decrypted = decrypt_token(encrypted)
    assert decrypted == raw_token


def test_state_generation_and_tampering():
    """Verify tamper detection on OAuth state parameter."""
    user_id = uuid4()
    workspace_id = uuid4()

    state = generate_oauth_state(user_id, workspace_id)
    recovered_uid, recovered_wid = verify_oauth_state(state)
    assert recovered_uid == user_id
    assert recovered_wid == workspace_id

    # Tampered state should raise ValueError
    tampered_state = state[:-4] + "abcd"
    with pytest.raises(ValueError):
        verify_oauth_state(tampered_state)


def test_get_connect_url():
    """Verify GET /api/calendar/connect-url returns Google OAuth URL."""
    workspace_id = uuid4()
    user_id = uuid4()
    mock_user = CurrentUser(id=user_id, email="lead@example.com")

    app.dependency_overrides[get_current_user] = lambda: mock_user

    mock_db = MagicMock()
    # Mock require_role check in workspace_members
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
        MagicMock(data=[{"role": "organiser"}])
    )

    with (
        patch("app.core.deps.get_supabase_client", return_value=mock_db),
        patch.object(settings, "GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com"),
        patch.object(settings, "GOOGLE_REDIRECT_URI", "http://localhost:5173/calendar/callback"),
    ):
        response = client.get(f"/api/calendar/connect-url?workspace_id={workspace_id}")
        assert response.status_code == 200
        data = response.json()
        assert "auth_url" in data
        assert "accounts.google.com" in data["auth_url"]
        assert "test-client-id" in data["auth_url"]

    app.dependency_overrides.clear()


def test_get_status_disconnected():
    """Verify status is connected=False when no row exists."""
    workspace_id = uuid4()
    user_id = uuid4()
    mock_user = CurrentUser(id=user_id, email="member@example.com")

    app.dependency_overrides[get_current_user] = lambda: mock_user

    mock_db = MagicMock()
    # Mock require_role check
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
        MagicMock(data=[{"role": "member"}])
    )
    # Mock calendar_connections query returning empty
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value = (
        MagicMock(data=[])
    )

    with patch("app.api.calendar.get_supabase_client", return_value=mock_db), patch(
        "app.core.deps.get_supabase_client", return_value=mock_db
    ):
        response = client.get(f"/api/calendar/status?workspace_id={workspace_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["connected"] is False

    app.dependency_overrides.clear()


def test_disconnect_calendar():
    """Verify DELETE /api/calendar/disconnect removes connection."""
    workspace_id = uuid4()
    user_id = uuid4()
    mock_user = CurrentUser(id=user_id, email="admin@example.com")

    app.dependency_overrides[get_current_user] = lambda: mock_user

    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
        MagicMock(data=[{"role": "admin"}])
    )
    mock_db.table.return_value.delete.return_value.eq.return_value.eq.return_value.eq.return_value.execute.return_value = (
        MagicMock(data=[])
    )

    with patch("app.api.calendar.get_supabase_client", return_value=mock_db), patch(
        "app.core.deps.get_supabase_client", return_value=mock_db
    ):
        response = client.delete(f"/api/calendar/disconnect?workspace_id={workspace_id}")
        assert response.status_code == 200
        assert response.json()["success"] is True

    app.dependency_overrides.clear()
