"""Unit tests for Tasks dependency and workflow chain mutations (Sprint 2 - Task 6)."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.deps import CurrentUser, get_current_user
from main import app

client = TestClient(app)


def mock_user():
    return CurrentUser(id=uuid4(), email="tester@actionpulse.io")


def test_update_task_dependency_success():
    app.dependency_overrides[get_current_user] = mock_user
    ws_id = str(uuid4())
    t1_id = str(uuid4())
    t2_id = str(uuid4())

    target_mock = {"id": t2_id, "workspace_id": ws_id, "status": "todo", "blocked_by": None}
    prereq_mock = {"id": t1_id, "workspace_id": ws_id, "status": "in_progress", "blocked_by": None}

    with patch("app.api.tasks.require_role", return_value="member"), \
         patch("app.api.tasks.get_supabase_client") as mock_db_getter:

        mock_db = MagicMock()
        mock_db_getter.return_value = mock_db

        def mock_table(name: str):
            table_mock = MagicMock()
            if name == "tasks":
                # For target query
                def mock_select(cols):
                    sel_mock = MagicMock()
                    def mock_eq1(f1, v1):
                        eq1_mock = MagicMock()
                        def mock_eq2(f2, v2):
                            eq2_mock = MagicMock()
                            if v1 == t2_id:
                                eq2_mock.execute.return_value = MagicMock(data=[target_mock])
                            elif v1 == t1_id:
                                eq2_mock.execute.return_value = MagicMock(data=[prereq_mock])
                            else:
                                eq2_mock.execute.return_value = MagicMock(data=[])
                            return eq2_mock
                        eq1_mock.eq.side_effect = mock_eq2
                        return eq1_mock
                    sel_mock.eq.side_effect = mock_eq1
                    return sel_mock
                table_mock.select.side_effect = mock_select
                table_mock.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": t2_id}])
            return table_mock

        mock_db.table.side_effect = mock_table

        resp = client.patch(
            f"/api/workspaces/{ws_id}/tasks/{t2_id}/dependency",
            json={"blocked_by": t1_id, "execution_type": "human"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == t2_id
        assert data["blocked_by"] == t1_id
        # Since prereq is in_progress, target must automatically transition to 'blocked'
        assert data["status"] == "blocked"

    app.dependency_overrides.clear()


def test_circular_dependency_rejected():
    app.dependency_overrides[get_current_user] = mock_user
    ws_id = str(uuid4())
    t1_id = str(uuid4())
    t2_id = str(uuid4())

    # Task 2 wants to depend on Task 1, but Task 1 is ALREADY blocked by Task 2
    target_mock = {"id": t2_id, "workspace_id": ws_id, "status": "todo", "blocked_by": None}
    prereq_mock = {"id": t1_id, "workspace_id": ws_id, "status": "blocked", "blocked_by": t2_id}

    with patch("app.api.tasks.require_role", return_value="member"), \
         patch("app.api.tasks.get_supabase_client") as mock_db_getter:

        mock_db = MagicMock()
        mock_db_getter.return_value = mock_db

        def mock_table(name: str):
            table_mock = MagicMock()
            if name == "tasks":
                def mock_select(cols):
                    sel_mock = MagicMock()
                    def mock_eq1(f1, v1):
                        eq1_mock = MagicMock()
                        def mock_eq2(f2, v2):
                            eq2_mock = MagicMock()
                            if v1 == t2_id:
                                eq2_mock.execute.return_value = MagicMock(data=[target_mock])
                            elif v1 == t1_id:
                                eq2_mock.execute.return_value = MagicMock(data=[prereq_mock])
                            else:
                                eq2_mock.execute.return_value = MagicMock(data=[])
                            return eq2_mock
                        eq1_mock.eq.side_effect = mock_eq2
                        return eq1_mock
                    sel_mock.eq.side_effect = mock_eq1
                    return sel_mock
                table_mock.select.side_effect = mock_select
            return table_mock

        mock_db.table.side_effect = mock_table

        resp = client.patch(
            f"/api/workspaces/{ws_id}/tasks/{t2_id}/dependency",
            json={"blocked_by": t1_id}
        )
        assert resp.status_code == 400
        assert "Circular dependency" in resp.json()["detail"]

    app.dependency_overrides.clear()

class MockQuery:
    def __init__(self, data=None):
        self._data = data if data is not None else []

    def eq(self, *args, **kwargs):
        return self

    def neq(self, *args, **kwargs):
        return self

    def execute(self):
        return MagicMock(data=self._data)


def test_update_task_status_prereq_blocking():
    app.dependency_overrides[get_current_user] = mock_user
    ws_id = str(uuid4())
    t1_id = str(uuid4())
    t2_id = str(uuid4())

    target_mock = {"id": t2_id, "workspace_id": ws_id, "status": "blocked", "blocked_by": t1_id}
    prereq_mock = {"id": t1_id, "workspace_id": ws_id, "status": "in_progress", "blocked_by": None}

    with patch("app.api.tasks.require_role", return_value="member"),          patch("app.api.tasks.get_supabase_client") as mock_db_getter:

        mock_db = MagicMock()
        mock_db_getter.return_value = mock_db

        def mock_table(name: str):
            table_mock = MagicMock()
            if name == "tasks":
                def mock_select(cols):
                    sel_mock = MagicMock()
                    def mock_eq(f, v):
                        if str(v) == t2_id:
                            return MockQuery([target_mock])
                        elif str(v) == t1_id:
                            return MockQuery([prereq_mock])
                        return MockQuery([])
                    sel_mock.eq.side_effect = mock_eq
                    return sel_mock
                table_mock.select.side_effect = mock_select
            return table_mock

        mock_db.table.side_effect = mock_table

        resp = client.patch(
            f"/api/workspaces/{ws_id}/tasks/{t2_id}/status",
            json={"status": "in_progress"}
        )
        assert resp.status_code == 400
        assert "prerequisite is not completed yet" in resp.json()["detail"]

    app.dependency_overrides.clear()


def test_update_task_status_done_unblocks_downstream():
    app.dependency_overrides[get_current_user] = mock_user
    ws_id = str(uuid4())
    t1_id = str(uuid4())

    target_mock = {"id": t1_id, "workspace_id": ws_id, "status": "in_progress", "blocked_by": None}

    with patch("app.api.tasks.require_role", return_value="member"),          patch("app.api.tasks.get_supabase_client") as mock_db_getter:

        mock_db = MagicMock()
        mock_db_getter.return_value = mock_db

        def mock_table(name: str):
            table_mock = MagicMock()
            if name == "tasks":
                def mock_select(cols):
                    sel_mock = MagicMock()
                    sel_mock.eq.side_effect = lambda f, v: MockQuery([target_mock] if str(v) == t1_id else [])
                    return sel_mock
                table_mock.select.side_effect = mock_select
                table_mock.update.side_effect = lambda payload: MockQuery([{"id": t1_id}])
            return table_mock

        mock_db.table.side_effect = mock_table

        resp = client.patch(
            f"/api/workspaces/{ws_id}/tasks/{t1_id}/status",
            json={"status": "done"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == t1_id
        assert data["status"] == "done"
        assert data["completed_at"] is not None

    app.dependency_overrides.clear()



def test_task_prerequisite_inquiry_and_reply_flow():
    user = mock_user()
    app.dependency_overrides[get_current_user] = lambda: user
    ws_id = str(uuid4())
    t1_id = str(uuid4())
    manager_id = str(uuid4())
    comm_id = str(uuid4())

    task_mock = {
        "id": t1_id,
        "workspace_id": ws_id,
        "title": "Build Auth Middleware",
        "status": "todo",
        "created_by": manager_id,
        "blocked_by": None,
    }

    inquiry_mock = {
        "id": comm_id,
        "task_id": t1_id,
        "workspace_id": ws_id,
        "sender_id": str(user.id),
        "recipient_id": manager_id,
        "message_type": "inquiry",
        "content": "Do we have the API key or schema ready?",
        "suggested_prerequisite_task_id": None,
        "status": "open",
        "created_at": "2026-11-03T20:00:00Z",
        "updated_at": "2026-11-03T20:00:00Z",
    }

    with patch("app.api.tasks.require_role", return_value="member"), \
         patch("app.api.tasks.get_supabase_client") as mock_db_getter:

        mock_db = MagicMock()
        mock_db_getter.return_value = mock_db

        def mock_table(name: str):
            table_mock = MagicMock()
            if name == "tasks":
                table_mock.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[task_mock])
            elif name == "task_communications":
                table_mock.insert.return_value.execute.return_value = MagicMock(data=[inquiry_mock])
                table_mock.select.return_value.eq.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[inquiry_mock])
            elif name == "notifications":
                table_mock.insert.return_value.execute.return_value = MagicMock(data=[{"id": str(uuid4())}])
            elif name == "profiles":
                table_mock.select.return_value.in_.return_value.execute.return_value = MagicMock(data=[
                    {"id": str(user.id), "display_name": "Developer", "email": "dev@team.com", "avatar_url": None},
                    {"id": manager_id, "display_name": "Manager Bob", "email": "bob@team.com", "avatar_url": None},
                ])
            return table_mock

        mock_db.table.side_effect = mock_table

        # 1. Post inquiry
        resp = client.post(
            f"/api/workspaces/{ws_id}/tasks/{t1_id}/prerequisite-inquiries",
            json={"content": "Do we have the API key or schema ready?"}
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["task_id"] == t1_id
        assert data["content"] == "Do we have the API key or schema ready?"
        assert data["status"] == "open"
        assert data["recipient_id"] == manager_id

        # 2. Get communications
        get_resp = client.get(f"/api/workspaces/{ws_id}/tasks/{t1_id}/communications")
        assert get_resp.status_code == 200
        threads = get_resp.json()
        assert len(threads) == 1
        assert threads[0]["message_type"] == "inquiry"

    app.dependency_overrides.clear()



def test_manager_reply_links_prerequisite_task():
    manager = mock_user()
    app.dependency_overrides[get_current_user] = lambda: manager
    ws_id = str(uuid4())
    t1_id = str(uuid4())
    t2_id = str(uuid4())
    assignee_id = str(uuid4())
    reply_id = str(uuid4())

    target_mock = {
        "id": t1_id,
        "workspace_id": ws_id,
        "title": "Build Dashboard",
        "status": "todo",
        "created_by": str(manager.id),
        "blocked_by": None,
    }
    prereq_mock = {
        "id": t2_id,
        "workspace_id": ws_id,
        "title": "Setup Database Schema",
        "status": "in_progress",
        "blocked_by": None,
    }

    reply_comm_mock = {
        "id": reply_id,
        "task_id": t1_id,
        "workspace_id": ws_id,
        "sender_id": str(manager.id),
        "recipient_id": assignee_id,
        "message_type": "reply",
        "content": "You must wait for the database schema task to finish first.",
        "suggested_prerequisite_task_id": t2_id,
        "status": "answered",
        "created_at": "2026-11-03T20:05:00Z",
        "updated_at": "2026-11-03T20:05:00Z",
    }

    with patch("app.api.tasks.require_role", return_value="admin"), \
         patch("app.api.tasks.get_supabase_client") as mock_db_getter:

        mock_db = MagicMock()
        mock_db_getter.return_value = mock_db

        def mock_table(name: str):
            table_mock = MagicMock()
            if name == "tasks":
                def mock_select(cols):
                    sel_mock = MagicMock()
                    def mock_eq1(f1, v1):
                        eq1_mock = MagicMock()
                        def mock_eq2(f2, v2):
                            eq2_mock = MagicMock()
                            if str(v1) == t1_id:
                                eq2_mock.execute.return_value = MagicMock(data=[target_mock])
                            elif str(v1) == t2_id:
                                eq2_mock.execute.return_value = MagicMock(data=[prereq_mock])
                            else:
                                eq2_mock.execute.return_value = MagicMock(data=[])
                            return eq2_mock
                        eq1_mock.eq.side_effect = mock_eq2
                        return eq1_mock
                    sel_mock.eq.side_effect = mock_eq1
                    return sel_mock
                table_mock.select.side_effect = mock_select
                table_mock.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": t1_id}])
            elif name == "task_communications":
                table_mock.select.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
                    data=[{"sender_id": assignee_id}]
                )
                table_mock.insert.return_value.execute.return_value = MagicMock(data=[reply_comm_mock])
                table_mock.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
            elif name == "notifications":
                table_mock.insert.return_value.execute.return_value = MagicMock(data=[{"id": str(uuid4())}])
            elif name == "profiles":
                table_mock.select.return_value.in_.return_value.execute.return_value = MagicMock(data=[
                    {"id": str(manager.id), "display_name": "Manager", "email": "mgr@team.com", "avatar_url": None},
                    {"id": assignee_id, "display_name": "Dev Assignee", "email": "dev@team.com", "avatar_url": None},
                ])
            return table_mock

        mock_db.table.side_effect = mock_table

        resp = client.post(
            f"/api/workspaces/{ws_id}/tasks/{t1_id}/prerequisite-replies",
            json={
                "content": "You must wait for the database schema task to finish first.",
                "suggested_prerequisite_task_id": t2_id,
                "mark_as_resolved": False,
            }
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["task_id"] == t1_id
        assert data["message_type"] == "reply"
        assert data["suggested_prerequisite_task_id"] == t2_id
        assert data["suggested_prerequisite_task_title"] == "Setup Database Schema"
        assert data["status"] == "answered"

    app.dependency_overrides.clear()
