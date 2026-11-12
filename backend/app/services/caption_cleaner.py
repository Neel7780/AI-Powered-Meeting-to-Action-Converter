"""Caption noise filtering and non-destructive deduplication helpers.

Removes live-caption UI toolbar artifacts and merges progressive STT revisions
or rolling caption overlaps without discarding distinct topics spoken by the
same participant.
"""

from __future__ import annotations

import math
import re
from typing import Any

_TOKEN_RE = re.compile(r"[^\W_]+(?:['’][^\W_]+)*", re.UNICODE)

_UI_SPEAKERS = {
    "language",
    "format_size",
    "settings",
    "circle",
    "more_vert",
    "arrow_drop_down",
    "expand_more",
    "expand_less",
    "close",
    "closed_caption",
    "subtitles",
    "font size",
    "font color",
}

_UI_TEXT_PATTERNS = (
    re.compile(r"\bformat_size\b", re.IGNORECASE),
    re.compile(r"open caption settings", re.IGNORECASE),
    re.compile(r"caption settings", re.IGNORECASE),
    re.compile(r"\bfont size\b", re.IGNORECASE),
    re.compile(r"\bfont color\b", re.IGNORECASE),
    re.compile(r"^(?:english|hindi|spanish|french|german|portuguese|japanese|korean|auto-detected)(?:\s*\([^)]+\))?$", re.IGNORECASE),
    re.compile(r"^(?:language|settings|circle|arrow_drop_down|expand_more|expand_less|closed_caption)$", re.IGNORECASE),
)

_PURE_FILLER_RE = re.compile(
    r"^(?:"
    r"(?:hello+|hi+|hey+)(?:[\s,]+(?:hello+|hi+|hey+))*(?:\s+(?:everyone|all|team|guys))?"
    r"|(?:am\s+i|is\s+(?:my\s+voice|it)|are\s+you)\s+(?:audible|visible)"
    r"|(?:can\s+you\s+)?hear\s+me(?:\s+now)?"
    r"|my\s+audible"
    r"|(?:ok|okay|thanks|thank\s+you|okay[\s,]+thank\s+you|bye|goodbye|alright|got\s+it|sounds\s+good|noted)"
    r")[\s.,!?]*$",
    re.IGNORECASE,
)


def _normalize_ws(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _tokenize_words(text: str) -> list[str]:
    return [m.group(0).lower() for m in _TOKEN_RE.finditer(text or "")]


def _common_prefix_len(a: list[str], b: list[str]) -> int:
    limit = min(len(a), len(b))
    i = 0
    while i < limit and a[i] == b[i]:
        i += 1
    return i


def _common_suffix_len(a: list[str], b: list[str], min_start: int = 0) -> int:
    i = len(a) - 1
    j = len(b) - 1
    count = 0
    while i >= min_start and j >= min_start and a[i] == b[j]:
        count += 1
        i -= 1
        j -= 1
    return count


def _strip_leading_words(text: str, word_count: int) -> str:
    if word_count <= 0:
        return _normalize_ws(text)
    matches = list(_TOKEN_RE.finditer(text or ""))
    if word_count >= len(matches):
        return ""
    cut_end = matches[word_count - 1].end()
    return re.sub(r"^[\s.,!?;:…—-]+", "", text[cut_end:]).strip()


def is_caption_ui_noise(speaker: str, text: str) -> bool:
    """Return True if the cue comes from caption-settings UI controls rather than speech."""
    clean_text = _normalize_ws(text)
    clean_speaker = _normalize_ws(speaker).lower()
    if not clean_text or len(clean_text) < 2:
        return True
    if clean_speaker in _UI_SPEAKERS:
        return True
    return any(p.search(clean_text) for p in _UI_TEXT_PATTERNS)


def deduplicate_caption_segments(raw_segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop UI noise and merge progressive/overlapping revisions while preserving distinct topics."""
    cleaned: list[dict[str, Any]] = []

    for idx, seg in enumerate(raw_segments):
        speaker = _normalize_ws(seg.get("speaker") or "Speaker") or "Speaker"
        text = _normalize_ws(seg.get("text") or "")
        if is_caption_ui_noise(speaker, text):
            continue

        start_ms = seg.get("start_ms")
        if start_ms is None:
            start_ms = idx * 5000
        end_ms = seg.get("end_ms")
        if end_ms is None:
            end_ms = start_ms + 5000

        target: dict[str, Any] | None = None
        floor = max(0, len(cleaned) - 2)
        for j in range(len(cleaned) - 1, floor - 1, -1):
            cand = cleaned[j]
            if cand["speaker"].lower() != speaker.lower():
                continue
            if abs(start_ms - cand["start_ms"]) <= 30000:
                target = cand
                break

        if target is not None:
            prev_text = target["text"]
            prev_words = _tokenize_words(prev_text)
            new_words = _tokenize_words(text)
            if not new_words:
                continue

            lcp = _common_prefix_len(prev_words, new_words)

            # 1. Exact normalized words (punctuation/capitalization fix)
            if lcp == len(prev_words) == len(new_words):
                if len(text) >= len(prev_text):
                    target["text"] = text
                target["end_ms"] = max(target["end_ms"], end_ms)
                continue

            # 2. Shorter stale prefix re-render
            if lcp == len(new_words) and len(new_words) < len(prev_words):
                continue

            # 3. Progressive expansion / minor STT edit of the same turn
            lcs = _common_suffix_len(prev_words, new_words, lcp)
            is_revision = (
                lcp == len(prev_words)
                or (
                    len(prev_words) >= 5
                    and lcp >= math.ceil(len(prev_words) * 0.7)
                    and len(new_words) >= len(prev_words) - 2
                )
                or (
                    len(prev_words) >= 6
                    and len(new_words) >= len(prev_words) - 2
                    and (lcp + lcs) >= len(prev_words) - 2
                )
            )
            if is_revision:
                target["text"] = text
                target["end_ms"] = max(target["end_ms"], end_ms)
                continue

            # 4. Rolling window overlap (suffix of prev matches prefix of new)
            trimmed_text: str | None = None
            max_overlap = min(len(prev_words), len(new_words))
            for k in range(max_overlap, 1, -1):
                overlap = prev_words[-k:]
                if k == 2 and len(" ".join(overlap)) < 10:
                    continue
                if overlap == new_words[:k]:
                    remainder = _strip_leading_words(text, k)
                    if not remainder or len(remainder) < 2:
                        trimmed_text = ""
                    else:
                        trimmed_text = remainder
                    break

            if trimmed_text == "":
                continue
            if trimmed_text is not None:
                cleaned.append({
                    "speaker": speaker,
                    "text": trimmed_text,
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                })
                continue

        cleaned.append({
            "speaker": speaker,
            "text": text,
            "start_ms": start_ms,
            "end_ms": end_ms,
        })

    return cleaned


_SPEAKER_PREFIX_RE = re.compile(r"^([A-Za-z0-9_ .-]{1,60}):\s+(.*)$")


def prepare_transcript_for_llm(canonical_text: str) -> str:
    """Remove UI noise, duplicate revisions, and standalone greetings before sending to LLM."""
    raw_lines = [line.strip() for line in (canonical_text or "").splitlines() if line.strip()]
    if not raw_lines:
        return ""

    filtered_segments: list[dict[str, Any]] = []
    for idx, line in enumerate(raw_lines):
        match = _SPEAKER_PREFIX_RE.match(line)
        if match and match.group(1).lower() not in {"http", "https", "note"}:
            speaker = match.group(1).strip()
            utterance = match.group(2).strip()
            has_speaker = True
        else:
            speaker, utterance = "Speaker", line
            has_speaker = False

        if is_caption_ui_noise(speaker, utterance):
            continue
        if _PURE_FILLER_RE.match(utterance):
            continue

        filtered_segments.append({
            "speaker": speaker,
            "has_speaker": has_speaker,
            "text": utterance,
            "start_ms": idx * 5000,
            "end_ms": (idx + 1) * 5000,
        })

    deduped = deduplicate_caption_segments(filtered_segments)
    if deduped:
        has_speaker_by_pair = {
            (s["speaker"].lower(), s["text"]): s["has_speaker"]
            for s in filtered_segments
        }
        out_lines = []
        for seg in deduped:
            # Default to omitting synthetic "Speaker:" unless original line had a speaker prefix
            orig_has_speaker = has_speaker_by_pair.get((seg["speaker"].lower(), seg["text"]))
            if orig_has_speaker is None:
                orig_has_speaker = any(
                    s["has_speaker"] and s["speaker"].lower() == seg["speaker"].lower()
                    for s in filtered_segments
                )
            if orig_has_speaker:
                out_lines.append(f"{seg['speaker']}: {seg['text']}")
            else:
                out_lines.append(seg["text"])
        return "\n".join(out_lines)

    # Preserve non-UI lines if a short test transcript only contained standalone greetings
    non_ui_lines = []
    for line in raw_lines:
        match = _SPEAKER_PREFIX_RE.match(line)
        spk = match.group(1).strip() if match else "Speaker"
        utt = match.group(2).strip() if match else line
        if not is_caption_ui_noise(spk, utt):
            non_ui_lines.append(line)
    return "\n".join(non_ui_lines) if non_ui_lines else canonical_text
