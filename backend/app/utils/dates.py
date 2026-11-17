"""Date and timezone utility functions for ActionPulse (BE-5 & Core)."""

import re
from datetime import UTC, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def is_valid_timezone(tz: str) -> bool:
    """Check if the provided string is a valid IANA timezone name."""
    if not tz or not isinstance(tz, str):
        return False
    try:
        ZoneInfo(tz.strip())
        return True
    except (ZoneInfoNotFoundError, ValueError, KeyError):
        return False


def to_utc(date_str: str | None, time_str: str | None, tz: str) -> datetime | None:
    """Convert a local date string (YYYY-MM-DD) and optional time string (HH:MM or HH:MM:SS)
    in timezone tz to a UTC datetime.
    
    If time_str is None or empty, defaults to 23:59:59 local time (end of day).
    Returns None on bad input or invalid timezone. Never raises.
    """
    if not date_str or not isinstance(date_str, str):
        return None
    if not is_valid_timezone(tz):
        return None

    date_clean = date_str.strip()
    # Match YYYY-MM-DD
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_clean):
        return None

    hour, minute, second = 23, 59, 59
    if time_str and isinstance(time_str, str) and time_str.strip():
        t_clean = time_str.strip()
        time_match = re.match(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$", t_clean)
        if not time_match:
            return None
        h_val, m_val, s_val = time_match.groups()
        hour, minute = int(h_val), int(m_val)
        second = int(s_val) if s_val is not None else 0
        if not (0 <= hour <= 23 and 0 <= minute <= 59 and 0 <= second <= 59):
            return None

    try:
        year, month, day = map(int, date_clean.split("-"))
        zone = ZoneInfo(tz.strip())
        local_dt = datetime(year, month, day, hour, minute, second, tzinfo=zone)
        return local_dt.astimezone(UTC)
    except Exception:
        return None
