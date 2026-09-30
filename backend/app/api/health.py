from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(tags=["Health & Diagnostics"])

@router.get("/health")
async def health_check():
    """Service health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT
    }

