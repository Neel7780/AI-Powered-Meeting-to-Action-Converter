"""GitHub App credentials stay here; user OAuth is used only to prove installer access."""

import base64
import hashlib
import hmac
import re
import secrets
import time
from datetime import UTC, datetime
from urllib.parse import urlencode, urlparse

import httpx
import jwt
from fastapi import HTTPException
from postgrest.exceptions import APIError

from app.core.config import settings
from app.core.supabase import get_supabase_client

# Only metadata is implemented. Adding an action requires its own checked operation.
ACTIONS = {
    "read_repository": {
        "label": "Read repository details", "implemented": True, "permission": "metadata", "mode": "read"
    },
    "read_issues": {"label": "Read issues", "implemented": False, "permission": "issues", "mode": "read"},
    "create_issues": {"label": "Create issues", "implemented": False, "permission": "issues", "mode": "write"},
    "comment": {"label": "Comment on issues", "implemented": False, "permission": "issues", "mode": "write"},
    "create_branch": {"label": "Create branches", "implemented": False, "permission": "contents", "mode": "write"},
    "open_pull_request": {
        "label": "Open pull requests", "implemented": False, "permission": "pull_requests", "mode": "write"
    },
}


def configured() -> bool:
    return all(getattr(settings, name) for name in (
        "GITHUB_APP_ID", "GITHUB_APP_SLUG", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET",
        "GITHUB_PRIVATE_KEY", "GITHUB_WEBHOOK_SECRET", "GITHUB_REDIRECT_URI",
    ))


def require_configured():
    redirect = urlparse(settings.GITHUB_REDIRECT_URI)
    secure_redirect = redirect.scheme == "https" or (
        settings.ENVIRONMENT == "development" and redirect.scheme == "http"
        and redirect.hostname in {"localhost", "127.0.0.1"}
    )
    if (not configured() or not secure_redirect or not settings.GITHUB_APP_ID.isdigit()
            or not re.fullmatch(r"[a-zA-Z0-9-]+", settings.GITHUB_APP_SLUG)):
        raise HTTPException(503, "GitHub integration is not configured. Contact your workspace administrator.")


def rpc(name: str, **params):
    try:
        return get_supabase_client().rpc(name, params).execute().data
    except APIError as exc:
        code = str(exc.code)
        if code == "42501":
            raise HTTPException(403, "GitHub access denied. Refresh your workspace permissions.") from None
        if code == "P0002":
            raise HTTPException(404, "GitHub connection or repository not found.") from None
        if code in {"22023", "23503", "23514"}:
            raise HTTPException(409, "GitHub connection changed. Refresh or reconnect and try again.") from None
        raise HTTPException(503, "GitHub settings could not be saved. Please retry.") from None


def database_rows(query) -> list[dict]:
    rows = []
    while True:
        batch = query.range(len(rows), len(rows) + 199).execute().data or []
        rows.extend(batch)
        if len(batch) < 200:
            return rows


def app_jwt() -> str:
    require_configured()
    now = int(time.time())
    try:
        return jwt.encode({"iat": now - 60, "exp": now + 540, "iss": settings.GITHUB_CLIENT_ID},
                          settings.GITHUB_PRIVATE_KEY, algorithm="RS256")
    except (ValueError, jwt.PyJWTError):
        raise HTTPException(503, "GitHub App signing key is invalid.") from None


class GitHubError(HTTPException):
    def __init__(self, upstream_status: int):
        self.upstream_status = upstream_status
        if upstream_status in {401, 403, 404, 422}:
            super().__init__(409, "GitHub access is unavailable or rate limited. Sync or reconnect, then retry.")
        else:
            super().__init__(502, "GitHub is temporarily unavailable. Please retry.")


async def request(method: str, path: str, token: str, **kwargs):
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
            response = await client.request(method, f"https://api.github.com{path}", headers={
                "Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2026-03-10",
            }, **kwargs)
        if not 200 <= response.status_code < 300:
            raise GitHubError(response.status_code)
        return response.json() if response.content else {}
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, "Could not reach GitHub. Please retry.") from None


async def paginate(path: str, token: str, key: str) -> list[dict]:
    rows = []
    for page in range(1, 101):
        data = await request("GET", path, token, params={"per_page": 100, "page": page})
        batch = data[key]
        rows.extend(batch)
        if len(batch) < 100:
            return rows
    # shortcut: at most 10,000 repositories per installation, add background pagination above that scale.
    raise HTTPException(502, "GitHub installation is too large to synchronize in one request.")


def new_state(workspace_id, user_id, phase="install", installation_id=None) -> str:
    state = secrets.token_urlsafe(32)
    rpc("github_begin_state", p_workspace_id=str(workspace_id), p_actor_id=str(user_id),
        p_state_hash=hashlib.sha256(state.encode()).hexdigest(), p_phase=phase, p_installation_id=installation_id)
    return state


def consume_state(state: str, user_id, phase: str) -> dict:
    row = rpc("github_consume_state", p_state_hash=hashlib.sha256(state.encode()).hexdigest(),
              p_actor_id=str(user_id), p_phase=phase)
    if not row:
        raise HTTPException(400, "GitHub connection expired or was already used. Start Connect GitHub again.")
    return row


def verifier(state: str) -> str:
    return base64.urlsafe_b64encode(hmac.digest(
        settings.GITHUB_CLIENT_SECRET.encode(), state.encode(), "sha256"
    )).rstrip(b"=").decode()


def authorization_url(state: str) -> str:
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier(state).encode()).digest()).rstrip(b"=").decode()
    return "https://github.com/login/oauth/authorize?" + urlencode({
        "client_id": settings.GITHUB_CLIENT_ID, "redirect_uri": settings.GITHUB_REDIRECT_URI,
        "state": state, "code_challenge": challenge, "code_challenge_method": "S256",
    })


async def exchange_code(code: str, state: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
            response = await client.post("https://github.com/login/oauth/access_token", headers={
                "Accept": "application/json",
            }, json={"client_id": settings.GITHUB_CLIENT_ID, "client_secret": settings.GITHUB_CLIENT_SECRET,
                     "redirect_uri": settings.GITHUB_REDIRECT_URI, "code": code, "code_verifier": verifier(state)})
        data = response.json()
        if response.status_code != 200 or not data.get("access_token") or data.get("error"):
            raise HTTPException(400, "GitHub authorization failed or expired. Start Connect GitHub again.")
        return data["access_token"]
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, "Could not verify GitHub authorization. Start Connect GitHub again.") from None


async def installation_token(installation_id: int, repository_id: int | None = None) -> str:
    # Enumeration needs installation-wide metadata; workspace operations always pass one repository ID.
    payload = {"permissions": {"metadata": "read"}}
    if repository_id is not None:
        payload["repository_ids"] = [repository_id]
    data = await request("POST", f"/app/installations/{installation_id}/access_tokens", app_jwt(), json=payload)
    return data["token"]


def installation_record(data: dict, observed_at: str) -> dict:
    return {
        "id": data["id"], "account_id": data["account"]["id"], "account_login": data["account"]["login"],
        "account_type": data["account"]["type"], "permissions": data.get("permissions", {}),
        "status": "suspended" if data.get("suspended_at") else "active", "observed_at": observed_at,
    }


def repository_records(rows: list[dict]) -> list[dict]:
    return [{"repository_id": r["id"], "full_name": r["full_name"], "private": r["private"]} for r in rows]


async def verify_installer(installation_id: int, code: str, state: str) -> tuple[dict, list[dict]]:
    observed_at = datetime.now(UTC).isoformat()
    user_token = await exchange_code(code, state)
    # This token is never used for workspace operations or stored, including its refresh token.
    installations = await paginate("/user/installations", user_token, "installations")
    if not any(i["id"] == installation_id and str(i["app_id"]) == settings.GITHUB_APP_ID for i in installations):
        raise HTTPException(403, "The authorizing GitHub account cannot access this installation.")
    repos = await paginate(f"/user/installations/{installation_id}/repositories", user_token, "repositories")
    repos = [r for r in repos if r.get("permissions", {}).get("admin") is True]
    if not repos:
        raise HTTPException(403, "You need GitHub administrator access to at least one selected repository.")
    data = await request("GET", f"/app/installations/{installation_id}", app_jwt())
    if str(data["app_id"]) != settings.GITHUB_APP_ID or data.get("suspended_at"):
        raise HTTPException(409, "GitHub installation is suspended or belongs to another app.")
    return installation_record(data, observed_at), repository_records(repos)


async def snapshot(installation_id: int) -> tuple[dict, list[dict]]:
    observed_at = datetime.now(UTC).isoformat()
    try:
        data = await request("GET", f"/app/installations/{installation_id}", app_jwt())
    except GitHubError as exc:
        if exc.upstream_status != 404:
            raise
        return {"id": installation_id, "status": "deleted", "observed_at": observed_at}, []
    record = installation_record(data, observed_at)
    if record["status"] != "active":
        return record, []
    token = await installation_token(installation_id)
    repos = await paginate("/installation/repositories", token, "repositories")
    return record, repository_records(repos)


def action_allowed(action: str, level: str, denied: list[str], permissions: dict) -> bool:
    policy = ACTIONS.get(action)
    if not policy or not policy["implemented"] or level not in {"read", "write"} or action in denied:
        return False
    granted = permissions.get(policy["permission"])
    return (policy["mode"] == "read" and granted in {"read", "write"}) or (
        policy["mode"] == "write" and level == "write" and granted == "write"
    )


def authorize_repository(workspace_id, user_id, repository_id: int, action="read_repository") -> dict:
    context = rpc("github_repository_context", p_workspace_id=str(workspace_id), p_actor_id=str(user_id),
                  p_repository_id=repository_id)
    if not context:
        raise HTTPException(404, "Repository not found or access denied.")
    if not action_allowed(action, context["level"], context["denied_actions"], context["permissions"]):
        raise HTTPException(403, "This GitHub action is not allowed for this repository.")
    return context


def verify_signature(body: bytes, signature: str):
    if not settings.GITHUB_WEBHOOK_SECRET:
        raise HTTPException(503, "GitHub webhook is not configured.")
    expected = "sha256=" + hmac.new(settings.GITHUB_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    if not re.fullmatch(r"sha256=[0-9a-f]{64}", signature) or not hmac.compare_digest(expected, signature):
        raise HTTPException(401, "Invalid GitHub webhook signature.")
