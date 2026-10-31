"""Internal operational endpoints (BE-2).

Secured endpoints for background maintenance and keep-alive pings.
"""

import hmac
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, status
from app.core.config import settings
from app.core.supabase import get_supabase_client
from app.services.email import process_all_meeting_notifications

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Internal Maintenance"])


@router.post("/internal/tick", status_code=status.HTTP_200_OK)
def internal_tick(x_tick_secret: Optional[str] = Header(None, alias="X-Tick-Secret")):
    """Keep-alive tick endpoint triggered by Supabase pg_cron.
    
    1. Authenticates request via X-Tick-Secret header (timing-safe comparison).
    2. Executes a trivial query against Supabase to prevent the free database from pausing.
    3. Keeps Render free web service awake.
    4. Dispatches scheduled pre-meeting reminders and post-meeting transcript nudges.
    """
    if not settings.INTERNAL_TICK_SECRET or not x_tick_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or unconfigured tick secret."
        )

    if not hmac.compare_digest(x_tick_secret, settings.INTERNAL_TICK_SECRET):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid tick secret."
        )

    # Perform trivial DB ping so Supabase marks database as active
    db_status = "connected"
    try:
        supabase = get_supabase_client()
        # Query 1 row from profiles
        supabase.table("profiles").select("id").limit(1).execute()
    except Exception as exc:
        logger.warning("internal_tick: Database ping degraded: %s", exc)
        db_status = "degraded"

    # Process background meeting notifications
    notification_stats = process_all_meeting_notifications()

    return {
        "status": "active",
        "tick": "ok",
        "db": db_status,
        "notifications": notification_stats,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.post("/internal/process-reminders", status_code=status.HTTP_200_OK)
def trigger_meeting_reminders(x_tick_secret: Optional[str] = Header(None, alias="X-Tick-Secret")):
    """Explicitly trigger pre-meeting reminders and post-meeting nudges."""
    if not settings.INTERNAL_TICK_SECRET or not x_tick_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or unconfigured tick secret."
        )

    if not hmac.compare_digest(x_tick_secret, settings.INTERNAL_TICK_SECRET):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid tick secret."
        )

    stats = process_all_meeting_notifications()
    return {
        "status": "ok",
        "processed": stats,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
