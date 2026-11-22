"""Unit tests for Phases 2–4: Workspace Search, Group Conversations, and Pinning."""

from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4
import pytest
from fastapi.testclient import TestClient

from app.core.deps import CurrentUser, get_current_user
from main import app

client = TestClient(app)


class _InMemoryTable:
    def __init__(self, name: str, rows: list[dict]):
        self.name = name
        self.rows = rows
        self._filters: list[tuple[str, str, object]] = []
        self._updates: dict = {}
        self._is_delete = False
        self._select_cols: str = "*"

    def select(self, cols: str = "*"):
        self._filters = []
        self._updates = {}
        self._is_delete = False
        self._select_cols = cols
        return self

    def eq(self, col: str, val: object):
        self._filters.append(("eq", col, str(val)))
        return self

    def neq(self, col: str, val: object):
        self._filters.append(("neq", col, str(val)))
        return self

    def in_(self, col: str, vals: list):
        str_vals = [str(v) for v in vals]
        self._filters.append(("in", col, str_vals))
        return self

    def is_(self, col: str, val: object):
        self._filters.append(("is", col, val))
        return self

    def ilike(self, col: str, val: str):
        self._filters.append(("ilike", col, val))
        return self

    def order(self, _col: str, desc: bool = False):
        return self

    def limit(self, _num: int):
        return self

    def insert(self, payload: dict | list[dict]):
        new_items = payload if isinstance(payload, list) else [payload]
        created_items = []
        for item in new_items:
            item_copy = dict(item)
            if "id" not in item_copy:
                item_copy["id"] = str(uuid4())
            if "created_at" not in item_copy:
                item_copy["created_at"] = "2026-11-22T00:00:00Z"
            if "updated_at" not in item_copy:
                item_copy["updated_at"] = "2026-11-22T00:00:00Z"
            self.rows.append(item_copy)
            created_items.append(item_copy)
        mock_res = MagicMock()
        mock_res.data = created_items
        mock_exec = MagicMock(return_value=mock_res)
        mock_builder = MagicMock()
        mock_builder.execute = mock_exec
        return mock_builder

    def update(self, payload: dict):
        self._updates = payload
        return self

    def delete(self):
        self._is_delete = True
        return self

    def execute(self):
        matched = list(self.rows)
        for op, col, val in self._filters:
            if op == "eq":
                matched = [r for r in matched if str(r.get(col)) == str(val)]
            elif op == "neq":
                matched = [r for r in matched if str(r.get(col)) != str(val)]
            elif op == "in":
                matched = [r for r in matched if str(r.get(col)) in val]
            elif op == "is":
                if val == "null" or val is None:
                    matched = [r for r in matched if r.get(col) is None]
                else:
                    matched = [r for r in matched if r.get(col) is not None]
            elif op == "ilike":
                # pattern like %query%
                q = str(val).strip("%").lower()
                matched = [r for r in matched if q in str(r.get(col, "")).lower()]

        if self._is_delete:
            remaining = [r for r in self.rows if r not in matched]
            self.rows.clear()
            self.rows.extend(remaining)
            self._filters = []
            self._is_delete = False
            res = MagicMock()
            res.data = matched
            return res

        if self._updates:
            for r in matched:
                r.update(self._updates)
            self._filters = []
            self._updates = {}
            res = MagicMock()
            res.data = matched
            return res

        self._filters = []
        res = MagicMock()
        res.data = matched
        return res


class _MockSupabaseDb:
    def __init__(self, tables: dict[str, list[dict]]):
        self.tables = {name: _InMemoryTable(name, rows) for name, rows in tables.items()}

    def table(self, name: str):
        if name not in self.tables:
            self.tables[name] = _InMemoryTable(name, [])
        return self.tables[name]


@pytest.fixture
def test_env():
    user_id = uuid4()
    other_user_1 = uuid4()
    other_user_2 = uuid4()
    non_member_user = uuid4()
    ws_id = uuid4()
    pub_channel_id = uuid4()
    priv_channel_id = uuid4()
    secret_channel_id = uuid4()

    mock_user = CurrentUser(
        id=user_id,
        email="tester@actionpulse.test",
        display_name="Tester",
        role="authenticated",
    )

    tables = {
        "workspace_members": [
            {"workspace_id": str(ws_id), "user_id": str(user_id), "role": "member"},
            {"workspace_id": str(ws_id), "user_id": str(other_user_1), "role": "member"},
            {"workspace_id": str(ws_id), "user_id": str(other_user_2), "role": "member"},
        ],
        "profiles": [
            {"id": str(user_id), "display_name": "Tester", "email": "tester@actionpulse.test", "avatar_url": None},
            {"id": str(other_user_1), "display_name": "Alice", "email": "alice@actionpulse.test", "avatar_url": None},
            {"id": str(other_user_2), "display_name": "Bob", "email": "bob@actionpulse.test", "avatar_url": None},
        ],
        "conversations": [
            {
                "id": str(pub_channel_id),
                "workspace_id": str(ws_id),
                "type": "channel",
                "name": "general",
                "is_private": False,
                "created_by": str(user_id),
                "created_at": "2026-11-20T00:00:00Z",
            },
            {
                "id": str(priv_channel_id),
                "workspace_id": str(ws_id),
                "type": "channel",
                "name": "project-team",
                "is_private": True,
                "created_by": str(user_id),
                "created_at": "2026-11-20T00:00:00Z",
            },
            {
                "id": str(secret_channel_id),
                "workspace_id": str(ws_id),
                "type": "channel",
                "name": "secret-exec",
                "is_private": True,
                "created_by": str(other_user_1),
                "created_at": "2026-11-20T00:00:00Z",
            },
        ],
        "conversation_members": [
            {"conversation_id": str(pub_channel_id), "user_id": str(user_id), "joined_at": "2026-11-20T00:00:00Z", "last_read_at": "2026-11-20T00:00:00Z"},
            {"conversation_id": str(priv_channel_id), "user_id": str(user_id), "joined_at": "2026-11-20T00:00:00Z", "last_read_at": "2026-11-20T00:00:00Z"},
            {"conversation_id": str(secret_channel_id), "user_id": str(other_user_1), "joined_at": "2026-11-20T00:00:00Z", "last_read_at": "2026-11-20T00:00:00Z"},
        ],
        "messages": [
            {
                "id": str(uuid4()),
                "conversation_id": str(pub_channel_id),
                "workspace_id": str(ws_id),
                "sender_id": str(other_user_1),
                "content": "Sprint planning roadmap meeting tomorrow at 10am",
                "is_sticker": False,
                "deleted_at": None,
                "created_at": "2026-11-21T10:00:00Z",
            },
            {
                "id": str(uuid4()),
                "conversation_id": str(priv_channel_id),
                "workspace_id": str(ws_id),
                "sender_id": str(user_id),
                "content": "Secret roadmap discussion for Q4 goals",
                "is_sticker": False,
                "deleted_at": None,
                "created_at": "2026-11-21T11:00:00Z",
            },
            {
                "id": str(uuid4()),
                "conversation_id": str(secret_channel_id),
                "workspace_id": str(ws_id),
                "sender_id": str(other_user_1),
                "content": "Executive roadmap not visible to regular members",
                "is_sticker": False,
                "deleted_at": None,
                "created_at": "2026-11-21T12:00:00Z",
            },
        ],
        "conversation_pins": [],
    }

    mock_db = _MockSupabaseDb(tables)

    yield {
        "user": mock_user,
        "other_user_1": other_user_1,
        "other_user_2": other_user_2,
        "non_member_user": non_member_user,
        "ws_id": ws_id,
        "pub_channel_id": pub_channel_id,
        "priv_channel_id": priv_channel_id,
        "secret_channel_id": secret_channel_id,
        "tables": tables,
        "db": mock_db,
    }
    app.dependency_overrides.clear()


def test_search_messages_authorized_and_respects_privacy(test_env):
    """User can search public channels and their private channels, but not private channels they are not part of."""
    app.dependency_overrides[get_current_user] = lambda: test_env["user"]
    with patch("app.core.deps.get_supabase_client", return_value=test_env["db"]), \
         patch("app.api.chat.get_supabase_client", return_value=test_env["db"]):
        # Search for 'roadmap'
        resp = client.get(
            f"/api/chat/workspaces/{test_env['ws_id']}/search",
            params={"q": "roadmap"},
        )
        assert resp.status_code == 200
        results = resp.json()
        assert len(results) == 2
        matched_contents = [r["content"] for r in results]
        assert "Sprint planning roadmap meeting tomorrow at 10am" in matched_contents
        assert "Secret roadmap discussion for Q4 goals" in matched_contents
        # The secret executive channel message must NOT be returned!
        assert "Executive roadmap not visible to regular members" not in matched_contents


def test_search_messages_scoped_to_accessible_conversation(test_env):
    """Scoping search to an accessible conversation returns only results from it."""
    app.dependency_overrides[get_current_user] = lambda: test_env["user"]
    with patch("app.core.deps.get_supabase_client", return_value=test_env["db"]), \
         patch("app.api.chat.get_supabase_client", return_value=test_env["db"]):
        resp = client.get(
            f"/api/chat/workspaces/{test_env['ws_id']}/search",
            params={"q": "roadmap", "conversation_id": str(test_env["pub_channel_id"])},
        )
        assert resp.status_code == 200
        results = resp.json()
        assert len(results) == 1
        assert results[0]["conversation_id"] == str(test_env["pub_channel_id"])


def test_search_messages_scoped_to_inaccessible_conversation_returns_404(test_env):
    """Attempting to scope search to a private conversation caller is not a member of returns 404 (anti-enumeration)."""
    app.dependency_overrides[get_current_user] = lambda: test_env["user"]
    with patch("app.core.deps.get_supabase_client", return_value=test_env["db"]), \
         patch("app.api.chat.get_supabase_client", return_value=test_env["db"]):
        resp = client.get(
            f"/api/chat/workspaces/{test_env['ws_id']}/search",
            params={"q": "roadmap", "conversation_id": str(test_env["secret_channel_id"])},
        )
        assert resp.status_code == 404


def test_create_group_conversation_success(test_env):
    """Caller can create a group conversation with 2+ other workspace members."""
    app.dependency_overrides[get_current_user] = lambda: test_env["user"]
    with patch("app.core.deps.get_supabase_client", return_value=test_env["db"]), \
         patch("app.api.chat.get_supabase_client", return_value=test_env["db"]):
        payload = {
            "participant_ids": [str(test_env["other_user_1"]), str(test_env["other_user_2"])],
            "name": "Design Sync Group",
        }
        resp = client.post(
            f"/api/chat/workspaces/{test_env['ws_id']}/group-conversations",
            json=payload,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["is_private"] is True
        assert data["type"] == "dm"
        assert len(data["participant_ids"]) == 3
        assert str(test_env["user"].id) in data["participant_ids"]


def test_create_group_conversation_fails_with_too_few_members(test_env):
    """Fails if fewer than 2 other members are provided (less than 3 members total)."""
    app.dependency_overrides[get_current_user] = lambda: test_env["user"]
    with patch("app.core.deps.get_supabase_client", return_value=test_env["db"]), \
         patch("app.api.chat.get_supabase_client", return_value=test_env["db"]):
        payload = {
            "participant_ids": [str(test_env["other_user_1"])],
        }
        resp = client.post(
            f"/api/chat/workspaces/{test_env['ws_id']}/group-conversations",
            json=payload,
        )
        assert resp.status_code in (400, 422)


def test_create_group_conversation_fails_for_non_workspace_user(test_env):
    """Fails if any participant is not a member of the workspace."""
    app.dependency_overrides[get_current_user] = lambda: test_env["user"]
    with patch("app.core.deps.get_supabase_client", return_value=test_env["db"]), \
         patch("app.api.chat.get_supabase_client", return_value=test_env["db"]):
        payload = {
            "participant_ids": [str(test_env["other_user_1"]), str(test_env["non_member_user"])],
        }
        resp = client.post(
            f"/api/chat/workspaces/{test_env['ws_id']}/group-conversations",
            json=payload,
        )
        assert resp.status_code == 400


def test_pin_and_unpin_message(test_env):
    """Can pin a message in an accessible conversation, list pins, and unpin."""
    app.dependency_overrides[get_current_user] = lambda: test_env["user"]
    target_msg = test_env["tables"]["messages"][0]
    msg_id = target_msg["id"]
    conv_id = target_msg["conversation_id"]

    with patch("app.core.deps.get_supabase_client", return_value=test_env["db"]), \
         patch("app.api.chat.get_supabase_client", return_value=test_env["db"]):
        # 1. Pin message
        p_resp = client.post(f"/api/chat/messages/{msg_id}/pin")
        assert p_resp.status_code == 200
        pin_data = p_resp.json()
        assert pin_data["message_id"] == msg_id

        # 2. List pins
        list_resp = client.get(f"/api/chat/conversations/{conv_id}/pins")
        assert list_resp.status_code == 200
        pins = list_resp.json()
        assert len(pins) == 1
        assert pins[0]["message_id"] == msg_id
        assert pins[0]["message_content"] == target_msg["content"]

        # 3. Pinning again is idempotent
        p_again = client.post(f"/api/chat/messages/{msg_id}/pin")
        assert p_again.status_code == 200

        # 4. Unpin message
        unpin_resp = client.delete(f"/api/chat/messages/{msg_id}/pin")
        assert unpin_resp.status_code == 200
        assert unpin_resp.json()["unpinned"] is True

        # 5. List pins is now empty
        list_after = client.get(f"/api/chat/conversations/{conv_id}/pins")
        assert list_after.status_code == 200
        assert len(list_after.json()) == 0


def test_pin_inaccessible_conversation_returns_404(test_env):
    """Pinning a message in a secret channel caller is not a member of returns 404."""
    app.dependency_overrides[get_current_user] = lambda: test_env["user"]
    secret_msg = test_env["tables"]["messages"][2]

    with patch("app.core.deps.get_supabase_client", return_value=test_env["db"]), \
         patch("app.api.chat.get_supabase_client", return_value=test_env["db"]):
        resp = client.post(f"/api/chat/messages/{secret_msg['id']}/pin")
        assert resp.status_code == 404
