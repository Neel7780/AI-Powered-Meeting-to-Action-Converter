from __future__ import annotations

import io
import zipfile
import xml.etree.ElementTree as ET
from app.parsers.clean import TranscriptParseError
from app.parsers.text import Segment, parse_text


def _extract_docx_paragraphs_zip(data: bytes) -> list[str]:
    """Fallback reader using python standard library zipfile and xml parser."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as docx_zip:
            if "word/document.xml" not in docx_zip.namelist():
                raise TranscriptParseError("Invalid DOCX file: missing word/document.xml")
            xml_content = docx_zip.read("word/document.xml")
            tree = ET.fromstring(xml_content)
            
            # XML namespace for WordprocessingML
            w_ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            paragraphs = []
            for p in tree.iter(f"{{{w_ns}}}p"):
                text_runs = [node.text for node in p.iter(f"{{{w_ns}}}t") if node.text]
                if text_runs:
                    paragraphs.append("".join(text_runs))
            return paragraphs
    except (zipfile.BadZipFile, ET.ParseError) as exc:
        raise TranscriptParseError(f"Could not parse DOCX file: {exc}") from exc


def parse_docx(data: bytes | io.BytesIO | str) -> list[Segment]:
    """
    Parses a Microsoft Word .docx transcript.
    Extracts paragraphs and delegates to parse_text.
    """
    raw_bytes: bytes
    if isinstance(data, bytes):
        raw_bytes = data
    elif isinstance(data, io.BytesIO):
        raw_bytes = data.getvalue()
    elif isinstance(data, str):
        # In case a file path or already decoded content was provided
        raw_bytes = data.encode("utf-8")
    else:
        raise TranscriptParseError("DOCX data must be bytes or BytesIO stream")

    paragraphs: list[str] = []

    # Try python-docx if installed
    try:
        import docx  # type: ignore
        doc = docx.Document(io.BytesIO(raw_bytes))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    except (ImportError, ValueError, AttributeError, zipfile.BadZipFile, ET.ParseError):
        # Fallback to standard library zip + XML parser
        paragraphs = _extract_docx_paragraphs_zip(raw_bytes)

    if not paragraphs:
        raise TranscriptParseError("DOCX file contains no paragraph text")

    combined_text = "\n".join(paragraphs)
    return parse_text(combined_text)
