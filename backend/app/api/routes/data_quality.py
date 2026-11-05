from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.actual_generation import ActualGeneration
from app.models.wind_forecast import WindForecast
from app.schemas.analytics import DataQualitySummary, DataBoundsResponse
from app.services.analytics_engine import AnalyticsEngine
from app.core.config import settings

router = APIRouter(prefix="/data-quality", tags=["Data Quality"])


@router.get(
    "/bounds",
    response_model=DataBoundsResponse,
    summary="Get available data date bounds",
    description="Returns the minimum and maximum settlement dates available in the database, with total record counts.",
)
def get_data_bounds(db: Session = Depends(get_db)) -> DataBoundsResponse:
    try:
        min_date = db.query(func.min(ActualGeneration.settlement_date)).scalar()
        max_date = db.query(func.max(ActualGeneration.settlement_date)).scalar()
        total_actual = db.query(func.count(ActualGeneration.id)).scalar() or 0
        total_forecast = db.query(func.count(WindForecast.id)).scalar() or 0
        return DataBoundsResponse(
            min_date=min_date,
            max_date=max_date,
            total_actual_records=total_actual,
            total_forecast_records=total_forecast,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query data bounds: {exc}",
        )


@router.get(
    "",
    response_model=DataQualitySummary,
    summary="Data completeness, coverage, and ingestion audit status",
    description="Expose expected vs received intervals (30-min actuals and hourly forecasts), missing intervals, and audit metadata.",
)
def get_data_quality(
    date_from: Optional[date] = Query(None, description="Start date (YYYY-MM-DD). Defaults to 2026-01-01."),
    date_to: Optional[date] = Query(None, description="End date (YYYY-MM-DD). Defaults to 2026-01-31."),
    decision_cutoff: Optional[str] = Query(None, description="Decision cutoff time in UTC (HH:MM). Defaults to 11:00."),
    db: Session = Depends(get_db),
) -> DataQualitySummary:
    d_from = date_from or date.fromisoformat(settings.EVALUATION_START_DATE)
    d_to = date_to or date.fromisoformat(settings.EVALUATION_END_DATE)
    if d_from > d_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="date_from cannot be after date_to.",
        )
    try:
        return AnalyticsEngine.get_data_quality(
            db=db,
            date_from=d_from,
            date_to=d_to,
            cutoff_str=decision_cutoff,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile data quality metrics: {exc}",
        )
