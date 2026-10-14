"""The deployed frontend must pass CORS preflight against the API."""

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_deployed_frontend_passes_cors_preflight():
    origin = "https://ai-powered-meeting-to-action-conver.vercel.app"
    response = client.options(
        "/api/meetings/x/approve",
        headers={"Origin": origin, "Access-Control-Request-Method": "POST"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


def test_unknown_origin_is_rejected():
    response = client.options(
        "/api/meetings/x/approve",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in response.headers
