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
