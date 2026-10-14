from __future__ import annotations

import re

from app.parsers.clean import TranscriptParseError, clean_text
from app.parsers.text import SPEAKER_PATTERN, Segment

VTT_TIMING_PATTERN = re.compile(
    r"^(?:(\d{1,2}):)?(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(?:(\d{1,2}):)?(\d{2}):(\d{2})\.(\d{3})(?:[ \t].*)?$"
)

VOICE_TAG_PATTERN = re.compile(
    r"<v(?:\.[^>]+)?\s+([^>]+)>(.*?)(?:</v>)?", re.IGNORECASE | re.DOTALL
)

TAG_STRIP_PATTERN = re.compile(r"<[^>]+>")


def _parse_vtt_timestamp(h: str | None, m: str, s: str, ms: str) -> int:
    hours = int(h) if h is not None else 0
    minutes = int(m)
    seconds = int(s)
    milliseconds = int(ms)
    return (hours * 3600 + minutes * 60 + seconds) * 1000 + milliseconds


def _is_cue_id(line: str) -> bool:
    """Returns True if a line looks like an optional cue identifier (short token, no voice/speaker tag)."""
    stripped = line.strip()
    return bool(stripped and not stripped.startswith("<v") and ":" not in stripped and len(stripped.split()) <= 2)


def _is_cue_start(lines: list[str], idx: int) -> bool:
    """Returns True if lines[idx] is a timing line or a cue id followed by a timing line."""
    if idx >= len(lines):
        return False
    if VTT_TIMING_PATTERN.match(lines[idx].strip()):
        return True
    if idx + 1 < len(lines) and VTT_TIMING_PATTERN.match(lines[idx + 1].strip()):
        return _is_cue_id(lines[idx])
    return False


def parse_vtt(data: bytes | str) -> list[Segment]:
    """
    Parses a WebVTT transcript file.
    - Strips WEBVTT header and NOTE blocks.
    - Extracts cue start and end timestamps in milliseconds.
    - Extracts speaker from <v Name> tags or 'Name:' prefixes.
    - Strips inline styling and formatting tags.
    """
    cleaned = clean_text(data)
    if not cleaned:
        raise TranscriptParseError("VTT transcript contains no usable text")

    lines = cleaned.split("\n")
    if not any("WEBVTT" in line for line in lines[:5]):
        raise TranscriptParseError("Missing WEBVTT header in VTT transcript")

    segments: list[Segment] = []
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i].strip()

        # Skip WEBVTT header line or metadata lines
        if not line or line.startswith("WEBVTT") or line.startswith("X-TIMESTAMP-MAP"):
            i += 1
            continue

        # Skip NOTE blocks until the next cue starts
        if line.startswith("NOTE"):
            i += 1
            while i < n and not _is_cue_start(lines, i):
                i += 1
            continue

        # Check for timing line or cue ID preceding timing line
        timing_match = VTT_TIMING_PATTERN.match(line)
        if not timing_match:
            if i + 1 < n and VTT_TIMING_PATTERN.match(lines[i + 1].strip()) and _is_cue_id(line):
                i += 1  # Skip cue ID
                line = lines[i].strip()
                timing_match = VTT_TIMING_PATTERN.match(line)

        if not timing_match:
            i += 1
            continue

        # Extract timestamps
        start_ms = _parse_vtt_timestamp(
            timing_match.group(1),
            timing_match.group(2),
            timing_match.group(3),
            timing_match.group(4),
        )
        end_ms = _parse_vtt_timestamp(
            timing_match.group(5),
            timing_match.group(6),
            timing_match.group(7),
            timing_match.group(8),
        )
        i += 1

        # Collect cue text lines until next cue starts or end of file
        cue_text_lines = []
        while i < n and not _is_cue_start(lines, i) and not lines[i].strip().startswith("NOTE"):
            cue_text_lines.append(lines[i].strip())
            i += 1

        if not cue_text_lines:
            continue

        raw_cue_text = " ".join(cue_text_lines)

        # Check for <v Speaker> tag
        speaker: str | None = None
        v_match = VOICE_TAG_PATTERN.search(raw_cue_text)
        if v_match:
            speaker = v_match.group(1).strip()
            raw_cue_text = raw_cue_text[:v_match.start()] + v_match.group(2) + raw_cue_text[v_match.end():]

        # Strip remaining HTML/VTT tags
        clean_cue_text = TAG_STRIP_PATTERN.sub("", raw_cue_text).strip()

        # Fallback to 'Speaker: Text' if no voice tag
        if not speaker:
            sp_match = SPEAKER_PATTERN.match(clean_cue_text)
            if sp_match:
                cand_speaker = sp_match.group(1).strip()
                if not re.search(r"\b\d+$", cand_speaker):
                    speaker = cand_speaker
                    clean_cue_text = sp_match.group(2).strip()

        if clean_cue_text:
            segments.append(Segment(
                speaker_name=speaker,
                start_ms=start_ms,
                end_ms=max(start_ms, end_ms),
                text=clean_cue_text,
            ))

    if not segments:
        raise TranscriptParseError("No valid cues found in VTT transcript")

    return segments
