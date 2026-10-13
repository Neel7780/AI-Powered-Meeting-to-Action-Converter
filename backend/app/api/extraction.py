"""AI Extraction API (BE-3).

Endpoint:
- POST /meetings/{meeting_id}/extract: start Gemini extraction as a background job (202)
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.core.config import settings
from app.core.deps import ORGANISER_ROLES, CurrentUser, get_current_user, require_meeting_role
from app.core.supabase import get_supabase_client
from app.services.llm.runner import run_extraction

router = APIRouter()

STALE_JOB_AFTER = timedelta(minutes=5)


@router.post(
    "/meetings/{meeting_id}/extract",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start AI extraction of action items from the meeting transcript",
)
def start_extraction(
    meeting_id: UUID,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Allowed roles: admin, organiser. Poll meetings.status until 'ready' or 'failed'.

    Re-running replaces the meeting's needs_review items; approved and rejected items stay.
    """
    meeting = require_meeting_role(meeting_id, ORGANISER_ROLES, user)
    mid = str(meeting_id)

    # No-AI meetings never reach any provider. No fallback.
    if not meeting.get("ai_processing"):
        raise HTTPException(status.HTTP_409_CONFLICT, "AI processing is disabled for this meeting")

    if meeting.get("status") == "processing":
        updated_at = datetime.fromisoformat(meeting["updated_at"])
        if datetime.now(UTC) - updated_at < STALE_JOB_AFTER:
            raise HTTPException(status.HTTP_409_CONFLICT, "Extraction is already running")

    if "gemini" not in settings.LLM_PROVIDER_ALLOWLIST or not settings.GEMINI_API_KEY:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI provider is not configured")

    db = get_supabase_client()
    if not db.table("transcripts").select("id").eq("meeting_id", mid).execute().data:
        raise HTTPException(status.HTTP_409_CONFLICT, "Submit a transcript before extracting")
    consent = db.table("consents").select("id").eq("meeting_id", mid).eq("status", "attested").execute()
    if not consent.data:
        raise HTTPException(status.HTTP_409_CONFLICT, "No active AI consent for this meeting")

    # ponytail: two clicks in the same instant can both start a job; the UI disables the button.
    db.table("extracted_items").delete().eq("meeting_id", mid).eq("review_status", "needs_review").execute()
    db.table("meetings").update({"status": "processing"}).eq("id", mid).execute()
    background_tasks.add_task(run_extraction, meeting_id)
    return {"status": "processing"}
