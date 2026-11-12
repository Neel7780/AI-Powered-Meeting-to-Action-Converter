"""Unit tests for caption toolbar filtering and non-destructive deduplication."""

from app.services.caption_cleaner import (
    deduplicate_caption_segments,
    is_caption_ui_noise,
    prepare_transcript_for_llm,
)


def test_drops_meet_caption_settings_toolbar_noise():
    assert is_caption_ui_noise(
        "language",
        "English format_size Font size circle Font color settings Open caption settings",
    ) is True
    assert is_caption_ui_noise("Madhav", "I will fix the webhook headers by Friday.") is False

    cleaned = deduplicate_caption_segments([
        {
            "speaker": "language",
            "text": "English format_size Font size circle Font color settings Open caption settings",
            "start_ms": 0,
            "end_ms": 5000,
        },
        {
            "speaker": "Madhav",
            "text": "I will fix the webhook headers by Friday.",
            "start_ms": 5000,
            "end_ms": 10000,
        },
    ])
    assert len(cleaned) == 1
    assert cleaned[0]["speaker"] == "Madhav"
    assert cleaned[0]["text"] == "I will fix the webhook headers by Friday."


def test_merges_progressive_stt_revision_like_thank_to_thank_you():
    seg_a = (
        "Hello, hello. My audible. Let's quickly align on the release checklist. "
        "I will fix the supervised webhook course headers by this Friday. "
        "Also, we need to test the Chrome extension review flow before Monday morning. "
        "Let's keep the staging development blog until the webhook test pass. Okay, thank."
    )
    seg_b = (
        "Hello, hello. My audible. Let's quickly align on the release checklist. "
        "I will fix the supervised webhook course headers by this Friday. "
        "Also, we need to test the Chrome extension review flow before Monday morning. "
        "Let's keep the staging development blog until the webhook test pass. Okay, thank you."
    )
    cleaned = deduplicate_caption_segments([
        {"speaker": "Madhav", "text": seg_a, "start_ms": 10000, "end_ms": 14000},
        {"speaker": "Madhav", "text": seg_b, "start_ms": 15000, "end_ms": 19000},
    ])
    assert len(cleaned) == 1
    assert cleaned[0]["text"].endswith("Okay, thank you.")
    assert cleaned[0]["end_ms"] == 19000


def test_preserves_same_speaker_distinct_topics_above_and_below():
    cleaned = deduplicate_caption_segments([
        {
            "speaker": "Madhav",
            "text": "First, I will fix the supervised webhook course headers by this Friday.",
            "start_ms": 5000,
            "end_ms": 12000,
        },
        {
            "speaker": "Madhav",
            "text": "Second, Priya needs to rotate the staging GitHub OAuth secret before Tuesday.",
            "start_ms": 40000,
            "end_ms": 48000,
        },
    ])
    assert len(cleaned) == 2
    assert "webhook course headers" in cleaned[0]["text"]
    assert "OAuth secret" in cleaned[1]["text"]


def test_trims_rolling_caption_overlap_without_dropping_new_topic():
    cleaned = deduplicate_caption_segments([
        {
            "speaker": "Madhav",
            "text": "Let's keep the staging development build until the webhook tests pass cleanly.",
            "start_ms": 10000,
            "end_ms": 16000,
        },
        {
            "speaker": "Madhav",
            "text": "until the webhook tests pass cleanly. Also deploy the worker service on Monday morning.",
            "start_ms": 17000,
            "end_ms": 23000,
        },
    ])
    assert len(cleaned) == 2
    assert cleaned[0]["text"] == "Let's keep the staging development build until the webhook tests pass cleanly."
    assert cleaned[1]["text"] == "Also deploy the worker service on Monday morning."


def test_prepare_transcript_for_llm_strips_standalone_greetings_but_keeps_mixed_lines():
    raw = "\n".join([
        "language: English format_size Font size circle Font color settings Open caption settings",
        "Madhav: Hello, hello.",
        "Madhav: Am I audible?",
        "Madhav: Hello, hello. I will fix the webhook headers by this Friday.",
        "Madhav: Okay, thank you.",
    ])
    prepared = prepare_transcript_for_llm(raw)
    assert "format_size" not in prepared
    assert "Am I audible" not in prepared
    assert prepared == "Madhav: Hello, hello. I will fix the webhook headers by this Friday."

