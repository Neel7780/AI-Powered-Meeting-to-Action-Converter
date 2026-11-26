"""Meetings and Transcript Ingestion API (BE-4).

Endpoints:
- POST /workspaces/{workspace_id}/meetings: Create meeting with participants and consent
- POST /meetings/{meeting_id}/transcript: Submit transcript (pasted text or file upload)
"""

import logging
import re
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status

from app.core.config import settings
from app.core.deps import (
    ORGANISER_ROLES,
    WORKSPACE_ROLES,
    CurrentUser,
    get_current_user,
    require_meeting_role,
    require_role,
)
from app.core.supabase import get_supabase_client
from app.parsers import TranscriptParseError, parse_transcript, to_canonical_text
from datetime import UTC, datetime
from app.schemas.meetings import (
    CreateMeetingRequest,
    ManualTaskCreateRequest,
    ManualTaskResponse,
    MeetingChapterItem,
    MeetingChaptersResponse,
    MeetingDetail,
    MeetingDetailResponse,
    MeetingListItem,
    MeetingParticipantResponse,
    MeetingResponse,
    MeetingSummaryResponse,
    ParticipantOut,
    ScheduleMeetingRequest,
    ScheduleMeetingResponse,
    SendMeetingInvitesResponse,
    SpeakerInsightItem,
    SummaryDecisionItem,
    SummaryDiscussionPointItem,
    TranscriptUploadResponse,
    WorkspaceStatsResponse,
)
from app.services.email import (
    generate_google_calendar_url,
    notify_tasks_assigned,
    send_meeting_schedule_invitations,
)
from app.services.llm.summary_service import (
    generate_meeting_chapters,
    generate_meeting_summary,
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
    return _create_meeting(workspace_id, payload, user)


def _create_meeting(
    workspace_id: UUID,
    payload: CreateMeetingRequest,
    user: CurrentUser,
    *,
    meeting_id: UUID | None = None,
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
    effective_visibility = "private" if not payload.ai_processing else (getattr(payload, "visibility", None) or "workspace")
    meeting_insert = {
        "workspace_id": str(workspace_id),
        "title": clean_title,
        "starts_at": payload.starts_at.isoformat(),
        "duration_minutes": getattr(payload, "duration_minutes", None) or 30,
        "timezone": payload.timezone.strip(),
        "organiser_id": str(user.id),
        "ai_processing": payload.ai_processing,
        "visibility": effective_visibility,
        "status": "draft",
        "lifecycle": "active",
        "calendar_event_id": getattr(payload, "calendar_event_id", None),
        "calendar_provider": getattr(payload, "calendar_provider", None),
        "conference_url": getattr(payload, "conference_url", None),
        "description": payload.description.strip() if getattr(payload, "description", None) else None,
    }
    if meeting_id is not None:
        meeting_insert["id"] = str(meeting_id)

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


def _check_private_meeting_access(db, meeting: dict, user: CurrentUser) -> None:
    """Match the meeting SELECT policy for service-role reads."""
    uid = str(user.id)
    if meeting.get("visibility") != "private" or meeting["organiser_id"] == uid:
        return
    mid = str(meeting["id"])
    participants = db.table("meeting_participants").select("id").eq("meeting_id", mid) \
        .eq("user_id", uid).limit(1).execute()
    if participants.data:
        return
    assignments = db.table("task_assignees").select("task_id, tasks!inner(meeting_id)") \
        .eq("user_id", uid).eq("tasks.meeting_id", mid).limit(1).execute()
    if not assignments.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found")


@router.post(
    "/workspaces/{workspace_id}/meetings/schedule",
    response_model=ScheduleMeetingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule a future meeting, add participants, and notify everyone via email"
)
def schedule_meeting(
    workspace_id: UUID,
    payload: ScheduleMeetingRequest,
    user: CurrentUser = Depends(get_current_user)
) -> ScheduleMeetingResponse:
    """Schedule a future meeting in the calendar and dispatch email invitations.
    
    Allowed roles: admin, organiser, owner.
    Inserts into meetings and meeting_participants, generates calendar .ics data,
    and sends email notifications with 1-click Google Calendar add links and .ics attachments.
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
            detail="Consent attestation required when AI processing is enabled"
        )

    client = get_supabase_client()

    # 3. Validate participant workspace membership
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
        "duration_minutes": payload.duration_minutes,
        "timezone": payload.timezone.strip(),
        "organiser_id": str(user.id),
        "ai_processing": payload.ai_processing,
        "visibility": "workspace",
        "status": "draft",
        "lifecycle": "active",
        "calendar_event_id": payload.calendar_event_id,
        "calendar_provider": payload.calendar_provider,
        "conference_url": payload.conference_url.strip() if payload.conference_url else None,
        "description": payload.description.strip() if payload.description else None,
    }

    try:
        m_resp = client.table("meetings").insert(meeting_insert).execute()
        if not m_resp.data:
            raise RuntimeError("Database returned empty record on meeting insertion")
        created_meeting = m_resp.data[0]
        meeting_id = created_meeting["id"]
    except Exception as exc:
        logger.error("Failed to insert scheduled meeting: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to schedule meeting: {exc}"
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
        if payload.ai_processing and payload.ai_attestation:
            consent_insert = {
                "meeting_id": meeting_id,
                "attested_by": str(user.id),
                "notice_version": settings.AI_NOTICE_VERSION,
                "status": "attested",
            }
            client.table("consents").insert(consent_insert).execute()
    except Exception as exc:
        logger.error("Failed to insert meeting participants or consent for %s: %s", meeting_id, exc)
        try:
            client.table("meetings").delete().eq("id", meeting_id).execute()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record meeting participants or consent: {exc}"
        ) from exc

    # 6. Send email notifications if requested
    sent_count = 0
    notified_recipients: list[str] = []
    if payload.notify_via_email:
        try:
            sent_count, notified_recipients = send_meeting_schedule_invitations(
                meeting_id=meeting_id,
                workspace_id=workspace_id,
                title=clean_title,
                starts_at_dt=payload.starts_at,
                duration_minutes=payload.duration_minutes,
                tz_name=payload.timezone,
                conference_url=payload.conference_url,
                description=payload.description,
                organiser_id=user.id,
                participant_user_ids=payload.participant_user_ids,
                external_participants=payload.external_participants,
            )
        except Exception as mail_err:
            logger.error("Error sending scheduled meeting invitations for %s: %s", meeting_id, mail_err)

    # 7. Generate 1-click Google Calendar URL
    gcal_url = generate_google_calendar_url(
        title=clean_title,
        starts_at_dt=payload.starts_at,
        duration_minutes=payload.duration_minutes,
        tz_name=payload.timezone,
        conference_url=payload.conference_url,
        description=payload.description,
    )

    return ScheduleMeetingResponse(
        id=UUID(created_meeting["id"]),
        workspace_id=UUID(created_meeting["workspace_id"]),
        title=created_meeting["title"],
        starts_at=datetime.fromisoformat(created_meeting["starts_at"]),
        duration_minutes=created_meeting.get("duration_minutes") or payload.duration_minutes,
        timezone=created_meeting["timezone"],
        organiser_id=UUID(created_meeting["organiser_id"]),
        ai_processing=created_meeting.get("ai_processing", payload.ai_processing),
        visibility=created_meeting.get("visibility", "workspace"),
        lifecycle=created_meeting.get("lifecycle", "active"),
        status=created_meeting.get("status", "draft"),
        conference_url=created_meeting.get("conference_url"),
        description=created_meeting.get("description"),
        calendar_event_id=created_meeting.get("calendar_event_id"),
        calendar_provider=created_meeting.get("calendar_provider"),
        notifications_sent=sent_count,
        notified_recipients=notified_recipients,
        google_calendar_url=gcal_url,
        created_at=datetime.fromisoformat(created_meeting["created_at"]),
    )


@router.post(
    "/meetings/{meeting_id}/send-invites",
    response_model=SendMeetingInvitesResponse,
    summary="Dispatch meeting invitations to all participants of a meeting"
)
def send_meeting_invites(
    meeting_id: UUID,
    user: CurrentUser = Depends(get_current_user)
) -> SendMeetingInvitesResponse:
    """Dispatch calendar invitation emails for an existing meeting."""
    client = get_supabase_client()
    m_resp = (
        client.table("meetings")
        .select("id, title, starts_at, timezone, organiser_id, workspace_id, conference_url, visibility, duration_minutes, description")
        .eq("id", str(meeting_id))
        .limit(1)
        .execute()
    )
    if not m_resp.data:
        raise HTTPException(status_code=404, detail="Meeting not found")

    meeting = m_resp.data[0]
    workspace_id = UUID(meeting["workspace_id"])
    require_role(workspace_id, ORGANISER_ROLES, user)
    _check_private_meeting_access(client, meeting, user)

    # Fetch participants
    p_resp = (
        client.table("meeting_participants")
        .select("user_id, external_name")
        .eq("meeting_id", str(meeting_id))
        .execute()
    )
    part_user_ids = [UUID(row["user_id"]) for row in (p_resp.data or []) if row.get("user_id")]
    external_parts = [row["external_name"] for row in (p_resp.data or []) if row.get("external_name")]

    starts_at_dt = datetime.fromisoformat(meeting["starts_at"])
    duration_minutes = meeting.get("duration_minutes") or 30
    description = meeting.get("description")

    sent_count, recipients = send_meeting_schedule_invitations(
        meeting_id=meeting_id,
        workspace_id=workspace_id,
        title=meeting["title"],
        starts_at_dt=starts_at_dt,
        duration_minutes=duration_minutes,
        tz_name=meeting.get("timezone") or "Asia/Kolkata",
        conference_url=meeting.get("conference_url"),
        description=description,
        organiser_id=meeting.get("organiser_id"),
        participant_user_ids=part_user_ids,
        external_participants=external_parts,
    )

    return SendMeetingInvitesResponse(
        meeting_id=meeting_id,
        title=meeting["title"],
        notifications_sent=sent_count,
        recipients=recipients,
        message=f"Sent {sent_count} invitation email(s) successfully.",
    )


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
    if meeting.get("status") not in ("draft", "failed"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A transcript can be added before processing starts or after a failed attempt.",
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
        if meeting.get("speaker_mapping_required"):
            client.table("meetings").update({"speaker_mapping_required": False}).eq("id", str(meeting_id)).execute()

        # Clear any cached summary and chapters for this meeting
        try:
            client.table("meetings").update({"summary": None, "chapters": None}).eq("id", str(meeting_id)).execute()
        except Exception as exc:
            logger.warning("Could not clear cached summary/chapters: %s", exc)

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


@router.get(
    "/meetings/{meeting_id}/summary",
    response_model=MeetingSummaryResponse,
    summary="Get concise meeting summary highlighting discussion points, decisions and outcomes"
)
def get_meeting_summary(
    meeting_id: UUID,
    refresh: bool = False,
    user: CurrentUser = Depends(get_current_user)
) -> MeetingSummaryResponse:
    """Retrieve grounded summary for a meeting. Allowed roles: admin, organiser, member."""
    meeting = require_meeting_role(meeting_id, WORKSPACE_ROLES, user)
    mid = str(meeting_id)
    client = get_supabase_client()
    _check_private_meeting_access(client, meeting, user)

    if not meeting.get("ai_processing", True):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="AI processing is disabled for this private meeting (No-AI mode)."
        )

    # Return cached summary if present and not force-refreshed
    if not refresh and meeting.get("summary"):
        try:
            return MeetingSummaryResponse.model_validate(meeting["summary"])
        except Exception as exc:
            logger.warning("Cached summary invalid for meeting %s, regenerating: %s", mid, exc)

    # 1. Fetch transcript record
    transcript_resp = (
        client.table("transcripts")
        .select("id, canonical_text")
        .eq("meeting_id", mid)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    transcript_record = transcript_resp.data[0] if transcript_resp.data else None

    # 2. Fetch transcript segments
    segments = []
    if transcript_record:
        seg_resp = (
            client.table("transcript_segments")
            .select("id, speaker_name, text, start_ms, end_ms, segment_index")
            .eq("transcript_id", transcript_record["id"])
            .order("segment_index", desc=False)
            .execute()
        )
        segments = seg_resp.data or []

    # 3. Fetch extracted items (both decisions and action items)
    items_resp = (
        client.table("extracted_items")
        .select("id, task, type, source_excerpt, source_start_ms, owner_name, review_status")
        .eq("meeting_id", mid)
        .execute()
    )
    extracted_items = [item for item in (items_resp.data or []) if item.get("review_status") != "rejected"]

    # 4. Generate grounded summary (LLM with deterministic fallback)
    summary_res = generate_meeting_summary(
        meeting=meeting,
        transcript_record=transcript_record,
        segments=segments,
        extracted_items=extracted_items,
    )

    # 5. Persist to meetings table if we generated a grounded summary with transcript data
    if segments or transcript_record:
        try:
            client.table("meetings").update({
                "summary": summary_res.model_dump(mode="json")
            }).eq("id", mid).execute()
        except Exception as exc:
            logger.warning("Failed to persist summary for meeting %s: %s", mid, exc)

    return summary_res


@router.get(
    "/meetings/{meeting_id}/chapters",
    response_model=MeetingChaptersResponse,
    summary="Get meaningful chapters and topic-based sections for navigating long meetings"
)
def get_meeting_chapters(
    meeting_id: UUID,
    refresh: bool = False,
    user: CurrentUser = Depends(get_current_user)
) -> MeetingChaptersResponse:
    """Retrieve topic-based chapters for a meeting. Allowed roles: admin, organiser, member."""
    meeting = require_meeting_role(meeting_id, WORKSPACE_ROLES, user)
    mid = str(meeting_id)
    client = get_supabase_client()
    _check_private_meeting_access(client, meeting, user)

    if not meeting.get("ai_processing", True):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="AI processing is disabled for this private meeting (No-AI mode)."
        )

    # Return cached chapters if present and not force-refreshed
    if not refresh and meeting.get("chapters"):
        try:
            return MeetingChaptersResponse.model_validate(meeting["chapters"])
        except Exception as exc:
            logger.warning("Cached chapters invalid for meeting %s, regenerating: %s", mid, exc)

    # 1. Fetch transcript record
    transcript_resp = (
        client.table("transcripts")
        .select("id, canonical_text")
        .eq("meeting_id", mid)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    transcript_record = transcript_resp.data[0] if transcript_resp.data else None

    # 2. Fetch transcript segments
    segments = []
    if transcript_record:
        seg_resp = (
            client.table("transcript_segments")
            .select("id, speaker_name, text, start_ms, end_ms, segment_index")
            .eq("transcript_id", transcript_record["id"])
            .order("segment_index", desc=False)
            .execute()
        )
        segments = seg_resp.data or []

    # 3. Fetch extracted items
    items_resp = (
        client.table("extracted_items")
        .select("id, task, type, source_excerpt, source_start_ms, owner_name, review_status")
        .eq("meeting_id", mid)
        .execute()
    )
    extracted_items = [item for item in (items_resp.data or []) if item.get("review_status") != "rejected"]

    # 4. Generate grounded chapters
    chapters_res = generate_meeting_chapters(
        meeting=meeting,
        transcript_record=transcript_record,
        segments=segments,
        extracted_items=extracted_items,
    )

    # 5. Persist to meetings table if chapters were generated
    if chapters_res.chapters:
        try:
            client.table("meetings").update({
                "chapters": chapters_res.model_dump(mode="json")
            }).eq("id", mid).execute()
        except Exception as exc:
            logger.warning("Failed to persist chapters for meeting %s: %s", mid, exc)

    return chapters_res




# ---------------------------------------------------------------------------
# Workspace Meetings & Stats Endpoints (Sprint 1 BE-2)
# ---------------------------------------------------------------------------

@router.get(
    "/workspaces/{workspace_id}/meetings",
    response_model=list[MeetingListItem],
    summary="List all active meetings in a workspace",
)
def list_meetings(
    workspace_id: UUID,
    user: CurrentUser = Depends(get_current_user),
) -> list[MeetingListItem]:
    """List all active meetings in *workspace_id*. Requires any member role."""
    require_role(workspace_id, WORKSPACE_ROLES, user)

    db = get_supabase_client()
    uid = str(user.id)
    # Filter task assignments and participants down to this caller. They are used
    # only for the private meeting visibility check and are never returned.
    res = (
        db.table("meetings")
        .select(
            "*, "
            "transcripts(id, source), extracted_items(type, review_status),"
            "meeting_participants(user_id), tasks(status, deadline_utc, task_assignees(user_id))"
        )
        .eq("workspace_id", str(workspace_id))
        .eq("lifecycle", "active")
        .eq("meeting_participants.user_id", uid)
        .eq("tasks.task_assignees.user_id", uid)
        .order("starts_at", desc=True)
        .execute()
    )
    return _meeting_list_items(res.data or [], uid, datetime.now(UTC))


def _meeting_list_items(rows: list[dict], uid: str, now: datetime) -> list[MeetingListItem]:
    meetings = []
    for row in rows:
        tasks = row.get("tasks") or []
        if row.get("visibility") == "private" and row["organiser_id"] != uid:
            if not row.get("meeting_participants") and not any(task.get("task_assignees") for task in tasks):
                continue
        transcript = row.get("transcripts")
        source = transcript.get("source") if transcript else None
        items = row.get("extracted_items") or []
        open_tasks = [task for task in tasks if task["status"] != "done"]
        mapping_required = row.get("speaker_mapping_required")
        meetings.append(MeetingListItem(
            **row,
            transcript_source=source,
            needs_speaker_mapping=source == "audio" and (
                mapping_required if mapping_required is not None else row["status"] == "draft"
            ),
            open_task_count=len(open_tasks),
            overdue_task_count=sum(
                1 for task in open_tasks
                if task.get("deadline_utc") and datetime.fromisoformat(task["deadline_utc"]) < now
            ),
            blocked_task_count=sum(task["status"] == "blocked" for task in open_tasks),
            pending_review_count=sum(
                item["type"] == "action" and item["review_status"] == "needs_review" for item in items
            ),
            decision_count=sum(item["type"] == "decision" and item["review_status"] != "rejected" for item in items),
            has_summary=bool(transcript),
        ))
    return meetings


@router.get(
    "/workspaces/{workspace_id}/meetings/{meeting_id}",
    response_model=MeetingDetail,
    summary="Get meeting detail",
)
def get_meeting(
    workspace_id: UUID,
    meeting_id: UUID,
    user: CurrentUser = Depends(get_current_user),
) -> MeetingDetail:
    """Return full meeting detail including participants and transcript id."""
    require_role(workspace_id, WORKSPACE_ROLES, user)

    db = get_supabase_client()

    meeting_res = (
        db.table("meetings")
        .select("*")
        .eq("id", str(meeting_id))
        .eq("workspace_id", str(workspace_id))
        .eq("lifecycle", "active")
        .execute()
    )
    if not meeting_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    meeting = meeting_res.data[0]
    _check_private_meeting_access(db, meeting, user)

    part_res = (
        db.table("meeting_participants")
        .select("id, user_id, external_name")
        .eq("meeting_id", str(meeting_id))
        .execute()
    )
    participants = [
        ParticipantOut(
            user_id=UUID(p["user_id"]) if p.get("user_id") else None,
            external_name=p.get("external_name"),
        )
        for p in (part_res.data or [])
    ]

    transcript_res = (
        db.table("transcripts")
        .select("id")
        .eq("meeting_id", str(meeting_id))
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    transcript_id = (
        UUID(transcript_res.data[0]["id"]) if transcript_res.data else None
    )

    return MeetingDetail(
        id=UUID(meeting["id"]),
        workspace_id=UUID(meeting["workspace_id"]),
        title=meeting["title"],
        starts_at=datetime.fromisoformat(meeting["starts_at"]),
        timezone=meeting["timezone"],
        visibility=meeting.get("visibility", "workspace"),
        created_at=datetime.fromisoformat(meeting["created_at"]),
        organiser_id=UUID(meeting["organiser_id"]),
        conference_url=meeting.get("conference_url"),
        duration_minutes=meeting.get("duration_minutes") or 30,
        description=meeting.get("description"),
        participants=participants,
        transcript_id=transcript_id,
    )


@router.get(
    "/meetings/{meeting_id}",
    response_model=MeetingDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get meeting details including participants and No-AI configuration"
)
def get_meeting_details(
    meeting_id: UUID,
    user: CurrentUser = Depends(get_current_user)
) -> MeetingDetailResponse:
    """Fetch meeting details, participants, and status.
    
    Verifies that the caller belongs to the meeting's workspace.
    """
    client = get_supabase_client()
    m_resp = client.table("meetings").select("*").eq("id", str(meeting_id)).execute()
    if not m_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    meeting = m_resp.data[0]
    workspace_id = UUID(str(meeting["workspace_id"]))
    # Enforce caller is in workspace (admin, organiser, or member)
    require_role(workspace_id, WORKSPACE_ROLES, user)
    _check_private_meeting_access(client, meeting, user)

    # Fetch organiser display name
    organiser_name = "Organiser"
    try:
        prof_resp = client.table("profiles").select("display_name, email").eq("id", str(meeting["organiser_id"])).execute()
        if prof_resp.data:
            organiser_name = prof_resp.data[0].get("display_name") or prof_resp.data[0].get("email") or "Organiser"
    except Exception as exc:
        logger.warning("Could not fetch organiser profile for meeting %s: %s", meeting_id, exc)

    # Fetch participants
    participants_list: list[MeetingParticipantResponse] = []
    try:
        p_resp = client.table("meeting_participants").select("*").eq("meeting_id", str(meeting_id)).execute()
        raw_participants = p_resp.data or []
        user_ids = [p["user_id"] for p in raw_participants if p.get("user_id")]
        profiles_map = {}
        if user_ids:
            prof_data = client.table("profiles").select("id, display_name, email").in_("id", user_ids).execute()
            for prof in (prof_data.data or []):
                profiles_map[prof["id"]] = prof

        for p in raw_participants:
            uid = p.get("user_id")
            prof = profiles_map.get(uid, {}) if uid else {}
            participants_list.append(MeetingParticipantResponse(
                id=UUID(str(p["id"])),
                user_id=UUID(str(uid)) if uid else None,
                external_name=p.get("external_name"),
                display_name=prof.get("display_name"),
                email=prof.get("email")
            ))
    except Exception as exc:
        logger.warning("Could not fetch participants for meeting %s: %s", meeting_id, exc)

    # Check transcript presence
    has_transcript = False
    try:
        t_resp = client.table("transcripts").select("id").eq("meeting_id", str(meeting_id)).limit(1).execute()
        has_transcript = bool(t_resp.data)
    except Exception:
        pass

    # Count tasks
    task_count = 0
    try:
        cnt_resp = client.table("tasks").select("id", count="exact").eq("meeting_id", str(meeting_id)).execute()
        task_count = cnt_resp.count if hasattr(cnt_resp, "count") and cnt_resp.count is not None else len(cnt_resp.data or [])
    except Exception:
        pass

    return MeetingDetailResponse(
        id=UUID(str(meeting["id"])),
        workspace_id=UUID(str(meeting["workspace_id"])),
        title=meeting["title"],
        starts_at=meeting["starts_at"],
        timezone=meeting.get("timezone", "Asia/Kolkata"),
        organiser_id=UUID(str(meeting["organiser_id"])),
        organiser_name=organiser_name,
        ai_processing=meeting.get("ai_processing", True),
        status=meeting.get("status", "draft"),
        visibility=meeting.get("visibility", "workspace"),
        lifecycle=meeting.get("lifecycle", "active"),
        participants=participants_list,
        has_transcript=has_transcript,
        task_count=task_count,
        created_at=meeting["created_at"],
    )


@router.post(
    "/meetings/{meeting_id}/tasks",
    response_model=ManualTaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Manually create and assign a task to a workspace participant (No-AI Mode)"
)
def create_manual_task(
    meeting_id: UUID,
    payload: ManualTaskCreateRequest,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user)
) -> ManualTaskResponse:
    """Manually assign a task to a workspace participant.
    
    Required role: organiser or admin (manager).
    Designed for No-AI mode where meetings remain private and managers manually assign tasks.
    Validates assignee workspace membership and inserts directly into tasks and task_assignees.
    """
    meeting = require_meeting_role(meeting_id, ORGANISER_ROLES, user)
    workspace_id = meeting["workspace_id"]
    client = get_supabase_client()
    _check_private_meeting_access(client, meeting, user)

    clean_title = payload.title.strip()
    if not (1 <= len(clean_title) <= 500):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Task title must be between 1 and 500 characters"
        )

    valid_priorities = {"low", "normal", "high", "urgent"}
    if payload.priority not in valid_priorities:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Priority must be one of {valid_priorities}"
        )

    # Validate assignee is an active workspace member
    assignee_name = None
    assignee_email = None
    if payload.assignee_user_id:
        assignee_str = str(payload.assignee_user_id)
        wm_resp = (
            client.table("workspace_members")
            .select("user_id")
            .eq("workspace_id", str(workspace_id))
            .eq("user_id", assignee_str)
            .execute()
        )
        if not (wm_resp.data or []):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Assignee {assignee_str} is not an active member of this workspace"
            )

        # Fetch profile info for response
        try:
            prof_resp = client.table("profiles").select("display_name, email").eq("id", assignee_str).execute()
            if prof_resp.data:
                assignee_name = prof_resp.data[0].get("display_name")
                assignee_email = prof_resp.data[0].get("email")
        except Exception:
            pass

    # Source excerpt: database requires non-empty string per tasks_source_excerpt_chk
    source_excerpt = (payload.source_excerpt or "Manual task assignment (No-AI mode)").strip()
    if not source_excerpt:
        source_excerpt = "Manual task assignment (No-AI mode)"

    task_insert = {
        "workspace_id": str(workspace_id),
        "meeting_id": str(meeting_id),
        "extracted_item_id": None,  # Explicitly None for manual task
        "title": clean_title,
        "description": payload.description.strip() if payload.description else None,
        "deadline_utc": payload.deadline_utc.isoformat() if payload.deadline_utc else None,
        "priority": payload.priority,
        "status": "todo",
        "source_excerpt": source_excerpt,
        "created_by": str(user.id),
        "external_owner_label": None,
    }

    try:
        t_resp = client.table("tasks").insert(task_insert).execute()
        if not t_resp.data:
            raise RuntimeError("Database returned empty record on task insertion")
        created_task = t_resp.data[0]
        task_id = UUID(str(created_task["id"]))
    except Exception as exc:
        logger.error("Failed to insert manual task for meeting %s: %s", meeting_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create task: {exc}"
        ) from exc

    # Insert primary assignee if specified
    if payload.assignee_user_id:
        try:
            assignee_insert = {
                "task_id": str(task_id),
                "user_id": str(payload.assignee_user_id),
                "is_primary": True,
            }
            client.table("task_assignees").insert(assignee_insert).execute()
        except Exception as exc:
            logger.error("Failed to insert task assignee for task %s: %s", task_id, exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to assign task: {exc}"
            ) from exc

        # Dispatch email notification in background
        background_tasks.add_task(notify_tasks_assigned, meeting_id, [task_id])

    return ManualTaskResponse(
        id=task_id,
        workspace_id=UUID(str(created_task["workspace_id"])),
        meeting_id=UUID(str(created_task["meeting_id"])),
        title=created_task["title"],
        description=created_task.get("description"),
        priority=created_task.get("priority", "normal"),
        status=created_task.get("status", "todo"),
        deadline_utc=created_task.get("deadline_utc"),
        source_excerpt=created_task["source_excerpt"],
        created_by=UUID(str(created_task["created_by"])),
        assignee_user_id=payload.assignee_user_id,
        assignee_name=assignee_name,
        assignee_email=assignee_email,
        created_at=created_task["created_at"],

    )


@router.get(
    "/workspaces/{workspace_id}/stats",
    response_model=WorkspaceStatsResponse,
    summary="Get workspace dashboard statistics",
)
def get_workspace_stats(
    workspace_id: UUID,
    user: CurrentUser = Depends(get_current_user),
) -> WorkspaceStatsResponse:
    """Return meeting count, open task count, and member count for the dashboard."""
    require_role(workspace_id, WORKSPACE_ROLES, user)

    db = get_supabase_client()
    ws_id = str(workspace_id)

    meeting_res = (
        db.table("meetings")
        .select("id", count="exact")
        .eq("workspace_id", ws_id)
        .eq("lifecycle", "active")
        .execute()
    )
    meeting_count = meeting_res.count or 0

    task_res = (
        db.table("tasks")
        .select("id", count="exact")
        .eq("workspace_id", ws_id)
        .neq("status", "done")
        .execute()
    )
    open_task_count = task_res.count or 0

    member_res = (
        db.table("workspace_members")
        .select("user_id", count="exact")
        .eq("workspace_id", ws_id)
        .execute()
    )
    member_count = member_res.count or 0

    return WorkspaceStatsResponse(
        meeting_count=meeting_count,
        open_task_count=open_task_count,
        member_count=member_count,
    )


@router.get(
    "/meetings/{meeting_id}/tasks",
    response_model=list[ManualTaskResponse],
    status_code=status.HTTP_200_OK,
    summary="Get all tasks assigned for a meeting"
)
def get_meeting_tasks(
    meeting_id: UUID,
    user: CurrentUser = Depends(get_current_user)
) -> list[ManualTaskResponse]:
    """Fetch all tasks associated with this meeting, including assignees."""
    client = get_supabase_client()
    m_resp = client.table("meetings").select("*").eq("id", str(meeting_id)).execute()
    if not m_resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    
    meeting = m_resp.data[0]
    workspace_id = UUID(str(meeting["workspace_id"]))
    require_role(workspace_id, WORKSPACE_ROLES, user)
    _check_private_meeting_access(client, meeting, user)

    tasks_resp = (
        client.table("tasks")
        .select("*")
        .eq("meeting_id", str(meeting_id))
        .order("created_at", desc=False)
        .execute()
    )
    task_rows = tasks_resp.data or []
    if not task_rows:
        return []

    task_ids = [t["id"] for t in task_rows]
    assignees_resp = (
        client.table("task_assignees")
        .select("task_id, user_id, is_primary")
        .in_("task_id", task_ids)
        .execute()
    )
    primary_assignees = {
        a["task_id"]: a["user_id"] 
        for a in (assignees_resp.data or []) 
        if a.get("is_primary", True)
    }

    # Fetch assignee profiles
    user_ids = list(set(primary_assignees.values()))
    profiles_map = {}
    if user_ids:
        prof_resp = client.table("profiles").select("id, display_name, email").in_("id", user_ids).execute()
        for p in (prof_resp.data or []):
            profiles_map[p["id"]] = p

    results: list[ManualTaskResponse] = []
    for t in task_rows:
        assignee_uid = primary_assignees.get(t["id"])
        prof = profiles_map.get(assignee_uid, {}) if assignee_uid else {}
        results.append(ManualTaskResponse(
            id=UUID(str(t["id"])),
            workspace_id=UUID(str(t["workspace_id"])),
            meeting_id=UUID(str(t["meeting_id"])),
            title=t["title"],
            description=t.get("description"),
            priority=t.get("priority", "normal"),
            status=t.get("status", "todo"),
            deadline_utc=t.get("deadline_utc"),
            source_excerpt=t.get("source_excerpt", ""),
            created_by=UUID(str(t["created_by"])),
            assignee_user_id=UUID(str(assignee_uid)) if assignee_uid else None,
            assignee_name=prof.get("display_name"),
            assignee_email=prof.get("email"),
            created_at=t["created_at"],
        ))

    return results


@router.delete(
    "/meetings/{meeting_id}/tasks/{task_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a task created for a meeting"
)
def delete_meeting_task(
    meeting_id: UUID,
    task_id: UUID,
    user: CurrentUser = Depends(get_current_user)
) -> dict[str, str]:
    """Delete a task associated with this meeting. Organiser or admin only."""
    meeting = require_meeting_role(meeting_id, ORGANISER_ROLES, user)
    client = get_supabase_client()
    _check_private_meeting_access(client, meeting, user)
    client.table("tasks").delete().eq("id", str(task_id)).eq("meeting_id", str(meeting_id)).execute()
    return {"message": f"Task {task_id} deleted successfully"}


