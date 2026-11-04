from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status, Response
from sqlalchemy import text, inspect
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.database import get_db
from app.schemas.health import HealthResponse, DatabaseHealth

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    description="Check backend system and database health, table initialization status, and data freshness.",
)
def get_health(response: Response, db: Session = Depends(get_db)) -> HealthResponse:
    now_utc = datetime.now(timezone.utc)
    db_health = DatabaseHealth(
        connected=False,
        tables_initialized=False,
        record_counts={},
        last_ingestion=None,
        error=None,
    )

    overall_status = "healthy"

    try:
        # Check basic connectivity
        db.execute(text("SELECT 1"))
        db_health.connected = True

        # Check tables initialized
        inspector = inspect(db.bind)
        existing_tables = inspector.get_table_names()
        required_tables = ["actual_generation", "wind_forecasts", "actual_generation_hourly", "ingestion_runs"]
        db_health.tables_initialized = all(t in existing_tables for t in required_tables)

        if db_health.tables_initialized:
            # Query record counts
            actual_count = db.execute(text("SELECT COUNT(*) FROM actual_generation")).scalar() or 0
            forecast_count = db.execute(text("SELECT COUNT(*) FROM wind_forecasts")).scalar() or 0
            hourly_count = db.execute(text("SELECT COUNT(*) FROM actual_generation_hourly")).scalar() or 0
            runs_count = db.execute(text("SELECT COUNT(*) FROM ingestion_runs")).scalar() or 0

            db_health.record_counts = {
                "actual_generation_30min": actual_count,
                "wind_forecasts": forecast_count,
                "actual_generation_hourly": hourly_count,
                "ingestion_runs": runs_count,
            }

            # Query last ingestion run
            last_run = db.execute(
                text(
                    "SELECT id, dataset, started_at, completed_at, status, records_inserted "
                    "FROM ingestion_runs ORDER BY started_at DESC LIMIT 1"
                )
            ).mappings().first()

            if last_run:
                db_health.last_ingestion = dict(last_run)

    except Exception as exc:
        logger.error(f"Database health check failed: {exc}", exc_info=False)
        db_health.connected = False
        db_health.error = str(exc)
        overall_status = "degraded"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return HealthResponse(
        status=overall_status,
        project=settings.PROJECT_NAME,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        timestamp=now_utc,
        database=db_health,
    )
