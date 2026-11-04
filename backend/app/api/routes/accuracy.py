from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.analytics import AccuracyMetrics, DailyAccuracyTrend, WorstIntervalRecord
from app.services.analytics_engine import AnalyticsEngine
from app.core.config import settings

router = APIRouter(prefix="/accuracy", tags=["Accuracy Analytics"])


@router.get(
    "/summary",
    response_model=AccuracyMetrics,
    summary="Statistical accuracy metrics summary",
    description="Calculate aggregate MAE, RMSE, Bias, WAPE, and MAPE across a specified date range.",
)
def get_accuracy_summary(
    date_from: Optional[date] = Query(None, description="Start date (YYYY-MM-DD). Defaults to 2026-01-01."),
    date_to: Optional[date] = Query(None, description="End date (YYYY-MM-DD). Defaults to 2026-01-31."),
    decision_cutoff: Optional[str] = Query(None, description="Decision cutoff time in UTC (HH:MM). Defaults to 11:00."),
    db: Session = Depends(get_db),
) -> AccuracyMetrics:
    d_from = date_from or date.fromisoformat(settings.EVALUATION_START_DATE)
    d_to = date_to or date.fromisoformat(settings.EVALUATION_END_DATE)
    if d_from > d_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="date_from cannot be after date_to.",
        )
    try:
        return AnalyticsEngine.get_accuracy_summary(
            db=db,
            date_from=d_from,
            date_to=d_to,
            cutoff_str=decision_cutoff,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate accuracy summary: {exc}",
        )


@router.get(
    "/trend",
    response_model=List[DailyAccuracyTrend],
    summary="Daily forecast accuracy time series trend",
    description="Return daily MAE, RMSE, Bias, and WAPE across the date range.",
)
def get_accuracy_trend(
    date_from: Optional[date] = Query(None, description="Start date (YYYY-MM-DD). Defaults to 2026-01-01."),
    date_to: Optional[date] = Query(None, description="End date (YYYY-MM-DD). Defaults to 2026-01-31."),
    decision_cutoff: Optional[str] = Query(None, description="Decision cutoff time in UTC (HH:MM). Defaults to 11:00."),
    db: Session = Depends(get_db),
) -> List[DailyAccuracyTrend]:
    d_from = date_from or date.fromisoformat(settings.EVALUATION_START_DATE)
    d_to = date_to or date.fromisoformat(settings.EVALUATION_END_DATE)
    if d_from > d_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="date_from cannot be after date_to.",
        )
    try:
        return AnalyticsEngine.get_daily_trends(
            db=db,
            date_from=d_from,
            date_to=d_to,
            cutoff_str=decision_cutoff,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate accuracy trends: {exc}",
        )


@router.get(
    "/distribution",
    summary="Error distribution histogram and scatter coordinates",
    description="Return histogram bins and scatter data comparing forecast vs actual for statistical diagnostics.",
)
def get_accuracy_distribution(
    date_from: Optional[date] = Query(None, description="Start date (YYYY-MM-DD). Defaults to 2026-01-01."),
    date_to: Optional[date] = Query(None, description="End date (YYYY-MM-DD). Defaults to 2026-01-31."),
    decision_cutoff: Optional[str] = Query(None, description="Decision cutoff time in UTC (HH:MM). Defaults to 11:00."),
    bins: int = Query(10, ge=5, le=30),
    db: Session = Depends(get_db),
):
    d_from = date_from or date.fromisoformat(settings.EVALUATION_START_DATE)
    d_to = date_to or date.fromisoformat(settings.EVALUATION_END_DATE)
    if d_from > d_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="date_from cannot be after date_to.",
        )
    try:
        return AnalyticsEngine.get_distribution(
            db=db,
            date_from=d_from,
            date_to=d_to,
            cutoff_str=decision_cutoff,
            bins=bins,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate error distribution: {exc}",
        )


@router.get(
    "/worst",
    response_model=List[WorstIntervalRecord],
    summary="Top forecast error intervals",
    description="Return the top N intervals with the largest absolute forecast errors in the period.",
)
def get_worst_intervals(
    date_from: Optional[date] = Query(None, description="Start date (YYYY-MM-DD). Defaults to 2026-01-01."),
    date_to: Optional[date] = Query(None, description="End date (YYYY-MM-DD). Defaults to 2026-01-31."),
    decision_cutoff: Optional[str] = Query(None, description="Decision cutoff time in UTC (HH:MM). Defaults to 11:00."),
    limit: int = Query(10, ge=1, le=50, description="Number of worst error intervals to return."),
    db: Session = Depends(get_db),
) -> List[WorstIntervalRecord]:
    d_from = date_from or date.fromisoformat(settings.EVALUATION_START_DATE)
    d_to = date_to or date.fromisoformat(settings.EVALUATION_END_DATE)
    if d_from > d_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="date_from cannot be after date_to.",
        )
    try:
        return AnalyticsEngine.get_worst_intervals(
            db=db,
            date_from=d_from,
            date_to=d_to,
            cutoff_str=decision_cutoff,
            limit=limit,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve worst error intervals: {exc}",
        )
