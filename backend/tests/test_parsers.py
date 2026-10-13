import io
import pytest
from pathlib import Path

from app.parsers import (
    Segment,
    TranscriptParseError,
    clean_text,
    parse_transcript,
    to_canonical_text,
    parse_text,
    parse_vtt,
    parse_srt,
    parse_docx,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"


class TestCleaning:
    def test_utf8_bom_stripped(self):
        bom_bytes = "\ufeffPriya: Hello team".encode("utf-8-sig")
        result = clean_text(bom_bytes)
        assert result == "Priya: Hello team"
        assert not result.startswith("\ufeff")

    def test_windows_crlf_normalized(self):
        raw = "Line 1\r\nLine 2\rLine 3\nLine 4"
        result = clean_text(raw)
        assert result == "Line 1\nLine 2\nLine 3\nLine 4"

    def test_control_characters_removed_except_newline_and_tab(self):
        # \x00 (NUL), \x07 (BEL), \x1b (ESC) should be removed, \t and \n kept
        raw = "Line 1\x00\x07 with\t tab\nLine \x1b2"
        result = clean_text(raw)
        assert result == "Line 1 with\t tab\nLine 2"

    def test_unicode_nfc_normalization(self):
        # 'e' + combining acute accent -> composed é
        decomposed = "Cafe\u0301: Meeting"
        result = clean_text(decomposed)
        assert result == "Café: Meeting"

    def test_repeated_spaces_collapsed_and_empty_lines_dropped(self):
        raw = "   Priya:    We   ship    Friday.   \n\n\n   \nRahul:  Agreed.   "
        result = clean_text(raw)
        assert result == "Priya: We ship Friday.\nRahul: Agreed."

    def test_invalid_utf8_bytes_raises_transcript_parse_error(self):
        bad_bytes = b"\xff\xfe\x00\x00\x80\x81"
        with pytest.raises(TranscriptParseError, match="File must be UTF-8 text"):
            clean_text(bad_bytes)

    def test_invalid_data_type_raises_transcript_parse_error(self):
        with pytest.raises(TranscriptParseError, match="must be bytes or string"):
            clean_text(12345)  # type: ignore


class TestTextParser:
    def test_speaker_and_text_split(self):
        raw = "Priya: We ship Friday."
        segments = parse_text(raw)
        assert len(segments) == 1
        assert segments[0].speaker_name == "Priya"
        assert segments[0].text == "We ship Friday."
        assert segments[0].start_ms is None
        assert segments[0].end_ms is None

    def test_line_without_speaker(self):
        raw = "This is a general announcement without a speaker."
        segments = parse_text(raw)
        assert len(segments) == 1
        assert segments[0].speaker_name is None
        assert segments[0].text == "This is a general announcement without a speaker."

    def test_colon_in_text_not_treated_as_speaker(self):
        # 'Meeting at 10:30' should NOT treat 'Meeting at 10' as a speaker
        raw = "Meeting at 10:30 will discuss the release plan."
        segments = parse_text(raw)
        assert len(segments) == 1
        assert segments[0].speaker_name is None
        assert segments[0].text == "Meeting at 10:30 will discuss the release plan."

    def test_colon_with_digits_not_treated_as_speaker(self):
        raw = "Review at 10: 30 tomorrow."
        segments = parse_text(raw)
        assert len(segments) == 1
        assert segments[0].speaker_name is None

    def test_speaker_label_length_limit(self):
        # A speaker label exceeding 40 characters should not be parsed as speaker
        long_speaker = "A" * 45
        raw = f"{long_speaker}: Some message."
        segments = parse_text(raw)
        assert len(segments) == 1
        assert segments[0].speaker_name is None

    def test_timestamps_square_and_round_brackets(self):
        raw = (
            "[00:01:00] Alice: Welcome everyone.\n"
            "(01:30) Bob: Status update.\n"
            "[00:02:15.500] Charlie: Done."
        )
        segments = parse_text(raw)
        assert len(segments) == 3

        # [00:01:00] -> 60,000 ms
        assert segments[0].speaker_name == "Alice"
        assert segments[0].start_ms == 60000
        assert segments[0].end_ms == 90000
        assert segments[0].text == "Welcome everyone."

        # (01:30) -> 90,000 ms
        assert segments[1].speaker_name == "Bob"
        assert segments[1].start_ms == 90000
        assert segments[1].end_ms == 135500
        assert segments[1].text == "Status update."

        # [00:02:15.500] -> 135,500 ms (last segment: end_ms equals start_ms)
        assert segments[2].speaker_name == "Charlie"
        assert segments[2].start_ms == 135500
        assert segments[2].end_ms == 135500
        assert segments[2].text == "Done."

    def test_sample_meeting_appendix_a_fixture(self):
        path = FIXTURES_DIR / "sample_meeting.txt"
        content = path.read_text(encoding="utf-8")
        segments = parse_text(content)
        assert len(segments) == 10
        assert segments[0].speaker_name == "Priya"
        assert segments[0].text == "Okay, let's start. The client demo is next Thursday."
        assert segments[1].speaker_name == "Rahul"
        assert segments[1].text == "I will fix the login bug on Safari by Wednesday."
        assert segments[2].speaker_name == "Priya"
        assert segments[3].speaker_name == "Aman"
        assert segments[4].speaker_name == "Rahul"
        assert segments[5].speaker_name == "Priya"
        assert segments[6].speaker_name == "Aman"
        assert segments[7].speaker_name == "Rahul"
        assert segments[8].speaker_name == "Rahul"
        assert segments[9].speaker_name == "Priya"

    def test_empty_text_raises_parse_error(self):
        with pytest.raises(TranscriptParseError, match="no usable text"):
            parse_text("   \n\n\t  ")


class TestVttParser:
    def test_parse_vtt_fixture(self):
        path = FIXTURES_DIR / "sample.vtt"
        content = path.read_text(encoding="utf-8")
        segments = parse_vtt(content)
        assert len(segments) == 3

        # Cue 1: <v Priya Nair>
        assert segments[0].speaker_name == "Priya Nair"
        assert segments[0].start_ms == 10500
        assert segments[0].end_ms == 15000
        assert segments[0].text == "Good morning team, let's review the sprint deliverables."

        # Cue 2: <v Rahul Mehta>
        assert segments[1].speaker_name == "Rahul Mehta"
        assert segments[1].start_ms == 16000
        assert segments[1].end_ms == 22500
        assert segments[1].text == "The frontend dashboard is ready and merged."

        # Cue 3: Aman Shah: ...
        assert segments[2].speaker_name == "Aman Shah"
        assert segments[2].start_ms == 23000
        assert segments[2].end_ms == 28000
        assert segments[2].text == "I will complete the API integration by Thursday."

    def test_missing_webvtt_header_raises_error(self):
        raw = "00:00:01.000 --> 00:00:04.000\nHello"
        with pytest.raises(TranscriptParseError, match="Missing WEBVTT header"):
            parse_vtt(raw)

    def test_vtt_with_cue_tags_and_multi_line_text(self):
        raw = (
            "WEBVTT\n\n"
            "00:01:00.000 --> 00:01:05.000\n"
            "<v.loud Aman>First line of cue.\n"
            "<b>Second line with bold.</b>"
        )
        segments = parse_vtt(raw)
        assert len(segments) == 1
        assert segments[0].speaker_name == "Aman"
        assert segments[0].start_ms == 60000
        assert segments[0].end_ms == 65000
        assert segments[0].text == "First line of cue. Second line with bold."


class TestSrtParser:
    def test_parse_srt_fixture(self):
        path = FIXTURES_DIR / "sample.srt"
        content = path.read_text(encoding="utf-8")
        segments = parse_srt(content)
        assert len(segments) == 3

        assert segments[0].speaker_name == "Priya"
        assert segments[0].start_ms == 5250
        assert segments[0].end_ms == 10500
        assert segments[0].text == "The client demo is scheduled for tomorrow."

        assert segments[1].speaker_name == "Rahul"
        assert segments[1].start_ms == 11000
        assert segments[1].end_ms == 16000
        assert segments[1].text == "I will prepare the presentation slides by tonight."

        assert segments[2].speaker_name == "Aman"
        assert segments[2].start_ms == 17000
        assert segments[2].end_ms == 21500
        assert segments[2].text == "I'll test the demo environment."

    def test_srt_without_speaker_and_with_tags(self):
        raw = (
            "1\n"
            "00:00:01,000 --> 00:00:03,500\n"
            "<i>No speaker here, just italics.</i>\n\n"
            "2\n"
            "00:00:04,000 --> 00:00:06,000\n"
            "Plain announcement."
        )
        segments = parse_srt(raw)
        assert len(segments) == 2
        assert segments[0].speaker_name is None
        assert segments[0].text == "No speaker here, just italics."
        assert segments[1].speaker_name is None
        assert segments[1].text == "Plain announcement."

    def test_empty_srt_raises_error(self):
        with pytest.raises(TranscriptParseError, match="No valid subtitle blocks"):
            parse_srt("1\nSome random text without timing")


class TestDocxParser:
    def test_parse_docx_fixture(self):
        path = FIXTURES_DIR / "sample.docx"
        raw_bytes = path.read_bytes()
        segments = parse_docx(raw_bytes)
        assert len(segments) == 3
        assert segments[0].speaker_name == "Priya"
        assert segments[0].text == "Kickoff meeting notes."
        assert segments[1].speaker_name == "Rahul"
        assert segments[1].text == "I will finalize the backend parsers today."
        assert segments[2].speaker_name == "Aman"
        assert segments[2].text == "Sounds good, I will review the PR."

    def test_parse_docx_bytesio_input(self):
        path = FIXTURES_DIR / "sample.docx"
        raw_bytes = path.read_bytes()
        segments = parse_docx(io.BytesIO(raw_bytes))
        assert len(segments) == 3

    def test_parse_docx_invalid_type(self):
        with pytest.raises(TranscriptParseError, match="must be bytes or BytesIO"):
            parse_docx(12345)  # type: ignore

    def test_parse_docx_missing_document_xml(self):
        buf = io.BytesIO()
        import zipfile
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("other.xml", "content")
        with pytest.raises(TranscriptParseError, match="missing word/document.xml"):
            parse_docx(buf.getvalue())

    def test_parse_docx_empty_paragraphs(self):
        buf = io.BytesIO()
        import zipfile
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr(
                "word/document.xml",
                "<w:document xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'><w:body></w:body></w:document>"
            )
        with pytest.raises(TranscriptParseError, match="contains no paragraph text"):
            parse_docx(buf.getvalue())

    def test_parse_docx_with_python_docx_mock(self, monkeypatch):
        import sys
        class MockParagraph:
            def __init__(self, text):
                self.text = text

        class MockDocument:
            def __init__(self, stream):
                self.paragraphs = [
                    MockParagraph("Aman: Test from mock python-docx."),
                    MockParagraph("Priya: Verified.")
                ]

        class MockDocxModule:
            Document = MockDocument

        monkeypatch.setitem(sys.modules, "docx", MockDocxModule)
        segments = parse_docx(b"dummy_bytes")
        assert len(segments) == 2
        assert segments[0].speaker_name == "Aman"

    def test_corrupt_docx_raises_error(self):
        with pytest.raises(TranscriptParseError):
            parse_docx(b"not a valid zip file")


class TestDispatcherAndCanonicalText:
    def test_dispatcher_pasted_text_when_filename_is_none(self):
        segments = parse_transcript(None, "Priya: Ready.")
        assert len(segments) == 1
        assert segments[0].speaker_name == "Priya"

    def test_dispatcher_pasted_text_when_filename_empty(self):
        segments = parse_transcript("", "Aman: Done.")
        assert len(segments) == 1
        assert segments[0].speaker_name == "Aman"

    def test_dispatcher_case_insensitive_extensions(self):
        raw = "Rahul: Agreed."
        for fn in ["test.txt", "TEST.TXT"]:
            segs = parse_transcript(fn, raw)
            assert segs[0].speaker_name == "Rahul"

        vtt_path = FIXTURES_DIR / "sample.vtt"
        vtt_data = vtt_path.read_bytes()
        assert len(parse_transcript("notes.VTT", vtt_data)) == 3

        srt_path = FIXTURES_DIR / "sample.srt"
        srt_data = srt_path.read_bytes()
        assert len(parse_transcript("notes.SRT", srt_data)) == 3

        docx_path = FIXTURES_DIR / "sample.docx"
        docx_data = docx_path.read_bytes()
        assert len(parse_transcript("notes.DOCX", docx_data)) == 3

    def test_dispatcher_unsupported_extension_raises_error(self):
        with pytest.raises(TranscriptParseError, match=r"Unsupported file format '\.pdf'"):
            parse_transcript("meeting.pdf", b"pdf binary content")

    def test_to_canonical_text(self):
        segments = [
            Segment(speaker_name="Priya", start_ms=0, end_ms=1000, text="First statement."),
            Segment(speaker_name=None, start_ms=1000, end_ms=2000, text="System notification."),
            Segment(speaker_name="Aman", start_ms=2000, end_ms=3000, text="Third statement."),
        ]
        canonical = to_canonical_text(segments)
        expected = (
            "Priya: First statement.\n"
            "System notification.\n"
            "Aman: Third statement."
        )
        assert canonical == expected
