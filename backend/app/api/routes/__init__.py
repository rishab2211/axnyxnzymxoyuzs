from fastapi import APIRouter
from app.api.routes.health import router as health_router
from app.api.routes.ingest import router as ingest_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.forecasts import router as forecasts_router
from app.api.routes.accuracy import router as accuracy_router
from app.api.routes.data_quality import router as data_quality_router

api_router = APIRouter(prefix="/api")
api_router.include_router(health_router)
api_router.include_router(ingest_router)
api_router.include_router(dashboard_router)
api_router.include_router(forecasts_router)
api_router.include_router(accuracy_router)
api_router.include_router(data_quality_router)

__all__ = ["api_router"]
