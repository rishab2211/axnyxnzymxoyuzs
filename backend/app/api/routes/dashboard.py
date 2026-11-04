from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.analytics import DashboardResponse
from app.services.analytics_engine import AnalyticsEngine
from app.core.config import settings

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "",
    response_model=DashboardResponse,
    summary="Executive overview metrics and time series",
    description="Retrieve daily KPIs (MAE, RMSE, Bias, WAPE), dual-granularity time series (hourly matched + 30m actual reference), and over/under forecast counts.",
)
def get_dashboard(
    delivery_date: Optional[date] = Query(None, description="Target electricity delivery settlement date (YYYY-MM-DD). Defaults to 2026-01-01."),
    decision_cutoff: Optional[str] = Query(None, description="Decision cutoff time in UTC (HH:MM). Defaults to 11:00."),
    db: Session = Depends(get_db),
) -> DashboardResponse:
    target_date = delivery_date or date.fromisoformat(settings.EVALUATION_START_DATE)
    try:
        return AnalyticsEngine.get_dashboard(
            db=db,
            delivery_date=target_date,
            cutoff_str=decision_cutoff,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate dashboard analytics: {exc}",
        )
