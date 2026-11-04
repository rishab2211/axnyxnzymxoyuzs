from datetime import datetime, date, time, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_

from app.models.actual_generation import ActualGeneration
from app.models.actual_hourly import ActualGenerationHourly
from app.models.wind_forecast import WindForecast
from app.models.ingestion_run import IngestionRun
from app.repositories.generation_repo import GenerationRepository
from app.repositories.ingestion_repo import IngestionRepository
from app.services.forecast_selector import ForecastSelector
from app.services.accuracy import AccuracyEngine
from app.schemas.analytics import (
    AccuracyMetrics,
    IntervalMatchRecord,
    Actual30mRecord,
    DashboardResponse,
    DailyAccuracyTrend,
    IntervalVintagesResponse,
    WorstIntervalRecord,
    DataQualitySummary,
)


class AnalyticsEngine:
    """Orchestrates forecast vintage retrieval, outturn matching, and metric calculations."""

    @classmethod
    def get_dashboard(
        cls,
        db: Session,
        delivery_date: date,
        cutoff_str: Optional[str] = None,
    ) -> DashboardResponse:
        """Generate comprehensive daily dashboard analytics with dual-granularity time series."""
        cutoff_dt = ForecastSelector.resolve_cutoff_datetime(delivery_date, cutoff_str)
        forecast_map = ForecastSelector.select_vintages_for_delivery_date(db, delivery_date, cutoff_str)

        start_dt = datetime.combine(delivery_date, time(0, 0), tzinfo=timezone.utc)
        end_dt = start_dt + timedelta(days=1)

        # 1. Fetch hourly actuals
        hourly_actuals = GenerationRepository.get_hourly_actuals_by_range(db, start_dt, end_dt)
        actual_map = {ha.hour_start_time: float(ha.generation_mw) if ha.generation_mw is not None else None for ha in hourly_actuals}

        # 2. Fetch raw 30-min actuals for reference background series
        raw_30m = GenerationRepository.get_actuals_by_date(db, delivery_date)
        actual_30m_series = [
            Actual30mRecord(
                start_time=r.start_time,
                settlement_period=r.settlement_period,
                generation_mw=float(r.generation_mw),
                publish_time=r.publish_time,
            )
            for r in raw_30m
        ]

        # 3. Match forecast and actual by start_time
        series: List[IntervalMatchRecord] = []
        matched_pairs: List[Tuple[float, float]] = []
        over_count = 0
        under_count = 0
        zero_count = 0

        current_dt = start_dt
        while current_dt < end_dt:
            fc = forecast_map.get(current_dt)
            act = actual_map.get(current_dt)

            fc_mw = float(fc.generation_mw) if fc else None
            pub_time = fc.publish_time if fc else None
            lead_h = round((current_dt - pub_time).total_seconds() / 3600.0, 1) if pub_time else None

            if fc_mw is not None and act is not None:
                err = AccuracyEngine.calculate_error(fc_mw, act)
                status_str = "matched"
                matched_pairs.append((fc_mw, act))
                if err > 0.0:
                    over_count += 1
                elif err < 0.0:
                    under_count += 1
                else:
                    zero_count += 1
            elif fc_mw is not None and act is None:
                err = None
                status_str = "missing_actual"
            elif fc_mw is None and act is not None:
                err = None
                status_str = "missing_forecast"
            else:
                err = None
                status_str = "missing_both"

            series.append(
                IntervalMatchRecord(
                    start_time=current_dt,
                    forecast_mw=fc_mw,
                    actual_hourly_mw=act,
                    error_mw=err,
                    forecast_publish_time=pub_time,
                    forecast_lead_hours=lead_h,
                    status=status_str,
                )
            )
            current_dt += timedelta(hours=1)

        # 4. Compute metrics on matched set
        metrics = AccuracyEngine.compute_metrics(matched_pairs, expected_observations=24)

        return DashboardResponse(
            delivery_date=delivery_date,
            decision_cutoff=cutoff_str or "11:00",
            cutoff_datetime=cutoff_dt,
            metrics=metrics,
            series=series,
            actual_30m_series=actual_30m_series,
            overforecast_count=over_count,
            underforecast_count=under_count,
            zero_error_count=zero_count,
        )

    @classmethod
    def get_forecasts(
        cls,
        db: Session,
        delivery_date: date,
        cutoff_str: Optional[str] = None,
    ) -> List[IntervalMatchRecord]:
        """Return interval-level matched forecast and actual pairs."""
        dash = cls.get_dashboard(db, delivery_date, cutoff_str)
        return dash.series

    @classmethod
    def get_accuracy_summary(
        cls,
        db: Session,
        date_from: date,
        date_to: date,
        cutoff_str: Optional[str] = None,
    ) -> AccuracyMetrics:
        """Calculate aggregate accuracy statistics across a date window."""
        matched_pairs: List[Tuple[float, float]] = []
        expected_total = 0

        curr_date = date_from
        while curr_date <= date_to:
            expected_total += 24
            dash = cls.get_dashboard(db, curr_date, cutoff_str)
            for s in dash.series:
                if s.forecast_mw is not None and s.actual_hourly_mw is not None:
                    matched_pairs.append((s.forecast_mw, s.actual_hourly_mw))
            curr_date += timedelta(days=1)

        return AccuracyEngine.compute_metrics(matched_pairs, expected_observations=expected_total)

    @classmethod
    def get_daily_trends(
        cls,
        db: Session,
        date_from: date,
        date_to: date,
        cutoff_str: Optional[str] = None,
    ) -> List[DailyAccuracyTrend]:
        """Calculate day-by-day accuracy trends over a date range."""
        trends: List[DailyAccuracyTrend] = []
        curr_date = date_from
        while curr_date <= date_to:
            dash = cls.get_dashboard(db, curr_date, cutoff_str)
            m = dash.metrics
            trends.append(
                DailyAccuracyTrend(
                    delivery_date=curr_date,
                    mae=m.mae,
                    rmse=m.rmse,
                    bias=m.bias,
                    wape=m.wape,
                    matched_count=m.matched_observations,
                    expected_count=24,
                    coverage_pct=m.coverage_pct,
                )
            )
            curr_date += timedelta(days=1)

        return trends

    @classmethod
    def get_vintages_evolution(
        cls,
        db: Session,
        delivery_date: date,
        cutoff_str: Optional[str] = None,
    ) -> IntervalVintagesResponse:
        """Return all historical publications for each delivery interval to visualize forecast evolution."""
        cutoff_dt = ForecastSelector.resolve_cutoff_datetime(delivery_date, cutoff_str)
        all_vintages = ForecastSelector.get_all_vintages_for_date(db, delivery_date)

        start_dt = datetime.combine(delivery_date, time(0, 0), tzinfo=timezone.utc)
        end_dt = start_dt + timedelta(days=1)

        # Fetch actuals
        hourly_actuals = GenerationRepository.get_hourly_actuals_by_range(db, start_dt, end_dt)
        actual_map = {ha.hour_start_time: float(ha.generation_mw) if ha.generation_mw is not None else None for ha in hourly_actuals}

        interval_payloads = []
        curr_dt = start_dt
        while curr_dt < end_dt:
            v_list = all_vintages.get(curr_dt, [])
            formatted_vintages = []
            selected_pub = None
            selected_gen = None

            for v in v_list:
                is_eligible = v.publish_time <= cutoff_dt
                lead_h = round((curr_dt - v.publish_time).total_seconds() / 3600.0, 1)
                formatted_vintages.append({
                    "publish_time": v.publish_time,
                    "generation_mw": float(v.generation_mw),
                    "lead_hours": lead_h,
                    "is_eligible": is_eligible,
                })
                if is_eligible:
                    if selected_pub is None or v.publish_time > selected_pub:
                        selected_pub = v.publish_time
                        selected_gen = float(v.generation_mw)

            interval_payloads.append({
                "start_time": curr_dt,
                "selected_publish_time": selected_pub,
                "selected_generation_mw": selected_gen,
                "actual_generation_mw": actual_map.get(curr_dt),
                "vintages": formatted_vintages,
            })
            curr_dt += timedelta(hours=1)

        return IntervalVintagesResponse(
            delivery_date=delivery_date,
            decision_cutoff=cutoff_str or "11:00",
            cutoff_datetime=cutoff_dt,
            intervals=interval_payloads,
        )

    @classmethod
    def get_worst_intervals(
        cls,
        db: Session,
        date_from: date,
        date_to: date,
        cutoff_str: Optional[str] = None,
        limit: int = 10,
    ) -> List[WorstIntervalRecord]:
        """Find the top N worst absolute forecast errors across the date range."""
        all_records: List[IntervalMatchRecord] = []
        curr_date = date_from
        while curr_date <= date_to:
            dash = cls.get_dashboard(db, curr_date, cutoff_str)
            all_records.extend(dash.series)
            curr_date += timedelta(days=1)

        return AccuracyEngine.get_worst_intervals(all_records, limit=limit)

    @classmethod
    def get_data_quality(
        cls,
        db: Session,
        date_from: date,
        date_to: date,
    ) -> DataQualitySummary:
        """Report on data coverage, missing intervals, and ingestion audit status."""
        days = (date_to - date_from).days + 1
        expected_30m = days * 48
        expected_hourly = days * 24

        # Query counts from DB
        dt_start = datetime.combine(date_from, time(0, 0), tzinfo=timezone.utc)
        dt_end = datetime.combine(date_to + timedelta(days=1), time(0, 0), tzinfo=timezone.utc)

        # 30m actuals count
        actual_30m_count = db.execute(
            select(func.count(ActualGeneration.id)).where(
                and_(
                    ActualGeneration.settlement_date >= date_from,
                    ActualGeneration.settlement_date <= date_to,
                )
            )
        ).scalar() or 0

        # Hourly actuals count
        hourly_actual_count = db.execute(
            select(func.count(ActualGenerationHourly.id)).where(
                and_(
                    ActualGenerationHourly.hour_start_time >= dt_start,
                    ActualGenerationHourly.hour_start_time < dt_end,
                )
            )
        ).scalar() or 0

        # Distinct forecast intervals targeting this range
        forecast_intervals_count = db.execute(
            select(func.count(func.distinct(WindForecast.start_time))).where(
                and_(
                    WindForecast.start_time >= dt_start,
                    WindForecast.start_time < dt_end,
                )
            )
        ).scalar() or 0

        # Matched count using default cutoff
        summary = cls.get_accuracy_summary(db, date_from, date_to)
        matched_count = summary.matched_observations

        missing_forecasts = max(0, expected_hourly - forecast_intervals_count)
        missing_actuals = max(0, expected_hourly - hourly_actual_count)

        act_cov = round((actual_30m_count / expected_30m * 100.0) if expected_30m > 0 else 0.0, 1)
        fc_cov = round((forecast_intervals_count / expected_hourly * 100.0) if expected_hourly > 0 else 0.0, 1)
        matched_cov = round((matched_count / expected_hourly * 100.0) if expected_hourly > 0 else 0.0, 1)

        recent_runs = IngestionRepository.list_runs(db, limit=10)
        formatted_runs = [
            {
                "id": r.id,
                "dataset": r.dataset,
                "started_at": r.started_at,
                "completed_at": r.completed_at,
                "status": r.status,
                "records_received": r.records_received,
                "records_inserted": r.records_inserted,
                "error_message": r.error_message,
            }
            for r in recent_runs
        ]

        return DataQualitySummary(
            date_from=date_from,
            date_to=date_to,
            expected_30m_intervals=expected_30m,
            actual_30m_records=actual_30m_count,
            expected_hourly_intervals=expected_hourly,
            hourly_actuals_available=hourly_actual_count,
            forecasts_available=forecast_intervals_count,
            matched_intervals=matched_count,
            missing_forecast_intervals=missing_forecasts,
            missing_actual_intervals=missing_actuals,
            actual_coverage_pct=act_cov,
            forecast_coverage_pct=fc_cov,
            matched_coverage_pct=matched_cov,
            recent_ingestions=formatted_runs,
        )
