"""Background extraction job (BE-3): transcript -> extracted_items + llm_runs."""

import logging
from datetime import datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.core.supabase import get_supabase_client
from app.services.llm.chain import LLMCall, extract
from app.services.llm.prompt import build_roster, strip_transcript_tags
from app.services.llm.validate import validate_items

logger = logging.getLogger(__name__)

# List prices from doc/ai-infra/01-ai-llm.md (Gemini 3.1 Flash-Lite, paid tier; actual spend is ₹0 on free tier).
USD_PER_M_INPUT = 0.25
USD_PER_M_OUTPUT = 1.50
INR_PER_USD = 88.0  # ponytail: fixed rate, fine for an estimate column


def _est_cost_inr(call: LLMCall) -> float:
    usd = (call.input_tokens or 0) * USD_PER_M_INPUT / 1e6 + (call.output_tokens or 0) * USD_PER_M_OUTPUT / 1e6
    return round(usd * INR_PER_USD, 4)


def _load_members(db, workspace_id: str) -> list[dict]:
    member_ids = [
        m["user_id"]
        for m in db.table("workspace_members").select("user_id").eq("workspace_id", workspace_id).execute().data
    ]
    if not member_ids:
        return []
    profiles = db.table("profiles").select("id, display_name, email").in_("id", member_ids).execute().data
    return [{"user_id": p["id"], "display_name": p.get("display_name"), "email": p.get("email")} for p in profiles]


def run_extraction(meeting_id: UUID | str) -> None:
    """Never raises: it runs after the 202 response. Sets meetings.status to 'ready' or 'failed'."""
    mid = str(meeting_id)
    try:
        db = get_supabase_client()
        meeting = db.table("meetings").select("*").eq("id", mid).execute().data[0]
        transcript = db.table("transcripts").select("id, canonical_text").eq("meeting_id", mid).execute().data[0]
        segments = (
            db.table("transcript_segments")
            .select("text, start_ms, end_ms")
            .eq("transcript_id", transcript["id"])
            .order("segment_index")
            .execute()
            .data
        )
        roster_text, refs = build_roster(_load_members(db, meeting["workspace_id"]))

        starts_at = datetime.fromisoformat(meeting["starts_at"])
        local_start = starts_at.astimezone(ZoneInfo(meeting["timezone"]))
        canonical_text = transcript["canonical_text"] or ""

        result, calls = extract({
            "title": meeting["title"],
            "meeting_date": local_start.date().isoformat(),
            "weekday": local_start.strftime("%A"),
            "timezone": meeting["timezone"],
            "roster": roster_text,
            "transcript": strip_transcript_tags(canonical_text),
        })

        db.table("llm_runs").insert([
            {
                "meeting_id": mid,
                "provider": "gemini",
                "model_version": settings.GEMINI_MODEL,
                "input_tokens": c.input_tokens,
                "output_tokens": c.output_tokens,
                "latency_ms": c.latency_ms,
                "est_cost_inr": _est_cost_inr(c),
                "payload_hash": c.payload_hash,
                "success": c.error_code is None,
                "error_code": c.error_code,
            }
            for c in calls
        ]).execute()

        if result is None:
            logger.warning("extraction failed meeting=%s error=%s", mid, calls[-1].error_code)
            db.table("meetings").update({"status": "failed"}).eq("id", mid).execute()
            return

        rows = validate_items(
            result.items,
            canonical_text=canonical_text,
            segments=segments,
            roster_refs=refs,
            timezone=meeting["timezone"],
            meeting_starts_at=starts_at,
        )
        if rows:
            db.table("extracted_items").insert([
                {**r, "meeting_id": mid, "provider": "gemini", "model_version": settings.GEMINI_MODEL}
                for r in rows
            ]).execute()
        db.table("meetings").update({"status": "ready"}).eq("id", mid).execute()
        logger.info(
            "extraction ready meeting=%s items=%d flagged=%d latency_ms=%d",
            mid, len(rows), sum(r["uncertainty_flag"] for r in rows), sum(c.latency_ms for c in calls),
        )
    except Exception as exc:
        # Log the type only: messages from the DB or SDK can echo transcript text.
        logger.error("extraction crashed meeting=%s error=%s", mid, type(exc).__name__)
        try:
            get_supabase_client().table("meetings").update({"status": "failed"}).eq("id", mid).execute()
        except Exception:
            logger.error("could not mark meeting=%s failed", mid)
