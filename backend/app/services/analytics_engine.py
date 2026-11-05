from datetime import datetime, date, time, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_, desc

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
    def _build_range_match_records(
        cls,
        db: Session,
        date_from: date,
        date_to: date,
        cutoff_str: Optional[str] = None,
    ) -> List[IntervalMatchRecord]:
        """
        Batch query all forecasts and hourly actuals for [date_from, date_to],
        evaluating cutoff eligibility per day to avoid O(N) query fan-out.
        """
        dt_start = datetime.combine(date_from, time(0, 0), tzinfo=timezone.utc)
        dt_end = datetime.combine(date_to + timedelta(days=1), time(0, 0), tzinfo=timezone.utc)

        # 1. Single query for all hourly actuals in the range
        hourly_actuals = GenerationRepository.get_hourly_actuals_by_range(db, dt_start, dt_end)
        actual_map: Dict[datetime, Optional[float]] = {
            ha.hour_start_time: float(ha.generation_mw) if ha.generation_mw is not None else None
            for ha in hourly_actuals
        }

        # 2. Single query for all forecasts targeting intervals in this delivery window
        stmt = (
            select(WindForecast)
            .where(
                and_(
                    WindForecast.start_time >= dt_start,
                    WindForecast.start_time < dt_end,
                )
            )
            .order_by(WindForecast.start_time.asc(), desc(WindForecast.publish_time))
        )
        forecast_rows = db.execute(stmt).scalars().all()

        # Group forecasts by target start_time
        fc_by_start: Dict[datetime, List[WindForecast]] = {}
        for fc in forecast_rows:
            fc_by_start.setdefault(fc.start_time, []).append(fc)

        # Cache cutoff_dt per day
        cutoff_cache: Dict[date, datetime] = {}

        series: List[IntervalMatchRecord] = []
        curr_dt = dt_start
        while curr_dt < dt_end:
            delivery_d = curr_dt.date()
            if delivery_d not in cutoff_cache:
                cutoff_cache[delivery_d] = ForecastSelector.resolve_cutoff_datetime(delivery_d, cutoff_str)
            cutoff_dt = cutoff_cache[delivery_d]

            candidates = fc_by_start.get(curr_dt, [])
            selected_fc: Optional[WindForecast] = None
            for c in candidates:
                if c.publish_time <= cutoff_dt:
                    selected_fc = c
                    break

            fc_mw = float(selected_fc.generation_mw) if selected_fc else None
            pub_time = selected_fc.publish_time if selected_fc else None
            lead_h = round((curr_dt - pub_time).total_seconds() / 3600.0, 1) if pub_time else None
            act = actual_map.get(curr_dt)

            if fc_mw is not None and act is not None:
                err = AccuracyEngine.calculate_error(fc_mw, act)
                status_str = "matched"
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
                    start_time=curr_dt,
                    forecast_mw=fc_mw,
                    actual_hourly_mw=act,
                    error_mw=err,
                    forecast_publish_time=pub_time,
                    forecast_lead_hours=lead_h,
                    status=status_str,
                )
            )
            curr_dt += timedelta(hours=1)

        return series

    @classmethod
    def get_accuracy_summary(
        cls,
        db: Session,
        date_from: date,
        date_to: date,
        cutoff_str: Optional[str] = None,
    ) -> AccuracyMetrics:
        """Calculate aggregate accuracy statistics across a date window via fast batch range query."""
        series = cls._build_range_match_records(db, date_from, date_to, cutoff_str)
        matched_pairs: List[Tuple[float, float]] = [
            (s.forecast_mw, s.actual_hourly_mw)
            for s in series
            if s.forecast_mw is not None and s.actual_hourly_mw is not None
        ]
        expected_total = len(series)
        return AccuracyEngine.compute_metrics(matched_pairs, expected_observations=expected_total)

    @classmethod
    def get_daily_trends(
        cls,
        db: Session,
        date_from: date,
        date_to: date,
        cutoff_str: Optional[str] = None,
    ) -> List[DailyAccuracyTrend]:
        """Calculate day-by-day accuracy trends over a date range via fast batch range query."""
        series = cls._build_range_match_records(db, date_from, date_to, cutoff_str)
        by_date: Dict[date, List[IntervalMatchRecord]] = {}
        for s in series:
            by_date.setdefault(s.start_time.date(), []).append(s)

        trends: List[DailyAccuracyTrend] = []
        curr_date = date_from
        while curr_date <= date_to:
            day_records = by_date.get(curr_date, [])
            matched_pairs = [
                (r.forecast_mw, r.actual_hourly_mw)
                for r in day_records
                if r.forecast_mw is not None and r.actual_hourly_mw is not None
            ]
            m = AccuracyEngine.compute_metrics(matched_pairs, expected_observations=len(day_records) or 24)
            trends.append(
                DailyAccuracyTrend(
                    delivery_date=curr_date,
                    mae=m.mae,
                    rmse=m.rmse,
                    bias=m.bias,
                    wape=m.wape,
                    matched_count=m.matched_observations,
                    expected_count=len(day_records) or 24,
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
    def get_distribution(
        cls,
        db: Session,
        date_from: date,
        date_to: date,
        cutoff_str: Optional[str] = None,
        bins: int = 10,
    ) -> Dict[str, Any]:
        """Compute error distribution histogram and scatter coordinates across date range via fast batch query."""
        series = cls._build_range_match_records(db, date_from, date_to, cutoff_str)
        errors: List[float] = []
        scatter_points: List[Dict[str, Any]] = []

        for s in series:
            if s.forecast_mw is not None and s.actual_hourly_mw is not None and s.error_mw is not None:
                errors.append(s.error_mw)
                scatter_points.append({
                    "actual": s.actual_hourly_mw,
                    "forecast": s.forecast_mw,
                    "error": s.error_mw,
                    "time": s.start_time,
                })

        hist = AccuracyEngine.compute_histogram(errors, bins=bins)
        return {
            "histogram": hist,
            "scatter": scatter_points[:300],  # Sample limit for responsive rendering
            "total_points": len(errors),
        }

    @classmethod
    def get_worst_intervals(
        cls,
        db: Session,
        date_from: date,
        date_to: date,
        cutoff_str: Optional[str] = None,
        limit: int = 10,
    ) -> List[WorstIntervalRecord]:
        """Find the top N worst absolute forecast errors across the date range via fast batch query."""
        series = cls._build_range_match_records(db, date_from, date_to, cutoff_str)
        return AccuracyEngine.get_worst_intervals(series, limit=limit)

    @classmethod
    def get_data_quality(
        cls,
        db: Session,
        date_from: date,
        date_to: date,
        cutoff_str: Optional[str] = None,
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

        # Distinct forecast intervals targeting this range in database (unfiltered by cutoff)
        forecast_intervals_count = db.execute(
            select(func.count(func.distinct(WindForecast.start_time))).where(
                and_(
                    WindForecast.start_time >= dt_start,
                    WindForecast.start_time < dt_end,
                )
            )
        ).scalar() or 0

        # Fast range calculation for cutoff-eligible forecasts and matches
        series = cls._build_range_match_records(db, date_from, date_to, cutoff_str)
        cutoff_eligible_count = sum(1 for s in series if s.forecast_mw is not None)
        matched_count = sum(1 for s in series if s.status == "matched")

        missing_forecasts = max(0, expected_hourly - forecast_intervals_count)
        missing_cutoff_forecasts = max(0, expected_hourly - cutoff_eligible_count)
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
            cutoff_eligible_forecasts=cutoff_eligible_count,
            missing_cutoff_forecast_intervals=missing_cutoff_forecasts,
            recent_ingestions=formatted_runs,
        )
