"""Unit tests for ActionPulse Authentication helper endpoints."""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


class TestForgotPasswordEndpoint:
    """Tests for POST /api/auth/forgot-password."""

    @patch("app.api.auth.send_email")
    @patch("app.api.auth.get_supabase_client")
    def test_forgot_password_success(self, mock_get_supabase, mock_send_email):
        # Mock Supabase generate_link response
        mock_client = MagicMock()
        mock_link_res = MagicMock()
        mock_link_res.properties.email_otp = "482910"
        mock_link_res.properties.action_link = "http://localhost:5173/reset-password#access_token=test"
        mock_client.auth.admin.generate_link.return_value = mock_link_res
        mock_get_supabase.return_value = mock_client

        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "user@example.com", "redirect_to": "http://localhost:5173/reset-password"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["code_length"] == 6
        assert "user@example.com" in data["message"]

        # Verify send_email was called with the OTP code
        mock_send_email.assert_called_once()
        call_kwargs = mock_send_email.call_args.kwargs
        assert call_kwargs["to"] == "user@example.com"
        assert "482910" in call_kwargs["html"]
        assert "482910" in call_kwargs["text"]
        assert "http://localhost:5173/reset-password#access_token=test" in call_kwargs["html"]

    @patch("app.api.auth.send_email")
    @patch("app.api.auth.get_supabase_client")
    def test_forgot_password_handles_supabase_error_gracefully(self, mock_get_supabase, mock_send_email):
        mock_client = MagicMock()
        mock_client.auth.admin.generate_link.side_effect = Exception("User not found")
        mock_get_supabase.return_value = mock_client

        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "nonexistent@example.com"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        # Should not crash and not reveal whether user exists
        mock_send_email.assert_not_called()

    def test_forgot_password_invalid_email(self):
        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "not-an-email"},
        )
        assert response.status_code == 422
