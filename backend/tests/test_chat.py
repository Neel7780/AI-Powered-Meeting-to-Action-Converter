"""Unit tests for Meeting Chatbot API, Assistant Service, and Workspace Chat Link Preview."""

import socket
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from app.api.chat import get_link_preview, is_safe_url
from app.core.config import settings
from app.core.deps import CurrentUser, get_current_user
from app.services.llm.chat_assistant import StructuredChatOutput, answer_workspace_chat
from main import app

client = TestClient(app)


def _addrinfo(ip: str, family: int = socket.AF_INET):
    return [(family, socket.SOCK_STREAM, 6, "", (ip, 0))]


# ============================================================
# MEETING CHATBOT API & ASSISTANT SERVICE TESTS
# ============================================================


@pytest.mark.parametrize("allowed, valid_response", [(True, True), (True, False), (False, True)])
def test_bedrock_chat_usage_fallback_and_provider_allowlist(monkeypatch, allowed, valid_response):
    monkeypatch.setattr(settings, "AWS_BEARER_TOKEN_BEDROCK", "test-key")
    monkeypatch.setattr(settings, "LLM_PROVIDER_ALLOWLIST", ["bedrock"] if allowed else [])
    db = MagicMock()
    model = MagicMock()
    model.invoke.return_value = {
        "raw": AIMessage(content="", usage_metadata={"input_tokens": 100, "output_tokens": 20, "total_tokens": 120}),
        "parsed": StructuredChatOutput(answer="Grounded answer") if valid_response else None,
        "parsing_error": None,
    }
    with patch("app.services.llm.chat_assistant.get_supabase_client", return_value=db), \
         patch("app.services.llm.chat_assistant._load_workspace_meeting_data", return_value=(
             [{"id": str(uuid4()), "title": "Sprint sync"}], [], [], [],
         )), \
         patch("app.services.llm.chat_assistant._build_context_xml", return_value="<workspace_meetings_data />"), \
         patch("app.services.llm.chat_assistant.create_structured_model", return_value=model) as factory, \
         patch("app.services.llm.chat_assistant._build_fallback_answer", return_value="fallback"):
        response = answer_workspace_chat(uuid4(), uuid4(), "What did we decide?", [])

    if allowed and valid_response:
        assert response.answer == "Grounded answer"
        [run] = db.table.return_value.insert.call_args.args[0]
        assert run["provider"] == "bedrock"
        assert run["model_version"] == settings.BEDROCK_MODEL_ID
        assert run["input_tokens"] == 100 and run["output_tokens"] == 20
        assert run["est_cost_inr"] is None
    else:
        assert response == "fallback"
        db.table.assert_not_called()
    if not allowed:
        factory.assert_not_called()
    else:
        factory.assert_called_once_with(StructuredChatOutput, temperature=0.1, include_raw=True)


def test_chat_message_unauthenticated():
    """Missing or invalid token returns 401 or 403."""
    res = client.post("/api/chat/message", json={
        "workspace_id": str(uuid4()),
        "query": "What did we decide?",
    })
    assert res.status_code in (401, 403)


def test_chat_message_non_member_forbidden():
    """User not in workspace gets 404 (anti-enumeration)."""
    workspace_id = uuid4()
    caller_id = uuid4()
    mock_user = CurrentUser(id=caller_id, email="outsider@example.com")

    db = MagicMock()
    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[])  # Not a member

    db.table.side_effect = lambda t: wm_mock if t == "workspace_members" else MagicMock()

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.core.deps.get_supabase_client", return_value=db):
            res = client.post("/api/chat/message", json={
                "workspace_id": str(workspace_id),
                "query": "Which tasks are pending?",
            })
            assert res.status_code == 404
            assert "access denied" in res.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()


def test_chat_message_pending_tasks_grounded():
    """Grounded query about pending tasks returns tasks, assignees, and citations."""
    workspace_id = uuid4()
    caller_id = uuid4()
    meeting_id = uuid4()
    task_id = uuid4()

    mock_user = CurrentUser(id=caller_id, email="member@example.com")

    db = MagicMock()

    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "member"}])

    meetings_mock = MagicMock()
    meetings_mock.select.return_value = meetings_mock
    meetings_mock.eq.return_value = meetings_mock
    meetings_mock.neq.return_value = meetings_mock
    meetings_mock.order.return_value = meetings_mock
    meetings_mock.limit.return_value = meetings_mock
    meetings_mock.execute.return_value = MagicMock(data=[{
        "id": str(meeting_id),
        "title": "Sprint 1 Architecture Review",
        "starts_at": "2026-10-20T10:00:00Z",
        "timezone": "Asia/Kolkata",
        "organiser_id": str(caller_id),
        "visibility": "workspace",
        "status": "ready",
        "lifecycle": "active",
    }])

    tasks_mock = MagicMock()
    tasks_mock.select.return_value = tasks_mock
    tasks_mock.eq.return_value = tasks_mock
    tasks_mock.in_.return_value = tasks_mock
    tasks_mock.order.return_value = tasks_mock
    tasks_mock.execute.return_value = MagicMock(data=[{
        "id": str(task_id),
        "meeting_id": str(meeting_id),
        "title": "Configure Brevo SMTP credentials",
        "description": "Set up Brevo API key in Render environment",
        "deadline_utc": "2026-10-25T18:00:00Z",
        "priority": "high",
        "status": "todo",
        "source_excerpt": "Bharat will configure Brevo credentials by Friday evening.",
        "external_owner_label": None,
        "created_at": "2026-10-20T11:00:00Z",
    }])

    ta_mock = MagicMock()
    ta_mock.select.return_value = ta_mock
    ta_mock.in_.return_value = ta_mock
    ta_mock.execute.return_value = MagicMock(data=[{
        "task_id": str(task_id),
        "user_id": str(caller_id),
        "is_primary": True,
    }])

    profiles_mock = MagicMock()
    profiles_mock.select.return_value = profiles_mock
    profiles_mock.in_.return_value = profiles_mock
    profiles_mock.execute.return_value = MagicMock(data=[{
        "id": str(caller_id),
        "display_name": "Bharat Odedara",
        "email": "bharat@example.com",
    }])

    ei_mock = MagicMock()
    ei_mock.select.return_value = ei_mock
    ei_mock.in_.return_value = ei_mock
    ei_mock.execute.return_value = MagicMock(data=[])

    tr_mock = MagicMock()
    tr_mock.select.return_value = tr_mock
    tr_mock.in_.return_value = tr_mock
    tr_mock.execute.return_value = MagicMock(data=[{
        "id": str(uuid4()),
        "meeting_id": str(meeting_id),
        "canonical_text": "Bharat will configure Brevo credentials by Friday evening.",
    }])

    def table_router(table_name: str):
        if table_name == "workspace_members":
            return wm_mock
        if table_name == "meetings":
            return meetings_mock
        if table_name == "tasks":
            return tasks_mock
        if table_name == "task_assignees":
            return ta_mock
        if table_name == "profiles":
            return profiles_mock
        if table_name == "extracted_items":
            return ei_mock
        if table_name == "transcripts":
            return tr_mock
        return MagicMock()

    db.table.side_effect = table_router

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.core.deps.get_supabase_client", return_value=db), \
             patch("app.services.llm.chat_assistant.get_supabase_client", return_value=db):
            res = client.post("/api/chat/message", json={
                "workspace_id": str(workspace_id),
                "query": "Which tasks are still pending?",
            })
            assert res.status_code == 200
            data = res.json()
            assert "answer" in data
            assert "Configure Brevo SMTP" in data["answer"]
            assert len(data["citations"]) > 0
            assert data["citations"][0]["task_title"] == "Configure Brevo SMTP credentials"
            assert data["meeting_context_count"] == 1
    finally:
        app.dependency_overrides.clear()


def test_list_chat_meetings():
    """Lists meetings available for chatbot filter dropdown."""
    workspace_id = uuid4()
    caller_id = uuid4()
    meeting_id = uuid4()
    mock_user = CurrentUser(id=caller_id, email="user@example.com")

    db = MagicMock()
    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "member"}])

    meetings_mock = MagicMock()
    meetings_mock.select.return_value = meetings_mock
    meetings_mock.eq.return_value = meetings_mock
    meetings_mock.neq.return_value = meetings_mock
    meetings_mock.order.return_value = meetings_mock
    meetings_mock.limit.return_value = meetings_mock
    meetings_mock.execute.return_value = MagicMock(data=[{
        "id": str(meeting_id),
        "title": "Sprint 1 Retrospective",
        "starts_at": "2026-10-22T14:00:00Z",
        "status": "ready",
    }])

    def table_router(table_name: str):
        if table_name == "workspace_members":
            return wm_mock
        if table_name == "meetings":
            return meetings_mock
        return MagicMock()

    db.table.side_effect = table_router

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.core.deps.get_supabase_client", return_value=db), \
             patch("app.api.chat.get_supabase_client", return_value=db):
            res = client.get(f"/api/chat/workspaces/{workspace_id}/meetings")
            assert res.status_code == 200
            items = res.json()
            assert len(items) == 1
            assert items[0]["title"] == "Sprint 1 Retrospective"
    finally:
        app.dependency_overrides.clear()


# ============================================================
# WORKSPACE CHAT LINK PREVIEW & SSRF GUARD TESTS
# ============================================================


def test_is_safe_url_blocks_ssrf():
    assert is_safe_url("http://localhost:8000") is False
    assert is_safe_url("http://127.0.0.1:8000") is False
    assert is_safe_url("http://0.0.0.0") is False
    assert is_safe_url("http://[::1]:8000") is False
    assert is_safe_url("http://192.168.1.1") is False
    assert is_safe_url("http://10.0.0.1") is False
    assert is_safe_url("http://169.254.169.254") is False
    assert is_safe_url("ftp://example.com") is False
    assert is_safe_url("javascript:alert(1)") is False
    assert is_safe_url("not-a-url") is False


def test_is_safe_url_blocks_private_ipv6_and_mixed_dns():
    with patch("socket.getaddrinfo", return_value=_addrinfo("fc00::1", socket.AF_INET6)):
        assert is_safe_url("https://internal6.example") is False

    with patch("socket.getaddrinfo", return_value=_addrinfo("::ffff:127.0.0.1", socket.AF_INET6)):
        assert is_safe_url("https://mapped-loopback.example") is False

    mixed_records = _addrinfo("93.184.216.34") + _addrinfo("10.0.0.5")
    with patch("socket.getaddrinfo", return_value=mixed_records):
        assert is_safe_url("https://rebind.example") is False


def test_is_safe_url_allows_public_ip():
    with patch("socket.getaddrinfo", return_value=_addrinfo("140.82.121.4")):
        assert is_safe_url("https://github.com") is True


def test_get_link_preview_blocks_ssrf():
    mock_user = CurrentUser(id=uuid4(), email="tester@example.com")
    with pytest.raises(HTTPException) as excinfo:
        get_link_preview(url="http://127.0.0.1:8000/secret", user=mock_user)
    assert excinfo.value.status_code == 400
    assert "private" in excinfo.value.detail.lower()


def test_get_link_preview_blocks_redirect_ssrf():
    mock_user = CurrentUser(id=uuid4(), email="tester@example.com")

    redirect_resp = MagicMock()
    redirect_resp.status_code = 302
    redirect_resp.headers = {"location": "http://169.254.169.254/latest/meta-data/"}

    def fake_getaddrinfo(host, port):
        if host == "public.example":
            return _addrinfo("93.184.216.34")
        return _addrinfo("169.254.169.254")

    with patch("socket.getaddrinfo", side_effect=fake_getaddrinfo), \
         patch("httpx.Client.get", return_value=redirect_resp):
        with pytest.raises(HTTPException) as excinfo:
            get_link_preview(url="https://public.example/go", user=mock_user)
        assert excinfo.value.status_code == 400
        assert "redirect" in excinfo.value.detail.lower()


def test_get_link_preview_parses_og_metadata_and_sanitizes_image():
    mock_user = CurrentUser(id=uuid4(), email="tester@example.com")

    mock_html = """
    <html>
      <head>
        <meta property="og:title" content="ActionPulse - Meeting Converter" />
        <meta property="og:description" content="AI-Powered meeting to action converter." />
        <meta property="og:image" content="https://example.com/logo.png" />
      </head>
      <body>Hello</body>
    </html>
    """

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"content-type": "text/html"}
    mock_resp.text = mock_html

    with patch("socket.getaddrinfo", return_value=_addrinfo("93.184.216.34")), \
         patch("httpx.Client.get", return_value=mock_resp):
        data = get_link_preview(url="https://example.com", user=mock_user)
        assert data.title == "ActionPulse - Meeting Converter"
        assert data.description == "AI-Powered meeting to action converter."
        assert data.image == "https://example.com/logo.png"


def test_get_link_preview_strips_unsafe_og_image_scheme():
    mock_user = CurrentUser(id=uuid4(), email="tester@example.com")

    mock_html = """
    <html>
      <head>
        <meta property="og:title" content="Malicious Card" />
        <meta property="og:image" content="javascript:alert(1)" />
      </head>
    </html>
    """

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"content-type": "text/html"}
    mock_resp.text = mock_html

    with patch("socket.getaddrinfo", return_value=_addrinfo("93.184.216.34")), \
         patch("httpx.Client.get", return_value=mock_resp):
        data = get_link_preview(url="https://example.com", user=mock_user)
        assert data.title == "Malicious Card"
        assert data.image is None


def test_get_link_preview_decodes_html_entities():
    mock_user = CurrentUser(id=uuid4(), email="tester@example.com")

    mock_html = """
    <html>
      <head>
        <meta property="og:title" content="R&amp;D &quot;Sprint&quot; &#39;Notes&#39;" />
        <meta property="og:description" content="Compare A &lt; B &amp; C &gt; D" />
        <meta property="og:site_name" content="Docs &amp; Co" />
        <meta property="og:image" content="https://cdn.example.com/img.png?w=400&amp;h=300" />
      </head>
    </html>
    """

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"content-type": "text/html"}
    mock_resp.text = mock_html

    with patch("socket.getaddrinfo", return_value=_addrinfo("93.184.216.34")), \
         patch("httpx.Client.get", return_value=mock_resp):
        data = get_link_preview(url="https://example.com/docs", user=mock_user)
        assert data.title == 'R&D "Sprint" \'Notes\''
        assert data.description == "Compare A < B & C > D"
        assert data.site_name == "Docs & Co"
        assert data.image == "https://cdn.example.com/img.png?w=400&h=300"


# ============================================================
# WORKSPACE CHAT DELETE MESSAGE + STORAGE CLEANUP TESTS (OPTION B)
# ============================================================


class _FakeQuery:
    def __init__(self, rows: list[dict]):
        self._rows = rows
        self._filters: list[tuple[str, object]] = []
        self._update_payload: dict | None = None
        self._is_delete: bool = False

    def select(self, *_args, **_kwargs):
        return self

    def update(self, payload: dict):
        self._update_payload = payload
        return self

    def delete(self):
        self._is_delete = True
        return self

    def eq(self, col: str, val: object):
        self._filters.append((col, val))
        return self

    def execute(self):
        matched = [
            row for row in self._rows
            if all(str(row.get(col)) == str(val) for col, val in self._filters)
        ]
        if self._is_delete:
            for row in matched:
                if row in self._rows:
                    self._rows.remove(row)
        elif self._update_payload is not None:
            for row in matched:
                row.update(self._update_payload)
        return MagicMock(data=matched)


class _FakeStorageBucket:
    def __init__(
        self,
        objects: set[str],
        fail_on_remove: bool = False,
        fail_paths: set[str] | None = None,
    ):
        self.objects = objects
        self.fail_on_remove = fail_on_remove
        self.fail_paths: set[str] = set(fail_paths or set())
        self.removed_calls: list[list[str]] = []

    def remove(self, paths: list[str]):
        self.removed_calls.append(list(paths))
        if self.fail_on_remove or any(p in self.fail_paths for p in paths):
            raise RuntimeError("Simulated Storage timeout")
        removed = []
        for p in paths:
            if p in self.objects:
                self.objects.discard(p)
                removed.append({"name": p})
        return removed


class _FakeChatDeleteDB:
    def __init__(
        self,
        *,
        tables: dict[str, list[dict]],
        storage_objects: set[str],
        fail_storage: bool = False,
        fail_paths: set[str] | None = None,
    ):
        self.tables = tables
        self.bucket = _FakeStorageBucket(
            storage_objects,
            fail_on_remove=fail_storage,
            fail_paths=fail_paths,
        )
        self.storage = MagicMock()
        self.storage.from_.return_value = self.bucket

    def table(self, name: str):
        return _FakeQuery(self.tables.setdefault(name, []))


def _build_delete_fixture(*, conv_type: str = "channel", is_private: bool = False, fail_storage: bool = False):
    ws_id = str(uuid4())
    conv_id = str(uuid4())
    msg_id = str(uuid4())
    sibling_msg_id = str(uuid4())
    owner_id = str(uuid4())
    admin_id = str(uuid4())
    sender_id = str(uuid4())
    other_member_id = str(uuid4())
    outsider_id = str(uuid4())

    target_path_1 = f"{ws_id}/{conv_id}/1001_secret.pdf"
    target_path_2 = f"{ws_id}/{conv_id}/1002_photo.png"
    sibling_path = f"{ws_id}/{conv_id}/1003_sibling.png"

    tables = {
        "conversations": [
            {
                "id": conv_id,
                "workspace_id": ws_id,
                "type": conv_type,
                "is_private": is_private,
            }
        ],
        "workspace_members": [
            {"workspace_id": ws_id, "user_id": owner_id, "role": "owner"},
            {"workspace_id": ws_id, "user_id": admin_id, "role": "admin"},
            {"workspace_id": ws_id, "user_id": sender_id, "role": "member"},
            {"workspace_id": ws_id, "user_id": other_member_id, "role": "member"},
        ],
        "conversation_members": [
            {"conversation_id": conv_id, "user_id": sender_id},
            {"conversation_id": conv_id, "user_id": other_member_id},
        ],
        "messages": [
            {
                "id": msg_id,
                "conversation_id": conv_id,
                "workspace_id": ws_id,
                "sender_id": sender_id,
                "content": "Confidential attachment",
                "deleted_at": None,
                "updated_at": "2026-11-18T10:00:00Z",
            },
            {
                "id": sibling_msg_id,
                "conversation_id": conv_id,
                "workspace_id": ws_id,
                "sender_id": other_member_id,
                "content": "Keep this attachment",
                "deleted_at": None,
                "updated_at": "2026-11-18T10:01:00Z",
            },
        ],
        "message_attachments": [
            {
                "id": str(uuid4()),
                "message_id": msg_id,
                "conversation_id": conv_id,
                "workspace_id": ws_id,
                "storage_path": target_path_1,
            },
            {
                "id": str(uuid4()),
                "message_id": msg_id,
                "conversation_id": conv_id,
                "workspace_id": ws_id,
                "storage_path": target_path_2,
            },
            {
                "id": str(uuid4()),
                "message_id": sibling_msg_id,
                "conversation_id": conv_id,
                "workspace_id": ws_id,
                "storage_path": sibling_path,
            },
        ],
    }

    db = _FakeChatDeleteDB(
        tables=tables,
        storage_objects={target_path_1, target_path_2, sibling_path},
        fail_storage=fail_storage,
    )
    return {
        "db": db,
        "ws_id": ws_id,
        "conv_id": conv_id,
        "msg_id": msg_id,
        "owner_id": owner_id,
        "admin_id": admin_id,
        "sender_id": sender_id,
        "other_member_id": other_member_id,
        "outsider_id": outsider_id,
        "target_paths": [target_path_1, target_path_2],
        "sibling_path": sibling_path,
    }


def test_delete_chat_message_unauthenticated():
    res = client.delete(f"/api/chat/messages/{uuid4()}")
    assert res.status_code in (401, 403)


def test_delete_chat_message_non_member_returns_404():
    fx = _build_delete_fixture(conv_type="channel", is_private=False)
    mock_user = CurrentUser(id=fx["outsider_id"], email="outsider@example.com")

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.delete(f"/api/chat/messages/{fx['msg_id']}")
            assert res.status_code == 404
            assert fx["db"].tables["messages"][0]["deleted_at"] is None
            assert set(fx["target_paths"]).issubset(fx["db"].bucket.objects)
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize("conv_type,is_private", [("channel", True), ("dm", True)])
@pytest.mark.parametrize("role_key", ["admin_id", "owner_id"])
def test_delete_chat_message_non_member_admin_or_owner_denied_on_private_conv(
    conv_type: str, is_private: bool, role_key: str
):
    """Workspace admins and owners who are NOT members of a private channel or DM receive 404."""
    fx = _build_delete_fixture(conv_type=conv_type, is_private=is_private)
    mock_user = CurrentUser(id=fx[role_key], email=f"{role_key}@example.com")

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.delete(f"/api/chat/messages/{fx['msg_id']}")
            assert res.status_code == 404
            assert "access denied" in res.json()["detail"].lower()
            assert fx["db"].tables["messages"][0]["deleted_at"] is None
            assert fx["db"].bucket.removed_calls == []
    finally:
        app.dependency_overrides.clear()


def test_delete_chat_message_unauthorized_member_returns_403():
    """Another regular member in the same conversation cannot delete someone else's message."""
    fx = _build_delete_fixture(conv_type="channel", is_private=False)
    mock_user = CurrentUser(id=fx["other_member_id"], email="other@example.com")

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.delete(f"/api/chat/messages/{fx['msg_id']}")
            assert res.status_code == 403
            assert fx["db"].tables["messages"][0]["deleted_at"] is None
            assert fx["db"].bucket.removed_calls == []
    finally:
        app.dependency_overrides.clear()


def test_delete_chat_message_sender_deletes_and_cleans_only_target_attachments():
    """Authorized sender soft-deletes message and deletes ONLY that message's Storage objects."""
    fx = _build_delete_fixture(conv_type="dm", is_private=True)
    mock_user = CurrentUser(id=fx["sender_id"], email="sender@example.com")

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.delete(f"/api/chat/messages/{fx['msg_id']}")
            assert res.status_code == 200
            body = res.json()
            assert body["deleted"] is True
            assert body["deleted_attachments_count"] == 2
            assert body["failed_attachments_count"] == 0
            assert body["storage_cleanup_ok"] is True
            assert body["pending_storage_cleanup"] is False
            assert body["detail"] is None

            # Message is soft-deleted
            target_msg = fx["db"].tables["messages"][0]
            assert target_msg["deleted_at"] is not None
            assert target_msg["content"] == "This message was deleted."

            # Target attachments removed from Storage and metadata table; sibling message attachment untouched
            fx["db"].storage.from_.assert_called_with("chat-attachments")
            assert fx["db"].bucket.removed_calls == [[p] for p in fx["target_paths"]]
            for p in fx["target_paths"]:
                assert p not in fx["db"].bucket.objects
            assert fx["sibling_path"] in fx["db"].bucket.objects
            assert [row["storage_path"] for row in fx["db"].tables["message_attachments"]] == [
                fx["sibling_path"]
            ]
    finally:
        app.dependency_overrides.clear()


def test_delete_chat_message_admin_member_can_moderate_private_channel():
    """Workspace admin who IS a member of the private channel can moderate and clean up Storage."""
    fx = _build_delete_fixture(conv_type="channel", is_private=True)
    fx["db"].tables["conversation_members"].append(
        {"conversation_id": fx["conv_id"], "user_id": fx["admin_id"]}
    )
    mock_user = CurrentUser(id=fx["admin_id"], email="admin@example.com")

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.delete(f"/api/chat/messages/{fx['msg_id']}")
            assert res.status_code == 200
            body = res.json()
            assert body["deleted"] is True
            assert body["storage_cleanup_ok"] is True
            assert body["deleted_attachments_count"] == 2
            assert fx["sibling_path"] in fx["db"].bucket.objects
    finally:
        app.dependency_overrides.clear()


def test_delete_chat_message_partial_storage_failure_is_logged_and_retryable(caplog):
    """If Storage cleanup fails, message stays soft-deleted, error is logged, and retry cleans Storage."""
    fx = _build_delete_fixture(conv_type="channel", is_private=False, fail_storage=True)
    mock_user = CurrentUser(id=fx["sender_id"], email="sender@example.com")

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            with caplog.at_level("ERROR", logger="app.api.chat"):
                first_res = client.delete(f"/api/chat/messages/{fx['msg_id']}")

            assert first_res.status_code == 200
            first_body = first_res.json()
            assert first_body["deleted"] is True
            assert first_body["storage_cleanup_ok"] is False
            assert first_body["pending_storage_cleanup"] is True
            assert first_body["deleted_attachments_count"] == 0
            assert first_body["failed_attachments_count"] == 2
            assert "pending storage cleanup" in first_body["detail"].lower()
            # Message is already soft-deleted despite Storage failure
            assert fx["db"].tables["messages"][0]["deleted_at"] is not None
            assert any("failed to remove" in rec.message.lower() for rec in caplog.records)

            # Storage recovers; retrying DELETE on the already-soft-deleted message completes cleanup
            fx["db"].bucket.fail_on_remove = False
            retry_res = client.delete(f"/api/chat/messages/{fx['msg_id']}")
            assert retry_res.status_code == 200
            retry_body = retry_res.json()
            assert retry_body["deleted"] is True
            assert retry_body["storage_cleanup_ok"] is True
            assert retry_body["pending_storage_cleanup"] is False
            assert retry_body["deleted_attachments_count"] == 2
            assert retry_body["failed_attachments_count"] == 0
            assert retry_body["detail"] is None
            for p in fx["target_paths"]:
                assert p not in fx["db"].bucket.objects
            assert fx["sibling_path"] in fx["db"].bucket.objects
    finally:
        app.dependency_overrides.clear()


def test_delete_chat_message_partial_subset_storage_failure_retries_only_remaining_files(caplog):
    """If Storage fails for only 1 of 2 files, file 1 is cleaned up immediately and retry cleans ONLY file 2."""
    fx = _build_delete_fixture(conv_type="channel", is_private=False)
    path_1, path_2 = fx["target_paths"]
    fx["db"].bucket.fail_paths.add(path_2)
    mock_user = CurrentUser(id=fx["sender_id"], email="sender@example.com")

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            with caplog.at_level("ERROR", logger="app.api.chat"):
                first_res = client.delete(f"/api/chat/messages/{fx['msg_id']}")

            assert first_res.status_code == 200
            first_body = first_res.json()
            assert first_body["deleted"] is True
            assert first_body["deleted_attachments_count"] == 1
            assert first_body["failed_attachments_count"] == 1
            assert first_body["storage_cleanup_ok"] is False
            assert first_body["pending_storage_cleanup"] is True
            assert "1 attachment(s) are pending storage cleanup" in first_body["detail"].lower()

            # File 1 already removed from Storage and metadata table; file 2 retained for retry & RLS block
            assert path_1 not in fx["db"].bucket.objects
            assert path_2 in fx["db"].bucket.objects
            assert fx["sibling_path"] in fx["db"].bucket.objects
            assert sorted(row["storage_path"] for row in fx["db"].tables["message_attachments"]) == sorted(
                [path_2, fx["sibling_path"]]
            )

            # Clear transient failure on file 2 and retry DELETE on the already-soft-deleted message
            fx["db"].bucket.fail_paths.clear()
            fx["db"].bucket.removed_calls.clear()
            retry_res = client.delete(f"/api/chat/messages/{fx['msg_id']}")

            assert retry_res.status_code == 200
            retry_body = retry_res.json()
            assert retry_body["deleted"] is True
            assert retry_body["deleted_attachments_count"] == 1
            assert retry_body["failed_attachments_count"] == 0
            assert retry_body["storage_cleanup_ok"] is True
            assert retry_body["pending_storage_cleanup"] is False
            assert retry_body["detail"] is None

            # Retry ONLY touched path_2 (never re-touched path_1 or sibling_path)
            assert fx["db"].bucket.removed_calls == [[path_2]]
            assert path_2 not in fx["db"].bucket.objects
            assert fx["sibling_path"] in fx["db"].bucket.objects
            assert [row["storage_path"] for row in fx["db"].tables["message_attachments"]] == [
                fx["sibling_path"]
            ]
    finally:
        app.dependency_overrides.clear()
