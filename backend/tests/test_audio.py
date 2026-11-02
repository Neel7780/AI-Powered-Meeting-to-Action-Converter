"""Offline meeting audio -> diarization (worker mocked) -> organiser speaker mapping, on the SQLite DB."""

import pytest
from test_e2e_sqlite import World, world  # noqa: F401  (fixture)

from app.core.config import settings
from app.services import diarization

WORKER_SEGMENTS = [
    {"start_ms": s, "end_ms": e, "speaker": spk, "text": text}
    for s, e, spk, text in [
        (0, 4000, "SPEAKER_01", "Okay, let's start. The client demo is next Thursday."),
        (4200, 8000, "SPEAKER_00", "I will fix the login bug on Safari by Wednesday."),
        (8100, 12000, "SPEAKER_02", "I'll have the onboarding flow ready by Friday."),
        (12100, 14000, "SPEAKER_01", "Great, that's all for today."),
    ]
]


@pytest.fixture
def worker(world, monkeypatch):  # noqa: F811
    calls = []
    monkeypatch.setattr(settings, "DIARIZATION_WORKER_URL", "https://worker.test")
    monkeypatch.setattr(settings, "DIARIZATION_WORKER_SECRET", "s3cret")

    def fake(audio, filename, mime_type, num_speakers):
        calls.append({"num_speakers": num_speakers, "filename": filename, "mime": mime_type})
        return [dict(s) for s in WORKER_SEGMENTS]

    monkeypatch.setattr(diarization, "diarize_audio", fake)
    return calls


def upload(w: World, mid: str, name="recording.webm"):
    return w.post(f"/meetings/{mid}/audio", w.priya, files={"file": (name, b"fake-audio", "audio/webm")})


def test_audio_upload_diarizes_with_participant_count(world, worker):  # noqa: F811
    mid = world.create_meeting()
    r = upload(world, mid)
    assert r.status_code == 202, r.text
    # Aman, Rahul and the external vendor
    assert r.json()["num_speakers"] == 3 and worker[0]["num_speakers"] == 3

    assert world.db.rows("meetings", id=mid)[0]["status"] == "draft"
    assert f"meeting-transcripts/{world.workspace}/{mid}/recording.webm" in world.db.uploads
    t = world.db.rows("transcripts", meeting_id=mid)[0]
    assert t["source"] == "audio"
    assert t["canonical_text"].splitlines()[0] == "Speaker 1: Okay, let's start. The client demo is next Thursday."
    assert t["canonical_text"].splitlines()[1].startswith("Speaker 2: I will fix")


def test_speaker_mapping_renames_transcript(world, worker):  # noqa: F811
    mid = world.create_meeting()
    upload(world, mid)
    headers = {"Authorization": f"Bearer {world.priya}"}
    r = world.client.get(f"/api/meetings/{mid}/speakers", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert [s["speaker_label"] for s in body["speakers"]] == ["SPEAKER_01", "SPEAKER_00", "SPEAKER_02"]
    assert body["speakers"][0]["segment_count"] == 2
    by_name = {p["name"]: p["participant_id"] for p in body["participants"]}
    assert set(by_name) == {"Aman Shah", "Rahul Mehta", "Vendor - Acme"}

    r = world.client.put(f"/api/meetings/{mid}/speakers", headers=headers, json={"mappings": [
        {"speaker_label": "SPEAKER_00", "participant_id": by_name["Rahul Mehta"]},
        {"speaker_label": "SPEAKER_02", "participant_id": by_name["Aman Shah"]},
        {"speaker_label": "SPEAKER_01", "participant_id": None},
    ]})
    assert r.status_code == 200, r.text
    text = world.db.rows("transcripts", meeting_id=mid)[0]["canonical_text"].splitlines()
    assert text[1] == "Rahul Mehta: I will fix the login bug on Safari by Wednesday."
    assert text[2].startswith("Aman Shah: ")
    assert text[0].startswith("Speaker 1: ")


def test_speaker_mapping_rejects_bad_input(world, worker):  # noqa: F811
    mid = world.create_meeting()
    upload(world, mid)
    headers = {"Authorization": f"Bearer {world.priya}"}
    pid = world.client.get(f"/api/meetings/{mid}/speakers", headers=headers).json()["participants"][0]["participant_id"]
    put = lambda m: world.client.put(f"/api/meetings/{mid}/speakers", headers=headers, json={"mappings": m})  # noqa: E731
    assert put([{"speaker_label": "SPEAKER_09", "participant_id": pid}]).status_code == 422
    assert put([{"speaker_label": "SPEAKER_00", "participant_id": pid},
                {"speaker_label": "SPEAKER_01", "participant_id": pid}]).status_code == 422
    assert put([{"speaker_label": "SPEAKER_00", "participant_id": world.workspace}]).status_code == 422


def test_audio_rejections(world, worker, monkeypatch):  # noqa: F811
    mid = world.create_meeting()
    assert upload(world, mid, "notes.pdf").status_code == 422
    assert world.post(f"/meetings/{mid}/audio", world.aman,
                      files={"file": ("r.webm", b"x", "audio/webm")}).status_code in (403, 404)
    monkeypatch.setattr(settings, "DIARIZATION_WORKER_URL", "")
    assert upload(world, mid).status_code == 503


def test_worker_failure_marks_meeting_failed(world, worker, monkeypatch):  # noqa: F811
    def boom(*a, **k):
        raise diarization.DiarizationError("worker down")
    monkeypatch.setattr(diarization, "diarize_audio", boom)
    mid = world.create_meeting()
    assert upload(world, mid).status_code == 202
    assert world.db.rows("meetings", id=mid)[0]["status"] == "failed"
