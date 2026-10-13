from __future__ import annotations

import re
from app.parsers.clean import clean_text, TranscriptParseError
from app.parsers.text import Segment, SPEAKER_PATTERN


SRT_TIMING_PATTERN = re.compile(
    r"^(?:(\d{1,2}):)?(\d{2}):(\d{2}),(\d{3})\s+-->\s+(?:(\d{1,2}):)?(\d{2}):(\d{2}),(\d{3})(?:[ \t].*)?$"
)

TAG_STRIP_PATTERN = re.compile(r"<[^>]+>")


def _parse_srt_timestamp(h: str | None, m: str, s: str, ms: str) -> int:
    hours = int(h) if h is not None else 0
    minutes = int(m)
    seconds = int(s)
    milliseconds = int(ms)
    return (hours * 3600 + minutes * 60 + seconds) * 1000 + milliseconds


def parse_srt(data: bytes | str) -> list[Segment]:
    """
    Parses an SRT subtitle / transcript file.
    - Parses subtitle blocks separated by index and timing lines.
    - Extracts start_ms and end_ms with comma separator.
    - Extracts speaker from 'Speaker: Text' prefix.
    - Strips inline subtitle formatting tags.
    """
    cleaned = clean_text(data)
    if not cleaned:
        raise TranscriptParseError("SRT transcript contains no usable text")

    lines = cleaned.split("\n")
    segments: list[Segment] = []

    i = 0
    n = len(lines)

    while i < n:
        line = lines[i].strip()

        # Look for the timing line (might be line i if index was skipped, or line i+1 if line i is index)
        timing_match = SRT_TIMING_PATTERN.match(line)
        if not timing_match and i + 1 < n:
            timing_match = SRT_TIMING_PATTERN.match(lines[i + 1].strip())
            if timing_match:
                i += 1  # Advance past the index line

        if not timing_match:
            i += 1
            continue

        start_ms = _parse_srt_timestamp(
            timing_match.group(1),
            timing_match.group(2),
            timing_match.group(3),
            timing_match.group(4),
        )
        end_ms = _parse_srt_timestamp(
            timing_match.group(5),
            timing_match.group(6),
            timing_match.group(7),
            timing_match.group(8),
        )
        i += 1

        # Collect text lines for this subtitle block
        block_text_lines = []
        while i < n:
            curr = lines[i].strip()
            if not curr:
                break
            # If current line is next timing line or next index followed by timing line, break
            if SRT_TIMING_PATTERN.match(curr):
                break
            if i + 1 < n and SRT_TIMING_PATTERN.match(lines[i + 1].strip()):
                break
            block_text_lines.append(curr)
            i += 1

        if not block_text_lines:
            continue

        raw_text = " ".join(block_text_lines)
        clean_block_text = TAG_STRIP_PATTERN.sub("", raw_text).strip()

        speaker: str | None = None
        sp_match = SPEAKER_PATTERN.match(clean_block_text)
        if sp_match:
            cand_speaker = sp_match.group(1).strip()
            if not re.search(r"\b\d+$", cand_speaker):
                speaker = cand_speaker
                clean_block_text = sp_match.group(2).strip()

        if clean_block_text:
            segments.append(Segment(
                speaker_name=speaker,
                start_ms=start_ms,
                end_ms=max(start_ms, end_ms),
                text=clean_block_text,
            ))

    if not segments:
        raise TranscriptParseError("No valid subtitle blocks found in SRT transcript")

    return segments
