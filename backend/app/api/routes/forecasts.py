from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.analytics import IntervalMatchRecord, IntervalVintagesResponse
from app.services.analytics_engine import AnalyticsEngine
from app.core.config import settings

router = APIRouter(prefix="/forecasts", tags=["Forecast Explorer"])


@router.get(
    "",
    response_model=List[IntervalMatchRecord],
    summary="Interval-level matched forecast and actual data",
    description="Retrieve 24 hourly intervals for a selected delivery date with forecast, actual, error, and publish time.",
)
def get_forecasts(
    delivery_date: Optional[date] = Query(None, description="Delivery date (YYYY-MM-DD). Defaults to 2026-01-01."),
    decision_cutoff: Optional[str] = Query(None, description="Decision cutoff time in UTC (HH:MM). Defaults to 11:00."),
    db: Session = Depends(get_db),
) -> List[IntervalMatchRecord]:
    target_date = delivery_date or date.fromisoformat(settings.EVALUATION_START_DATE)
    try:
        return AnalyticsEngine.get_forecasts(
            db=db,
            delivery_date=target_date,
            cutoff_str=decision_cutoff,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch forecast records: {exc}",
        )


@router.get(
    "/vintages",
    response_model=IntervalVintagesResponse,
    summary="Historical forecast publication evolution by interval",
    description="Retrieve all publication vintages for every interval on a delivery date to show forecast evolution as delivery approaches.",
)
def get_forecast_vintages(
    delivery_date: Optional[date] = Query(None, description="Delivery date (YYYY-MM-DD). Defaults to 2026-01-01."),
    decision_cutoff: Optional[str] = Query(None, description="Decision cutoff time in UTC (HH:MM). Defaults to 11:00."),
    db: Session = Depends(get_db),
) -> IntervalVintagesResponse:
    target_date = delivery_date or date.fromisoformat(settings.EVALUATION_START_DATE)
    try:
        return AnalyticsEngine.get_vintages_evolution(
            db=db,
            delivery_date=target_date,
            cutoff_str=decision_cutoff,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch forecast vintages: {exc}",
        )
