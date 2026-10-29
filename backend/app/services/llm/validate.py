"""Turn the model's items into extracted_items rows, flagging anything uncertain (BE-3).

Pure functions: no DB, no network.
"""

import re
from datetime import datetime

from app.services.llm.prompt import LLMItem
from app.utils.dates import to_utc

MIN_CONFIDENCE = 0.70

_QUOTES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"'})


def normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text.translate(_QUOTES)).strip()


def _clamp(value: float | None) -> float | None:
    return None if value is None else min(max(value, 0.0), 1.0)


def _low(value: float | None) -> bool:
    return value is None or value < MIN_CONFIDENCE


def validate_items(
    items: list[LLMItem],
    *,
    canonical_text: str,
    segments: list[dict],
    roster_refs: dict[str, str],
    timezone: str,
    meeting_starts_at: datetime,
    roster_names: dict[str, str] | None = None,
) -> list[dict]:
    """Return extracted_items rows (without meeting_id/provider/model_version).

    A flag is only a badge for the reviewer; it never blocks approval.
    """
    transcript = normalise(canonical_text)
    rows: list[dict] = []

    for item in items:
        excerpt = item.source_excerpt.strip()
        task = (item.task or "").strip() or None
        if not excerpt or (item.type == "action" and not task):
            continue  # the DB would reject these rows anyway

        needle = normalise(excerpt)
        verbatim = needle in transcript
        seg = next(
            (s for s in segments if s.get("start_ms") is not None and needle in normalise(s["text"])),
            None,
        )

        owner_user_id = roster_refs.get(item.owner_ref) if item.owner_ref else None
        if item.type == "action" and item.owner_name and roster_names:
            name = normalise(item.owner_name).casefold()
            matches = [ref for ref, full_name in roster_names.items()
                       if name == normalise(full_name).casefold()
                       or name == normalise(full_name).split(" ")[0].casefold()]
            if len(matches) != 1:
                owner_user_id = None
            if len(matches) == 1:
                speaker = normalise(seg.get("speaker_name") or "").casefold() if seg else ""
                named_in_quote = re.search(r"(?<!\w)" + re.escape(name) + r"(?!\w)", needle.casefold())
                matched_user_id = roster_refs[matches[0]]
                if named_in_quote or speaker in (name, normalise(roster_names[matches[0]]).casefold()):
                    owner_user_id = matched_user_id
                elif owner_user_id != matched_user_id:
                    owner_user_id = None
        deadline = to_utc(item.deadline_date, item.deadline_time, timezone)
        owner_conf = _clamp(item.owner_confidence)
        confidence = _clamp(item.confidence)

        flagged = not verbatim or _low(confidence)
        if item.type == "action":
            flagged = (
                flagged
                or owner_user_id is None  # nobody named, an external person, or an unknown ref
                or deadline is None
                or _low(owner_conf)
                or deadline < meeting_starts_at
            )

        rows.append({
            "type": item.type,
            "task": task,
            "owner_name": item.owner_name,
            "owner_user_id": owner_user_id,
            "owner_confidence": owner_conf,
            "deadline_raw": item.deadline_raw,
            "deadline_utc": deadline.isoformat() if deadline else None,
            "deadline_timezone": timezone if deadline else None,
            "deadline_confidence": _clamp(item.deadline_confidence),
            "priority": item.priority,
            "source_excerpt": excerpt,
            "source_start_ms": seg["start_ms"] if seg else None,
            "source_end_ms": seg["end_ms"] if seg else None,
            "confidence": confidence,
            "uncertainty_flag": flagged,
        })

    return rows
