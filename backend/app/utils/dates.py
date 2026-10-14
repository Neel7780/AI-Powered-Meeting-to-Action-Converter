from __future__ import annotations

from datetime import datetime, time as dtime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def is_valid_timezone(tz: str) -> bool:
    """
    Validates whether the provided timezone name is recognized by zoneinfo.
    Returns True for valid timezones, False otherwise.
    Never raises an exception.
    """
    if not isinstance(tz, str) or not tz.strip():
        return False
    try:
        ZoneInfo(tz.strip())
        return True
    except (ZoneInfoNotFoundError, ValueError, TypeError):
        return False


def to_utc(date: str | None, time: str | None, tz: str) -> datetime | None:
    """
    Converts a local meeting date and optional time in a given timezone to UTC datetime.
    - If date only is provided (time is None or empty), assumes end-of-day: 23:59:59 local time.
    - If time is provided, parses 'HH:MM' or 'HH:MM:SS'.
    - Bad date, time, or timezone returns None.
    - Never raises an exception.

    Example:
    >>> to_utc("2026-10-02", None, "Asia/Kolkata")
    datetime.datetime(2026, 10, 2, 18, 29, 59, tzinfo=datetime.timezone.utc)
    >>> to_utc("2026-10-02", "14:30", "Asia/Kolkata")
    datetime.datetime(2026, 10, 2, 9, 0, tzinfo=datetime.timezone.utc)
    """
    if not date or not isinstance(date, str) or not tz or not isinstance(tz, str):
        return None

    if not is_valid_timezone(tz):
        return None

    # Parse date (format YYYY-MM-DD)
    try:
        parsed_date = datetime.strptime(date.strip(), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None

    # Parse time
    parsed_time: dtime
    if time is None or not str(time).strip():
        parsed_time = dtime(hour=23, minute=59, second=59)
    else:
        time_str = str(time).strip()
        parsed_time_val = None
        for fmt in ("%H:%M", "%H:%M:%S"):
            try:
                parsed_time_val = datetime.strptime(time_str, fmt).time()
                break
            except ValueError:
                continue
        if parsed_time_val is None:
            return None
        parsed_time = parsed_time_val

    try:
        zone = ZoneInfo(tz.strip())
        local_dt = datetime.combine(parsed_date, parsed_time, tzinfo=zone)
        return local_dt.astimezone(timezone.utc)
    except (ZoneInfoNotFoundError, ValueError, TypeError, OverflowError):
        return None
