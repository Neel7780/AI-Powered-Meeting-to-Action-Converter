"""WebVTT (.vtt) transcript parser (BE-5)."""

import re

from app.parsers.clean import clean_transcript_data
from app.parsers.text import Segment


def _parse_vtt_timestamp(ts: str) -> int | None:
    """Parse VTT timestamp (HH:MM:SS.mmm or MM:SS.mmm) to milliseconds."""
    ts = ts.strip()
    match = re.match(r"^(?:(\d{1,2}):)?(\d{2}):(\d{2})(?:\.(\d{1,3}))?$", ts)
    if not match:
        return None
    h_str, m_str, s_str, ms_str = match.groups()
    h = int(h_str) if h_str else 0
    m = int(m_str)
    s = int(s_str)
    ms = int(ms_str.ljust(3, "0")[:3]) if ms_str else 0
    return (h * 3600 + m * 60 + s) * 1000 + ms


def parse_vtt_transcript(raw_data: bytes | str) -> list[Segment]:
    """Parse WebVTT file into list of Segments."""
    cleaned = clean_transcript_data(raw_data)
    lines = cleaned.split("\n")

    segments: list[Segment] = []
    i = 0
    n = len(lines)

    timing_re = re.compile(
        r"^((?:\d{1,2}:)?\d{2}:\d{2}(?:\.\d{1,3})?)\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}(?:\.\d{1,3})?)"
    )

    # In NOTE block state
    in_note = False

    while i < n:
        line = lines[i].strip()
        if in_note:
            if not line:
                in_note = False
            i += 1
            continue

        if not line or line.startswith("WEBVTT"):
            i += 1
            continue

        if line.startswith("NOTE"):
            in_note = True
            i += 1
            continue

        match = timing_re.match(line)
        if match:
            start_ms = _parse_vtt_timestamp(match.group(1))
            end_ms = _parse_vtt_timestamp(match.group(2))
            if start_ms is not None and end_ms is not None and end_ms < start_ms:
                end_ms = start_ms

            # Collect subsequent text lines until blank line or next timing
            i += 1
            text_lines: list[str] = []
            while i < n and lines[i].strip() and not timing_re.match(lines[i].strip()):
                text_lines.append(lines[i].strip())
                i += 1

            full_text = " ".join(text_lines)
            if not full_text:
                continue

            # Check for <v SpeakerName> or <v.class SpeakerName>
            speaker: str | None = None
            v_match = re.search(r"<v(?:\.[^>]+)?\s+([^>]+)>", full_text)
            if v_match:
                speaker = v_match.group(1).strip()

            # Strip all VTT/HTML tags
            clean_text = re.sub(r"<[^>]+>", "", full_text).strip()

            # If no voice tag, check for "Speaker:" prefix
            if not speaker:
                prefix_match = re.match(r"^([a-zA-Z][a-zA-Z\s._'-]{0,39}[a-zA-Z._'-]):\s*(.*)$", clean_text)
                if prefix_match:
                    speaker = prefix_match.group(1).strip()
                    clean_text = prefix_match.group(2).strip()

            if clean_text:
                segments.append(Segment(
                    speaker_name=speaker,
                    start_ms=start_ms,
                    end_ms=end_ms,
                    text=clean_text
                ))
            continue

        i += 1

    return segments
