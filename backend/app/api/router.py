"""Aggregated API router mounting all modular domain endpoints."""

from fastapi import APIRouter

from app.api import calendar, chat, extraction, health, meetings, review, workspaces

api_router = APIRouter()

# Core service endpoints
api_router.include_router(health.router, tags=["Health"])

# Sprint 1 Vertical Slice routers
api_router.include_router(workspaces.router, prefix="/workspaces", tags=["Workspaces"])
api_router.include_router(meetings.router, tags=["Meetings"])
api_router.include_router(review.router, tags=["Review & Approval"])

# Calendar integration endpoints
api_router.include_router(calendar.router, prefix="/calendar", tags=["Calendar"])

# AI extraction (BE-3)
api_router.include_router(extraction.router, tags=["Extraction"])

# Meeting Chatbot API
api_router.include_router(chat.router, prefix="/chat", tags=["Meeting Chatbot"])
