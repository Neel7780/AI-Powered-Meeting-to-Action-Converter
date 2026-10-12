"""Meetings and Transcript Ingestion API (BE-4).

Endpoints:
- POST /workspaces/{workspace_id}/meetings: Create meeting with participants and consent
- POST /meetings/{meeting_id}/transcript: Submit transcript (pasted text or file upload)
"""

import logging
import re
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.core.config import settings
from app.core.deps import (
    ORGANISER_ROLES,
    CurrentUser,
    get_current_user,
    require_meeting_role,
    require_role,
)
from app.core.supabase import get_supabase_client
from app.parsers import TranscriptParseError, parse_transcript, to_canonical_text
from app.schemas.meetings import (
    CreateMeetingRequest,
    MeetingResponse,
    TranscriptUploadResponse,
)
from app.utils.dates import is_valid_timezone

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_UPLOAD_EXTENSIONS = {".txt", ".vtt", ".srt", ".docx"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB per spec
MAX_WORD_COUNT = 15000


@router.post(
    "/workspaces/{workspace_id}/meetings",
    response_model=MeetingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new meeting with participants and AI processing consent"
)
def create_meeting(
    workspace_id: UUID,
    payload: CreateMeetingRequest,
    user: CurrentUser = Depends(get_current_user)
) -> MeetingResponse:
    """Create a meeting (and its consent row).
    
    Allowed roles: admin, organiser.
    Validates timezone, workspace membership of all participants,
    and requires explicit AI attestation if AI processing is enabled.
    """
    # 1. Enforce RBAC
    require_role(workspace_id, ORGANISER_ROLES, user)

    # 2. Validate input
    clean_title = payload.title.strip()
    if not (1 <= len(clean_title) <= 300):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Meeting title must be between 1 and 300 characters"
        )

    if not is_valid_timezone(payload.timezone):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid timezone: '{payload.timezone}'"
        )

    if payload.ai_processing and not payload.ai_attestation:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="AI attestation required when AI processing is enabled"
        )

    client = get_supabase_client()

    # 3. Validate that all participant_user_ids are current workspace members
    if payload.participant_user_ids:
        candidate_ids = [str(pid) for pid in payload.participant_user_ids]
        members_resp = (
            client.table("workspace_members")
            .select("user_id")
            .eq("workspace_id", str(workspace_id))
            .in_("user_id", candidate_ids)
            .execute()
        )
        active_member_ids = {m["user_id"] for m in (members_resp.data or [])}
        for cid in candidate_ids:
            if cid not in active_member_ids:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Participant {cid} is not a member of this workspace"
                )

    # 4. Insert meeting row
    meeting_insert = {
        "workspace_id": str(workspace_id),
        "title": clean_title,
        "starts_at": payload.starts_at.isoformat(),
        "timezone": payload.timezone.strip(),
        "organiser_id": str(user.id),
        "ai_processing": payload.ai_processing,
        "visibility": "workspace",
        "status": "draft",
        "lifecycle": "active",
    }

    try:
        m_resp = client.table("meetings").insert(meeting_insert).execute()
        if not m_resp.data:
            raise RuntimeError("Database returned empty record on meeting insertion")
        created_meeting = m_resp.data[0]
        meeting_id = created_meeting["id"]
    except Exception as exc:
        logger.error("Failed to insert meeting: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create meeting: {exc}"
        ) from exc

    # 5. Insert participants & consent in transaction-like rollback boundary
    try:
        participant_rows = []
        for pid in payload.participant_user_ids:
            participant_rows.append({"meeting_id": meeting_id, "user_id": str(pid)})
        for ext_name in payload.external_participants:
            cleaned_ext = ext_name.strip()
            if cleaned_ext:
                participant_rows.append({"meeting_id": meeting_id, "external_name": cleaned_ext})

        if participant_rows:
            client.table("meeting_participants").insert(participant_rows).execute()

        # Insert consent row if AI processing is enabled
        if payload.ai_processing:
            consent_insert = {
                "meeting_id": meeting_id,
                "attested_by": str(user.id),
                "notice_version": settings.AI_NOTICE_VERSION,
                "status": "attested",
            }
            client.table("consents").insert(consent_insert).execute()

    except Exception as exc:
        logger.error("Failed to insert participants/consent, rolling back meeting %s: %s", meeting_id, exc)
        try:
            client.table("meetings").delete().eq("id", meeting_id).execute()
        except Exception as delete_exc:
            logger.error("Rollback deletion failed for meeting %s: %s", meeting_id, delete_exc)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize meeting participants or consent: {exc}"
        ) from exc

    return MeetingResponse(**created_meeting)


@router.post(
    "/meetings/{meeting_id}/transcript",
    response_model=TranscriptUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit or upload a transcript for a meeting"
)
def submit_transcript(
    meeting_id: UUID,
    text: str | None = Form(None),
    file: UploadFile | None = File(None),
    user: CurrentUser = Depends(get_current_user)
) -> TranscriptUploadResponse:
    """Submit meeting transcript via pasted text or file upload (.txt, .vtt, .srt, .docx).
    
    Allowed roles: admin, organiser.
    Allowed meeting status: draft or failed only.
    """
    # 1. Enforce RBAC and load meeting
    meeting = require_meeting_role(meeting_id, ORGANISER_ROLES, user)
    workspace_id = meeting["workspace_id"]

    # 2. Check meeting state
    current_status = meeting.get("status")
    if current_status not in ("draft", "failed"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Transcripts can only be submitted for meetings in 'draft' or 'failed' status "
                f"(current: '{current_status}')"
            )
        )

    # 3. Validate input presence
    has_text = bool(text and text.strip())
    has_file = bool(file and file.filename and file.filename.strip())

    if not has_text and not has_file:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Must provide either non-empty pasted text or a transcript file"
        )

    client = get_supabase_client()
    raw_bytes: bytes | str
    clean_filename: str | None = None
    storage_path: str | None = None
    file_size_bytes: int | None = None
    mime_type: str | None = None
    source_type: str

    if has_file and file is not None:
        filename = file.filename or ""
        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_UPLOAD_EXTENSIONS:
            allowed_str = ", ".join(sorted(ALLOWED_UPLOAD_EXTENSIONS))
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unsupported file format '{ext}'. Allowed extensions: {allowed_str}"
            )

        try:
            file_content = file.file.read()
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Could not read uploaded file: {exc}"
            ) from exc

        file_size_bytes = len(file_content)
        if file_size_bytes > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds maximum 10MB limit ({file_size_bytes} bytes)"
            )

        # Sanitize filename
        safe_name = Path(filename).name
        clean_filename = re.sub(r"[^\w\s.-]", "_", safe_name).strip()
        source_type = ext.lstrip(".")
        raw_bytes = file_content

        # Determine MIME type
        if ext == ".txt":
            mime_type = "text/plain"
        elif ext == ".vtt":
            mime_type = "text/vtt"
        elif ext == ".srt":
            mime_type = "application/x-subrip"
        elif ext == ".docx":
            mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    else:
        source_type = "paste"
        raw_bytes = text.strip() if text else ""

    # 4. Parse segments
    try:
        segments = parse_transcript(clean_filename, raw_bytes)
    except TranscriptParseError as err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(err)
        ) from err
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Transcript parsing failed: {exc}"
        ) from exc

    # 5. Enforce word limit (15,000 words max)
    word_count = sum(len(re.findall(r"\w+", seg.text)) for seg in segments)
    if word_count > MAX_WORD_COUNT:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Transcript exceeds maximum limit of {MAX_WORD_COUNT:,} words (got {word_count:,})"
        )

    # 6. Upload file to Supabase Storage if file upload
    if clean_filename and file_size_bytes is not None:
        storage_path = f"{workspace_id}/{meeting_id}/{clean_filename}"
        try:
            client.storage.from_(settings.STORAGE_BUCKET_TRANSCRIPTS).upload(
                path=storage_path,
                file=raw_bytes,
                file_options={"content-type": mime_type or "text/plain", "upsert": "true"}
            )
        except Exception as exc:
            logger.error("Failed to upload transcript to storage: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to store transcript file in storage bucket: {exc}"
            ) from exc

    canonical_text = to_canonical_text(segments)
    raw_text_record = raw_bytes if source_type == "paste" else None

    # 7. Persist to transcripts table (replaces any previous transcript for this meeting)
    try:
        # Delete previous transcript if any (cascades to transcript_segments)
        client.table("transcripts").delete().eq("meeting_id", str(meeting_id)).execute()

        transcript_insert = {
            "meeting_id": str(meeting_id),
            "source": source_type,
            "storage_path": storage_path,
            "raw_text": raw_text_record,
            "canonical_text": canonical_text,
            "file_name": clean_filename,
            "file_size_bytes": file_size_bytes,
            "mime_type": mime_type,
        }
        t_resp = client.table("transcripts").insert(transcript_insert).execute()
        if not t_resp.data:
            raise RuntimeError("Database returned empty record on transcript insertion")
        transcript_record = t_resp.data[0]
        transcript_id = transcript_record["id"]

        # Bulk insert transcript segments
        segment_rows = [
            {
                "transcript_id": transcript_id,
                "segment_index": idx,
                "speaker_name": seg.speaker_name,
                "start_ms": seg.start_ms,
                "end_ms": seg.end_ms,
                "text": seg.text,
            }
            for idx, seg in enumerate(segments)
        ]
        client.table("transcript_segments").insert(segment_rows).execute()

    except Exception as exc:
        logger.error("Failed to save transcript and segments for meeting %s: %s", meeting_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save transcript data: {exc}"
        ) from exc

    return TranscriptUploadResponse(
        transcript_id=UUID(str(transcript_id)),
        segment_count=len(segments),
        word_count=word_count
    )
