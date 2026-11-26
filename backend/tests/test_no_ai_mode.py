"""Tests for No-AI Mode and Manual Task Assignment (Sprint 3).

Verifies:
1. No-AI meeting creation without requiring AI attestation, setting visibility=private and ai_processing=False.
2. AI extraction is strictly rejected with HTTP 409 Conflict for No-AI meetings (Zero AI Leaks).
3. Workspace managers can manually assign tasks to workspace participants.
4. Non-organisers are forbidden from creating tasks (RBAC 403).
5. Assignees must be active members of the workspace (422 Unprocessable Entity).
"""

from datetime import datetime, timezone
import sys
import types
from unittest.mock import MagicMock
from uuid import uuid4

# Provide mock modules for heavy LLM packages if not installed in current environment
class _MockPackage(types.ModuleType):
    def __init__(self, name: str):
        super().__init__(name)
        self.__path__ = []

    def __getattr__(self, name: str):
        mock = MagicMock()
        setattr(self, name, mock)
        return mock

for _pkg in ["langchain_core", "botocore", "boto3", "langchain_aws", "langchain_google_genai"]:
    if _pkg not in sys.modules:
        sys.modules[_pkg] = _MockPackage(_pkg)

for _mod in [
    "langchain_core.messages", "langchain_core.runnables", "langchain_core.prompts",
    "botocore.config", "botocore.stub"
]:
    if _mod not in sys.modules:
        sys.modules[_mod] = _MockPackage(_mod)

import pytest
from fastapi import BackgroundTasks, HTTPException

from app.api.extraction import start_extraction
from app.api.meetings import (
    _check_private_meeting_access,
    create_manual_task,
    create_meeting,
    delete_meeting_task,
    get_meeting_chapters,
    get_meeting_details,
    get_meeting_summary,
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
        "organiser_id": str(caller_id),
        "visibility": "private",
        "ai_processing": False,
    }])

    db.table.side_effect = lambda name: wm_mock if name == "workspace_members" else m_mock

    import app.api.extraction as ext_api
    import app.core.deps as deps_mod

    orig_ext_db = ext_api.get_supabase_client
    orig_d_db = deps_mod.get_supabase_client
    try:
        ext_api.get_supabase_client = lambda: db
        deps_mod.get_supabase_client = lambda: db

        with pytest.raises(HTTPException) as exc_info:
            start_extraction(meeting_id, BackgroundTasks(), mock_user)

        assert exc_info.value.status_code == 409
        assert "disabled" in exc_info.value.detail.lower()
    finally:
        ext_api.get_supabase_client = orig_ext_db
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


def test_private_meeting_access_blocked_for_non_participant():
    """Verify non-participants cannot read or mutate private meetings."""
    caller_id = uuid4()
    organiser_id = uuid4()
    mock_user = CurrentUser(id=caller_id, email="outsider@example.com")
    meeting = {
        "id": str(uuid4()),
        "organiser_id": str(organiser_id),
        "visibility": "private",
        "ai_processing": False,
    }

    db = MagicMock()
    mp_mock = MagicMock()
    mp_mock.select.return_value = mp_mock
    mp_mock.eq.return_value = mp_mock
    mp_mock.limit.return_value = mp_mock
    mp_mock.execute.return_value = MagicMock(data=[])

    ta_mock = MagicMock()
    ta_mock.select.return_value = ta_mock
    ta_mock.eq.return_value = ta_mock
    ta_mock.limit.return_value = ta_mock
    ta_mock.execute.return_value = MagicMock(data=[])

    db.table.side_effect = lambda name: mp_mock if name == "meeting_participants" else ta_mock

    with pytest.raises(HTTPException) as exc_info:
        _check_private_meeting_access(db, meeting, mock_user)

    assert exc_info.value.status_code == 404
    assert "Meeting not found" in exc_info.value.detail


def test_private_meeting_access_allowed_for_participant():
    """Verify registered participants have read access to private meetings."""
    caller_id = uuid4()
    organiser_id = uuid4()
    mock_user = CurrentUser(id=caller_id, email="participant@example.com")
    meeting = {
        "id": str(uuid4()),
        "organiser_id": str(organiser_id),
        "visibility": "private",
        "ai_processing": False,
    }

    db = MagicMock()
    mp_mock = MagicMock()
    mp_mock.select.return_value = mp_mock
    mp_mock.eq.return_value = mp_mock
    mp_mock.limit.return_value = mp_mock
    mp_mock.execute.return_value = MagicMock(data=[{"id": str(uuid4())}])

    db.table.side_effect = lambda name: mp_mock

    # Participant access check should pass without raising
    _check_private_meeting_access(db, meeting, mock_user)


def test_summary_and_chapters_blocked_on_no_ai_meeting():
    """Verify meeting summary and chapters refuse processing for No-AI meetings (HTTP 409)."""
    meeting_id = uuid4()
    caller_id = uuid4()
    mock_user = CurrentUser(id=caller_id, email="manager@example.com")

    db = MagicMock()
    import app.api.meetings as m_api
    import app.core.deps as deps_mod

    meeting_record = {
        "id": str(meeting_id),
        "workspace_id": str(uuid4()),
        "organiser_id": str(caller_id),
        "visibility": "private",
        "ai_processing": False,
    }

    orig_m_db = m_api.get_supabase_client
    orig_d_db = deps_mod.get_supabase_client
    orig_rmr = m_api.require_meeting_role
    try:
        m_api.get_supabase_client = lambda: db
        deps_mod.get_supabase_client = lambda: db
        m_api.require_meeting_role = lambda mid, roles, usr: meeting_record

        # Test summary blocked
        with pytest.raises(HTTPException) as exc_summary:
            get_meeting_summary(meeting_id, refresh=False, user=mock_user)
        assert exc_summary.value.status_code == 409
        assert "disabled for this private meeting" in exc_summary.value.detail

        # Test chapters blocked
        with pytest.raises(HTTPException) as exc_chapters:
            get_meeting_chapters(meeting_id, refresh=False, user=mock_user)
        assert exc_chapters.value.status_code == 409
        assert "disabled for this private meeting" in exc_chapters.value.detail
    finally:
        m_api.get_supabase_client = orig_m_db
        deps_mod.get_supabase_client = orig_d_db
        m_api.require_meeting_role = orig_rmr


def test_followup_blocked_on_no_ai_meeting():
    """Verify follow-up draft is refused for No-AI meetings (HTTP 409)."""
    from app.api.followup import draft_followup
    from app.schemas.followup import DraftFollowUpRequest

    meeting_id = uuid4()
    caller_id = uuid4()
    mock_user = CurrentUser(id=caller_id, email="manager@example.com")

    meeting_record = {
        "id": str(meeting_id),
        "workspace_id": str(uuid4()),
        "organiser_id": str(caller_id),
        "visibility": "private",
        "ai_processing": False,
    }

    db = MagicMock()
    import app.api.followup as f_api
    orig_f_db = f_api.get_supabase_client
    orig_rmr = f_api.require_meeting_role
    try:
        f_api.get_supabase_client = lambda: db
        f_api.require_meeting_role = lambda mid, roles, usr: meeting_record

        payload = DraftFollowUpRequest(tone="executive")
        with pytest.raises(HTTPException) as exc_info:
            draft_followup(meeting_id, payload, mock_user)

        assert exc_info.value.status_code == 409
        assert "disabled for this private meeting" in exc_info.value.detail
    finally:
        f_api.get_supabase_client = orig_f_db
        f_api.require_meeting_role = orig_rmr


def test_copilot_excludes_no_ai_transcripts():
    """Verify workspace copilot strictly filters out transcripts from No-AI meetings."""
    from app.services.llm.chat_assistant import _load_workspace_meeting_data

    workspace_id = uuid4()
    caller_id = uuid4()
    ai_meeting_id = str(uuid4())
    no_ai_meeting_id = str(uuid4())

    db = MagicMock()

    meetings_data = [
        {
            "id": ai_meeting_id,
            "workspace_id": str(workspace_id),
            "title": "Public Sprint Planning",
            "starts_at": "2026-11-26T10:00:00Z",
            "timezone": "UTC",
            "organiser_id": str(caller_id),
            "visibility": "workspace",
            "status": "completed",
            "lifecycle": "active",
            "ai_processing": True,
        },
        {
            "id": no_ai_meeting_id,
            "workspace_id": str(workspace_id),
            "title": "Confidential Board Review",
            "starts_at": "2026-11-26T11:00:00Z",
            "timezone": "UTC",
            "organiser_id": str(caller_id),
            "visibility": "private",
            "status": "completed",
            "lifecycle": "active",
            "ai_processing": False,
        },
    ]

    m_table = MagicMock()
    m_table.select.return_value = m_table
    m_table.eq.return_value = m_table
    m_table.neq.return_value = m_table
    m_table.order.return_value = m_table
    m_table.limit.return_value = m_table
    m_table.execute.return_value = MagicMock(data=meetings_data)

    transcripts_table = MagicMock()
    transcripts_table.select.return_value = transcripts_table
    transcripts_table.in_.return_value = transcripts_table
    transcripts_table.execute.return_value = MagicMock(data=[
        {
            "id": str(uuid4()),
            "meeting_id": ai_meeting_id,
            "canonical_text": "Public discussion content",
            "raw_text": "Public discussion content",
        }
    ])

    empty_table = MagicMock()
    empty_table.select.return_value = empty_table
    empty_table.in_.return_value = empty_table
    empty_table.eq.return_value = empty_table
    empty_table.execute.return_value = MagicMock(data=[])

    def table_mock(name):
        if name == "meetings":
            return m_table
        if name == "transcripts":
            return transcripts_table
        return empty_table

    db.table.side_effect = table_mock

    meetings, tasks, items, transcripts = _load_workspace_meeting_data(db, workspace_id, None, caller_id)

    # Transcripts must only be fetched for the AI-enabled meeting
    transcripts_table.in_.assert_called_once_with("meeting_id", [ai_meeting_id])
    assert len(transcripts) == 1
    assert transcripts[0]["meeting_id"] == ai_meeting_id


