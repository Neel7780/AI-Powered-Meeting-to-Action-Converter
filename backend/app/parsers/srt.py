"""SubRip (.srt) transcript parser (BE-5)."""

import re

from app.parsers.clean import clean_transcript_data
from app.parsers.text import Segment


def _parse_srt_timestamp(ts: str) -> int | None:
    """Parse SRT timestamp (HH:MM:SS,mmm) to milliseconds."""
    ts = ts.strip().replace(",", ".")
    match = re.match(r"^(?:(\d{1,2}):)?(\d{2}):(\d{2})(?:\.(\d{1,3}))?$", ts)
    if not match:
        return None
    h_str, m_str, s_str, ms_str = match.groups()
    h = int(h_str) if h_str else 0
    m = int(m_str)
    s = int(s_str)
    ms = int(ms_str.ljust(3, "0")[:3]) if ms_str else 0
    return (h * 3600 + m * 60 + s) * 1000 + ms


def parse_srt_transcript(raw_data: bytes | str) -> list[Segment]:
    """Parse SubRip (.srt) file into list of Segments."""
    cleaned = clean_transcript_data(raw_data)
    blocks = re.split(r"\n\s*\n", cleaned)

    segments: list[Segment] = []
    timing_re = re.compile(r"((?:\d{1,2}:)?\d{2}:\d{2}[,\.]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[,\.]\d{1,3})")
    speaker_re = re.compile(r"^([a-zA-Z][a-zA-Z\s._'-]{0,39}[a-zA-Z._'-]):\s*(.*)$")

    for block in blocks:
        lines = [ln.strip() for ln in block.split("\n") if ln.strip()]
        if not lines:
            continue

        timing_idx = -1
        for idx, line in enumerate(lines):
            if timing_re.search(line):
                timing_idx = idx
                break

        if timing_idx == -1:
            continue

        timing_match = timing_re.search(lines[timing_idx])
        if not timing_match:
            continue

        start_ms = _parse_srt_timestamp(timing_match.group(1))
        end_ms = _parse_srt_timestamp(timing_match.group(2))
        if start_ms is not None and end_ms is not None and end_ms < start_ms:
            end_ms = start_ms

        text_lines = lines[timing_idx + 1:]
        full_text = " ".join(text_lines).strip()
        if not full_text:
            continue

        # Strip basic HTML tags if any (e.g. <i>, <b>)
        full_text = re.sub(r"<[^>]+>", "", full_text).strip()

        speaker: str | None = None
        spk_match = speaker_re.match(full_text)
        if spk_match:
            speaker = spk_match.group(1).strip()
            full_text = spk_match.group(2).strip()

        if full_text:
            segments.append(Segment(
                speaker_name=speaker,
                start_ms=start_ms,
                end_ms=end_ms,
                text=full_text
            ))

    return segments
