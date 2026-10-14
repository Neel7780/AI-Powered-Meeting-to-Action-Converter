from __future__ import annotations

from pathlib import Path

from app.parsers.clean import TranscriptParseError, clean_text
from app.parsers.docx import parse_docx
from app.parsers.srt import parse_srt
from app.parsers.text import Segment, parse_text
from app.parsers.vtt import parse_vtt


def to_canonical_text(segments: list[Segment]) -> str:
    """
    Converts parsed segments to canonical format:
    one 'Speaker: text' line per segment (or just 'text' if speaker is unknown).
    This format is stored in transcripts.canonical_text and fed into LLM prompts.
    """
    lines: list[str] = []
    for s in segments:
        if s.speaker_name:
            lines.append(f"{s.speaker_name}: {s.text}")
        else:
            lines.append(s.text)
    return "\n".join(lines)


def parse_transcript(filename: str | None, data: bytes | str) -> list[Segment]:
    """
    Dispatcher that selects the appropriate parser based on file extension.
    - filename=None or empty string implies pasted text (.txt parser).
    - Supported extensions: .txt, .vtt, .srt, .docx (case-insensitive).
    - Raises TranscriptParseError on unsupported extension or empty segments.
    """
    if not filename:
        segments = parse_text(data)
    else:
        ext = Path(filename).suffix.lower()
        if ext in ("", ".txt"):
            segments = parse_text(data)
        elif ext == ".vtt":
            segments = parse_vtt(data)
        elif ext == ".srt":
            segments = parse_srt(data)
        elif ext == ".docx":
            segments = parse_docx(data)
        else:
            raise TranscriptParseError(
                f"Unsupported file format '{ext}'. Allowed extensions: .txt, .vtt, .srt, .docx"
            )

    if not segments:
        raise TranscriptParseError("No valid segments could be extracted from the transcript")

    return segments


__all__ = [
    "Segment",
    "TranscriptParseError",
    "clean_text",
    "parse_text",
    "parse_vtt",
    "parse_srt",
    "parse_docx",
    "parse_transcript",
    "to_canonical_text",
]
