from __future__ import annotations

import re
from dataclasses import dataclass

from app.parsers.clean import TranscriptParseError, clean_text


@dataclass
class Segment:
    speaker_name: str | None
    start_ms: int | None
    end_ms: int | None
    text: str


# Matches [00:12:05], (12:05), [12:05.500], (01:12:05,123), etc.
TIMESTAMP_PATTERN = re.compile(
    r"^[\[\(](\d{1,2}:)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?[\]\)]\s*"
)

# Speaker label: up to 40 characters starting with a letter, followed by colon and whitespace
# Must not end in digits (e.g. 'Meeting at 10:30' or '10: 30')
SPEAKER_PATTERN = re.compile(
    r"^([A-Za-z][^:\n]{0,39}):\s+(.+)$"
)


def _parse_timestamp_ms(match: re.Match) -> int:
    """Converts a regex timestamp match to milliseconds."""
    hours_part = match.group(1)
    minutes = int(match.group(2))
    seconds = int(match.group(3))
    ms_part = match.group(4)

    hours = int(hours_part[:-1]) if hours_part else 0
    ms = int(ms_part.ljust(3, "0")[:3]) if ms_part else 0

    return (hours * 3600 + minutes * 60 + seconds) * 1000 + ms


def parse_text(data: bytes | str) -> list[Segment]:
    """
    Parses plain text / pasted transcript into a list of Segment objects.
    - Cleans input using clean_text.
    - Extracts optional timestamps [HH:MM:SS] or (MM:SS).
    - Extracts speaker names (letters first, <= 40 chars before colon).
    - Ensures start_ms and end_ms satisfy database constraints.
    """
    cleaned = clean_text(data)
    if not cleaned:
        raise TranscriptParseError("Transcript contains no usable text")

    lines = cleaned.split("\n")
    raw_segments: list[dict] = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        start_ms: int | None = None

        # Check for leading timestamp
        ts_match = TIMESTAMP_PATTERN.match(line)
        if ts_match:
            start_ms = _parse_timestamp_ms(ts_match)
            line = line[ts_match.end():].strip()
            if not line:
                continue

        speaker: str | None = None
        text = line

        # Check for speaker label
        sp_match = SPEAKER_PATTERN.match(line)
        if sp_match:
            candidate_speaker = sp_match.group(1).strip()
            # Ensure candidate speaker does not end with digits (e.g. 'at 10' in 'Meeting at 10: 30')
            if not re.search(r"\b\d+$", candidate_speaker):
                speaker = candidate_speaker
                text = sp_match.group(2).strip()

        raw_segments.append({
            "speaker_name": speaker,
            "start_ms": start_ms,
            "text": text,
        })

    if not raw_segments:
        raise TranscriptParseError("No segments found in transcript")

    # Timing alignment: start_ms and end_ms must both be set or both be null
    has_any_timestamps = any(s["start_ms"] is not None for s in raw_segments)

    segments: list[Segment] = []
    for i, item in enumerate(raw_segments):
        cur_start = item["start_ms"]
        cur_end: int | None = None

        if has_any_timestamps and cur_start is not None:
            # Look ahead for next segment with a start_ms
            next_start = None
            for j in range(i + 1, len(raw_segments)):
                if raw_segments[j]["start_ms"] is not None:
                    next_start = raw_segments[j]["start_ms"]
                    break

            if next_start is not None and next_start >= cur_start:
                cur_end = next_start
            else:
                cur_end = cur_start
        elif has_any_timestamps and cur_start is None:
            # Segment has no timestamp; keep both None
            cur_start = None
            cur_end = None

        segments.append(Segment(
            speaker_name=item["speaker_name"],
            start_ms=cur_start,
            end_ms=cur_end,
            text=item["text"]
        ))

    return segments
