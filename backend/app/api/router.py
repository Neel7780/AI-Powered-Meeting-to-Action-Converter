"""API Router registry for ActionPulse Backend."""

from fastapi import APIRouter

from app.api import calendar, extraction, health, meetings, review, workspaces

api_router = APIRouter()

# Health diagnostic endpoints
api_router.include_router(health.router)

# Workspace management endpoints (BE-1)
api_router.include_router(workspaces.router, prefix="/workspaces", tags=["Workspaces"])

# Core API endpoints (BE-4)
api_router.include_router(meetings.router, tags=["Meetings"])
api_router.include_router(review.router, tags=["Review & Approval"])

# Calendar integration endpoints
api_router.include_router(calendar.router, prefix="/calendar", tags=["Calendar"])

# AI extraction (BE-3)
api_router.include_router(extraction.router, tags=["Extraction"])
