"""DOCX (.docx) transcript parser (BE-5)."""

import io

from app.parsers.clean import TranscriptParseError
from app.parsers.text import Segment, parse_text_transcript


def parse_docx_transcript(raw_data: bytes) -> list[Segment]:
    """Extract paragraphs from DOCX file and parse with text parser."""
    try:
        import docx
    except ImportError as exc:
        raise TranscriptParseError("DOCX parsing support (python-docx) is not installed") from exc

    try:
        file_stream = io.BytesIO(raw_data)
        doc = docx.Document(file_stream)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        full_text = "\n".join(paragraphs)
        if not full_text.strip():
            raise TranscriptParseError("DOCX document contains no text")
        return parse_text_transcript(full_text)
    except TranscriptParseError:
        raise
    except Exception as exc:
        raise TranscriptParseError(f"Failed to read DOCX file: {exc}") from exc
