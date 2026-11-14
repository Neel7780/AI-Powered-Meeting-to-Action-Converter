"""Workspace-scoped GitHub App settings. GitHub never authenticates an ActionPulse user."""

import hashlib
import json
from typing import Annotated
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Request, Response

from app.core.config import settings
from app.core.deps import ADMIN_ROLES, DEV_USER_ID, CurrentUser, get_current_user, require_role
from app.core.supabase import get_supabase_client
from app.schemas.github import GitHubAccessUpdate, GitHubInstallCallback, GitHubMappingUpdate, GitHubOAuthCallback
from app.services import github


def private_response(response: Response):
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(dependencies=[Depends(private_response)])
GitHubID = Annotated[int, Path(gt=0, le=2**53 - 1)]


def integration_user(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    # The app's development sign-in shortcut must never reach real external credentials.
    if user.id == DEV_USER_ID:
        raise HTTPException(403, "Sign in with a real account to manage GitHub connections.")
    return user


def installation_link(workspace_id: UUID, installation_id: int):
    rows = (get_supabase_client().table("github_workspace_installations").select("installation_id")
            .eq("workspace_id", str(workspace_id)).eq("installation_id", installation_id).execute().data)
    if not rows:
        raise HTTPException(404, "GitHub installation not found in this workspace.")


@router.post("/workspaces/{workspace_id}/github/connect")
def connect(workspace_id: UUID, user: CurrentUser = Depends(integration_user)):
    require_role(workspace_id, ADMIN_ROLES, user)
    github.require_configured()
    state = github.new_state(workspace_id, user.id)
    url = f"https://github.com/apps/{settings.GITHUB_APP_SLUG}/installations/new?" + urlencode({"state": state})
    return {"url": url}


@router.post("/github/install-callback")
def install_callback(payload: GitHubInstallCallback, user: CurrentUser = Depends(integration_user)):
    github.require_configured()
    state = github.consume_state(payload.state, user.id, "install")
    # The query parameter is only a candidate, verified through GitHub OAuth in the second phase.
    oauth_state = github.new_state(state["workspace_id"], user.id, "oauth", payload.installation_id)
    return {"url": github.authorization_url(oauth_state)}


@router.post("/github/callback")
async def oauth_callback(payload: GitHubOAuthCallback, user: CurrentUser = Depends(integration_user)):
    github.require_configured()
    state = github.consume_state(payload.state, user.id, "oauth")
    installation, repos = await github.verify_installer(state["installation_id"], payload.code, payload.state)
    # The transaction rechecks admin membership after all network waits.
    github.rpc("github_complete_connection", p_workspace_id=state["workspace_id"], p_actor_id=str(user.id),
               p_installation=installation, p_repositories=repos)
    return {"workspace_id": state["workspace_id"], "account": installation["account_login"]}


@router.get("/workspaces/{workspace_id}/github")
def get_settings(workspace_id: UUID, user: CurrentUser = Depends(integration_user)):
    role = require_role(workspace_id, {"admin", "organiser", "member"}, user)
    db = get_supabase_client()
    links = github.database_rows(db.table("github_workspace_installations")
                                 .select("installation_id,github_installations(*)")
                                 .eq("workspace_id", str(workspace_id)).order("installation_id"))
    repos = github.database_rows(db.table("github_repositories").select("*").eq("workspace_id", str(workspace_id))
                                 .order("full_name").order("repository_id"))
    grant_query = (db.table("github_repository_permissions").select("repository_id,user_id,level,denied_actions")
                   .eq("workspace_id", str(workspace_id)).order("repository_id").order("user_id"))
    if role != "admin":
        grant_query = grant_query.eq("user_id", str(user.id))
    grants = github.database_rows(grant_query)
    installations = [link["github_installations"] for link in links]
    if role != "admin":
        grants = [g for g in grants if g["user_id"] == str(user.id)]
        by_installation = {i["id"]: i for i in installations}
        by_repo = {g["repository_id"]: g for g in grants}
        repos = [r for r in repos if r["connected"] and r["repository_id"] in by_repo
                 and by_installation[r["installation_id"]]["status"] == "active"
                 and github.action_allowed("read_repository", by_repo[r["repository_id"]]["level"],
                                           by_repo[r["repository_id"]]["denied_actions"],
                                           by_installation[r["installation_id"]]["permissions"])]
        visible_ids = {r["installation_id"] for r in repos}
        installations = [i for i in installations if i["id"] in visible_ids]
        require_role(workspace_id, {"admin", "organiser", "member"}, user)
        return {"configured": github.configured(), "can_manage": False, "installations": installations,
                "repositories": repos, "grants": grants, "members": [],
                "actions": [{"id": name, **policy} for name, policy in github.ACTIONS.items()]}
    members = github.database_rows(db.table("workspace_members").select("user_id,role")
                                   .eq("workspace_id", str(workspace_id)).order("user_id"))
    profiles = []
    for offset in range(0, len(members), 100):
        profiles.extend(github.database_rows(db.table("profiles").select("id,display_name,email")
                                             .in_("id", [m["user_id"] for m in members[offset:offset + 100]])
                                             .order("id")))
    by_id = {p["id"]: p for p in profiles}
    require_role(workspace_id, ADMIN_ROLES, user)
    return {
        "configured": github.configured(), "can_manage": True, "installations": installations,
        "repositories": repos, "grants": grants,
        "members": [{**m, "display_name": by_id.get(m["user_id"], {}).get("display_name"),
                     "email": by_id.get(m["user_id"], {}).get("email")} for m in members],
        "actions": [{"id": name, **policy} for name, policy in github.ACTIONS.items()],
    }


@router.patch("/workspaces/{workspace_id}/github/repositories/{repository_id}")
async def map_repository(workspace_id: UUID, repository_id: GitHubID, payload: GitHubMappingUpdate,
                         user: CurrentUser = Depends(integration_user)):
    require_role(workspace_id, ADMIN_ROLES, user)
    if payload.connected:
        rows = (get_supabase_client().table("github_repositories").select("installation_id")
                .eq("workspace_id", str(workspace_id)).eq("repository_id", repository_id).execute().data)
        if not rows:
            raise HTTPException(404, "Repository was not verified for this workspace. Connect GitHub again.")
        token = await github.installation_token(rows[0]["installation_id"], repository_id)
        await github.request("GET", f"/repositories/{repository_id}", token)
    github.rpc("github_manage_repository", p_workspace_id=str(workspace_id), p_actor_id=str(user.id),
               p_repository_id=repository_id, p_connected=payload.connected)
    return {"success": True}


@router.put("/workspaces/{workspace_id}/github/repositories/{repository_id}/members/{member_id}")
def set_access(workspace_id: UUID, repository_id: GitHubID, member_id: UUID, payload: GitHubAccessUpdate,
               user: CurrentUser = Depends(integration_user)):
    require_role(workspace_id, ADMIN_ROLES, user)
    github.rpc("github_set_access", p_workspace_id=str(workspace_id), p_actor_id=str(user.id),
               p_repository_id=repository_id, p_user_id=str(member_id), p_level=payload.level,
               p_denied_actions=sorted(set(payload.denied_actions)))
    return {"success": True}


@router.delete("/workspaces/{workspace_id}/github/installations/{installation_id}")
def disconnect(workspace_id: UUID, installation_id: GitHubID, user: CurrentUser = Depends(integration_user)):
    require_role(workspace_id, ADMIN_ROLES, user)
    github.rpc("github_disconnect_installation", p_workspace_id=str(workspace_id), p_actor_id=str(user.id),
               p_installation_id=installation_id)
    return {"success": True}


@router.post("/workspaces/{workspace_id}/github/installations/{installation_id}/sync")
async def sync(workspace_id: UUID, installation_id: GitHubID, user: CurrentUser = Depends(integration_user)):
    require_role(workspace_id, ADMIN_ROLES, user)
    installation_link(workspace_id, installation_id)
    installation, repos = await github.snapshot(installation_id)
    github.rpc("github_sync_installation", p_workspace_id=str(workspace_id), p_actor_id=str(user.id),
               p_installation=installation, p_repositories=repos)
    return {"success": True}


@router.get("/workspaces/{workspace_id}/github/repositories/{repository_id}/details")
async def repository_details(workspace_id: UUID, repository_id: GitHubID,
                             user: CurrentUser = Depends(integration_user)):
    require_role(workspace_id, {"admin", "organiser", "member"}, user)
    context = github.authorize_repository(workspace_id, user.id, repository_id)
    token = await github.installation_token(context["installation_id"], repository_id)
    fresh = github.authorize_repository(workspace_id, user.id, repository_id)
    if fresh["installation_id"] != context["installation_id"]:
        raise HTTPException(409, "Repository installation changed. Please retry.")
    data = await github.request("GET", f"/repositories/{repository_id}", token)
    final_context = github.authorize_repository(workspace_id, user.id, repository_id)
    if final_context["installation_id"] != context["installation_id"]:
        raise HTTPException(409, "Repository installation changed. Please retry.")
    github.rpc("github_audit", p_workspace_id=str(workspace_id), p_actor_id=str(user.id),
               p_action="read_repository", p_repository_id=repository_id)
    return {key: data.get(key) for key in ("id", "full_name", "private", "description", "default_branch", "archived")}


@router.post("/github/webhook")
async def webhook(request: Request):
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 2 * 1024 * 1024:
            raise HTTPException(413, "GitHub webhook is too large.")
    github.verify_signature(bytes(body), request.headers.get("x-hub-signature-256", ""))
    try:
        delivery_id = str(UUID(request.headers.get("x-github-delivery", "")))
        payload = json.loads(body)
        if not isinstance(payload, dict):
            raise ValueError
    except (ValueError, TypeError):
        raise HTTPException(400, "Malformed GitHub webhook.") from None
    event = request.headers.get("x-github-event", "")
    if event not in {"installation", "installation_repositories", "installation_target", "repository"}:
        return {"ignored": True}
    event_installation = payload.get("installation")
    iid = event_installation.get("id") if isinstance(event_installation, dict) else None
    if type(iid) is not int or not 0 < iid <= 2**53 - 1:
        raise HTTPException(400, "Missing GitHub installation ID.")
    db = get_supabase_client()
    digest = hashlib.sha256(body).hexdigest()
    previous = (db.table("github_webhook_deliveries").select("payload_hash")
                .eq("delivery_id", delivery_id).execute().data)
    if previous:
        if previous[0]["payload_hash"] != digest:
            raise HTTPException(409, "GitHub delivery ID was already used with a different payload.")
        return {"duplicate": True}
    installation, repos = await github.snapshot(iid)
    processed = github.rpc("github_sync_installation", p_installation=installation, p_repositories=repos,
                           p_delivery_id=delivery_id, p_payload_hash=digest, p_event=event)
    return {"processed": processed}
