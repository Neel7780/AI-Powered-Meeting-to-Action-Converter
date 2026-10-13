from __future__ import annotations

import re
import unicodedata


class TranscriptParseError(ValueError):
    """Raised when transcript content or file cannot be parsed."""
    pass


def clean_text(data: bytes | str) -> str:
    """
    Cleans transcript raw text:
    - Decodes bytes as UTF-8 with BOM stripping.
    - Normalizes line endings (\\r\\n and \\r to \\n).
    - Removes control characters (except \\n and \\t).
    - Applies Unicode NFC normalization.
    - Collapses repeated spaces per line (preserving tabs).
    - Drops empty/whitespace-only lines.
    """
    if isinstance(data, bytes):
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise TranscriptParseError("File must be UTF-8 text") from exc
    elif isinstance(data, str):
        text = data.lstrip("\ufeff")
    else:
        raise TranscriptParseError("Transcript data must be bytes or string")

    # Unicode NFC normalization
    text = unicodedata.normalize("NFC", text)

    # Convert line endings to \n
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Remove control characters except \n and \t
    cleaned_chars = [
        ch for ch in text
        if ch in ("\n", "\t") or not unicodedata.category(ch).startswith("C")
    ]
    text = "".join(cleaned_chars)

    # Process line by line: collapse repeated spaces (not tabs) and drop empty lines
    cleaned_lines = []
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped:
            # Collapse repeated spaces while preserving tabs
            collapsed = re.sub(r" {2,}", " ", stripped)
            cleaned_lines.append(collapsed)

    return "\n".join(cleaned_lines)
