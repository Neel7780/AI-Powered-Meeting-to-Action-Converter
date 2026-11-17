"""Tests for BE-4 Meetings and Transcript Ingestion API."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.deps import CurrentUser, get_current_user
from main import app

client = TestClient(app)


def test_create_meeting_success():
    workspace_id = uuid4()
    caller_id = uuid4()
    participant_id = uuid4()

    mock_user = CurrentUser(id=caller_id, email="admin@example.com")

    # DB mocks
    db = MagicMock()

    # workspace_members check for caller
    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.in_.return_value = wm_mock
    # 1st call for require_role -> role='admin'
    # 2nd call for participants check -> participant_id in active members
    wm_mock.execute.side_effect = [
        MagicMock(data=[{"role": "admin"}]),
        MagicMock(data=[{"user_id": str(participant_id)}]),
    ]

    # meetings insert
    meetings_mock = MagicMock()
    meetings_mock.insert.return_value = meetings_mock
    meeting_record = {
        "id": str(uuid4()),
        "workspace_id": str(workspace_id),
        "title": "Sprint 1 Kickoff",
        "starts_at": "2026-10-15T10:00:00Z",
        "timezone": "Asia/Kolkata",
        "organiser_id": str(caller_id),
        "ai_processing": True,
        "visibility": "workspace",
        "status": "draft",
        "lifecycle": "active",
        "created_at": "2026-10-12T00:00:00Z",
    }
    meetings_mock.execute.return_value = MagicMock(data=[meeting_record])

    # participants and consents inserts
    mp_mock = MagicMock()
    mp_mock.insert.return_value = mp_mock
    mp_mock.execute.return_value = MagicMock(data=[])

    consents_mock = MagicMock()
    consents_mock.insert.return_value = consents_mock
    consents_mock.execute.return_value = MagicMock(data=[])

    def table_router(name):
        if name == "workspace_members":
            return wm_mock
        if name == "meetings":
            return meetings_mock
        if name == "meeting_participants":
            return mp_mock
        if name == "consents":
            return consents_mock
        return MagicMock()

    db.table.side_effect = table_router

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.core.deps.get_supabase_client", return_value=db), \
             patch("app.api.meetings.get_supabase_client", return_value=db):

            payload = {
                "title": "Sprint 1 Kickoff",
                "starts_at": "2026-10-15T10:00:00Z",
                "timezone": "Asia/Kolkata",
                "participant_user_ids": [str(participant_id)],
                "external_participants": ["Vendor Partner"],
                "ai_processing": True,
                "ai_attestation": True,
            }
            resp = client.post(f"/api/workspaces/{workspace_id}/meetings", json=payload)
            assert resp.status_code == 201
            data = resp.json()
            assert data["title"] == "Sprint 1 Kickoff"
            assert data["status"] == "draft"
            assert data["ai_processing"] is True
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_create_meeting_requires_attestation():
    workspace_id = uuid4()
    caller_id = uuid4()
    mock_user = CurrentUser(id=caller_id, email="admin@example.com")

    db = MagicMock()
    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "admin"}])
    db.table.return_value = wm_mock

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.core.deps.get_supabase_client", return_value=db), \
             patch("app.api.meetings.get_supabase_client", return_value=db):

            payload = {
                "title": "Sprint 1 Planning",
                "starts_at": "2026-10-15T10:00:00Z",
                "timezone": "Asia/Kolkata",
                "ai_processing": True,
                "ai_attestation": False,  # Missing required attestation!
            }
            resp = client.post(f"/api/workspaces/{workspace_id}/meetings", json=payload)
            assert resp.status_code == 422
            assert "attestation required" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_create_meeting_forbidden_for_regular_member():
    workspace_id = uuid4()
    caller_id = uuid4()
    mock_user = CurrentUser(id=caller_id, email="member@example.com")

    db = MagicMock()
    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "member"}])  # Only member role!
    db.table.return_value = wm_mock

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.core.deps.get_supabase_client", return_value=db):
            payload = {
                "title": "Unauthorized Meeting",
                "starts_at": "2026-10-15T10:00:00Z",
                "timezone": "Asia/Kolkata",
                "ai_processing": False,
                "ai_attestation": False,
            }
            resp = client.post(f"/api/workspaces/{workspace_id}/meetings", json=payload)
            assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_create_meeting_invalid_timezone():
    workspace_id = uuid4()
    caller_id = uuid4()
    mock_user = CurrentUser(id=caller_id, email="admin@example.com")

    db = MagicMock()
    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "admin"}])
    db.table.return_value = wm_mock

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.core.deps.get_supabase_client", return_value=db):
            payload = {
                "title": "Invalid TZ Meeting",
                "starts_at": "2026-10-15T10:00:00Z",
                "timezone": "Mars/Olympus_Mons",
                "ai_processing": False,
                "ai_attestation": False,
            }
            resp = client.post(f"/api/workspaces/{workspace_id}/meetings", json=payload)
            assert resp.status_code == 422
            assert "invalid timezone" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_submit_transcript_paste_success():
    meeting_id = uuid4()
    workspace_id = uuid4()
    caller_id = uuid4()
    mock_user = CurrentUser(id=caller_id, email="admin@example.com")

    db = MagicMock()

    # require_meeting_role mocks:
    # 1) select * from meetings where id = meeting_id
    # 2) select role from workspace_members
    meetings_mock = MagicMock()
    meetings_mock.select.return_value = meetings_mock
    meetings_mock.eq.return_value = meetings_mock
    meetings_mock.execute.return_value = MagicMock(data=[{
        "id": str(meeting_id),
        "workspace_id": str(workspace_id),
        "status": "draft"
    }])

    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "admin"}])

    transcripts_mock = MagicMock()
    transcripts_mock.delete.return_value = transcripts_mock
    transcripts_mock.eq.return_value = transcripts_mock
    transcripts_mock.insert.return_value = transcripts_mock
    transcripts_mock.execute.return_value = MagicMock(data=[{"id": str(uuid4())}])

    segments_mock = MagicMock()
    segments_mock.insert.return_value = segments_mock
    segments_mock.execute.return_value = MagicMock(data=[])

    def table_router(name):
        if name == "meetings":
            return meetings_mock
        if name == "workspace_members":
            return wm_mock
        if name == "transcripts":
            return transcripts_mock
        if name == "transcript_segments":
            return segments_mock
        return MagicMock()

    db.table.side_effect = table_router

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.core.deps.get_supabase_client", return_value=db), \
             patch("app.api.meetings.get_supabase_client", return_value=db):

            pasted_text = (
                "Priya: Let's start the sprint review.\n"
                "Rahul: I will fix the login bug by Wednesday.\n"
                "Aman: I will prepare the onboarding flow by Friday."
            )
            resp = client.post(
                f"/api/meetings/{meeting_id}/transcript",
                data={"text": pasted_text}
            )
            assert resp.status_code == 201
            data = resp.json()
            assert data["segment_count"] == 3
            assert data["word_count"] > 10
            assert "transcript_id" in data
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_submit_transcript_conflict_on_ready_status():
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
        "status": "ready"  # Already processed!
    }])

    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "admin"}])

    db.table.side_effect = lambda name: meetings_mock if name == "meetings" else wm_mock

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.core.deps.get_supabase_client", return_value=db):
            resp = client.post(
                f"/api/meetings/{meeting_id}/transcript",
                data={"text": "Priya: Hello"}
            )
            assert resp.status_code == 409
            assert "draft" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_submit_transcript_file_upload_vtt():
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
        "status": "draft"
    }])

    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "admin"}])

    transcripts_mock = MagicMock()
    transcripts_mock.delete.return_value = transcripts_mock
    transcripts_mock.eq.return_value = transcripts_mock
    transcripts_mock.insert.return_value = transcripts_mock
    transcripts_mock.execute.return_value = MagicMock(data=[{"id": str(uuid4())}])

    segments_mock = MagicMock()
    segments_mock.insert.return_value = segments_mock
    segments_mock.execute.return_value = MagicMock(data=[])

    db.table.side_effect = lambda name: {
        "meetings": meetings_mock,
        "workspace_members": wm_mock,
        "transcripts": transcripts_mock,
        "transcript_segments": segments_mock,
    }.get(name, MagicMock())

    storage_mock = MagicMock()
    db.storage.from_.return_value = storage_mock

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.core.deps.get_supabase_client", return_value=db), \
             patch("app.api.meetings.get_supabase_client", return_value=db):

            vtt_content = (
                "WEBVTT\n\n"
                "00:00:01.000 --> 00:00:04.000\n"
                "<v Priya>Hello team, let's start the demo.\n\n"
                "00:00:05.000 --> 00:00:08.000\n"
                "<v Rahul>I will fix the bug by tomorrow.\n"
            )

            resp = client.post(
                f"/api/meetings/{meeting_id}/transcript",
                files={"file": ("meeting.vtt", vtt_content.encode("utf-8"), "text/vtt")}
            )
            assert resp.status_code == 201
            data = resp.json()
            assert data["segment_count"] == 2
            storage_mock.upload.assert_called_once()
            call_kwargs = storage_mock.upload.call_args[1]
            assert call_kwargs["path"] == f"{workspace_id}/{meeting_id}/meeting.vtt"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_submit_transcript_unsupported_file_extension():
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
        "status": "draft"
    }])

    wm_mock = MagicMock()
    wm_mock.select.return_value = wm_mock
    wm_mock.eq.return_value = wm_mock
    wm_mock.execute.return_value = MagicMock(data=[{"role": "admin"}])

    db.table.side_effect = lambda name: meetings_mock if name == "meetings" else wm_mock

    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        with patch("app.core.deps.get_supabase_client", return_value=db), \
             patch("app.api.meetings.get_supabase_client", return_value=db):
            resp = client.post(
                f"/api/meetings/{meeting_id}/transcript",
                files={"file": ("notes.pdf", b"%PDF-1.4...", "application/pdf")}
            )
            assert resp.status_code == 422
            assert "unsupported file format" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
