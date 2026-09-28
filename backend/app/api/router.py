from fastapi import APIRouter
from app.api import health

api_router = APIRouter()

# Health endpoints mounted at root and /api
api_router.include_router(health.router)

# Sprint 1 Feature routers will be mounted here by feature sub-teams:
# api_router.include_router(workspaces.router, prefix="/workspaces", tags=["Workspaces"])
# api_router.include_router(meetings.router, prefix="/meetings", tags=["Meetings"])
# api_router.include_router(extraction.router, prefix="/meetings", tags=["Extraction"])
# api_router.include_router(review.router, prefix="/meetings", tags=["Review & Approval"])
