"""Live captions must finish the meeting created in the shared UI, without duplicates."""
from datetime import UTC, datetime

import pytest

from test_e2e_sqlite import world  # noqa: F401

CALL_URL = "https://meet.google.com/abc-defg-hij"


def scheduled(world, *, ai=True):
    mid = world.create_meeting(ai_processing=ai)
    world.db.table("meetings").update({
        "starts_at": datetime.now(UTC).isoformat(), "conference_url": CALL_URL,
    }).eq("id", mid).execute()
    return mid


def upload(world):
    return world.post("/meetings/automation/extension-upload", world.priya, json={
        "workspace_id": world.workspace, "provider": "google_meet",
        "conference_url": CALL_URL + "?authuser=1", "title": "Browser call title",
        "transcript_text": "Priya: We agreed to review the launch checklist.",
        "auto_extract": False,
    })


def test_captions_attach_to_scheduled_meeting_and_preserve_details(world):  # noqa: F811
    mid = scheduled(world)
    response = upload(world)
    assert response.status_code == 201, response.text
    assert response.json()["meeting_id"] == mid
    assert response.json()["title"] == "Sprint sync"
    assert len(world.db.rows("meetings")) == 1
    assert len(world.db.rows("consents", meeting_id=mid)) == 1
    assert len(world.db.rows("meeting_participants", meeting_id=mid)) == 3
    assert world.db.rows("transcripts", meeting_id=mid)[0]["canonical_text"]


@pytest.mark.parametrize("missing_consent", [False, True])
def test_scheduled_meeting_cannot_bypass_no_ai_or_consent(world, missing_consent):  # noqa: F811
    mid = scheduled(world, ai=missing_consent)
    if missing_consent:
        world.db.table("consents").delete().eq("meeting_id", mid).execute()
    response = upload(world)
    assert response.status_code == 409, response.text
    assert not world.db.rows("transcripts")
    assert len(world.db.rows("meetings")) == 1


def test_ambiguous_repeated_call_does_not_guess_or_create_another_meeting(world):  # noqa: F811
    scheduled(world)
    scheduled(world)
    response = upload(world)
    assert response.status_code == 409, response.text
    assert not world.db.rows("transcripts")
    assert len(world.db.rows("meetings")) == 2


@pytest.mark.parametrize("meeting_status", ["draft", "processing", "ready", "failed"])
def test_repeated_caption_upload_preserves_saved_transcript(world, meeting_status):  # noqa: F811
    mid = scheduled(world)
    first = upload(world)
    assert first.status_code == 201, first.text
    transcript_id = first.json()["transcript_id"]
    world.db.table("meetings").update({"status": meeting_status}).eq("id", mid).execute()

    repeated = upload(world)

    assert repeated.status_code == 409, repeated.text
    assert len(world.db.rows("meetings")) == 1
    assert [row["id"] for row in world.db.rows("transcripts")] == [transcript_id]


@pytest.mark.parametrize("enable_ai", [False, True])
def test_calendar_scheduler_requires_opt_in_for_caption_ingestion(world, enable_ai):  # noqa: F811
    ai_fields = {"ai_processing": True, "ai_attestation": True} if enable_ai else {}
    response = world.post(f"/workspaces/{world.workspace}/meetings/schedule", world.priya, json={
        "title": "Calendar meeting",
        "starts_at": datetime.now(UTC).isoformat(),
        "duration_minutes": 45,
        "description": "Review the launch checklist",
        "conference_url": CALL_URL,
        "notify_via_email": False,
        **ai_fields,
    })
    assert response.status_code == 201, response.text
    meeting = response.json()
    assert meeting["ai_processing"] is enable_ai
    assert len(world.db.rows("consents", meeting_id=meeting["id"])) == int(enable_ai)

    captions = upload(world)
    if enable_ai:
        assert captions.status_code == 201, captions.text
        assert captions.json()["meeting_id"] == meeting["id"]
    else:
        assert captions.status_code == 409, captions.text
        assert not world.db.rows("transcripts", meeting_id=meeting["id"])
    assert len(world.db.rows("meetings")) == 1
