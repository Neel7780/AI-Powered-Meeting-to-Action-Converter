"""Unit tests for Meeting Chatbot API and Assistant Service."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.deps import CurrentUser, get_current_user
from main import app

client = TestClient(app)


def test_chat_message_unauthenticated():
    """Missing or invalid token returns 401 or 403."""
    res = client.post("/api/chat/message", json={
        "workspace_id": str(uuid4()),
        "query": "What did we decide?"
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
                "query": "Which tasks are pending?"
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

    # 1. workspace_members check -> role='member'
    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "member"}])

    # 2. meetings query
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
        "lifecycle": "active"
    }])

    # 3. tasks query
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
        "created_at": "2026-10-20T11:00:00Z"
    }])

    # 4. task_assignees and profiles
    ta_mock = MagicMock()
    ta_mock.select.return_value = ta_mock
    ta_mock.in_.return_value = ta_mock
    ta_mock.execute.return_value = MagicMock(data=[{
        "task_id": str(task_id),
        "user_id": str(caller_id),
        "is_primary": True
    }])

    profiles_mock = MagicMock()
    profiles_mock.select.return_value = profiles_mock
    profiles_mock.in_.return_value = profiles_mock
    profiles_mock.execute.return_value = MagicMock(data=[{
        "id": str(caller_id),
        "display_name": "Bharat Odedara",
        "email": "bharat@example.com"
    }])

    # 5. extracted_items
    ei_mock = MagicMock()
    ei_mock.select.return_value = ei_mock
    ei_mock.in_.return_value = ei_mock
    ei_mock.execute.return_value = MagicMock(data=[])

    # 6. transcripts
    tr_mock = MagicMock()
    tr_mock.select.return_value = tr_mock
    tr_mock.in_.return_value = tr_mock
    tr_mock.execute.return_value = MagicMock(data=[{
        "id": str(uuid4()),
        "meeting_id": str(meeting_id),
        "canonical_text": "Bharat will configure Brevo credentials by Friday evening."
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
                "query": "Which tasks are still pending?"
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
        "status": "ready"
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
