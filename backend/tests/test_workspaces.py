import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from uuid import uuid4
from fastapi import HTTPException

# Assuming main.py exposes `app`
try:
    from main import app
except ImportError:
    # If main is in app.main
    from app.main import app

from app.core.deps import get_current_user, CurrentUser
from app.core.config import settings

client = TestClient(app)

def mock_get_current_user():
    return CurrentUser(id=uuid4(), email="admin@example.com")

def test_create_invite_non_admin_gets_403():
    app.dependency_overrides[get_current_user] = mock_get_current_user
    
    with patch("app.api.workspaces.require_role") as mock_req_role:
        mock_req_role.side_effect = HTTPException(status_code=403, detail="Insufficient permissions")
        
        ws_id = str(uuid4())
        response = client.post(f"/api/workspaces/{ws_id}/invites", json={
            "email": "test@example.com",
            "role": "member"
        })
        
        assert response.status_code == 403
        
    app.dependency_overrides.clear()

def test_create_invite_success():
    app.dependency_overrides[get_current_user] = mock_get_current_user
    
    with patch("app.api.workspaces.require_role") as mock_req_role, \
         patch("app.api.workspaces.get_supabase_client") as mock_get_db, \
         patch("app.api.workspaces.send_invite_email") as mock_send_email:
        
        # Setup mock db
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        
        # User not in profile
        mock_db.table().select().eq().execute.return_value = MagicMock(data=[])
        
        # Rate limit count < 20
        mock_db.table().select().eq().gte().execute.return_value = MagicMock(count=0)
        
        # Insert success
        mock_db.table().insert().execute.return_value = MagicMock(data=[{
            "id": str(uuid4()),
            "role": "member",
            "expires_at": "2026-10-10T00:00:00Z"
        }])
        
        ws_id = str(uuid4())
        # Test with uppercase and extra space to verify normalization
        response = client.post(f"/api/workspaces/{ws_id}/invites", json={
            "email": "NewUser@example.com",
            "role": "member"
        })
        
        assert response.status_code == 201
        assert response.json()["email"] == "newuser@example.com"
        assert "id" in response.json()
        assert "token" not in response.json()  # Token must never be returned!
        
        mock_send_email.assert_called_once()
        
    app.dependency_overrides.clear()


@pytest.mark.parametrize("environment, cleanup_fails", [
    ("development", False), ("production", False), ("development", True),
])
def test_email_failure_returns_502_without_leaking_invite_token(environment, cleanup_fails, monkeypatch, caplog):
    """A rejected email must not crash, claim success, or put the invite link in logs."""
    monkeypatch.setattr(settings, "ENVIRONMENT", environment)
    invite_id = str(uuid4())
    token = "private-invite-token-for-regression-test"
    db = MagicMock()
    invites = MagicMock()
    for method in ("select", "eq", "gte", "is_", "delete", "insert"):
        getattr(invites, method).return_value = invites
    invites.execute.side_effect = [
        MagicMock(data=[], count=0),  # rate limit
        MagicMock(data=[]),  # remove an earlier pending invitation
        MagicMock(data=[{"id": invite_id, "role": "member", "expires_at": "2026-11-10T00:00:00Z"}]),
        RuntimeError("cleanup unavailable") if cleanup_fails else MagicMock(data=[]),
    ]
    other = MagicMock()
    for method in ("select", "eq"):
        getattr(other, method).return_value = other
    other.execute.return_value = MagicMock(data=[])
    db.table.side_effect = lambda name: invites if name == "workspace_invites" else other

    app.dependency_overrides[get_current_user] = mock_get_current_user
    try:
        with patch("app.api.workspaces.require_role"), \
             patch("app.api.workspaces.get_supabase_client", return_value=db), \
             patch("app.api.workspaces.secrets.token_urlsafe", return_value=token), \
             patch("app.api.workspaces.send_invite_email", side_effect=RuntimeError(f"provider rejected {token}")):
            response = client.post(f"/api/workspaces/{uuid4()}/invites", json={
                "email": "invitee@example.com", "role": "member",
            })
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 502
    assert "could not be delivered" in response.json()["detail"]
    assert token not in response.text and token not in caplog.text
    assert "NameError" not in caplog.text
    invites.eq.assert_any_call("id", invite_id)
    assert invites.delete.call_count == 2
