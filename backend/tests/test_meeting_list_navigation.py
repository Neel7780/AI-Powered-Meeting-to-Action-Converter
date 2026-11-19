from datetime import UTC, datetime
from uuid import uuid4

from app.api.meetings import _meeting_list_items


def test_meeting_list_counts_and_preserves_speaker_state():
    now = datetime(2026, 11, 18, tzinfo=UTC)
    organiser = str(uuid4())
    base = {
        "id": str(uuid4()),
        "title": "Release planning",
        "starts_at": "2026-11-16T10:00:00+00:00",
        "created_at": "2026-11-16T09:00:00+00:00",
        "timezone": "UTC",
        "status": "ready",
        "organiser_id": organiser,
        "transcripts": {"id": str(uuid4()), "source": "audio"},
        "speaker_mapping_required": True,
        "tasks": [
            {"status": "blocked", "deadline_utc": "2026-11-17T10:00:00+00:00"},
            {"status": "in_progress", "deadline_utc": "2026-11-19T10:00:00+00:00"},
            {"status": "done", "deadline_utc": "2026-11-17T10:00:00+00:00"},
        ],
        "extracted_items": [
            {"type": "action", "review_status": "needs_review"},
            {"type": "action", "review_status": "approved"},
            {"type": "decision", "review_status": "needs_review"},
            {"type": "decision", "review_status": "rejected"},
        ],
    }
    [unmapped, mapped, legacy] = _meeting_list_items([
        base,
        {**base, "speaker_mapping_required": False, "status": "draft"},
        {**base, "speaker_mapping_required": None, "status": "draft"},
    ], organiser, now)

    assert all("status" not in item.model_dump() for item in (unmapped, mapped, legacy))
    assert (unmapped.open_task_count, unmapped.overdue_task_count, unmapped.blocked_task_count) == (2, 1, 1)
    assert (unmapped.pending_review_count, unmapped.decision_count) == (1, 1)
    assert unmapped.has_summary and unmapped.transcript_source == "audio"
    assert unmapped.needs_speaker_mapping and legacy.needs_speaker_mapping
    assert not mapped.needs_speaker_mapping


def test_meeting_list_hides_private_meetings_without_participation_or_assignment():
    reader = str(uuid4())
    base = {
        "id": str(uuid4()),
        "title": "Private meeting",
        "starts_at": "2026-11-16T10:00:00+00:00",
        "created_at": "2026-11-16T09:00:00+00:00",
        "timezone": "UTC",
        "status": "draft",
        "visibility": "private",
        "organiser_id": str(uuid4()),
    }
    visible_ids = [str(uuid4()), str(uuid4()), str(uuid4())]
    items = _meeting_list_items([
        base,
        {**base, "id": visible_ids[0], "organiser_id": reader},
        {**base, "id": visible_ids[1], "meeting_participants": [{"user_id": reader}]},
        {**base, "id": visible_ids[2], "tasks": [{"status": "todo", "task_assignees": [{"user_id": reader}]}]},
    ], reader, datetime(2026, 11, 18, tzinfo=UTC))

    assert [str(item.id) for item in items] == visible_ids
    assert all(item.open_task_count == 0 for item in items[:2])
    assert items[2].open_task_count == 1
