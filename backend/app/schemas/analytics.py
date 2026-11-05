from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class AccuracyMetrics(BaseModel):
    mae: Optional[float] = Field(None, description="Mean Absolute Error (MW)")
    rmse: Optional[float] = Field(None, description="Root Mean Square Error (MW)")
    bias: Optional[float] = Field(None, description="Mean Error / Forecast Bias (MW). Positive = overforecast, negative = underforecast.")
    wape: Optional[float] = Field(None, description="Weighted Absolute Percentage Error (%)")
    mape: Optional[float] = Field(None, description="Mean Absolute Percentage Error (%) with zero denominators excluded")
    mape_excluded_count: int = Field(0, description="Number of zero/near-zero actuals excluded from MAPE")
    matched_observations: int = Field(0, description="Count of intervals with both eligible forecast and actual generation")
    expected_observations: int = Field(0, description="Expected hourly intervals in evaluation window")
    coverage_pct: float = Field(0.0, description="Matched intervals divided by expected intervals * 100")


class IntervalMatchRecord(BaseModel):
    start_time: datetime
    forecast_mw: Optional[float] = None
    actual_hourly_mw: Optional[float] = None
    error_mw: Optional[float] = None
    forecast_publish_time: Optional[datetime] = None
    forecast_lead_hours: Optional[float] = None
    status: str = Field(..., description="'matched', 'missing_forecast', or 'missing_actual'")


class Actual30mRecord(BaseModel):
    start_time: datetime
    settlement_period: int
    generation_mw: float
    publish_time: datetime


class DashboardResponse(BaseModel):
    delivery_date: date
    decision_cutoff: str
    cutoff_datetime: datetime
    metrics: AccuracyMetrics
    series: List[IntervalMatchRecord]
    actual_30m_series: List[Actual30mRecord]
    overforecast_count: int = 0
    underforecast_count: int = 0
    zero_error_count: int = 0


class DailyAccuracyTrend(BaseModel):
    delivery_date: date
    mae: Optional[float] = None
    rmse: Optional[float] = None
    bias: Optional[float] = None
    wape: Optional[float] = None
    matched_count: int = 0
    expected_count: int = 24
    coverage_pct: float = 0.0


class VintagePublication(BaseModel):
    publish_time: datetime
    generation_mw: float
    lead_hours: float
    is_eligible: bool


class IntervalVintagesResponse(BaseModel):
    delivery_date: date
    decision_cutoff: str
    cutoff_datetime: datetime
    intervals: List[Dict[str, Any]]


class WorstIntervalRecord(BaseModel):
    start_time: datetime
    forecast_mw: float
    actual_mw: float
    error_mw: float
    absolute_error_mw: float
    percentage_error: Optional[float] = None
    forecast_publish_time: datetime


class DataQualitySummary(BaseModel):
    date_from: date
    date_to: date
    expected_30m_intervals: int
    actual_30m_records: int
    expected_hourly_intervals: int
    hourly_actuals_available: int
    forecasts_available: int
    matched_intervals: int
    missing_forecast_intervals: int
    missing_actual_intervals: int
    actual_coverage_pct: float
    forecast_coverage_pct: float
    matched_coverage_pct: float
    cutoff_eligible_forecasts: int = Field(0, description="Count of hourly intervals with at least one forecast published on or before cutoff")
    missing_cutoff_forecast_intervals: int = Field(0, description="Hourly intervals lacking an eligible forecast published on or before cutoff")
    recent_ingestions: List[Dict[str, Any]] = Field(default_factory=list)


class DataBoundsResponse(BaseModel):
    min_date: Optional[date] = None
    max_date: Optional[date] = None
    total_actual_records: int
    total_forecast_records: int
