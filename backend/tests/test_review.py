"""Tests for BE-4 Review & Approval API (approve / reject)."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.deps import CurrentUser, get_current_user
from main import app

client = TestClient(app)


def test_approve_action_item_creates_task_and_assignee():
    meeting_id = uuid4()
    workspace_id = uuid4()
    caller_id = uuid4()
    owner_id = uuid4()
    item_id = uuid4()

    mock_user = CurrentUser(id=caller_id, email="admin@example.com")

    db = MagicMock()

    # require_meeting_role mocks
    meetings_mock = MagicMock()
    meetings_mock.select.return_value = meetings_mock
    meetings_mock.eq.return_value = meetings_mock
    meetings_mock.execute.return_value = MagicMock(data=[{
        "id": str(meeting_id),
        "workspace_id": str(workspace_id),
        "timezone": "Asia/Kolkata",
        "status": "ready"
    }])

    # workspace_members check: 1) caller role=admin, 2) owner is active member
    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.in_.return_value = wm_mock
    wm_mock.execute.side_effect = [
        MagicMock(data=[{"role": "admin"}]),
        MagicMock(data=[{"user_id": str(owner_id)}]),
    ]

    # extracted_items mock
    items_mock = MagicMock()
    items_mock.select.return_value = items_mock
    items_mock.eq.return_value = items_mock
    items_mock.in_.return_value = items_mock
    items_mock.update.return_value = items_mock
    item_record = {
        "id": str(item_id),
        "meeting_id": str(meeting_id),
        "type": "action",
        "task": "Fix login bug on Safari",
        "owner_name": "Rahul",
        "owner_user_id": None,
        "deadline_utc": "2026-10-18T18:29:59Z",
        "priority": "normal",
        "source_excerpt": "I will fix the login bug on Safari by Wednesday.",
        "review_status": "needs_review",
    }
    items_mock.execute.return_value = MagicMock(data=[item_record])

    # tasks mock
    task_id = str(uuid4())
    tasks_mock = MagicMock()
    tasks_mock.insert.return_value = tasks_mock
    tasks_mock.execute.return_value = MagicMock(data=[{"id": task_id}])

    # task_assignees mock
    assignees_mock = MagicMock()
    assignees_mock.insert.return_value = assignees_mock
    assignees_mock.execute.return_value = MagicMock(data=[])

    def table_router(name):
        return {
            "meetings": meetings_mock,
            "workspace_members": wm_mock,
            "extracted_items": items_mock,
            "tasks": tasks_mock,
            "task_assignees": assignees_mock,
        }.get(name, MagicMock())

    db.table.side_effect = table_router

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.core.deps.get_supabase_client", return_value=db), \
             patch("app.api.review.get_supabase_client", return_value=db), \
             patch("app.api.review.notify_tasks_assigned") as mock_notify:

            payload = {
                "items": [
                    {
                        "id": str(item_id),
                        "task": "Fix Safari login bug immediately",
                        "owner_user_id": str(owner_id),
                        "priority": "urgent",
                        "deadline_date": "2026-10-21"
                    }
                ]
            }
            resp = client.post(f"/api/meetings/{meeting_id}/approve", json=payload)
            assert resp.status_code == 200
            data = resp.json()
            assert data["approved"] == 1
            assert data["task_ids"] == [task_id]

            # Verify task was inserted with verbatim excerpt
            task_call = tasks_mock.insert.call_args[0][0]
            assert task_call["title"] == "Fix Safari login bug immediately"
            assert task_call["priority"] == "urgent"
            assert task_call["deadline_utc"] == "2026-10-21T18:29:59+00:00"
            assert items_mock.update.call_args.args[0]["deadline_utc"] == task_call["deadline_utc"]
            assert task_call["source_excerpt"] == "I will fix the login bug on Safari by Wednesday."
            assert task_call["created_by"] == str(caller_id)

            # Verify primary assignee inserted
            assignee_call = assignees_mock.insert.call_args[0][0]
            assert assignee_call["task_id"] == task_id
            assert assignee_call["user_id"] == str(owner_id)
            assert assignee_call["is_primary"] is True

            # Verify notify_tasks_assigned background task was queued
            mock_notify.assert_called_once()
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_approve_decision_item_creates_no_task():
    meeting_id = uuid4()
    workspace_id = uuid4()
    caller_id = uuid4()
    item_id = uuid4()

    mock_user = CurrentUser(id=caller_id, email="admin@example.com")
    db = MagicMock()

    meetings_mock = MagicMock()
    meetings_mock.select.return_value = meetings_mock
    meetings_mock.eq.return_value = meetings_mock
    meetings_mock.execute.return_value = MagicMock(data=[{
        "id": str(meeting_id),
        "workspace_id": str(workspace_id),
        "status": "ready"
    }])

    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "admin"}])

    items_mock = MagicMock()
    items_mock.select.return_value = items_mock
    items_mock.eq.return_value = items_mock
    items_mock.in_.return_value = items_mock
    items_mock.update.return_value = items_mock
    item_record = {
        "id": str(item_id),
        "meeting_id": str(meeting_id),
        "type": "decision",  # Decision type!
        "task": "Use Supabase Storage instead of S3",
        "source_excerpt": "We decided to use Supabase Storage instead of S3.",
        "review_status": "needs_review",
    }
    items_mock.execute.return_value = MagicMock(data=[item_record])

    tasks_mock = MagicMock()
    tasks_mock.insert.return_value = tasks_mock

    db.table.side_effect = lambda name: {
        "meetings": meetings_mock,
        "workspace_members": wm_mock,
        "extracted_items": items_mock,
        "tasks": tasks_mock,
    }.get(name, MagicMock())

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.core.deps.get_supabase_client", return_value=db), \
             patch("app.api.review.get_supabase_client", return_value=db):

            payload = {"items": [{"id": str(item_id)}]}
            resp = client.post(f"/api/meetings/{meeting_id}/approve", json=payload)
            assert resp.status_code == 200
            data = resp.json()
            assert data["approved"] == 1
            assert data["task_ids"] == []  # No task created for decisions!
            tasks_mock.insert.assert_not_called()
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_approve_already_approved_item_returns_conflict():
    meeting_id = uuid4()
    workspace_id = uuid4()
    caller_id = uuid4()
    item_id = uuid4()

    mock_user = CurrentUser(id=caller_id, email="admin@example.com")
    db = MagicMock()

    meetings_mock = MagicMock()
    meetings_mock.select.return_value = meetings_mock
    meetings_mock.eq.return_value = meetings_mock
    meetings_mock.execute.return_value = MagicMock(data=[{
        "id": str(meeting_id),
        "workspace_id": str(workspace_id),
        "status": "ready"
    }])

    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "admin"}])

    items_mock = MagicMock()
    items_mock.select.return_value = items_mock
    items_mock.eq.return_value = items_mock
    items_mock.in_.return_value = items_mock
    item_record = {
        "id": str(item_id),
        "meeting_id": str(meeting_id),
        "type": "action",
        "review_status": "approved",  # Already approved!
    }
    items_mock.execute.return_value = MagicMock(data=[item_record])

    db.table.side_effect = lambda name: {
        "meetings": meetings_mock,
        "workspace_members": wm_mock,
        "extracted_items": items_mock,
    }.get(name, MagicMock())

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.core.deps.get_supabase_client", return_value=db), \
             patch("app.api.review.get_supabase_client", return_value=db):

            payload = {"items": [{"id": str(item_id)}]}
            resp = client.post(f"/api/meetings/{meeting_id}/approve", json=payload)
            assert resp.status_code == 409
            assert "expected 'needs_review'" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_approve_non_member_owner_returns_422():
    meeting_id = uuid4()
    workspace_id = uuid4()
    caller_id = uuid4()
    item_id = uuid4()
    external_owner = uuid4()

    mock_user = CurrentUser(id=caller_id, email="admin@example.com")
    db = MagicMock()

    meetings_mock = MagicMock()
    meetings_mock.select.return_value = meetings_mock
    meetings_mock.eq.return_value = meetings_mock
    meetings_mock.execute.return_value = MagicMock(data=[{
        "id": str(meeting_id),
        "workspace_id": str(workspace_id),
        "status": "ready"
    }])

    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.in_.return_value = wm_mock
    wm_mock.execute.side_effect = [
        MagicMock(data=[{"role": "admin"}]),
        MagicMock(data=[]),  # external_owner is NOT in workspace_members!
    ]

    items_mock = MagicMock()
    items_mock.select.return_value = items_mock
    items_mock.eq.return_value = items_mock
    items_mock.in_.return_value = items_mock
    item_record = {
        "id": str(item_id),
        "meeting_id": str(meeting_id),
        "type": "action",
        "task": "Test Task",
        "source_excerpt": "Test excerpt.",
        "review_status": "needs_review",
    }
    items_mock.execute.return_value = MagicMock(data=[item_record])

    db.table.side_effect = lambda name: {
        "meetings": meetings_mock,
        "workspace_members": wm_mock,
        "extracted_items": items_mock,
    }.get(name, MagicMock())

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.core.deps.get_supabase_client", return_value=db), \
             patch("app.api.review.get_supabase_client", return_value=db):

            payload = {"items": [{"id": str(item_id), "owner_user_id": str(external_owner)}]}
            resp = client.post(f"/api/meetings/{meeting_id}/approve", json=payload)
            assert resp.status_code == 422
            assert "not an active member" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_approve_forbidden_for_regular_member():
    meeting_id = uuid4()
    workspace_id = uuid4()
    caller_id = uuid4()

    mock_user = CurrentUser(id=caller_id, email="member@example.com")
    db = MagicMock()

    meetings_mock = MagicMock()
    meetings_mock.select.return_value = meetings_mock
    meetings_mock.eq.return_value = meetings_mock
    meetings_mock.execute.return_value = MagicMock(data=[{
        "id": str(meeting_id),
        "workspace_id": str(workspace_id),
        "status": "ready"
    }])

    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "member"}])  # Only member!

    db.table.side_effect = lambda name: meetings_mock if name == "meetings" else wm_mock

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.core.deps.get_supabase_client", return_value=db):
            payload = {"items": [{"id": str(uuid4())}]}
            resp = client.post(f"/api/meetings/{meeting_id}/approve", json=payload)
            assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_reject_candidate_items_success():
    meeting_id = uuid4()
    workspace_id = uuid4()
    caller_id = uuid4()
    item_id = uuid4()

    mock_user = CurrentUser(id=caller_id, email="admin@example.com")
    db = MagicMock()

    meetings_mock = MagicMock()
    meetings_mock.select.return_value = meetings_mock
    meetings_mock.eq.return_value = meetings_mock
    meetings_mock.execute.return_value = MagicMock(data=[{
        "id": str(meeting_id),
        "workspace_id": str(workspace_id),
        "status": "ready"
    }])

    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "admin"}])

    items_mock = MagicMock()
    items_mock.select.return_value = items_mock
    items_mock.eq.return_value = items_mock
    items_mock.in_.return_value = items_mock
    items_mock.update.return_value = items_mock
    item_record = {
        "id": str(item_id),
        "review_status": "needs_review",
    }
    items_mock.execute.return_value = MagicMock(data=[item_record])

    db.table.side_effect = lambda name: {
        "meetings": meetings_mock,
        "workspace_members": wm_mock,
        "extracted_items": items_mock,
    }.get(name, MagicMock())

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.core.deps.get_supabase_client", return_value=db), \
             patch("app.api.review.get_supabase_client", return_value=db):

            payload = {"item_ids": [str(item_id)], "reason": "Duplicate conversation topic"}
            resp = client.post(f"/api/meetings/{meeting_id}/reject", json=payload)
            assert resp.status_code == 200
            data = resp.json()
            assert data["rejected"] == 1

            # Verify update was called with review_status=rejected and reason
            update_call = items_mock.update.call_args[0][0]
            assert update_call["review_status"] == "rejected"
            assert update_call["reviewed_by"] == str(caller_id)
            assert update_call["rejection_reason"] == "Duplicate conversation topic"
            assert "reviewed_at" in update_call
    finally:
        app.dependency_overrides.pop(get_current_user, None)
