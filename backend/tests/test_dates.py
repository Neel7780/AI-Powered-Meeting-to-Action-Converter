from datetime import datetime, timezone

from app.utils.dates import is_valid_timezone, to_utc


class TestTimezoneValidation:
    def test_valid_timezones(self):
        assert is_valid_timezone("Asia/Kolkata") is True
        assert is_valid_timezone("UTC") is True
        assert is_valid_timezone("America/New_York") is True
        assert is_valid_timezone("Europe/London") is True
        assert is_valid_timezone("Asia/Tokyo") is True

    def test_invalid_timezones(self):
        assert is_valid_timezone("Invalid/Timezone") is False
        assert is_valid_timezone("Moon/Base") is False
        assert is_valid_timezone("") is False
        assert is_valid_timezone("   ") is False
        assert is_valid_timezone(None) is False  # type: ignore
        assert is_valid_timezone(12345) is False  # type: ignore


class TestToUtc:
    def test_date_only_defaults_to_end_of_day_ist(self):
        # 23:59:59 IST (+05:30) is 18:29:59 UTC
        result = to_utc("2026-10-02", None, "Asia/Kolkata")
        assert result is not None
        assert result == datetime(2026, 10, 2, 18, 29, 59, tzinfo=timezone.utc)

    def test_date_with_empty_time_string_defaults_to_end_of_day(self):
        result = to_utc("2026-10-02", "  ", "Asia/Kolkata")
        assert result is not None
        assert result == datetime(2026, 10, 2, 18, 29, 59, tzinfo=timezone.utc)

    def test_date_and_time_ist(self):
        # 14:30 IST (+05:30) is 09:00:00 UTC
        result = to_utc("2026-10-02", "14:30", "Asia/Kolkata")
        assert result is not None
        assert result == datetime(2026, 10, 2, 9, 0, 0, tzinfo=timezone.utc)

    def test_date_and_time_with_seconds_ist(self):
        result = to_utc("2026-10-02", "14:30:45", "Asia/Kolkata")
        assert result is not None
        assert result == datetime(2026, 10, 2, 9, 0, 45, tzinfo=timezone.utc)

    def test_utc_timezone_conversion(self):
        result = to_utc("2026-10-02", "12:00", "UTC")
        assert result is not None
        assert result == datetime(2026, 10, 2, 12, 0, 0, tzinfo=timezone.utc)

    def test_dst_summer_edt(self):
        # In July, New York is in EDT (UTC-4). 12:00 EDT -> 16:00 UTC
        result = to_utc("2026-07-01", "12:00", "America/New_York")
        assert result is not None
        assert result == datetime(2026, 7, 1, 16, 0, 0, tzinfo=timezone.utc)

    def test_dst_winter_est(self):
        # In January, New York is in EST (UTC-5). 12:00 EST -> 17:00 UTC
        result = to_utc("2026-01-15", "12:00", "America/New_York")
        assert result is not None
        assert result == datetime(2026, 1, 15, 17, 0, 0, tzinfo=timezone.utc)

    def test_invalid_date_returns_none_never_raises(self):
        assert to_utc("not-a-date", "12:00", "Asia/Kolkata") is None
        assert to_utc("2026-02-31", "12:00", "Asia/Kolkata") is None
        assert to_utc("", "12:00", "Asia/Kolkata") is None
        assert to_utc(None, "12:00", "Asia/Kolkata") is None
        assert to_utc(12345, "12:00", "Asia/Kolkata") is None  # type: ignore

    def test_invalid_time_returns_none_never_raises(self):
        assert to_utc("2026-10-02", "25:00", "Asia/Kolkata") is None
        assert to_utc("2026-10-02", "12:60", "Asia/Kolkata") is None
        assert to_utc("2026-10-02", "invalid-time", "Asia/Kolkata") is None

    def test_invalid_timezone_returns_none_never_raises(self):
        assert to_utc("2026-10-02", "12:00", "Invalid/Timezone") is None
        assert to_utc("2026-10-02", "12:00", "") is None
        assert to_utc("2026-10-02", "12:00", None) is None  # type: ignore

    def test_to_utc_zoneinfo_exception(self, monkeypatch):
        import app.utils.dates as dates_mod
        from zoneinfo import ZoneInfoNotFoundError
        def mock_zoneinfo(*args, **kwargs):
            raise ZoneInfoNotFoundError("Simulated error")
        monkeypatch.setattr(dates_mod, "ZoneInfo", mock_zoneinfo)
        assert to_utc("2026-10-02", "12:00", "UTC") is None
