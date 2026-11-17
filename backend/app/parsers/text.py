"""Plain text and pasted transcript parser (BE-5)."""

import re
from dataclasses import dataclass

from app.parsers.clean import clean_transcript_data


@dataclass
class Segment:
    speaker_name: str | None
    start_ms: int | None
    end_ms: int | None
    text: str


def _parse_timestamp_ms(ts_str: str) -> int | None:
    """Parse [HH:MM:SS], [MM:SS], (HH:MM:SS), (MM:SS) into milliseconds."""
    ts_str = ts_str.strip("[]()")
    parts = ts_str.split(":")
    try:
        if len(parts) == 3:
            h, m, s = int(parts[0]), int(parts[1]), float(parts[2].replace(",", "."))
            return int((h * 3600 + m * 60 + s) * 1000)
        elif len(parts) == 2:
            m, s = int(parts[0]), float(parts[1].replace(",", "."))
            return int((m * 60 + s) * 1000)
    except (ValueError, IndexError):
        pass
    return None


def parse_text_transcript(raw_data: bytes | str) -> list[Segment]:
    """Parse plain text or pasted meeting transcript into list of Segments."""
    cleaned = clean_transcript_data(raw_data)
    lines = [ln.strip() for ln in cleaned.split("\n") if ln.strip()]

    raw_segments: list[dict] = []

    ts_pattern = re.compile(
        r"^(\[[0-9]{1,2}:[0-9]{2}(?::[0-9]{2}(?:[.,][0-9]{1,3})?)?\]"
        r"|\([0-9]{1,2}:[0-9]{2}(?::[0-9]{2}(?:[.,][0-9]{1,3})?)?\))\s*"
    )

    # Regex for speaker: starts with letter, at most 40 chars, no digit directly before colon, followed by space
    # Ensures "Meeting at 10:30" or "at 10:30" is not treated as a speaker
    speaker_pattern = re.compile(r"^([a-zA-Z][a-zA-Z\s._'-]{0,39}[a-zA-Z._'-]):\s*(.*)$")

    for line in lines:
        start_ms: int | None = None
        ts_match = ts_pattern.match(line)
        if ts_match:
            ts_str = ts_match.group(1)
            start_ms = _parse_timestamp_ms(ts_str)
            line = line[ts_match.end():].strip()

        speaker_name: str | None = None
        spk_match = speaker_pattern.match(line)
        if spk_match:
            # Check it's not a false positive like "Time: 10:30" or numbers
            candidate_speaker = spk_match.group(1).strip()
            rest_of_line = spk_match.group(2).strip()
            if candidate_speaker and rest_of_line:
                speaker_name = candidate_speaker
                line = rest_of_line

        if line:
            raw_segments.append({
                "speaker_name": speaker_name,
                "start_ms": start_ms,
                "text": line
            })

    # Reconcile start_ms and end_ms (database constraint: BOTH null or BOTH set)
    segments: list[Segment] = []
    for i, item in enumerate(raw_segments):
        cur_start = item["start_ms"]
        cur_end: int | None = None
        if cur_start is not None:
            # Find next segment with start_ms
            next_start: int | None = None
            for j in range(i + 1, len(raw_segments)):
                if raw_segments[j]["start_ms"] is not None:
                    next_start = raw_segments[j]["start_ms"]
                    break
            if next_start is not None and next_start >= cur_start:
                cur_end = next_start
            else:
                cur_end = cur_start

        segments.append(Segment(
            speaker_name=item["speaker_name"],
            start_ms=cur_start,
            end_ms=cur_end,
            text=item["text"]
        ))

    return segments
