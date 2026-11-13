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


# Matches [00:12:05], (12:05), [12:05.500], (01:12:05,123), 00:12:05, 12:05, etc.
TIMESTAMP_PATTERN = re.compile(
    r"^[\[\(]?(\d{1,2}:)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?[\]\)]?\s*[-–:]?\s*"
)

# Speaker label: up to 40 characters starting with a letter, allowing embedded timestamp [MM:SS] before colon
SPEAKER_PATTERN = re.compile(
    r"^([A-Za-z](?:\[[\d:.,]+\]|\([\d:.,]+\)|[^:\n]){0,39}):\s+(.+)$"
)

# Embedded or trailing timestamp in speaker label: e.g. "Krishna [00:12]", "Krishna (12:05)", "Krishna 00:12"
SPEAKER_TIMESTAMP_PATTERN = re.compile(
    r"[\[\(]?(\d{1,2}:)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?[\]\)]?"
)

# Timestamp at start of speech text: e.g. "[00:12] Hello", "(12:05) Hello", "00:12 Hello"
TEXT_TIMESTAMP_PATTERN = re.compile(
    r"^[\[\(]?(\d{1,2}:)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?[\]\)]?\s*[-–:]?\s*"
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

        # 1. Check for leading timestamp (e.g. [00:15] Speaker: Text or 00:15 Speaker: Text)
        ts_match = TIMESTAMP_PATTERN.match(line)
        if ts_match:
            start_ms = _parse_timestamp_ms(ts_match)
            line = line[ts_match.end():].strip()
            if not line:
                continue

        speaker: str | None = None
        text = line

        # 2. Check for speaker label
        sp_match = SPEAKER_PATTERN.match(line)
        if sp_match:
            candidate_speaker = sp_match.group(1).strip()
            # Check if speaker label itself has an embedded timestamp (e.g. "Krishna [00:15]" or "Neel (01:20)")
            sp_ts = SPEAKER_TIMESTAMP_PATTERN.search(candidate_speaker)
            if sp_ts:
                if start_ms is None:
                    start_ms = _parse_timestamp_ms(sp_ts)
                candidate_speaker = re.sub(r"[\[\(]?(\d{1,2}:)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?[\]\)]?", "", candidate_speaker).strip(" []()-–:")

            # Ensure candidate speaker is <= 40 chars and does not end with digits (e.g. 'at 10' in 'Meeting at 10: 30')
            if len(candidate_speaker) <= 40 and not re.search(r"\b\d+$", candidate_speaker):
                speaker = candidate_speaker
                text = sp_match.group(2).strip()

        # 3. Check if text begins with a timestamp (e.g. "Krishna: [00:15] Hello everyone" or "Krishna: (00:15) Hello")
        text_ts = TEXT_TIMESTAMP_PATTERN.match(text)
        if text_ts:
            if start_ms is None:
                start_ms = _parse_timestamp_ms(text_ts)
            text = text[text_ts.end():].strip()

        raw_segments.append({
            "speaker_name": speaker,
            "start_ms": start_ms,
            "text": text,
        })

    if not raw_segments:
        raise TranscriptParseError("No segments found in transcript")

    # Timing alignment:
    has_any_timestamps = any(s["start_ms"] is not None for s in raw_segments)

    if has_any_timestamps:
        # Interpolate and propagate missing timestamps so segments in a timestamped transcript don't default to 00:00
        known_indices = [i for i, s in enumerate(raw_segments) if s["start_ms"] is not None]
        first_idx = known_indices[0]
        first_ms = raw_segments[first_idx]["start_ms"] or 0
        for i in range(first_idx):
            raw_segments[i]["start_ms"] = int((i / max(1, first_idx)) * first_ms)

        for k in range(len(known_indices) - 1):
            idx_a = known_indices[k]
            idx_b = known_indices[k + 1]
            ms_a = raw_segments[idx_a]["start_ms"] or 0
            ms_b = raw_segments[idx_b]["start_ms"] or 0
            gap = idx_b - idx_a
            for i in range(idx_a + 1, idx_b):
                step = i - idx_a
                raw_segments[i]["start_ms"] = int(ms_a + (step / gap) * (ms_b - ms_a))

        last_idx = known_indices[-1]
        running_ms = raw_segments[last_idx]["start_ms"] or 0
        for i in range(last_idx + 1, len(raw_segments)):
            prev_words = max(1, len(raw_segments[i - 1]["text"].split()))
            dur_ms = max(4000, int(prev_words * 460))
            running_ms += dur_ms
            raw_segments[i]["start_ms"] = running_ms

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
            cur_start = None
            cur_end = None

        segments.append(Segment(
            speaker_name=item["speaker_name"],
            start_ms=cur_start,
            end_ms=cur_end,
            text=item["text"]
        ))

    return segments
