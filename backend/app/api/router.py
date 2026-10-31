"""API Router registry for ActionPulse Backend."""

from fastapi import APIRouter

from app.api import chat, extraction, followup, health, meetings, review, workspaces

api_router = APIRouter()

# Health diagnostic endpoints
api_router.include_router(health.router)

# Workspace management endpoints (BE-1)
api_router.include_router(workspaces.router, prefix="/workspaces", tags=["Workspaces"])

# Core API endpoints (BE-4)
api_router.include_router(meetings.router, tags=["Meetings"])
api_router.include_router(review.router, tags=["Review & Approval"])
api_router.include_router(followup.router, prefix="/meetings", tags=["Follow-Up"])

# AI extraction (BE-3)
api_router.include_router(extraction.router, tags=["Extraction"])

# Meeting Chatbot API
api_router.include_router(chat.router, prefix="/chat", tags=["Meeting Chatbot"])
