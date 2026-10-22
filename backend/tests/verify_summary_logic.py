"""Verification script for pure algorithmic logic of Sprint 2 Meeting Summary & Chapters.

Runs with pure Python standard library to execute tests directly in environments
where third-party frameworks (pydantic/fastapi) are not installed in the system Python path.
"""

import sys


def _format_timestamp(seconds: int) -> str:
    mins = seconds // 60
    secs = seconds % 60
    return f"{mins:02d}:{secs:02d}"


def _format_duration_str(seconds: int) -> str:
    mins = seconds // 60
    secs = seconds % 60
    return f"{mins:02d}:{secs:02d}"


def calculate_real_speaker_insights_logic(segments: list[dict], extracted_items: list[dict]) -> list[dict]:
    if not segments:
        return []

    speaker_durations = {}
    speaker_word_counts = {}
    speaker_topics = {}

    for seg in segments:
        spk = (seg.get("speaker_name") or "Unknown").strip() or "Unknown"
        start_ms = seg.get("start_ms")
        end_ms = seg.get("end_ms")
        text = seg.get("text") or ""
        word_count = len(text.split())

        if start_ms is not None and end_ms is not None and end_ms >= start_ms:
            duration_s = max(1, int((end_ms - start_ms) / 1000))
        else:
            duration_s = max(2, int(word_count * 0.46))

        speaker_durations[spk] = speaker_durations.get(spk, 0) + duration_s
        speaker_word_counts[spk] = speaker_word_counts.get(spk, 0) + word_count

        if spk not in speaker_topics and len(text) > 15:
            speaker_topics[spk] = [text[:80] + ("..." if len(text) > 80 else "")]

    total_duration_s = sum(speaker_durations.values()) or 1
    insights = []

    for spk, duration_s in speaker_durations.items():
        pct = round((duration_s / total_duration_s) * 100, 1)
        duration_m = round(duration_s / 60, 1)

        spk_items = [
            it.get("task")
            for it in extracted_items
            if (it.get("owner_name") or "").lower() == spk.lower() and it.get("task")
        ]
        if spk_items:
            contrib = f"Assigned {len(spk_items)} task(s): {spk_items[0]}"
        elif spk in speaker_topics and speaker_topics[spk]:
            contrib = f"Discussed: {speaker_topics[spk][0]}"
        else:
            contrib = f"Contributed {speaker_word_counts.get(spk, 0)} words to discussion."

        insights.append({
            "speaker": spk,
            "talk_percentage": pct,
            "duration_min": duration_m,
            "key_contribution": contrib,
        })

    insights.sort(key=lambda x: x["talk_percentage"], reverse=True)
    return insights


def match_action_items_to_chapters(chapters: list[dict], items: list[dict]) -> list[dict]:
    items_with_time = [
        (int(it["source_start_ms"] / 1000), it["id"], it.get("type", "action"))
        for it in items
        if it.get("source_start_ms") is not None
    ]
    for ch in chapters:
        start_s = ch["start_seconds"]
        end_s = start_s + ch["duration_seconds"]
        ch["action_item_ids"] = [
            it_id for (t_s, it_id, it_type) in items_with_time
            if start_s <= t_s <= end_s and it_type == "action"
        ]
        ch["action_item_count"] = len(ch["action_item_ids"])
        ch["decision_count"] = sum(
            1 for (t_s, it_id, it_type) in items_with_time
            if start_s <= t_s <= end_s and it_type == "decision"
        )
    return chapters


def run_all_tests():
    print("=======================================================")
    print("🧪 EXECUTING SPRINT 2 LOGIC & ALGORITHM TESTS")
    print("=======================================================")

    # Test 1: Empty transcript insights
    res_empty = calculate_real_speaker_insights_logic([], [])
    assert res_empty == [], "Expected empty insights for empty segments"
    print("✅ Test 1 Passed: Empty transcript returns empty speaker insights")

    # Test 2: Multi-speaker talk-time duration and percentage calculation
    segments = [
        {"speaker_name": "Asha", "start_ms": 0, "end_ms": 120000, "text": "Asha opens meeting and introduces agenda."},
        {"speaker_name": "Vikram", "start_ms": 120000, "end_ms": 180000, "text": "Vikram reviews backend performance."},
        {"speaker_name": "Karthik", "start_ms": 180000, "end_ms": 300000, "text": "Karthik presents frontend and tab redesign."},
    ]
    items = [
        {"id": "ai-1", "task": "Ship dark mode", "type": "action", "source_start_ms": 200000, "owner_name": "Karthik"},
        {"id": "dec-1", "task": "Approve teal palette", "type": "decision", "source_start_ms": 250000, "owner_name": "Karthik"},
    ]
    # Total duration = 300s. Asha = 120s (40.0%), Karthik = 120s (40.0%), Vikram = 60s (20.0%)
    insights = calculate_real_speaker_insights_logic(segments, items)
    assert len(insights) == 3, f"Expected 3 speakers, got {len(insights)}"
    total_pct = sum(i["talk_percentage"] for i in insights)
    assert 99.9 <= total_pct <= 100.1, f"Expected ~100%, got {total_pct}"
    karthik_info = next(i for i in insights if i["speaker"] == "Karthik")
    assert "Ship dark mode" in karthik_info["key_contribution"]
    print(f"✅ Test 2 Passed: Speaker talk-time math: {[(i['speaker'], str(i['talk_percentage'])+'%') for i in insights]}")

    # Test 3: Timestamp formatters
    assert _format_timestamp(0) == "00:00"
    assert _format_timestamp(312) == "05:12"
    assert _format_timestamp(2050) == "34:10"
    print("✅ Test 3 Passed: Timestamp formatting (312s -> 05:12, 2050s -> 34:10)")

    # Test 4: Chapter action item and decision temporal anchoring
    test_chapters = [
        {"id": "chap-1", "start_seconds": 0, "duration_seconds": 180},     # 0:00 - 3:00 (0 - 180s)
        {"id": "chap-2", "start_seconds": 180, "duration_seconds": 150},   # 3:00 - 5:30 (180s - 330s)
    ]
    matched = match_action_items_to_chapters(test_chapters, items)
    assert matched[0]["action_item_count"] == 0
    assert matched[0]["decision_count"] == 0
    assert matched[1]["action_item_count"] == 1
    assert "ai-1" in matched[1]["action_item_ids"]
    assert matched[1]["decision_count"] == 1
    print("✅ Test 4 Passed: Action items & decisions accurately linked to chapter 2 by timestamp")

    # Test 5: Fallback word-count duration estimation when timestamps are missing
    unsegmented = [
        {"speaker_name": "Solo", "start_ms": None, "end_ms": None, "text": "This is a sentence with ten words spoken during the sync."}
    ]
    solo_insight = calculate_real_speaker_insights_logic(unsegmented, [])
    assert len(solo_insight) == 1
    assert solo_insight[0]["talk_percentage"] == 100.0
    assert solo_insight[0]["duration_min"] > 0
    print("✅ Test 5 Passed: Fallback word count estimation for unsegmented audio")

    print("-------------------------------------------------------")
    print("🎉 ALL SPRINT 2 CORE ALGORITHMIC TESTS EXECUTED & PASSED!")
    return 0


if __name__ == "__main__":
    sys.exit(run_all_tests())
