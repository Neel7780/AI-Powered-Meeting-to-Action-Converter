"""Aggregated API router mounting all modular domain endpoints."""

from fastapi import APIRouter

from app.api import (
    analytics,
    audio,
    calendar,
    chat,
    extraction,
    followup,
    github,
    health,
    meeting_automation,
    meetings,
    review,
    tasks,
    workspaces,
)

api_router = APIRouter()

# Core service endpoints
api_router.include_router(health.router, tags=["Health"])

# Sprint 1 Vertical Slice routers
api_router.include_router(workspaces.router, prefix="/workspaces", tags=["Workspaces"])
api_router.include_router(meetings.router, tags=["Meetings"])
api_router.include_router(audio.router, tags=["Audio & Speaker Diarization"])
api_router.include_router(review.router, tags=["Review & Approval"])
api_router.include_router(followup.router, prefix="/meetings", tags=["Follow-Up"])

# Sprint 2 Tasks & Dependencies (Task 6)
api_router.include_router(tasks.router, prefix="/workspaces", tags=["Tasks"])

# Sprint 2 Analytics (Task 7)
api_router.include_router(analytics.router, prefix="/workspaces", tags=["Workspace Analytics"])

# Calendar integration endpoints
api_router.include_router(calendar.router, prefix="/calendar", tags=["Calendar"])
api_router.include_router(github.router, tags=["GitHub Integration"])

# AI extraction (BE-3)
api_router.include_router(extraction.router, tags=["Extraction"])

# Meeting Chatbot API
api_router.include_router(chat.router, prefix="/chat", tags=["Meeting Chatbot"])

# Online Meeting Automation (Sprint 2 - Task 1: Madhav Chauhan)
api_router.include_router(meeting_automation.router, tags=["Online Meeting Automation"])
