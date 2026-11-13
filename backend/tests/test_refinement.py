"""Comprehensive unit & edge-case tests for Phase 2 Manager AI Refinement Loop."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.deps import CurrentUser, get_current_user
from app.services.llm.chain import LLMCall
from app.services.llm.prompt import LLMExtraction, LLMItem
from app.services.llm.refine import run_refinement
from main import app

client = TestClient(app)


def _setup_mock_supabase_for_refinement(
    meeting_id,
    workspace_id,
    approved_items=None,
    pending_items=None,
    members=None,
):
    caller_id = uuid4()
    mock_user = CurrentUser(id=caller_id, email="admin@actionpulse.io")

    if approved_items is None:
        approved_items = [
            {
                "id": str(uuid4()),
                "meeting_id": str(meeting_id),
                "type": "action",
                "task": "Fix webhook headers validation",
                "owner_name": "Madhav",
                "owner_user_id": str(caller_id),
                "deadline_utc": "2026-11-13T18:29:59Z",
                "review_status": "approved",
                "source_excerpt": "I will fix the webhook headers validation work by this Friday.",
            }
        ]
    if pending_items is None:
        pending_items = [
            {
                "id": str(uuid4()),
                "meeting_id": str(meeting_id),
                "type": "action",
                "task": "Run the Chrome extension upload test",
                "owner_name": "Madhav",
                "owner_user_id": str(caller_id),
                "deadline_utc": "2026-11-16T11:30:00Z",
                "review_status": "needs_review",
                "source_excerpt": "we also need to run the Chrome extension update. Sorry, upload test by before Monday 5 PM.",
            }
        ]
    if members is None:
        members = [
            {"user_id": str(caller_id), "role": "admin"},
            {"user_id": str(uuid4()), "role": "team_member"},
        ]

    db = MagicMock()

    def _table(name: str):
        tbl = MagicMock()
        tbl.select.return_value = tbl
        tbl.eq.return_value = tbl
        tbl.in_.return_value = tbl
        tbl.order.return_value = tbl
        tbl.delete.return_value = tbl
        tbl.update.return_value = tbl
        tbl.insert.return_value = tbl

        if name == "meetings":
            tbl.execute.return_value = MagicMock(data=[{
                "id": str(meeting_id),
                "workspace_id": str(workspace_id),
                "title": "Sprint 102 Sync",
                "timezone": "Asia/Kolkata",
                "starts_at": "2026-11-12T10:00:00Z",
                "ai_processing": True,
                "status": "ready",
            }])
        elif name == "transcripts":
            tbl.execute.return_value = MagicMock(data=[{
                "id": str(uuid4()),
                "meeting_id": str(meeting_id),
                "canonical_text": (
                    "Madhav: I will fix the webhook headers validation work by this Friday.\n"
                    "Madhav: Also run the Chrome extension upload test before Monday 5 PM.\n"
                    "Bharat: I will prepare the database migration script before Thursday."
                ),
            }])
        elif name == "transcript_segments":
            tbl.execute.return_value = MagicMock(data=[
                {
                    "text": "I will fix the webhook headers validation work by this Friday.",
                    "speaker_name": "Madhav",
                    "start_ms": 10000,
                    "end_ms": 15000,
                },
                {
                    "text": "Also run the Chrome extension upload test before Monday 5 PM.",
                    "speaker_name": "Madhav",
                    "start_ms": 16000,
                    "end_ms": 22000,
                },
                {
                    "text": "I will prepare the database migration script before Thursday.",
                    "speaker_name": "Bharat",
                    "start_ms": 23000,
                    "end_ms": 28000,
                },
            ])
        elif name == "workspace_members":
            tbl.execute.return_value = MagicMock(data=members)
        elif name == "profiles":
            tbl.execute.return_value = MagicMock(data=[
                {"id": str(caller_id), "display_name": "Madhav Chauhan", "email": "admin@actionpulse.io"},
                {"id": members[1]["user_id"], "display_name": "Bharat Odedara", "email": "bharat@actionpulse.io"},
            ])
        elif name == "extracted_items":
            # For select: return combined approved + pending
            # For delete: track delete query
            # For insert: return inserted items
            tbl.execute.side_effect = [
                MagicMock(data=approved_items + pending_items),  # select all items
                MagicMock(data=[]),  # delete needs_review items
                MagicMock(data=[{
                    "id": str(uuid4()),
                    "task": "Run Chrome extension upload test with Bharat",
                    "review_status": "needs_review",
                }]),  # insert newly refined items
            ]
        elif name == "llm_runs":
            tbl.execute.return_value = MagicMock(data=[{"id": str(uuid4())}])
        else:
            tbl.execute.return_value = MagicMock(data=[])

        return tbl

    db.table.side_effect = _table
    return db, mock_user, members


def test_refine_endpoint_forbidden_for_regular_member():
    """Non-manager role cannot invoke refinement."""
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
        "status": "ready",
        "ai_processing": True,
    }])
    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "team_member"}])

    def _table(name):
        if name == "meetings":
            return meetings_mock
        return wm_mock

    db.table.side_effect = _table

    with patch("app.core.deps.get_supabase_client", return_value=db), \
         patch("app.api.review.get_supabase_client", return_value=db):
        app.dependency_overrides[get_current_user] = lambda: mock_user
        try:
            resp = client.post(f"/api/meetings/{meeting_id}/refine", json={"feedback": "Update task 1"})
            assert resp.status_code == 403
            assert "Forbidden" in resp.json()["detail"]
        finally:
            app.dependency_overrides.pop(get_current_user, None)


def test_refine_endpoint_rejects_empty_feedback():
    """Empty feedback prompt triggers 422 error."""
    meeting_id = uuid4()
    workspace_id = uuid4()
    caller_id = uuid4()
    mock_user = CurrentUser(id=caller_id, email="admin@example.com")

    db = MagicMock()
    m_mock = MagicMock()
    m_mock.select.return_value = m_mock
    m_mock.eq.return_value = m_mock
    m_mock.execute.return_value = MagicMock(data=[{
        "id": str(meeting_id),
        "workspace_id": str(workspace_id),
        "ai_processing": True,
        "status": "ready",
    }])
    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "admin"}])

    def _table(name):
        return m_mock if name == "meetings" else wm_mock

    db.table.side_effect = _table

    with patch("app.core.deps.get_supabase_client", return_value=db), \
         patch("app.api.review.get_supabase_client", return_value=db), \
         patch("app.api.review.llm_is_configured", return_value=True):
        app.dependency_overrides[get_current_user] = lambda: mock_user
        try:
            resp = client.post(f"/api/meetings/{meeting_id}/refine", json={"feedback": "   "})
            assert resp.status_code == 422
        finally:
            app.dependency_overrides.pop(get_current_user, None)


def test_refinement_preserves_approved_items_and_replaces_only_pending():
    """Approved items remain locked on the taskboard; only pending items get refined."""
    meeting_id = uuid4()
    workspace_id = uuid4()
    db, mock_user, members = _setup_mock_supabase_for_refinement(meeting_id, workspace_id)

    # Simulated LLM refinement output
    simulated_refined_items = LLMExtraction(items=[
        LLMItem(
            type="action",
            task="Run the Chrome extension upload test with Bharat",
            owner_name="Bharat",
            owner_ref="M2",
            owner_confidence=0.95,
            deadline_raw="by Monday 5 PM",
            deadline_date="2026-11-16",
            deadline_time="17:00",
            deadline_confidence=0.9,
            priority="urgent",
            source_excerpt="Also run the Chrome extension upload test before Monday 5 PM.",
            confidence=0.98,
        )
    ])
    mock_calls = [LLMCall(input_tokens=250, output_tokens=100, latency_ms=850, payload_hash="hash123")]

    with patch("app.services.llm.refine.get_supabase_client", return_value=db), \
         patch("app.services.llm.refine.refine", return_value=(simulated_refined_items, mock_calls)):
        count = run_refinement(meeting_id, "Assign Chrome extension testing to Bharat and set urgent priority")
        assert count == 1


def test_refinement_adds_missing_task_requested_by_manager():
    """Manager asks to add an omitted task from the transcript, producing 2 pending items."""
    meeting_id = uuid4()
    workspace_id = uuid4()
    db, mock_user, members = _setup_mock_supabase_for_refinement(meeting_id, workspace_id)

    simulated_refined_items = LLMExtraction(items=[
        LLMItem(
            type="action",
            task="Run the Chrome extension upload test",
            owner_name="Madhav",
            owner_ref="M1",
            deadline_date="2026-11-16",
            deadline_time="17:00",
            source_excerpt="Also run the Chrome extension upload test before Monday 5 PM.",
            confidence=0.95,
        ),
        LLMItem(
            type="action",
            task="Prepare the database migration script",
            owner_name="Bharat",
            owner_ref="M2",
            deadline_date="2026-11-19",
            source_excerpt="I will prepare the database migration script before Thursday.",
            confidence=0.96,
        ),
    ])
    mock_calls = [LLMCall(input_tokens=300, output_tokens=180, latency_ms=920, payload_hash="hash456")]

    with patch("app.services.llm.refine.get_supabase_client", return_value=db), \
         patch("app.services.llm.refine.refine", return_value=(simulated_refined_items, mock_calls)):
        count = run_refinement(meeting_id, "Add the database migration task spoken by Bharat before Thursday")
        assert count == 2


def test_refine_endpoint_full_integration_success():
    """Verify POST /api/meetings/{id}/refine endpoint returns 200 OK with formatted RefineResponse."""
    meeting_id = uuid4()
    workspace_id = uuid4()
    caller_id = uuid4()
    mock_user = CurrentUser(id=caller_id, email="admin@example.com")

    db = MagicMock()
    meetings_mock = MagicMock()
    meetings_mock.select.return_value = meetings_mock
    meetings_mock.eq.return_value = meetings_mock
    meetings_mock.execute.return_value = MagicMock(data=[{
        "id": str(meeting_id),
        "workspace_id": str(workspace_id),
        "ai_processing": True,
        "status": "ready",
    }])
    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "admin"}])

    def _table(name):
        return meetings_mock if name == "meetings" else wm_mock

    db.table.side_effect = _table

    with patch("app.core.deps.get_supabase_client", return_value=db), \
         patch("app.api.review.get_supabase_client", return_value=db), \
         patch("app.api.review.llm_is_configured", return_value=True), \
         patch("app.api.review.run_refinement", return_value=2):
        app.dependency_overrides[get_current_user] = lambda: mock_user
        try:
            resp = client.post(
                f"/api/meetings/{meeting_id}/refine",
                json={"feedback": "Change the deadline for task 1 to next Tuesday 5 PM"}
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is True
            assert data["refined_count"] == 2
            assert "Successfully refined candidate items based on manager feedback" in data["message"]
        finally:
            app.dependency_overrides.pop(get_current_user, None)
