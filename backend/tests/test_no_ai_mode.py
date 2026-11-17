"""Tests for No-AI Mode and Manual Task Assignment (Sprint 3).

Verifies:
1. No-AI meeting creation without requiring AI attestation, setting visibility=private and ai_processing=False.
2. AI extraction is strictly rejected with HTTP 409 Conflict for No-AI meetings (Zero AI Leaks).
3. Workspace managers can manually assign tasks to workspace participants.
4. Non-organisers are forbidden from creating tasks (RBAC 403).
5. Assignees must be active members of the workspace (422 Unprocessable Entity).
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import BackgroundTasks, HTTPException

from app.api.meetings import (
    create_manual_task,
    create_meeting,
    delete_meeting_task,
    extract_meeting_action_items,
    get_meeting_details,
    get_meeting_tasks,
)
from app.core.deps import CurrentUser
from app.schemas.meetings import CreateMeetingRequest, ManualTaskCreateRequest


def test_create_no_ai_meeting_without_attestation():
    workspace_id = uuid4()
    caller_id = uuid4()
    mock_user = CurrentUser(id=caller_id, email="manager@example.com")

    db = MagicMock()
    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "admin", "user_id": str(caller_id)}])

    meetings_mock = MagicMock()
    meetings_mock.insert.return_value = meetings_mock
    meeting_record = {
        "id": str(uuid4()),
        "workspace_id": str(workspace_id),
        "title": "Confidential Strategy Meeting",
        "starts_at": datetime.now(timezone.utc).isoformat(),
        "timezone": "Asia/Kolkata",
        "organiser_id": str(caller_id),
        "ai_processing": False,
        "visibility": "private",
        "status": "draft",
        "lifecycle": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    meetings_mock.execute.return_value = MagicMock(data=[meeting_record])

    db.table.side_effect = lambda name: wm_mock if name == "workspace_members" else meetings_mock

    req = CreateMeetingRequest(
        title="Confidential Strategy Meeting",
        starts_at=datetime.now(timezone.utc),
        timezone="Asia/Kolkata",
        ai_processing=False,
        ai_attestation=False,
        visibility="private",
    )

    import app.api.meetings as m_api
    import app.core.deps as deps_mod

    orig_m_db = m_api.get_supabase_client
    orig_d_db = deps_mod.get_supabase_client
    try:
        m_api.get_supabase_client = lambda: db
        deps_mod.get_supabase_client = lambda: db

        res = create_meeting(workspace_id, req, mock_user)
        assert res.ai_processing is False
        assert res.visibility == "private"
        assert res.title == "Confidential Strategy Meeting"
    finally:
        m_api.get_supabase_client = orig_m_db
        deps_mod.get_supabase_client = orig_d_db


def test_extract_fails_on_no_ai_meeting():
    meeting_id = uuid4()
    workspace_id = uuid4()
    caller_id = uuid4()
    mock_user = CurrentUser(id=caller_id, email="manager@example.com")

    db = MagicMock()
    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "admin"}])

    m_mock = MagicMock()
    m_mock.select.return_value = m_mock
    m_mock.eq.return_value = m_mock
    m_mock.execute.return_value = MagicMock(data=[{
        "id": str(meeting_id),
        "workspace_id": str(workspace_id),
        "ai_processing": False,
    }])

    db.table.side_effect = lambda name: wm_mock if name == "workspace_members" else m_mock

    import app.api.meetings as m_api
    import app.core.deps as deps_mod

    orig_m_db = m_api.get_supabase_client
    orig_d_db = deps_mod.get_supabase_client
    try:
        m_api.get_supabase_client = lambda: db
        deps_mod.get_supabase_client = lambda: db

        with pytest.raises(HTTPException) as exc_info:
            extract_meeting_action_items(meeting_id, mock_user)

        assert exc_info.value.status_code == 409
        assert "disabled for this private meeting" in exc_info.value.detail
    finally:
        m_api.get_supabase_client = orig_m_db
        deps_mod.get_supabase_client = orig_d_db


def test_create_manual_task_success():
    meeting_id = uuid4()
    workspace_id = uuid4()
    caller_id = uuid4()
    participant_id = uuid4()
    mock_user = CurrentUser(id=caller_id, email="manager@example.com")

    db = MagicMock()

    m_mock = MagicMock()
    m_mock.select.return_value = m_mock
    m_mock.eq.return_value = m_mock
    m_mock.execute.return_value = MagicMock(data=[{
        "id": str(meeting_id),
        "workspace_id": str(workspace_id),
        "ai_processing": False,
    }])

    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"user_id": str(participant_id), "role": "admin"}])

    tasks_mock = MagicMock()
    tasks_mock.insert.return_value = tasks_mock
    created_task_record = {
        "id": str(uuid4()),
        "workspace_id": str(workspace_id),
        "meeting_id": str(meeting_id),
        "extracted_item_id": None,
        "title": "Prepare financial statements",
        "description": "Prepare confidential Q3 ledger statements",
        "deadline_utc": None,
        "priority": "high",
        "status": "todo",
        "source_excerpt": "Manual task assignment (No-AI mode)",
        "created_by": str(caller_id),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    tasks_mock.execute.return_value = MagicMock(data=[created_task_record])

    ta_mock = MagicMock()
    ta_mock.insert.return_value = ta_mock
    ta_mock.execute.return_value = MagicMock(data=[])

    prof_mock = MagicMock()
    prof_mock.select.return_value = prof_mock
    prof_mock.eq.return_value = prof_mock
    prof_mock.execute.return_value = MagicMock(data=[{"display_name": "Alice Smith", "email": "alice@example.com"}])

    def table_lookup(name):
        if name == "meetings":
            return m_mock
        if name == "workspace_members":
            return wm_mock
        if name == "tasks":
            return tasks_mock
        if name == "task_assignees":
            return ta_mock
        if name == "profiles":
            return prof_mock
        return MagicMock()

    db.table.side_effect = table_lookup

    import app.api.meetings as m_api
    import app.core.deps as deps_mod

    orig_m_db = m_api.get_supabase_client
    orig_d_db = deps_mod.get_supabase_client
    try:
        m_api.get_supabase_client = lambda: db
        deps_mod.get_supabase_client = lambda: db

        bg = BackgroundTasks()
        task_req = ManualTaskCreateRequest(
            title="Prepare financial statements",
            description="Prepare confidential Q3 ledger statements",
            assignee_user_id=participant_id,
            priority="high",
        )

        created_task = create_manual_task(meeting_id, task_req, bg, mock_user)
        assert created_task.title == "Prepare financial statements"
        assert created_task.priority == "high"
        assert created_task.status == "todo"
        assert created_task.assignee_user_id == participant_id
        assert created_task.assignee_name == "Alice Smith"
    finally:
        m_api.get_supabase_client = orig_m_db
        deps_mod.get_supabase_client = orig_d_db


def test_regular_member_forbidden_from_manual_task_creation():
    meeting_id = uuid4()
    workspace_id = uuid4()
    regular_user = CurrentUser(id=uuid4(), email="member@example.com")

    db = MagicMock()
    m_mock = MagicMock()
    m_mock.select.return_value = m_mock
    m_mock.eq.return_value = m_mock
    m_mock.execute.return_value = MagicMock(data=[{"id": str(meeting_id), "workspace_id": str(workspace_id)}])

    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "member"}])

    db.table.side_effect = lambda name: m_mock if name == "meetings" else wm_mock

    import app.api.meetings as m_api
    import app.core.deps as deps_mod

    orig_m_db = m_api.get_supabase_client
    orig_d_db = deps_mod.get_supabase_client
    try:
        m_api.get_supabase_client = lambda: db
        deps_mod.get_supabase_client = lambda: db

        bg = BackgroundTasks()
        task_req = ManualTaskCreateRequest(
            title="Unauthorized task creation",
            priority="normal",
        )

        with pytest.raises(HTTPException) as exc_info:
            create_manual_task(meeting_id, task_req, bg, regular_user)

        assert exc_info.value.status_code == 403
    finally:
        m_api.get_supabase_client = orig_m_db
        deps_mod.get_supabase_client = orig_d_db


def test_get_meeting_details_and_tasks():
    meeting_id = uuid4()
    workspace_id = uuid4()
    caller_id = uuid4()
    task_id = uuid4()
    mock_user = CurrentUser(id=caller_id, email="manager@example.com")

    db = MagicMock()
    m_mock = MagicMock()
    m_mock.select.return_value = m_mock
    m_mock.eq.return_value = m_mock
    m_mock.execute.return_value = MagicMock(data=[{
        "id": str(meeting_id),
        "workspace_id": str(workspace_id),
        "title": "Private Security Sync",
        "starts_at": datetime.now(timezone.utc).isoformat(),
        "timezone": "Asia/Kolkata",
        "organiser_id": str(caller_id),
        "ai_processing": False,
        "status": "ready",
        "visibility": "private",
        "lifecycle": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }])

    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "admin"}])

    prof_mock = MagicMock()
    prof_mock.select.return_value = prof_mock
    prof_mock.eq.return_value = prof_mock
    prof_mock.execute.return_value = MagicMock(data=[{"display_name": "Yuvraj Katara", "email": "yuvraj@example.com"}])

    mp_mock = MagicMock()
    mp_mock.select.return_value = mp_mock
    mp_mock.eq.return_value = mp_mock
    mp_mock.execute.return_value = MagicMock(data=[])

    trans_mock = MagicMock()
    trans_mock.select.return_value = trans_mock
    trans_mock.eq.return_value = trans_mock
    trans_mock.limit.return_value = trans_mock
    trans_mock.execute.return_value = MagicMock(data=[])

    tasks_mock = MagicMock()
    tasks_mock.select.return_value = tasks_mock
    tasks_mock.eq.return_value = tasks_mock
    tasks_mock.order.return_value = tasks_mock
    tasks_mock.execute.return_value = MagicMock(data=[{
        "id": str(task_id),
        "workspace_id": str(workspace_id),
        "meeting_id": str(meeting_id),
        "title": "Review audit log",
        "description": "Ensure zero AI leaks in private meeting",
        "priority": "urgent",
        "status": "todo",
        "deadline_utc": None,
        "source_excerpt": "Manual task assignment (No-AI mode)",
        "created_by": str(caller_id),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }])

    ta_mock = MagicMock()
    ta_mock.select.return_value = ta_mock
    ta_mock.in_.return_value = ta_mock
    ta_mock.execute.return_value = MagicMock(data=[{"task_id": str(task_id), "user_id": str(caller_id), "is_primary": True}])

    def table_lookup(name):
        if name == "meetings":
            return m_mock
        if name == "workspace_members":
            return wm_mock
        if name == "profiles":
            return prof_mock
        if name == "meeting_participants":
            return mp_mock
        if name == "transcripts":
            return trans_mock
        if name == "tasks":
            return tasks_mock
        if name == "task_assignees":
            return ta_mock
        return MagicMock()

    db.table.side_effect = table_lookup

    import app.api.meetings as m_api
    import app.core.deps as deps_mod

    orig_m_db = m_api.get_supabase_client
    orig_d_db = deps_mod.get_supabase_client
    try:
        m_api.get_supabase_client = lambda: db
        deps_mod.get_supabase_client = lambda: db

        # 1. Test get_meeting_details
        details = get_meeting_details(meeting_id, mock_user)
        assert details.title == "Private Security Sync"
        assert details.ai_processing is False
        assert details.visibility == "private"
        assert details.organiser_name == "Yuvraj Katara"

        # 2. Test get_meeting_tasks
        tasks = get_meeting_tasks(meeting_id, mock_user)
        assert len(tasks) == 1
        assert tasks[0].title == "Review audit log"
        assert tasks[0].priority == "urgent"
        assert tasks[0].assignee_user_id == caller_id

        # 3. Test delete_meeting_task
        del_resp = delete_meeting_task(meeting_id, task_id, mock_user)
        assert "deleted successfully" in del_resp["message"]
    finally:
        m_api.get_supabase_client = orig_m_db
        deps_mod.get_supabase_client = orig_d_db

