from fastapi import APIRouter
from app.api import health, meetings, review, workspaces

api_router = APIRouter()

# Health endpoints mounted at root and /api
api_router.include_router(health.router)

# Sprint feature routers
api_router.include_router(workspaces.router, prefix="/workspaces", tags=["Workspaces"])
api_router.include_router(meetings.router, tags=["Meetings & Ingestion"])
api_router.include_router(review.router, tags=["Review & Approval"])

