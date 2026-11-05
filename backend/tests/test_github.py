"""GitHub trust boundaries; database transactions have separate PostgreSQL regression checks."""

import asyncio
import hashlib
import hmac
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from urllib.parse import parse_qs, urlparse
from uuid import UUID

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api import github as api
from app.core.config import settings
from app.core.deps import DEV_USER_ID, CurrentUser, get_current_user
from app.services import github
from main import app

USER = UUID("10000000-0000-0000-0000-000000000001")
WORKSPACE = UUID("20000000-0000-0000-0000-000000000001")
BASE = f"/api/workspaces/{WORKSPACE}/github"
STATE = "s" * 43


@pytest.fixture
def environment(monkeypatch):
    for name, value in {
        "GITHUB_APP_ID": "99", "GITHUB_APP_SLUG": "test-app", "GITHUB_CLIENT_ID": "client-id",
        "GITHUB_CLIENT_SECRET": "test-secret", "GITHUB_PRIVATE_KEY": "test-private-key",
        "GITHUB_WEBHOOK_SECRET": "test-webhook-secret", "GITHUB_REDIRECT_URI": "https://example.test/github/callback",
    }.items():
        monkeypatch.setattr(settings, name, value)
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=USER, email="admin@example.test")
    monkeypatch.setattr(api, "require_role", lambda *_: "admin")
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_app_jwt_uses_rsa_and_short_expiry(environment, monkeypatch):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setattr(settings, "GITHUB_PRIVATE_KEY", key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption(),
    ).decode())
    token = github.app_jwt()
    claims = jwt.decode(token, key.public_key(), algorithms=["RS256"])
    assert claims["exp"] - claims["iat"] == 600
    assert claims["iss"] == "client-id"


def test_install_state_is_random_hashed_and_bound(environment, monkeypatch):
    calls = []
    monkeypatch.setattr(github, "rpc", lambda name, **params: calls.append((name, params)))
    response = environment.post(f"{BASE}/connect")
    assert response.status_code == 200
    url = urlparse(response.json()["url"])
    state = parse_qs(url.query)["state"][0]
    assert url.netloc == "github.com" and url.path == "/apps/test-app/installations/new"
    assert len(state) == 43
    assert calls[0][1] == {"p_workspace_id": str(WORKSPACE), "p_actor_id": str(USER),
                           "p_state_hash": hashlib.sha256(state.encode()).hexdigest(),
                           "p_phase": "install", "p_installation_id": None}
    assert state not in repr(calls)


@pytest.mark.parametrize("role", ["organiser", "member", "outsider"])
def test_non_admin_cannot_start_connection(environment, monkeypatch, role):
    def deny(*_):
        raise HTTPException(404 if role == "outsider" else 403, "Access denied")
    monkeypatch.setattr(api, "require_role", deny)
    mocked = MagicMock()
    monkeypatch.setattr(github, "new_state", mocked)
    assert environment.post(f"{BASE}/connect").status_code in {403, 404}
    mocked.assert_not_called()


def test_demo_auth_cannot_use_real_github_credentials(environment):
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(id=DEV_USER_ID, email="dev@example.test")
    assert environment.post(f"{BASE}/connect").status_code == 403


def test_expired_or_replayed_callback_does_not_call_github(environment, monkeypatch):
    monkeypatch.setattr(github, "rpc", lambda *_, **__: None)
    mocked = AsyncMock()
    monkeypatch.setattr(github, "verify_installer", mocked)
    response = environment.post("/api/github/callback", json={"state": STATE, "code": "example-code"})
    assert response.status_code == 400
    mocked.assert_not_called()


def test_install_callback_requires_separate_pkce_proof(environment, monkeypatch):
    monkeypatch.setattr(github, "consume_state", lambda *args: {"workspace_id": str(WORKSPACE)})
    mocked = MagicMock(return_value="v" * 43)
    monkeypatch.setattr(github, "new_state", mocked)
    response = environment.post("/api/github/install-callback", json={"state": STATE, "installation_id": 101})
    assert response.status_code == 200
    params = parse_qs(urlparse(response.json()["url"]).query)
    assert params["code_challenge_method"] == ["S256"]
    assert params["redirect_uri"] == [settings.GITHUB_REDIRECT_URI]
    assert len(params["code_challenge"][0]) == 43
    mocked.assert_called_once_with(str(WORKSPACE), USER, "oauth", 101)


def test_spoofed_installation_is_rejected_before_mapping(environment, monkeypatch):
    monkeypatch.setattr(github, "consume_state", lambda *_: {"workspace_id": str(WORKSPACE), "installation_id": 101})
    monkeypatch.setattr(github, "exchange_code", AsyncMock(return_value="transient-user-token"))
    monkeypatch.setattr(github, "paginate", AsyncMock(return_value=[{"id": 999, "app_id": 99}]))
    save = MagicMock()
    monkeypatch.setattr(github, "rpc", save)
    response = environment.post("/api/github/callback", json={"state": STATE, "code": "example-code"})
    assert response.status_code == 403
    save.assert_not_called()


def test_callback_only_maps_github_admin_repositories(environment, monkeypatch):
    monkeypatch.setattr(github, "app_jwt", lambda: "app-jwt")
    monkeypatch.setattr(github, "consume_state", lambda *_: {"workspace_id": str(WORKSPACE), "installation_id": 101})
    exchange = AsyncMock(return_value="transient-user-token")
    monkeypatch.setattr(github, "exchange_code", exchange)
    pages = AsyncMock(side_effect=[[{"id": 101, "app_id": 99}], [
        {"id": 501, "full_name": "org/admin-repo", "private": True, "permissions": {"admin": True}},
        {"id": 502, "full_name": "org/read-repo", "private": True, "permissions": {"pull": True}},
    ]])
    monkeypatch.setattr(github, "paginate", pages)
    monkeypatch.setattr(github, "request", AsyncMock(return_value={
        "id": 101, "app_id": 99, "account": {"id": 55, "login": "org", "type": "Organization"},
        "permissions": {"metadata": "read"}, "suspended_at": None,
    }))
    save = MagicMock()
    monkeypatch.setattr(github, "rpc", save)
    response = environment.post("/api/github/callback", json={"state": STATE, "code": "example-code"})
    assert response.status_code == 200
    assert save.call_args.kwargs["p_repositories"] == [
        {"repository_id": 501, "full_name": "org/admin-repo", "private": True},
    ]
    assert "transient-user-token" not in repr(save.call_args)
    assert save.call_args.kwargs["p_workspace_id"] == str(WORKSPACE)
    assert save.call_args.kwargs["p_actor_id"] == str(USER)


def test_scoped_tokens_have_no_write_permissions(environment, monkeypatch):
    mocked = AsyncMock(return_value={"token": "installation-token"})
    monkeypatch.setattr(github, "request", mocked)
    monkeypatch.setattr(github, "app_jwt", lambda: "app-jwt")
    assert asyncio.run(github.installation_token(101, 501)) == "installation-token"
    assert mocked.call_args.kwargs["json"] == {"repository_ids": [501], "permissions": {"metadata": "read"}}


@pytest.mark.parametrize(("level", "denied", "permissions", "expected"), [
    ("none", [], {"metadata": "read"}, False), ("read", [], {"metadata": "read"}, True),
    ("write", ["read_repository"], {"metadata": "read"}, False), ("write", [], {}, False),
])
def test_policy_can_only_reduce_access(level, denied, permissions, expected):
    assert github.action_allowed("read_repository", level, denied, permissions) is expected
    for action in ("unknown", "create_issues", "open_pull_request", "create_branch", "comment", "read_issues"):
        assert not github.action_allowed(action, "write", [], {"issues": "write", "contents": "write"})


def test_cross_workspace_repository_context_is_required(environment, monkeypatch):
    mocked = MagicMock(return_value=None)
    monkeypatch.setattr(github, "rpc", mocked)
    response = environment.get(f"{BASE}/repositories/501/details")
    assert response.status_code == 404
    assert mocked.call_args.kwargs == {
        "p_workspace_id": str(WORKSPACE), "p_actor_id": str(USER), "p_repository_id": 501,
    }


@pytest.mark.parametrize("revoke_at", [2, 3])
def test_revocation_during_network_wait_blocks_operation_or_result(environment, monkeypatch, revoke_at):
    calls = []
    def authorize(*_):
        calls.append(1)
        if len(calls) == revoke_at:
            raise HTTPException(403, "Access revoked")
        return {"installation_id": 101}
    monkeypatch.setattr(github, "authorize_repository", authorize)
    monkeypatch.setattr(github, "installation_token", AsyncMock(return_value="installation-token"))
    operation = AsyncMock(return_value={"id": 501})
    monkeypatch.setattr(github, "request", operation)
    response = environment.get(f"{BASE}/repositories/501/details")
    assert response.status_code == 403
    if revoke_at == 2:
        operation.assert_not_called()


def test_operations_never_use_member_identity(environment, monkeypatch):
    monkeypatch.setattr(github, "authorize_repository", lambda *_: {"installation_id": 101})
    monkeypatch.setattr(github, "installation_token", AsyncMock(return_value="installation-token"))
    operation = AsyncMock(return_value={"id": 501, "full_name": "org/repo", "token": "must-not-leak"})
    monkeypatch.setattr(github, "request", operation)
    audit = MagicMock()
    monkeypatch.setattr(github, "rpc", audit)
    response = environment.get(f"{BASE}/repositories/501/details")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    operation.assert_awaited_once_with("GET", "/repositories/501", "installation-token")
    assert "must-not-leak" not in response.text
    assert audit.call_args.kwargs["p_actor_id"] == str(USER)


def signed_webhook(environment, body, delivery="30000000-0000-0000-0000-000000000001", valid=True):
    signature = "sha256=" + hmac.new(settings.GITHUB_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return environment.post("/api/github/webhook", content=body, headers={
        "X-Hub-Signature-256": signature if valid else "sha256=wrong", "X-GitHub-Delivery": delivery,
        "X-GitHub-Event": "installation_repositories",
    })


def test_unsigned_webhook_cannot_touch_database(environment, monkeypatch):
    db = MagicMock()
    monkeypatch.setattr(api, "get_supabase_client", db)
    assert signed_webhook(environment, b'{"installation":{"id":101}}', valid=False).status_code == 401
    db.assert_not_called()


@pytest.mark.parametrize("signature", ["sha256=é", "sha256=" + "f" * 65])
def test_malformed_signatures_are_rejected(environment, signature):
    with pytest.raises(HTTPException) as error:
        github.verify_signature(b"example", signature)
    assert error.value.status_code == 401


def test_permissions_reject_unknown_actions_and_workspace_override(environment):
    url = f"{BASE}/repositories/501/members/{USER}"
    assert environment.put(url, json={"level": "write", "denied_actions": ["execute_agent"]}).status_code == 422
    assert environment.put(url, json={"level": "read", "workspace_id": str(WORKSPACE)}).status_code == 422


@pytest.mark.parametrize("body", [b'not-json', b'[]', b'{"installation":"wrong"}', b'{"installation":{"id":true}}'])
def test_malformed_signed_webhooks_fail_safely(environment, body):
    assert signed_webhook(environment, body).status_code == 400


def test_webhook_live_sync_is_idempotent_and_retryable(environment, monkeypatch):
    db = MagicMock()
    previous = db.table.return_value.select.return_value.eq.return_value.execute
    previous.return_value = SimpleNamespace(data=[])
    monkeypatch.setattr(api, "get_supabase_client", lambda: db)
    snapshot = AsyncMock(return_value=({"id": 101, "status": "active"}, []))
    monkeypatch.setattr(github, "snapshot", snapshot)
    save = MagicMock(return_value=True)
    monkeypatch.setattr(github, "rpc", save)
    body = json.dumps({"installation": {"id": 101}, "action": "removed"}).encode()
    assert signed_webhook(environment, body).status_code == 200
    assert save.call_args.args[0] == "github_sync_installation"
    assert save.call_args.kwargs["p_repositories"] == []
    previous.return_value = SimpleNamespace(data=[{"payload_hash": hashlib.sha256(body).hexdigest()}])
    assert signed_webhook(environment, body).json() == {"duplicate": True}
    assert snapshot.await_count == 1
    assert signed_webhook(environment, b'{"installation":{"id":101}}').status_code == 409
    previous.return_value = SimpleNamespace(data=[])
    snapshot.side_effect = HTTPException(502, "GitHub unavailable")
    save.reset_mock()
    assert signed_webhook(environment, body).status_code == 502
    save.assert_not_called()


def test_deleted_installation_snapshot_revokes_access(environment, monkeypatch):
    monkeypatch.setattr(github, "app_jwt", lambda: "app-jwt")
    monkeypatch.setattr(github, "request", AsyncMock(side_effect=github.GitHubError(404)))
    installation, repos = asyncio.run(github.snapshot(101))
    assert installation["status"] == "deleted" and repos == []


def test_github_errors_do_not_expose_credentials(environment, monkeypatch):
    response = httpx.Response(401, json={"message": "secret-token private-key example"})
    client = AsyncMock()
    client.request.return_value = response
    factory = MagicMock()
    factory.return_value.__aenter__ = AsyncMock(return_value=client)
    factory.return_value.__aexit__ = AsyncMock(return_value=False)
    monkeypatch.setattr(github.httpx, "AsyncClient", factory)
    with pytest.raises(HTTPException) as error:
        asyncio.run(github.request("GET", "/repositories/501", "secret-token"))
    assert "secret-token" not in error.value.detail and "private-key" not in error.value.detail


def test_settings_do_not_leak_ungranted_repositories(environment, monkeypatch):
    monkeypatch.setattr(api, "require_role", lambda *_: "member")
    rows = {
        "github_workspace_installations": [{"github_installations": {
            "id": 101, "status": "active", "permissions": {"metadata": "read"},
        }}],
        "github_repositories": [
            {"repository_id": 501, "installation_id": 101, "connected": True},
            {"repository_id": 502, "installation_id": 101, "connected": True},
        ],
        "github_repository_permissions": [
            {"repository_id": 501, "user_id": str(USER), "level": "read", "denied_actions": []},
        ],
    }
    db = MagicMock()
    def table(name):
        query = MagicMock()
        query.select.return_value = query
        query.eq.return_value = query
        query.order.return_value = query
        query.range.return_value = query
        query.execute.return_value = SimpleNamespace(data=rows[name])
        return query
    db.table.side_effect = table
    monkeypatch.setattr(api, "get_supabase_client", lambda: db)
    result = environment.get(BASE).json()
    assert [r["repository_id"] for r in result["repositories"]] == [501]
    assert result["members"] == [] and result["can_manage"] is False


def test_database_pagination_does_not_truncate_permission_rows():
    query = MagicMock()
    query.range.return_value = query
    query.execute.side_effect = [SimpleNamespace(data=[{"id": i} for i in range(200)]),
                                 SimpleNamespace(data=[{"id": 200}])]
    rows = github.database_rows(query)
    assert len(rows) == 201 and rows[-1] == {"id": 200}
    assert [call.args for call in query.range.call_args_list] == [(0, 199), (200, 399)]
