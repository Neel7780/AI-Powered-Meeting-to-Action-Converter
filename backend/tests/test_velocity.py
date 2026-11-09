"""Unit tests for Sprint Velocity & Meeting Progress Tracker (Sprint 3).

Verifies workspace velocity calculation, meeting diffs, chronic spillover detection,
and privileged task rollover across meetings.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.deps import CurrentUser, get_current_user
from main import app

client = TestClient(app)


def mock_user():
    return CurrentUser(id=uuid4(), email="lead@actionpulse.io")


def test_get_sprint_velocity_success():
    app.dependency_overrides[get_current_user] = mock_user
    ws_id = str(uuid4())
    m1_id = str(uuid4())
    m2_id = str(uuid4())

    now = datetime.now(UTC)
    m1_time = (now - timedelta(days=7)).isoformat()
    m2_time = (now - timedelta(days=1)).isoformat()

    meetings_mock = [
        {"id": m1_id, "title": "Sprint 1 Kickoff", "starts_at": m1_time, "created_at": m1_time},
        {"id": m2_id, "title": "Sprint 1 Review", "starts_at": m2_time, "created_at": m2_time},
    ]

    t1_created = (now - timedelta(days=10)).isoformat()
    tasks_mock = [
        {
            "id": str(uuid4()),
            "meeting_id": m1_id,
            "title": "Task Done",
            "description": "Completed work",
            "status": "done",
            "priority": "normal",
            "deadline_utc": None,
            "completed_at": (now - timedelta(days=3)).isoformat(),
            "created_at": t1_created,
            "blocked_by": None,
            "external_owner_label": "Bharat",
            "source_excerpt": "Quote 1",
        },
        {
            "id": str(uuid4()),
            "meeting_id": m1_id,
            "title": "Task Spillover",
            "description": "Still open",
            "status": "in_progress",
            "priority": "high",
            "deadline_utc": None,
            "completed_at": None,
            "created_at": t1_created,
            "blocked_by": None,
            "external_owner_label": "Bharat",
            "source_excerpt": "Quote 2",
        },
        {
            "id": str(uuid4()),
            "meeting_id": m2_id,
            "title": "Task New",
            "description": "New in review",
            "status": "todo",
            "priority": "urgent",
            "deadline_utc": None,
            "completed_at": None,
            "created_at": m2_time,
            "blocked_by": None,
            "external_owner_label": "Neel",
            "source_excerpt": "Quote 3",
        },
    ]

    def mock_table(table_name: str):
        mock = MagicMock()
        if table_name == "meetings":
            mock.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(
                data=meetings_mock
            )
        elif table_name == "tasks":
            mock.select.return_value.eq.return_value.execute.return_value = MagicMock(
                data=tasks_mock
            )
        return mock

    mock_db = MagicMock()
    mock_db.table.side_effect = mock_table

    with patch("app.api.velocity.require_role") as mock_role, \
         patch("app.api.velocity.get_supabase_client", return_value=mock_db):
        resp = client.get(f"/api/workspaces/{ws_id}/velocity")

    app.dependency_overrides.clear()
    assert resp.status_code == 200
    data = resp.json()

    assert data["workspace_id"] == ws_id
    assert len(data["available_meetings"]) == 2
    assert data["selected_diff"] is not None
    assert data["selected_diff"]["base_meeting"]["id"] == m1_id
    assert data["selected_diff"]["current_meeting"]["id"] == m2_id
    assert len(data["selected_diff"]["completed_tasks"]) == 1
    assert len(data["selected_diff"]["carried_over_tasks"]) == 1
    assert len(data["selected_diff"]["new_action_items"]) == 1
    assert data["selected_diff"]["velocity_score"] == 50.0
    assert len(data["chronic_spillovers"]) >= 1
    assert data["kpis"]["total_meetings_analyzed"] == 2


def test_rollover_task_success():
    app.dependency_overrides[get_current_user] = mock_user
    ws_id = str(uuid4())
    task_id = str(uuid4())
    target_meeting_id = str(uuid4())

    mock_db = MagicMock()
    mock_db.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[{"id": task_id, "meeting_id": target_meeting_id}]
    )

    with patch("app.api.velocity.require_role"), \
         patch("app.api.velocity.get_supabase_client", return_value=mock_db):
        resp = client.post(
            f"/api/workspaces/{ws_id}/tasks/{task_id}/rollover",
            json={"target_meeting_id": target_meeting_id},
        )

    app.dependency_overrides.clear()
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["task_id"] == task_id
    assert data["target_meeting_id"] == target_meeting_id
