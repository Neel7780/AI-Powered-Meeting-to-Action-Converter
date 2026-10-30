"""Unit and integration tests for Workspace Analytics (Sprint 2 - Task 7).

Verifies workspace KPIs, cycle times, bottleneck detection,
and RBAC employee performance evaluation restrictions.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.deps import CurrentUser, get_current_user
from main import app

client = TestClient(app)


def mock_user_admin():
    return CurrentUser(id=uuid4(), email="admin@actionpulse.io")


def mock_user_member():
    return CurrentUser(id=uuid4(), email="member@actionpulse.io")


def test_get_analytics_as_organiser_includes_member_evaluations():
    """Organisers and admins should receive workspace KPIs AND employee scorecards."""
    app.dependency_overrides[get_current_user] = mock_user_admin
    ws_id = str(uuid4())
    user_id_1 = str(uuid4())
    user_id_2 = str(uuid4())
    meeting_id = str(uuid4())

    now = datetime.now(UTC)
    t1_created = (now - timedelta(days=5)).isoformat()
    t1_completed = (now - timedelta(days=3)).isoformat()
    t1_deadline = (now - timedelta(days=2)).isoformat()  # Finished before deadline: on time!

    t2_created = (now - timedelta(days=4)).isoformat()
    t2_deadline = (now - timedelta(days=1)).isoformat()  # Still in progress & past deadline: overdue!

    t3_created = (now - timedelta(days=2)).isoformat()

    tasks_mock_data = [
        {
            "id": "task-1",
            "title": "Build Auth",
            "status": "done",
            "priority": "high",
            "deadline_utc": t1_deadline,
            "blocked_by": None,
            "created_at": t1_created,
            "completed_at": t1_completed,
            "meeting_id": meeting_id,
            "external_owner_label": None,
        },
        {
            "id": "task-2",
            "title": "Database Optimization",
            "status": "in_progress",
            "priority": "urgent",
            "deadline_utc": t2_deadline,
            "blocked_by": "task-1",
            "created_at": t2_created,
            "completed_at": None,
            "meeting_id": meeting_id,
            "external_owner_label": None,
        },
        {
            "id": "task-3",
            "title": "Write Unit Tests",
            "status": "blocked",
            "priority": "normal",
            "deadline_utc": None,
            "blocked_by": "task-2",
            "created_at": t3_created,
            "completed_at": None,
            "meeting_id": meeting_id,
            "external_owner_label": None,
        },
    ]

    assignees_mock_data = [
        {"task_id": "task-1", "user_id": user_id_1, "is_primary": True},
        {"task_id": "task-2", "user_id": user_id_1, "is_primary": True},
        {"task_id": "task-3", "user_id": user_id_2, "is_primary": True},
    ]

    members_mock_data = [
        {"user_id": user_id_1, "role": "member"},
        {"user_id": user_id_2, "role": "member"},
    ]

    profiles_mock_data = [
        {"id": user_id_1, "display_name": "Alice Developer", "email": "alice@team.com", "avatar_url": None},
        {"id": user_id_2, "display_name": "Bob Tester", "email": "bob@team.com", "avatar_url": None},
    ]

    meetings_mock_data = [
        {"id": meeting_id, "title": "Sprint 2 Kickoff", "starts_at": (now - timedelta(days=6)).isoformat()}
    ]

    with patch("app.api.analytics.require_role", return_value="organiser"), \
         patch("app.api.analytics.get_supabase_client") as mock_db_getter:

        mock_db = MagicMock()
        mock_db_getter.return_value = mock_db

        def mock_table(name: str):
            table_mock = MagicMock()
            if name == "tasks":
                table_mock.select.return_value.eq.return_value.gte.return_value.execute.return_value = MagicMock(
                    data=tasks_mock_data
                )
            elif name == "task_assignees":
                table_mock.select.return_value.in_.return_value.execute.return_value = MagicMock(
                    data=assignees_mock_data
                )
            elif name == "meetings":
                m_mock = table_mock.select.return_value.eq.return_value.order.return_value.limit.return_value
                m_mock.execute.return_value = MagicMock(data=meetings_mock_data)
            elif name == "workspace_members":
                table_mock.select.return_value.eq.return_value.execute.return_value = MagicMock(
                    data=members_mock_data
                )
            elif name == "profiles":
                table_mock.select.return_value.in_.return_value.execute.return_value = MagicMock(
                    data=profiles_mock_data
                )
            return table_mock

        mock_db.table.side_effect = mock_table

        resp = client.get(f"/api/workspaces/{ws_id}/analytics?timeframe=30d")
        assert resp.status_code == 200
        data = resp.json()

        # Check KPIs
        assert data["user_role"] == "organiser"
        assert data["kpis"]["total_tasks"] == 3
        assert data["kpis"]["completed_tasks"] == 1
        assert data["kpis"]["currently_overdue"] == 1  # task-2 is past deadline
        assert data["kpis"]["currently_blocked"] >= 1  # task-3 is blocked
        assert data["kpis"]["completion_rate"] == 33.3

        # Check Bottleneck Analysis
        assert len(data["bottlenecks"]) >= 1
        blocked_item = next(b for b in data["bottlenecks"] if b["title"] == "Write Unit Tests")
        assert blocked_item["blocked_by_title"] == "Database Optimization"

        # Check Member Evaluations (MUST BE PRESENT FOR ORGANISER)
        assert data["member_evaluations"] is not None
        assert len(data["member_evaluations"]) == 2

        alice = next(m for m in data["member_evaluations"] if m["display_name"] == "Alice Developer")
        assert alice["total_assigned"] == 2
        assert alice["completed_total"] == 1
        assert alice["completed_on_time"] == 1
        assert alice["currently_overdue"] == 1
        assert alice["on_time_rate"] == 100.0

    app.dependency_overrides.clear()


def test_get_analytics_as_member_restricts_employee_evaluations():
    """Regular members should see team KPIs, but NOT individual employee scorecards."""
    app.dependency_overrides[get_current_user] = mock_user_member
    ws_id = str(uuid4())

    with patch("app.api.analytics.require_role", return_value="member"), \
         patch("app.api.analytics.get_supabase_client") as mock_db_getter:

        mock_db = MagicMock()
        mock_db_getter.return_value = mock_db

        def mock_table(name: str):
            table_mock = MagicMock()
            if name == "tasks":
                t_mock = table_mock.select.return_value.eq.return_value.gte.return_value
                t_mock.execute.return_value = MagicMock(data=[])
            elif name == "meetings":
                m_mock = table_mock.select.return_value.eq.return_value.order.return_value.limit.return_value
                m_mock.execute.return_value = MagicMock(data=[])
            return table_mock

        mock_db.table.side_effect = mock_table

        resp = client.get(f"/api/workspaces/{ws_id}/analytics")
        assert resp.status_code == 200
        data = resp.json()

        assert data["user_role"] == "member"
        assert data["kpis"]["total_tasks"] == 0
        # Crucial RBAC privacy check:
        assert data["member_evaluations"] is None

    app.dependency_overrides.clear()


def test_get_analytics_non_member_returns_404():
    """Users not in workspace should receive 404 (preventing workspace enumeration)."""
    app.dependency_overrides[get_current_user] = mock_user_member
    ws_id = str(uuid4())

    with patch("app.api.analytics.require_role") as mock_role:
        mock_role.side_effect = HTTPException(status_code=404, detail="Workspace not found or access denied")

        resp = client.get(f"/api/workspaces/{ws_id}/analytics")
        assert resp.status_code == 404

    app.dependency_overrides.clear()
