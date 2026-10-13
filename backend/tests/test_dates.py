"""Unit tests for date and timezone utilities (BE-5 & Core)."""

from datetime import UTC, datetime

from app.utils.dates import is_valid_timezone, to_utc


def test_is_valid_timezone():
    assert is_valid_timezone("Asia/Kolkata") is True
    assert is_valid_timezone("America/New_York") is True
    assert is_valid_timezone("UTC") is True
    assert is_valid_timezone("Europe/London") is True
    assert is_valid_timezone("Invalid/Fake_Zone") is False
    assert is_valid_timezone("") is False
    assert is_valid_timezone(None) is False


def test_to_utc_date_only_defaults_to_end_of_day():
    # 2026-10-02 in Asia/Kolkata (+05:30) at 23:59:59 local is 18:29:59 UTC
    res = to_utc("2026-10-02", None, "Asia/Kolkata")
    assert res is not None
    assert res == datetime(2026, 10, 2, 18, 29, 59, tzinfo=UTC)


def test_to_utc_with_time():
    # 2026-10-02 14:30 in Asia/Kolkata (+05:30) is 09:00:00 UTC
    res = to_utc("2026-10-02", "14:30", "Asia/Kolkata")
    assert res is not None
    assert res == datetime(2026, 10, 2, 9, 0, 0, tzinfo=UTC)


def test_to_utc_with_seconds():
    res = to_utc("2026-10-02", "14:30:15", "Asia/Kolkata")
    assert res is not None
    assert res == datetime(2026, 10, 2, 9, 0, 15, tzinfo=UTC)


def test_to_utc_invalid_inputs_never_raise():
    assert to_utc(None, None, "Asia/Kolkata") is None
    assert to_utc("", None, "Asia/Kolkata") is None
    assert to_utc("invalid-date", None, "Asia/Kolkata") is None
    assert to_utc("2026-10-02", "invalid-time", "Asia/Kolkata") is None
    assert to_utc("2026-10-02", "25:00", "Asia/Kolkata") is None
    assert to_utc("2026-10-02", None, "Invalid/Timezone") is None
