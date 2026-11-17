"""Transcript parsing package dispatcher (BE-5).

Supports pasted text and files in .txt, .vtt, .srt, and .docx formats.
"""

from pathlib import Path

from app.parsers.clean import TranscriptParseError
from app.parsers.docx import parse_docx_transcript
from app.parsers.srt import parse_srt_transcript
from app.parsers.text import Segment, parse_text_transcript
from app.parsers.vtt import parse_vtt_transcript


def to_canonical_text(segments: list[Segment]) -> str:
    """Format segments into canonical text for LLM extraction and DB storage.
    
    Produces one 'Speaker: text' line per segment (or just 'text' when speaker is unknown).
    """
    lines: list[str] = []
    for seg in segments:
        text = seg.text.strip()
        if not text:
            continue
        if seg.speaker_name and seg.speaker_name.strip():
            lines.append(f"{seg.speaker_name.strip()}: {text}")
        else:
            lines.append(text)
    return "\n".join(lines)


def parse_transcript(filename: str | None, data: bytes | str) -> list[Segment]:
    """Parse raw transcript data into a list of Segment objects based on file extension.
    
    filename=None denotes direct pasted text.
    Raises TranscriptParseError on unsupported extension or empty segments.
    """
    if filename is None:
        segments = parse_text_transcript(data)
    else:
        ext = Path(filename).suffix.lower()
        if ext == ".txt":
            segments = parse_text_transcript(data)
        elif ext == ".vtt":
            segments = parse_vtt_transcript(data)
        elif ext == ".srt":
            segments = parse_srt_transcript(data)
        elif ext == ".docx":
            if isinstance(data, str):
                data = data.encode("utf-8")
            segments = parse_docx_transcript(data)
        else:
            raise TranscriptParseError(
                f"Unsupported transcript format '{ext}'. Allowed extensions: .txt, .vtt, .srt, .docx"
            )

    if not segments:
        raise TranscriptParseError("Transcript contains no valid text segments")

    return segments


__all__ = [
    "Segment",
    "TranscriptParseError",
    "parse_transcript",
    "to_canonical_text",
]
