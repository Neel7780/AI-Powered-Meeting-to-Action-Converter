"""Text cleaning and normalization for transcript ingestion (BE-5)."""

import re
import unicodedata


class TranscriptParseError(ValueError):
    """User-visible error when transcript parsing fails."""


def clean_transcript_data(data: bytes | str) -> str:
    """Decode raw bytes or text, strip BOM, normalize Unicode and line endings,
    strip non-printable control characters, and collapse excessive spacing.
    """
    if isinstance(data, bytes):
        try:
            # Strip UTF-8 BOM if present
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError as err:
            raise TranscriptParseError("File must be UTF-8 text") from err
    else:
        text = str(data)

    # Convert Windows / old Mac line endings to standard \n
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Unicode NFC normalization
    text = unicodedata.normalize("NFC", text)

    # Remove non-printable control characters, preserving \n and \t
    # Control categories in Unicode are Cc and Cf (excluding \t: 0x09 and \n: 0x0a)
    cleaned_chars = []
    for ch in text:
        if ch in ("\n", "\t"):
            cleaned_chars.append(ch)
        elif unicodedata.category(ch) in ("Cc", "Cf"):
            continue
        else:
            cleaned_chars.append(ch)
    text = "".join(cleaned_chars)

    # Collapse repeated horizontal whitespace (spaces/tabs on the same line)
    text = re.sub(r"[^\S\n]+", " ", text)

    return text
