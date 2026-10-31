"""Calendar Service for ActionPulse.

Handles Google Calendar OAuth 2.0 flow, token encryption/refreshing,
and event retrieval/normalization.
"""

import base64
import hashlib
import hmac
import json
import logging
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import urlencode
from uuid import UUID

import httpx

from app.core.config import settings
from app.core.supabase import get_supabase_client
from app.schemas.calendar import CalendarAttendee, CalendarEventItem

logger = logging.getLogger(__name__)

GOOGLE_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GOOGLE_CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"

SCOPES = [
    "https://www.googleapis.com/auth/calendar.events.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
]


def _get_encryption_key() -> bytes:
    secret = (
        settings.CALENDAR_ENCRYPTION_SECRET
        or settings.SUPABASE_SERVICE_ROLE_KEY
        or "actionpulse-zero-budget-secret"
    )
    return hashlib.sha256(secret.encode("utf-8")).digest()


def encrypt_token(plain_token: str) -> str:
    """Reversibly encrypt token using a derived SHA-256 key and XOR streaming."""
    key = _get_encryption_key()
    raw = plain_token.encode("utf-8")
    encrypted = bytes([b ^ key[i % len(key)] for i, b in enumerate(raw)])
    return base64.urlsafe_b64encode(encrypted).decode("ascii")


def decrypt_token(cipher_token: str) -> str:
    """Decrypt a token previously encrypted with encrypt_token."""
    key = _get_encryption_key()
    encrypted = base64.urlsafe_b64decode(cipher_token.encode("ascii"))
    decrypted = bytes([b ^ key[i % len(key)] for i, b in enumerate(encrypted)])
    return decrypted.decode("utf-8")


def generate_oauth_state(user_id: UUID, workspace_id: UUID) -> str:
    """Generate a tamper-proof state parameter with HMAC signature."""
    payload = {
        "uid": str(user_id),
        "wid": str(workspace_id),
        "ts": int(time.time()),
    }
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    encoded_payload = base64.urlsafe_b64encode(raw).decode("ascii")
    
    key = _get_encryption_key()
    signature = hmac.new(key, encoded_payload.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{encoded_payload}.{signature}"


def verify_oauth_state(state: str, max_age_seconds: int = 900) -> tuple[UUID, UUID]:
    """Verify HMAC signature and timestamp of state parameter.
    
    Returns (user_id, workspace_id) if valid; raises ValueError if invalid.
    """
    try:
        parts = state.split(".")
        if len(parts) != 2:
            raise ValueError("Malformed state parameter")
        
        encoded_payload, signature = parts
        key = _get_encryption_key()
        expected_sig = hmac.new(key, encoded_payload.encode("ascii"), hashlib.sha256).hexdigest()
        
        if not hmac.compare_digest(signature, expected_sig):
            raise ValueError("Invalid state signature")
        
        payload_bytes = base64.urlsafe_b64decode(encoded_payload.encode("ascii"))
        payload = json.loads(payload_bytes.decode("utf-8"))
        
        if time.time() - payload.get("ts", 0) > max_age_seconds:
            raise ValueError("OAuth state expired (over 15 minutes old)")
        
        return UUID(payload["uid"]), UUID(payload["wid"])
    except Exception as e:
        logger.warning(f"Failed to verify OAuth state: {e}")
        raise ValueError(f"Invalid state parameter: {e}") from e


def get_google_auth_url(user_id: UUID, workspace_id: UUID, redirect_uri: Optional[str] = None) -> str:
    """Construct Google OAuth 2.0 authorization URL."""
    state = generate_oauth_state(user_id, workspace_id)
    r_uri = redirect_uri or settings.GOOGLE_REDIRECT_URI
    
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": r_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"{GOOGLE_AUTH_BASE_URL}?{urlencode(params)}"


async def exchange_google_code(code: str, redirect_uri: Optional[str] = None) -> dict[str, Any]:
    """Exchange authorization code with Google for tokens."""
    r_uri = redirect_uri or settings.GOOGLE_REDIRECT_URI
    data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": r_uri,
        "grant_type": "authorization_code",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data=data)
        if resp.status_code != 200:
            logger.error(f"Google token exchange failed ({resp.status_code}): {resp.text}")
            raise ValueError("Failed to exchange authorization code with Google")
        return resp.json()


async def get_google_user_email(access_token: str) -> str:
    """Fetch user's email using the Google access token."""
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(GOOGLE_USERINFO_URL, headers=headers)
        if resp.status_code != 200:
            logger.error(f"Google userinfo failed ({resp.status_code}): {resp.text}")
            raise ValueError("Failed to retrieve user profile from Google")
        data = resp.json()
        return data.get("email", "").lower()


async def refresh_google_access_token(encrypted_refresh_token: str) -> tuple[str, datetime]:
    """Use the refresh token to get a new access token."""
    refresh_token = decrypt_token(encrypted_refresh_token)
    data = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data=data)
        if resp.status_code != 200:
            logger.error(f"Google token refresh failed: {resp.text}")
            raise ValueError("Unable to refresh Google access token. Please reconnect your calendar.")
        res = resp.json()
        access_token = res["access_token"]
        expires_in = int(res.get("expires_in", 3600))
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        return access_token, expires_at


async def get_valid_access_token(conn_row: dict[str, Any]) -> str:
    """Return cached access token or refresh if missing/expired."""
    access_token = conn_row.get("access_token")
    expires_at_str = conn_row.get("token_expires_at")
    
    needs_refresh = True
    if access_token and expires_at_str:
        try:
            expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
            # If token is valid for at least another 2 minutes, keep it
            if expires_at > datetime.now(timezone.utc) + timedelta(seconds=120):
                needs_refresh = False
        except Exception:
            needs_refresh = True

    if not needs_refresh and access_token:
        return access_token

    # Perform refresh
    new_token, expires_at = await refresh_google_access_token(conn_row["encrypted_refresh_token"])
    
    # Update Supabase cached token
    client = get_supabase_client()
    client.table("calendar_connections").update({
        "access_token": new_token,
        "token_expires_at": expires_at.isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", conn_row["id"]).execute()
    
    return new_token


def _extract_conference_url(item: dict[str, Any]) -> Optional[str]:
    """Extract Google Meet or external video call link from event metadata."""
    # 1. Google Meet conference data
    conf_data = item.get("conferenceData") or {}
    entry_points = conf_data.get("entryPoints") or []
    for ep in entry_points:
        if ep.get("entryPointType") == "video" and ep.get("uri"):
            return ep.get("uri")
    
    # 2. hangoutLink
    if item.get("hangoutLink"):
        return item.get("hangoutLink")
    
    # 3. Regex search for Zoom / Teams / Meet in location or description
    text_content = f"{item.get('location', '')} {item.get('description', '')}"
    meet_match = re.search(r"https:\/\/(meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}|[a-zA-Z0-9.\-]+\.zoom\.us\/j\/\d+|teams\.microsoft\.com\/l\/meetup-join\/[^\s]+)", text_content)
    if meet_match:
        return meet_match.group(0)
    
    return None


async def fetch_calendar_events(
    conn_row: dict[str, Any],
    workspace_id: UUID,
    days_ahead: int = 14
) -> list[CalendarEventItem]:
    """Fetch upcoming events from Google Calendar and normalize them for ActionPulse."""
    access_token = await get_valid_access_token(conn_row)
    now = datetime.now(timezone.utc)
    time_min = (now - timedelta(hours=2)).isoformat()
    time_max = (now + timedelta(days=days_ahead)).isoformat()
    
    params = {
        "timeMin": time_min,
        "timeMax": time_max,
        "singleEvents": "true",
        "orderBy": "startTime",
        "maxResults": 30,
    }
    headers = {"Authorization": f"Bearer {access_token}"}
    
    async with httpx.AsyncClient(timeout=15.0) as http_client:
        resp = await http_client.get(GOOGLE_CALENDAR_EVENTS_URL, headers=headers, params=params)
        if resp.status_code != 200:
            logger.error(f"Google Calendar API error ({resp.status_code}): {resp.text}")
            raise ValueError("Failed to fetch events from Google Calendar")
        data = resp.json()
    
    # Fetch existing workspace members to cross-reference attendees
    supabase_client = get_supabase_client()
    members_resp = (
        supabase_client.table("workspace_members")
        .select("user_id, profiles(id, email, display_name)")
        .eq("workspace_id", str(workspace_id))
        .execute()
    )
    
    member_email_map: dict[str, UUID] = {}
    for m in (members_resp.data or []):
        prof = m.get("profiles") or {}
        email = prof.get("email")
        if email:
            member_email_map[email.lower()] = UUID(prof["id"])
    
    # Fetch already imported calendar event IDs in this workspace
    meetings_resp = (
        supabase_client.table("meetings")
        .select("id, calendar_event_id")
        .eq("workspace_id", str(workspace_id))
        .not_.is_("calendar_event_id", "null")
        .execute()
    )
    imported_events_map = {
        row["calendar_event_id"]: UUID(row["id"])
        for row in (meetings_resp.data or [])
        if row.get("calendar_event_id")
    }
    
    normalized_events: list[CalendarEventItem] = []
    
    for item in data.get("items", []):
        event_id = item.get("id")
        title = item.get("summary", "(Untitled Event)").strip()
        description = item.get("description")
        
        # Determine start time & timezone
        start_data = item.get("start", {})
        end_data = item.get("end", {})
        
        start_str = start_data.get("dateTime") or start_data.get("date")
        end_str = end_data.get("dateTime") or end_data.get("date")
        
        if not start_str:
            continue
            
        try:
            # Handle all-day dates or ISO strings
            if "T" not in start_str:
                starts_at = datetime.fromisoformat(f"{start_str}T09:00:00+05:30")
            else:
                starts_at = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
        except Exception:
            continue

        ends_at: Optional[datetime] = None
        if end_str:
            try:
                if "T" not in end_str:
                    ends_at = datetime.fromisoformat(f"{end_str}T10:00:00+05:30")
                else:
                    ends_at = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
            except Exception:
                ends_at = None

        tz = start_data.get("timeZone") or "Asia/Kolkata"
        conference_url = _extract_conference_url(item)
        
        # Process attendees
        attendees: list[CalendarAttendee] = []
        for att in item.get("attendees", []):
            att_email = (att.get("email") or "").lower().strip()
            if not att_email:
                continue
            matched_uid = member_email_map.get(att_email)
            attendees.append(CalendarAttendee(
                email=att_email,
                name=att.get("displayName"),
                matched_user_id=matched_uid,
                is_workspace_member=matched_uid is not None,
            ))
            
        is_imported = event_id in imported_events_map
        existing_id = imported_events_map.get(event_id)
        
        normalized_events.append(CalendarEventItem(
            id=event_id,
            title=title,
            description=description,
            starts_at=starts_at,
            ends_at=ends_at,
            timezone=tz,
            conference_url=conference_url,
            attendees=attendees,
            already_imported=is_imported,
            existing_meeting_id=existing_id,
        ))
        
    return normalized_events
