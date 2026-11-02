"""Offline meetings: in-app audio recording -> speaker diarization -> organiser speaker mapping.

Endpoints:
- POST /meetings/{meeting_id}/audio: upload a recording (202); diarization runs in the background.
  Poll meetings.status: 'processing' -> 'draft' (transcript ready) or 'failed'.
- GET  /meetings/{meeting_id}/speakers: diarized speakers with sample quotes + meeting participants.
- PUT  /meetings/{meeting_id}/speakers: organiser maps SPEAKER_xx labels to meeting participants.

Diarization only knows *that* different people spoke, never *who*. The number of speakers is
fixed to the meeting's participant count, and names come only from the organiser's mapping.
Unmapped speakers stay "Speaker N", so extraction leaves their tasks unowned and flagged.
"""

import logging
import re
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.deps import ORGANISER_ROLES, CurrentUser, get_current_user, require_meeting_role
from app.core.supabase import get_supabase_client
from app.services import diarization

logger = logging.getLogger(__name__)

router = APIRouter()

AUDIO_MIME_TYPES = {
    ".webm": "audio/webm",
    ".ogg": "audio/ogg",
    ".opus": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".mp4": "audio/mp4",
    ".wav": "audio/wav",
}
MAX_AUDIO_BYTES = 50 * 1024 * 1024  # Supabase free-tier per-file limit
SAMPLES_PER_SPEAKER = 3


class SpeakerMapping(BaseModel):
    speaker_label: str = Field(min_length=1, max_length=64)
    participant_id: UUID | None = None  # meeting_participants.id; null = unknown speaker


class UpdateSpeakersRequest(BaseModel):
    mappings: list[SpeakerMapping] = Field(min_length=1)


def _participants(db, meeting_id: str) -> list[dict]:
    rows = db.table("meeting_participants").select("id, user_id, external_name") \
        .eq("meeting_id", meeting_id).execute().data or []
    user_ids = [r["user_id"] for r in rows if r.get("user_id")]
    names: dict[str, str] = {}
    if user_ids:
        for p in db.table("profiles").select("id, display_name, email").in_("id", user_ids).execute().data or []:
            names[p["id"]] = p.get("display_name") or (p.get("email") or "").split("@")[0] or "Member"
    return [
        {
            "participant_id": r["id"],
            "user_id": r.get("user_id"),
            "name": names.get(r.get("user_id") or "", None) or (r.get("external_name") or "").strip() or "Participant",
            "is_external": not r.get("user_id"),
        }
        for r in rows
    ]


def _transcript(db, meeting_id: str) -> dict:
    rows = db.table("transcripts").select("id, source").eq("meeting_id", meeting_id).execute().data or []
    if not rows or rows[0].get("source") != "audio":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No diarized audio transcript for this meeting")
    return rows[0]


def _canonical(segments: list[dict]) -> str:
    return "\n".join(f'{s["speaker_name"]}: {s["text"]}' if s.get("speaker_name") else s["text"] for s in segments)


def run_diarization(meeting_id: str, audio: bytes, filename: str, mime_type: str,
                    storage_path: str, num_speakers: int) -> None:
    """Background job: worker -> transcripts + transcript_segments -> meeting back to 'draft'."""
    db = get_supabase_client()
    try:
        segments = diarization.diarize_audio(audio, filename, mime_type, num_speakers)
        names = diarization.default_speaker_names(segments)
        rows = [
            {"segment_index": i, "speaker_label": s["speaker"], "speaker_name": names[s["speaker"]],
             "start_ms": s["start_ms"], "end_ms": s["end_ms"], "text": s["text"]}
            for i, s in enumerate(segments)
        ]
        db.table("transcripts").delete().eq("meeting_id", meeting_id).execute()
        transcript = db.table("transcripts").insert({
            "meeting_id": meeting_id,
            "source": "audio",
            "storage_path": storage_path,
            "canonical_text": _canonical(rows),
            "file_name": filename,
            "file_size_bytes": len(audio),
            "mime_type": mime_type,
        }).execute().data[0]
        db.table("transcript_segments").insert(
            [{**r, "transcript_id": transcript["id"]} for r in rows]
        ).execute()
        db.table("meetings").update({"status": "draft"}).eq("id", meeting_id).execute()
    except Exception as exc:  # noqa: BLE001 - any failure must release the meeting
        logger.error("Diarization failed for meeting %s: %s", meeting_id, exc)
        db.table("meetings").update({"status": "failed"}).eq("id", meeting_id).execute()


@router.post(
    "/meetings/{meeting_id}/audio",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload an in-app meeting recording for transcription + speaker diarization",
)
def upload_audio(
    meeting_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    meeting = require_meeting_role(meeting_id, ORGANISER_ROLES, user)
    if meeting.get("status") not in ("draft", "failed"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Audio can only be uploaded in 'draft' or 'failed' status (current: '{meeting.get('status')}')",
        )
    if not diarization.is_configured():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Diarization worker is not configured")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in AUDIO_MIME_TYPES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            f"Unsupported audio format '{ext}'. Allowed: {', '.join(sorted(AUDIO_MIME_TYPES))}")
    audio = file.file.read(MAX_AUDIO_BYTES + 1)
    if not audio:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Audio file is empty")
    if len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Audio exceeds the 50 MB limit")

    db = get_supabase_client()
    mid = str(meeting_id)
    num_speakers = len(_participants(db, mid))
    if num_speakers < 1:
        raise HTTPException(status.HTTP_409_CONFLICT, "Add the meeting's participants before uploading audio")

    filename = re.sub(r"[^\w.-]", "_", Path(file.filename or "recording").name)
    mime_type = AUDIO_MIME_TYPES[ext]
    storage_path = f'{meeting["workspace_id"]}/{mid}/{filename}'
    try:
        db.storage.from_(settings.STORAGE_BUCKET_TRANSCRIPTS).upload(
            path=storage_path, file=audio, file_options={"content-type": mime_type, "upsert": "true"})
    except Exception as exc:
        logger.error("Failed to upload audio for meeting %s: %s", mid, exc)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to store the recording") from exc

    db.table("meetings").update({"status": "processing"}).eq("id", mid).execute()
    background_tasks.add_task(run_diarization, mid, audio, filename, mime_type, storage_path, num_speakers)
    return {"status": "processing", "num_speakers": num_speakers}


@router.get("/meetings/{meeting_id}/speakers", summary="Diarized speakers with sample quotes, for mapping")
def get_speakers(meeting_id: UUID, user: CurrentUser = Depends(get_current_user)) -> dict:
    require_meeting_role(meeting_id, ORGANISER_ROLES, user)
    db = get_supabase_client()
    mid = str(meeting_id)
    transcript = _transcript(db, mid)
    segments = db.table("transcript_segments").select("speaker_label, speaker_name, start_ms, end_ms, text") \
        .eq("transcript_id", transcript["id"]).order("segment_index").execute().data or []

    speakers: dict[str, dict] = {}
    for seg in segments:
        label = seg.get("speaker_label")
        if not label:
            continue
        sp = speakers.setdefault(label, {"speaker_label": label, "speaker_name": seg.get("speaker_name"),
                                         "talk_time_ms": 0, "segment_count": 0, "samples": []})
        sp["talk_time_ms"] += (seg.get("end_ms") or 0) - (seg.get("start_ms") or 0)
        sp["segment_count"] += 1
        sp["samples"].append(seg)

    for sp in speakers.values():
        # longest utterances are the easiest for the organiser to recognise
        best = sorted(sp["samples"], key=lambda s: len(s["text"]), reverse=True)[:SAMPLES_PER_SPEAKER]
        sp["samples"] = [{"start_ms": s["start_ms"], "text": s["text"][:280]}
                         for s in sorted(best, key=lambda s: s["start_ms"] or 0)]

    return {"speakers": list(speakers.values()), "participants": _participants(db, mid)}


@router.put("/meetings/{meeting_id}/speakers", summary="Map diarized speakers to meeting participants")
def update_speakers(meeting_id: UUID, payload: UpdateSpeakersRequest,
                    user: CurrentUser = Depends(get_current_user)) -> dict:
    meeting = require_meeting_role(meeting_id, ORGANISER_ROLES, user)
    if meeting.get("status") == "processing":
        raise HTTPException(status.HTTP_409_CONFLICT, "Meeting is still processing")
    db = get_supabase_client()
    mid = str(meeting_id)
    transcript = _transcript(db, mid)
    participants = {p["participant_id"]: p for p in _participants(db, mid)}

    labels = [m.speaker_label for m in payload.mappings]
    if len(set(labels)) != len(labels):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Each speaker can be mapped only once")
    mapped = [str(m.participant_id) for m in payload.mappings if m.participant_id]
    if len(set(mapped)) != len(mapped):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A participant can be mapped to only one speaker")

    segments = db.table("transcript_segments").select("id, segment_index, speaker_label, speaker_name, text") \
        .eq("transcript_id", transcript["id"]).order("segment_index").execute().data or []
    known = {s["speaker_label"] for s in segments if s.get("speaker_label")}
    order = list(dict.fromkeys(s["speaker_label"] for s in segments if s.get("speaker_label")))

    new_names: dict[str, str] = {}
    for m in payload.mappings:
        if m.speaker_label not in known:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown speaker '{m.speaker_label}'")
        if m.participant_id is None:
            new_names[m.speaker_label] = f"Speaker {order.index(m.speaker_label) + 1}"
        elif str(m.participant_id) in participants:
            new_names[m.speaker_label] = participants[str(m.participant_id)]["name"]
        else:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                                f"Participant {m.participant_id} is not part of this meeting")

    for label, name in new_names.items():
        db.table("transcript_segments").update({"speaker_name": name}) \
            .eq("transcript_id", transcript["id"]).eq("speaker_label", label).execute()
    for seg in segments:
        if seg.get("speaker_label") in new_names:
            seg["speaker_name"] = new_names[seg["speaker_label"]]
    db.table("transcripts").update({"canonical_text": _canonical(segments)}).eq("id", transcript["id"]).execute()

    return {"speakers": [{"speaker_label": k, "speaker_name": v} for k, v in new_names.items()]}
