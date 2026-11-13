"""Meeting action item refinement service using manager feedback (Phase 2).

Preserves all approved items on the taskboard and refines only pending candidate
items according to the manager's prompt.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.config import settings
from app.core.supabase import get_supabase_client
from app.services.caption_cleaner import prepare_transcript_for_llm
from app.services.llm.chain import refine
from app.services.llm.prompt import build_roster, strip_transcript_tags
from app.services.llm.runner import _load_members, _FALLBACK_TIMEZONES
from app.services.llm.validate import validate_items

logger = logging.getLogger(__name__)


def _format_items_summary(items: list[dict], roster_by_id: dict[str, str]) -> str:
    """Format candidate items into a clean numbered list for LLM context."""
    if not items:
        return "None"
    lines: list[str] = []
    for idx, it in enumerate(items, 1):
        task = it.get("task") or "Untitled task"
        owner_name = it.get("owner_name")
        if not owner_name and it.get("owner_user_id"):
            owner_name = roster_by_id.get(str(it.get("owner_user_id")), "Unknown member")
        owner_str = owner_name or "Unassigned"
        deadline_str = it.get("deadline_raw") or it.get("deadline_date") or "None"
        excerpt = it.get("source_excerpt") or ""
        lines.append(f"{idx}. Task: {task} | Owner: {owner_str} | Deadline: {deadline_str} | Excerpt: {excerpt}")
    return "\n".join(lines)


def run_refinement(meeting_id: UUID | str, feedback: str) -> int:
    """Execute targeted LLM refinement on pending candidate items.

    - Approved items remain 100% untouched on the taskboard and in the database.
    - Only `needs_review` items are updated or replaced.
    - Returns the count of active pending items after refinement.
    """
    mid = str(meeting_id)
    db = get_supabase_client()

    meeting_rows = db.table("meetings").select("*").eq("id", mid).execute().data
    if not meeting_rows:
        raise ValueError(f"Meeting {mid} not found")
    meeting = meeting_rows[0]

    transcript_rows = db.table("transcripts").select("id, canonical_text").eq("meeting_id", mid).execute().data
    if not transcript_rows:
        raise ValueError(f"No transcript found for meeting {mid}")
    transcript = transcript_rows[0]

    segments = (
        db.table("transcript_segments")
        .select("text, speaker_name, start_ms, end_ms")
        .eq("transcript_id", transcript["id"])
        .order("segment_index")
        .execute()
        .data
        or []
    )

    members = _load_members(db, meeting["workspace_id"])
    roster_text, refs = build_roster(members)
    roster_by_id = {str(m["user_id"]): m.get("display_name") or (m.get("email") or "").split("@")[0] for m in members}
    roster_names = {
        ref: member.get("display_name") or (member.get("email") or "").split("@")[0]
        for ref, member in zip(refs, members)
    }

    # Timezone handling with IST fallback for Windows
    starts_at = datetime.fromisoformat(meeting["starts_at"])
    tz_key = (meeting.get("timezone") or "UTC").strip()
    try:
        tz_info = ZoneInfo(tz_key)
    except ZoneInfoNotFoundError:
        tz_info = _FALLBACK_TIMEZONES.get(tz_key, UTC)
    local_start = starts_at.astimezone(tz_info)
    canonical_text = transcript.get("canonical_text") or ""

    # Fetch existing extracted items to separate approved from pending
    existing_items = db.table("extracted_items").select("*").eq("meeting_id", mid).execute().data or []
    approved_items = [it for it in existing_items if it.get("review_status") == "approved"]
    pending_items = [it for it in existing_items if it.get("review_status") == "needs_review"]

    prompt_inputs = {
        "title": meeting.get("title") or "Meeting",
        "meeting_date": local_start.date().isoformat(),
        "weekday": local_start.strftime("%A"),
        "timezone": meeting.get("timezone") or "UTC",
        "roster": roster_text,
        "approved_items": _format_items_summary(approved_items, roster_by_id),
        "pending_items": _format_items_summary(pending_items, roster_by_id),
        "manager_feedback": feedback.strip(),
        "transcript": prepare_transcript_for_llm(strip_transcript_tags(canonical_text)),
    }

    result, calls = refine(prompt_inputs)

    # Log LLM run telemetry
    if calls:
        try:
            db.table("llm_runs").insert([
                {
                    "meeting_id": mid,
                    "provider": "bedrock",
                    "model_version": settings.BEDROCK_MODEL_ID,
                    "input_tokens": c.input_tokens,
                    "output_tokens": c.output_tokens,
                    "latency_ms": c.latency_ms,
                    "est_cost_inr": None,
                    "payload_hash": c.payload_hash,
                    "success": c.error_code is None,
                    "error_code": c.error_code,
                }
                for c in calls
            ]).execute()
        except Exception as log_err:
            logger.warning("Failed to insert llm_runs for refinement: %s", log_err)

    if result is None:
        error_code = calls[-1].error_code if calls else "unknown_error"
        logger.error("Refinement failed for meeting=%s error=%s", mid, error_code)
        raise RuntimeError(f"AI refinement failed: {error_code}")

    # Validate output items (resolves owner refs and formats deadlines to UTC)
    rows = validate_items(
        result.items,
        canonical_text=canonical_text,
        segments=segments,
        roster_refs=refs,
        roster_names=roster_names,
        timezone=meeting["timezone"],
        meeting_starts_at=starts_at,
    )

    # Atomic update: drop only needs_review items, leave approved and rejected intact
    db.table("extracted_items").delete().eq("meeting_id", mid).eq("review_status", "needs_review").execute()

    if rows:
        insert_rows = []
        for r in rows:
            row_copy = {k: v for k, v in r.items() if k != "depends_on_index"}
            row_copy.update({
                "meeting_id": mid,
                "provider": "bedrock",
                "model_version": settings.BEDROCK_MODEL_ID,
            })
            insert_rows.append(row_copy)

        inserted = db.table("extracted_items").insert(insert_rows).execute()
        inserted_items = inserted.data or []

        # Link dependencies if requested by refinement
        for idx, r in enumerate(rows):
            dep_idx = r.get("depends_on_index")
            if dep_idx is not None and 0 <= dep_idx < len(inserted_items) and idx < len(inserted_items):
                prereq_id = inserted_items[dep_idx]["id"]
                curr_id = inserted_items[idx]["id"]
                try:
                    db.table("extracted_items").update({
                        "rejection_reason": f"depends_on:{prereq_id}"
                    }).eq("id", curr_id).execute()
                except Exception as dep_err:
                    logger.warning("Failed to link refined dependency: %s", dep_err)

    logger.info("Refinement completed meeting=%s refined_items=%d", mid, len(rows))
    return len(rows)

