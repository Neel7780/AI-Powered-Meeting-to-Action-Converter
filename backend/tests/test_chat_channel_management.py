"""Unit tests for Phase 1: Workspace Chat Channel & Membership Management."""

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

    def order(self, _col: str, desc: bool = False):
        return self

    def limit(self, _num: int):
        return self

    def insert(self, payload: dict | list[dict]):
        new_items = payload if isinstance(payload, list) else [payload]
        for item in new_items:
            item_copy = dict(item)
            if "id" not in item_copy:
                item_copy["id"] = str(uuid4())
            if "created_at" not in item_copy:
                item_copy["created_at"] = "2026-11-20T00:00:00Z"
            if "updated_at" not in item_copy:
                item_copy["updated_at"] = "2026-11-20T00:00:00Z"
            self.rows.append(item_copy)
        mock_res = MagicMock()
        mock_res.data = new_items
        mock_exec = MagicMock(return_value=mock_res)
        mock_builder = MagicMock()
        mock_builder.execute = mock_exec
        return mock_builder

    def update(self, updates: dict):
        self._updates = updates
        return self

    def delete(self):
        self._is_delete = True
        return self

    def _matches(self, row: dict) -> bool:
        for op, col, val in self._filters:
            row_val = str(row.get(col, ""))
            if op == "eq" and row_val != val:
                return False
            if op == "neq" and row_val == val:
                return False
            if op == "in" and row_val not in val:
                return False
        return True

    def execute(self):
        matched = [r for r in self.rows if self._matches(r)]
        if self._is_delete:
            for r in matched:
                if r in self.rows:
                    self.rows.remove(r)
            self._filters = []
            self._is_delete = False
            return MagicMock(data=[])

        if self._updates:
            for r in matched:
                r.update(self._updates)
            self._filters = []
            self._updates = {}
            return MagicMock(data=matched)

        # Handle joined profiles for conversation_members
        if self.name == "conversation_members" and "profiles" in self._select_cols:
            result = []
            for r in matched:
                r_copy = dict(r)
                # Mock profile lookup
                uid = r.get("user_id")
                r_copy["profiles"] = {
                    "id": uid,
                    "display_name": f"User {uid[:6]}",
                    "email": f"user_{uid[:6]}@example.com",
                    "avatar_url": None,
                }
                result.append(r_copy)
            self._filters = []
            return MagicMock(data=result)

        self._filters = []
        return MagicMock(data=[dict(r) for r in matched])


class _InMemorySupabase:
    def __init__(self):
        self.tables: dict[str, list[dict]] = {
            "conversations": [],
            "conversation_members": [],
            "workspace_members": [],
            "profiles": [],
        }

    def table(self, name: str):
        if name not in self.tables:
            self.tables[name] = []
        return _InMemoryTable(name, self.tables[name])


@pytest.fixture
def chat_fixture():
    ws_id = str(uuid4())
    admin_id = str(uuid4())
    creator_id = str(uuid4())
    member_id = str(uuid4())
    outsider_id = str(uuid4())

    db = _InMemorySupabase()

    # Workspace members
    db.tables["workspace_members"].extend([
        {"workspace_id": ws_id, "user_id": admin_id, "role": "admin"},
        {"workspace_id": ws_id, "user_id": creator_id, "role": "member"},
        {"workspace_id": ws_id, "user_id": member_id, "role": "member"},
    ])

    # Channels
    general_id = str(uuid4())
    public_id = str(uuid4())
    private_id = str(uuid4())

    db.tables["conversations"].extend([
        {
            "id": general_id,
            "workspace_id": ws_id,
            "type": "channel",
            "name": "general",
            "topic": "Company-wide discussion",
            "description": "General announcements",
            "is_private": False,
            "created_by": admin_id,
            "created_at": "2026-11-20T00:00:00Z",
            "updated_at": "2026-11-20T00:00:00Z",
        },
        {
            "id": public_id,
            "workspace_id": ws_id,
            "type": "channel",
            "name": "engineering",
            "topic": "Engineering team",
            "description": "Dev discussions",
            "is_private": False,
            "created_by": creator_id,
            "created_at": "2026-11-20T00:00:00Z",
            "updated_at": "2026-11-20T00:00:00Z",
        },
        {
            "id": private_id,
            "workspace_id": ws_id,
            "type": "channel",
            "name": "security-private",
            "topic": "Private security reviews",
            "description": "Confidential channel",
            "is_private": True,
            "created_by": creator_id,
            "created_at": "2026-11-20T00:00:00Z",
            "updated_at": "2026-11-20T00:00:00Z",
        },
    ])

    # Memberships
    db.tables["conversation_members"].extend([
        {"conversation_id": general_id, "user_id": admin_id, "joined_at": "2026-11-20T00:00:00Z", "last_read_at": "2026-11-20T00:00:00Z"},
        {"conversation_id": general_id, "user_id": creator_id, "joined_at": "2026-11-20T00:00:00Z", "last_read_at": "2026-11-20T00:00:00Z"},
        {"conversation_id": general_id, "user_id": member_id, "joined_at": "2026-11-20T00:00:00Z", "last_read_at": "2026-11-20T00:00:00Z"},

        {"conversation_id": public_id, "user_id": creator_id, "joined_at": "2026-11-20T00:00:00Z", "last_read_at": "2026-11-20T00:00:00Z"},
        {"conversation_id": public_id, "user_id": member_id, "joined_at": "2026-11-20T00:00:00Z", "last_read_at": "2026-11-20T00:00:00Z"},

        {"conversation_id": private_id, "user_id": creator_id, "joined_at": "2026-11-20T00:00:00Z", "last_read_at": "2026-11-20T00:00:00Z"},
    ])

    return {
        "db": db,
        "ws_id": ws_id,
        "admin_id": admin_id,
        "creator_id": creator_id,
        "member_id": member_id,
        "outsider_id": outsider_id,
        "general_id": general_id,
        "public_id": public_id,
        "private_id": private_id,
    }


# ==============================================================================
# 1. Channel Discovery Tests
# ==============================================================================

def test_discover_public_channels_lists_only_public_and_computes_membership(chat_fixture):
    fx = chat_fixture
    caller = CurrentUser(id=UUID(fx["member_id"]), email="member@example.com")
    app.dependency_overrides[get_current_user] = lambda: caller
    try:
        with patch("app.core.deps.get_supabase_client", return_value=fx["db"]), \
             patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.get(f"/api/chat/workspaces/{fx['ws_id']}/channels/discover")
            assert res.status_code == 200
            data = res.json()
            assert len(data) == 2  # general + engineering (security-private excluded!)
            names = [c["name"] for c in data]
            assert "general" in names
            assert "engineering" in names
            assert "security-private" not in names  # Private channels NEVER in discovery

            eng = next(c for c in data if c["name"] == "engineering")
            assert eng["is_member"] is True
            assert eng["member_count"] == 2
    finally:
        app.dependency_overrides.clear()


def test_discover_public_channels_search_filtering(chat_fixture):
    fx = chat_fixture
    caller = CurrentUser(id=UUID(fx["member_id"]), email="member@example.com")
    app.dependency_overrides[get_current_user] = lambda: caller
    try:
        with patch("app.core.deps.get_supabase_client", return_value=fx["db"]), \
             patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.get(f"/api/chat/workspaces/{fx['ws_id']}/channels/discover?q=announcements")
            assert res.status_code == 200
            data = res.json()
            assert len(data) == 1
            assert data[0]["name"] == "general"
    finally:
        app.dependency_overrides.clear()


# ==============================================================================
# 2. Join Public Channel Tests
# ==============================================================================

def test_join_public_channel_success(chat_fixture):
    fx = chat_fixture
    new_user_id = str(uuid4())
    fx["db"].tables["workspace_members"].append({
        "workspace_id": fx["ws_id"],
        "user_id": new_user_id,
        "role": "member",
    })
    caller = CurrentUser(id=UUID(new_user_id), email="new@example.com")
    app.dependency_overrides[get_current_user] = lambda: caller
    try:
        with patch("app.core.deps.get_supabase_client", return_value=fx["db"]), \
             patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.post(f"/api/chat/channels/{fx['public_id']}/join")
            assert res.status_code == 200
            assert res.json()["joined"] is True
            # Verify registered in conversation_members
            assert any(
                r["conversation_id"] == fx["public_id"] and r["user_id"] == new_user_id
                for r in fx["db"].tables["conversation_members"]
            )
    finally:
        app.dependency_overrides.clear()


def test_join_private_channel_blocked(chat_fixture):
    fx = chat_fixture
    caller = CurrentUser(id=UUID(fx["member_id"]), email="member@example.com")
    app.dependency_overrides[get_current_user] = lambda: caller
    try:
        with patch("app.core.deps.get_supabase_client", return_value=fx["db"]), \
             patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.post(f"/api/chat/channels/{fx['private_id']}/join")
            assert res.status_code == 403
            assert "Cannot join a private channel without an invitation" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


# ==============================================================================
# 3. Channel Update Tests (Edit Name, Topic, Description, Privacy)
# ==============================================================================

def test_update_channel_details_success_by_creator(chat_fixture):
    fx = chat_fixture
    caller = CurrentUser(id=UUID(fx["creator_id"]), email="creator@example.com")
    app.dependency_overrides[get_current_user] = lambda: caller
    try:
        with patch("app.core.deps.get_supabase_client", return_value=fx["db"]), \
             patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.patch(
                f"/api/chat/channels/{fx['public_id']}",
                json={
                    "name": "backend-core",
                    "topic": "FastAPI and Supabase Architecture",
                    "description": "Core backend discussions and reviews",
                },
            )
            assert res.status_code == 200
            data = res.json()
            assert data["name"] == "backend-core"
            assert data["topic"] == "FastAPI and Supabase Architecture"
            assert data["description"] == "Core backend discussions and reviews"
    finally:
        app.dependency_overrides.clear()


def test_update_channel_details_unauthorized_for_regular_member(chat_fixture):
    fx = chat_fixture
    caller = CurrentUser(id=UUID(fx["member_id"]), email="member@example.com")
    app.dependency_overrides[get_current_user] = lambda: caller
    try:
        with patch("app.core.deps.get_supabase_client", return_value=fx["db"]), \
             patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.patch(
                f"/api/chat/channels/{fx['public_id']}",
                json={"name": "hijacked-channel"},
            )
            assert res.status_code == 403
            assert "Unauthorized" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_update_channel_duplicate_name_rejected_409(chat_fixture):
    fx = chat_fixture
    caller = CurrentUser(id=UUID(fx["creator_id"]), email="creator@example.com")
    app.dependency_overrides[get_current_user] = lambda: caller
    try:
        with patch("app.core.deps.get_supabase_client", return_value=fx["db"]), \
             patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            # Try to rename 'engineering' to 'general' (which already exists)
            res = client.patch(
                f"/api/chat/channels/{fx['public_id']}",
                json={"name": "general"},
            )
            assert res.status_code == 409
            assert "already exists" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_rename_general_channel_blocked_400(chat_fixture):
    fx = chat_fixture
    caller = CurrentUser(id=UUID(fx["admin_id"]), email="admin@example.com")
    app.dependency_overrides[get_current_user] = lambda: caller
    try:
        with patch("app.core.deps.get_supabase_client", return_value=fx["db"]), \
             patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.patch(
                f"/api/chat/channels/{fx['general_id']}",
                json={"name": "main-announcements"},
            )
            assert res.status_code == 400
            assert "The default #general channel cannot be renamed" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_make_general_channel_private_blocked_400(chat_fixture):
    fx = chat_fixture
    caller = CurrentUser(id=UUID(fx["admin_id"]), email="admin@example.com")
    app.dependency_overrides[get_current_user] = lambda: caller
    try:
        with patch("app.core.deps.get_supabase_client", return_value=fx["db"]), \
             patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.patch(
                f"/api/chat/channels/{fx['general_id']}",
                json={"is_private": True},
            )
            assert res.status_code == 400
            assert "The default #general channel cannot be made private" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_change_channel_privacy_success(chat_fixture):
    fx = chat_fixture
    caller = CurrentUser(id=UUID(fx["creator_id"]), email="creator@example.com")
    app.dependency_overrides[get_current_user] = lambda: caller
    try:
        with patch("app.core.deps.get_supabase_client", return_value=fx["db"]), \
             patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.patch(
                f"/api/chat/channels/{fx['public_id']}",
                json={"is_private": True},
            )
            assert res.status_code == 200
            assert res.json()["is_private"] is True
    finally:
        app.dependency_overrides.clear()


# ==============================================================================
# 4. Membership Management Tests (Invite, Remove, Leave)
# ==============================================================================

def test_invite_member_success(chat_fixture):
    fx = chat_fixture
    caller = CurrentUser(id=UUID(fx["creator_id"]), email="creator@example.com")
    app.dependency_overrides[get_current_user] = lambda: caller
    try:
        with patch("app.core.deps.get_supabase_client", return_value=fx["db"]), \
             patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            # Invite admin into security-private
            res = client.post(
                f"/api/chat/channels/{fx['private_id']}/members",
                json={"user_id": fx["admin_id"]},
            )
            assert res.status_code == 200
            assert res.json()["status"] == "added"
            # Verify in conversation_members
            assert any(
                r["conversation_id"] == fx["private_id"] and r["user_id"] == fx["admin_id"]
                for r in fx["db"].tables["conversation_members"]
            )
    finally:
        app.dependency_overrides.clear()


def test_invite_non_workspace_member_rejected_400(chat_fixture):
    fx = chat_fixture
    caller = CurrentUser(id=UUID(fx["creator_id"]), email="creator@example.com")
    app.dependency_overrides[get_current_user] = lambda: caller
    try:
        with patch("app.core.deps.get_supabase_client", return_value=fx["db"]), \
             patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.post(
                f"/api/chat/channels/{fx['public_id']}/members",
                json={"user_id": fx["outsider_id"]},
            )
            assert res.status_code == 400
            assert "not a member of this workspace" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_leave_channel_success(chat_fixture):
    fx = chat_fixture
    caller = CurrentUser(id=UUID(fx["member_id"]), email="member@example.com")
    app.dependency_overrides[get_current_user] = lambda: caller
    try:
        with patch("app.core.deps.get_supabase_client", return_value=fx["db"]), \
             patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.delete(f"/api/chat/channels/{fx['public_id']}/members/{fx['member_id']}")
            assert res.status_code == 200
            assert res.json()["deleted"] is True
            # Verify removed
            assert not any(
                r["conversation_id"] == fx["public_id"] and r["user_id"] == fx["member_id"]
                for r in fx["db"].tables["conversation_members"]
            )
    finally:
        app.dependency_overrides.clear()


def test_leave_general_channel_blocked_400(chat_fixture):
    fx = chat_fixture
    caller = CurrentUser(id=UUID(fx["member_id"]), email="member@example.com")
    app.dependency_overrides[get_current_user] = lambda: caller
    try:
        with patch("app.core.deps.get_supabase_client", return_value=fx["db"]), \
             patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.delete(f"/api/chat/channels/{fx['general_id']}/members/{fx['member_id']}")
            assert res.status_code == 400
            assert "cannot leave the default #general channel" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_sole_member_cannot_leave_private_channel_400(chat_fixture):
    fx = chat_fixture
    # creator_id is the sole member of security-private
    caller = CurrentUser(id=UUID(fx["creator_id"]), email="creator@example.com")
    app.dependency_overrides[get_current_user] = lambda: caller
    try:
        with patch("app.core.deps.get_supabase_client", return_value=fx["db"]), \
             patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.delete(f"/api/chat/channels/{fx['private_id']}/members/{fx['creator_id']}")
            assert res.status_code == 400
            assert "sole remaining member" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_remove_another_member_success_by_creator(chat_fixture):
    fx = chat_fixture
    caller = CurrentUser(id=UUID(fx["creator_id"]), email="creator@example.com")
    app.dependency_overrides[get_current_user] = lambda: caller
    try:
        with patch("app.core.deps.get_supabase_client", return_value=fx["db"]), \
             patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.delete(f"/api/chat/channels/{fx['public_id']}/members/{fx['member_id']}")
            assert res.status_code == 200
            assert res.json()["deleted"] is True
            assert not any(
                r["conversation_id"] == fx["public_id"] and r["user_id"] == fx["member_id"]
                for r in fx["db"].tables["conversation_members"]
            )
    finally:
        app.dependency_overrides.clear()


def test_remove_another_member_unauthorized_by_regular_member_403(chat_fixture):
    fx = chat_fixture
    caller = CurrentUser(id=UUID(fx["member_id"]), email="member@example.com")
    app.dependency_overrides[get_current_user] = lambda: caller
    try:
        with patch("app.core.deps.get_supabase_client", return_value=fx["db"]), \
             patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.delete(f"/api/chat/channels/{fx['public_id']}/members/{fx['creator_id']}")
            assert res.status_code == 403
            assert "Unauthorized" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_get_channel_members_list(chat_fixture):
    fx = chat_fixture
    caller = CurrentUser(id=UUID(fx["creator_id"]), email="creator@example.com")
    app.dependency_overrides[get_current_user] = lambda: caller
    try:
        with patch("app.core.deps.get_supabase_client", return_value=fx["db"]), \
             patch("app.api.chat.get_supabase_client", return_value=fx["db"]):
            res = client.get(f"/api/chat/channels/{fx['public_id']}/members")
            assert res.status_code == 200
            data = res.json()
            assert len(data) == 2
            creator_item = next(m for m in data if m["user_id"] == fx["creator_id"])
            assert creator_item["is_creator"] is True
    finally:
        app.dependency_overrides.clear()

