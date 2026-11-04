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
