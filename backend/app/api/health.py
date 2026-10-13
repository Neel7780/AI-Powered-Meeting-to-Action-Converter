"""Health check and service diagnostics endpoint (BE-4)."""

import logging

from fastapi import APIRouter, Response, status

from app.core.config import settings
from app.core.supabase import get_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health & Diagnostics"])


@router.get("/health")
def health_check(response: Response):
    """Service and database health check endpoint.
    
    Pings Supabase Postgres via service-role client.
    Returns 200 when healthy, 503 when the database is unreachable.
    """
    db_status = "disconnected"
    db_error = None

    try:
        client = get_supabase_client()
        # Run lightweight query to verify connectivity and schema health
        client.table("workspaces").select("id").limit(1).execute()
        db_status = "connected"
    except Exception as exc:
        logger.warning("Database health check ping failed: %s", exc)
        db_error = str(exc)

    if db_status == "connected":
        return {
            "status": "healthy",
            "database": "connected",
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
        }

    response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": "unhealthy",
        "database": "disconnected",
        "detail": db_error or "Database connection failed",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }
