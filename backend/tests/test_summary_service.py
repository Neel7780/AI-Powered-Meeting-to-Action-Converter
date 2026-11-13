"""Unit tests for Dynamic Summary and Topic-Based Chapter Generator (Sprint 2).

Tests:
1. calculate_real_speaker_insights: verifies accurate duration, talk percentages, and contributions.
2. generate_meeting_summary: verifies grounded discussion points, decisions, outcomes, next steps, and empty transcript behavior.
3. generate_meeting_chapters: verifies chronological chapters, segment chunking, and action item timestamp anchoring.
"""

from uuid import uuid4
from unittest.mock import patch

from app.schemas.meetings import (
    MeetingChaptersResponse,
    MeetingSummaryResponse,
    SpeakerInsightItem,
)
from app.services.llm.summary_service import (
    calculate_real_speaker_insights,
    generate_meeting_chapters,
    generate_meeting_summary,
)


def test_calculate_real_speaker_insights():
    segments = [
        {"speaker_name": "Asha", "start_ms": 0, "end_ms": 60000, "text": "Hello team, let's begin the review."},
        {"speaker_name": "Karthik", "start_ms": 60000, "end_ms": 120000, "text": "I will share the design updates now."},
        {"speaker_name": "Asha", "start_ms": 120000, "end_ms": 180000, "text": "Looks great, let's capture the action items."},
    ]
    extracted_items = [
        {"id": "ai-1", "task": "Ship dark theme", "type": "action", "owner_name": "Karthik"},
    ]

    insights = calculate_real_speaker_insights(segments, extracted_items)

    assert len(insights) == 2
    # Asha spoke for 120s (66.7%), Karthik spoke for 60s (33.3%)
    asha_insight = next(i for i in insights if i.speaker == "Asha")
    karthik_insight = next(i for i in insights if i.speaker == "Karthik")

    assert asha_insight.talk_percentage == 66.7
    assert asha_insight.duration_min == 2.0
    assert karthik_insight.talk_percentage == 33.3
    assert karthik_insight.duration_min == 1.0
    assert "Ship dark theme" in karthik_insight.key_contribution


def test_generate_meeting_summary_empty_transcript():
    meeting = {"id": str(uuid4()), "title": "Empty Sync", "starts_at": "2026-10-23T10:00:00Z"}
    res = generate_meeting_summary(meeting, transcript_record=None, segments=[], extracted_items=[])

    assert isinstance(res, MeetingSummaryResponse)
    assert res.overview == "No transcript has been submitted yet for 'Empty Sync'."
    assert res.key_discussion_points == []
    assert res.decisions == []
    assert res.outcomes == []
    assert res.next_steps == []
    assert res.speaker_insights == []
    assert res.model_used == "none"


def test_generate_meeting_summary_grounded_fallback():
    meeting_id = uuid4()
    meeting = {
        "id": str(meeting_id),
        "title": "Design Sprint Review",
        "starts_at": "2026-10-23T10:00:00Z",
        "ai_processing": False,  # deterministic fallback
    }
    transcript_record = {"canonical_text": "Karthik: Welcome.\nAsha: Here are the items."}
    segments = [
        {"speaker_name": "Karthik", "text": "Welcome to our design review session.", "start_ms": 0, "end_ms": 300000},
        {"speaker_name": "Asha", "text": "We decided to implement the dedicated Action Items tab.", "start_ms": 300000, "end_ms": 600000},
        {"speaker_name": "Vikram", "text": "Latency is optimized to sub-second.", "start_ms": 600000, "end_ms": 900000},
    ]
    extracted_items = [
        {
            "id": "dec-1",
            "task": "Adopt dedicated Action Items tab",
            "type": "decision",
            "source_excerpt": "We decided to implement the dedicated Action Items tab.",
            "source_start_ms": 310000,
            "owner_name": "Asha",
        },
        {
            "id": "ai-1",
            "task": "Refactor navigation",
            "type": "action",
            "source_excerpt": "Refactor navigation",
            "source_start_ms": 400000,
            "owner_name": "Karthik",
        },
    ]

    res = generate_meeting_summary(meeting, transcript_record, segments, extracted_items)

    assert isinstance(res, MeetingSummaryResponse)
    assert res.meeting_id == meeting_id
    assert "Design Sprint Review" in res.overview
    assert len(res.decisions) == 1
    assert res.decisions[0].id == "dec-1"
    assert res.decisions[0].speaker == "Asha"
    assert len(res.key_discussion_points) > 0
    assert len(res.speaker_insights) == 3
    assert len(res.next_steps) == 1
    assert "Karthik: Refactor navigation" in res.next_steps[0]
    assert res.model_used == "deterministic-grounded"


def test_generate_meeting_chapters_empty_transcript():
    meeting = {"id": str(uuid4()), "title": "Empty Sync"}
    res = generate_meeting_chapters(meeting, transcript_record=None, segments=[], extracted_items=[])

    assert isinstance(res, MeetingChaptersResponse)
    assert res.chapter_count == 0
    assert res.chapters == []


def test_generate_meeting_chapters_grounded_with_action_items():
    meeting_id = uuid4()
    meeting = {
        "id": str(meeting_id),
        "title": "Design Sprint Review",
        "starts_at": "2026-10-23T10:00:00Z",
        "ai_processing": False,
    }
    transcript_record = {"canonical_text": "Karthik: Intro.\nAsha: Design.\nVikram: Performance."}
    segments = [
        {"speaker_name": "Karthik", "text": "Intro and sprint goals overview.", "start_ms": 0, "end_ms": 300000},
        {"speaker_name": "Asha", "text": "Discussion on navigation and action items.", "start_ms": 312000, "end_ms": 750000},
        {"speaker_name": "Vikram", "text": "Performance benchmarks and API review.", "start_ms": 760000, "end_ms": 1200000},
    ]
    extracted_items = [
        {
            "id": "ai-1",
            "task": "Update theme",
            "type": "action",
            "source_start_ms": 350000,  # 5m50s -> inside chapter 1 / segment 2
            "owner_name": "Asha",
        },
        {
            "id": "dec-1",
            "task": "Approve teal palette",
            "type": "decision",
            "source_start_ms": 400000,
            "owner_name": "Karthik",
        },
    ]

    res = generate_meeting_chapters(meeting, transcript_record, segments, extracted_items)

    assert isinstance(res, MeetingChaptersResponse)
    assert res.chapter_count > 0
    assert len(res.chapters) == res.chapter_count
    assert res.chapters[0].timestamp == "00:00"

    # Verify action item is properly anchored to chapter
    all_action_ids = [aid for ch in res.chapters for aid in ch.action_item_ids]
    assert "ai-1" in all_action_ids
    assert res.chapters[0].end_seconds > res.chapters[0].start_seconds
    assert res.chapters[0].end_timestamp != ""
    assert res.chapters[0].description != ""


def test_generate_meeting_summary_and_chapters_with_llm_mock():
    from app.services.llm.summary_service import LLMChapter, LLMDiscussionPoint, LLMSummaryAndChapters

    meeting_id = uuid4()
    meeting = {
        "id": str(meeting_id),
        "title": "LLM Sprint Sync",
        "starts_at": "2026-10-23T10:00:00Z",
        "ai_processing": True,
    }
    transcript_record = {"canonical_text": "Krishna: Reviewing summary.\nNeel: Chapters working."}
    segments = [
        {"speaker_name": "Krishna", "text": "Reviewing summary architecture.", "start_ms": 0, "end_ms": 120000},
        {"speaker_name": "Neel", "text": "Chapters working with timestamps.", "start_ms": 120000, "end_ms": 240000},
    ]
    extracted_items = [
        {"id": "ai-1", "task": "Ship Sprint 2", "type": "action", "source_start_ms": 150000, "owner_name": "Neel"},
    ]

    mock_llm_payload = LLMSummaryAndChapters(
        overview="Team aligned on Sprint 2 deliverables including summaries and chapters.",
        key_discussion_points=[
            LLMDiscussionPoint(
                topic="Sprint 2 Scope",
                points=["Implement Summary", "Implement Chapters", "Fix Timestamps"],
                timestamp="00:00",
                speakers=["Krishna", "Neel"],
            )
        ],
        outcomes=["Sprint 2 core deliverables accepted"],
        next_steps=["Neel: ship Sprint 2"],
        takeaways=["Summary and chapters persisted", "Timestamps aligned"],
        chapters=[
            LLMChapter(
                title="Introduction & Overview",
                summary="Reviewing Sprint 2 architecture.",
                key_points=["Reviewing summary architecture."],
                start_seconds=0,
                duration_seconds=120,
                end_seconds=120,
                speakers=["Krishna"],
            ),
            LLMChapter(
                title="Implementation & Verification",
                summary="Chapters working with timestamps.",
                key_points=["Chapters working with timestamps."],
                start_seconds=120,
                duration_seconds=120,
                end_seconds=240,
                speakers=["Neel"],
            ),
        ],
    )

    with patch("app.services.llm.summary_service._try_llm_summary_and_chapters", return_value=mock_llm_payload):
        summary_res = generate_meeting_summary(meeting, transcript_record, segments, extracted_items)
        assert summary_res.overview == "Team aligned on Sprint 2 deliverables including summaries and chapters."
        assert "Summary and chapters persisted" in summary_res.takeaways
        assert len(summary_res.key_discussion_points) == 1

        chapters_res = generate_meeting_chapters(meeting, transcript_record, segments, extracted_items)
        assert chapters_res.chapter_count == 2
        assert chapters_res.chapters[0].title == "Introduction & Overview"
        assert chapters_res.chapters[0].start_seconds == 0
        assert chapters_res.chapters[0].end_seconds == 120
        assert chapters_res.chapters[0].end_timestamp == "02:00"
        assert chapters_res.chapters[1].start_seconds == 120
        assert chapters_res.chapters[1].end_seconds == 240
        assert chapters_res.chapters[1].end_timestamp == "04:00"
        assert "ai-1" in chapters_res.chapters[1].action_item_ids

