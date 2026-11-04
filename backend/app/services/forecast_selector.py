from datetime import datetime, date, time, timezone
from typing import Optional, Dict, List
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, desc

from app.models.wind_forecast import WindForecast
from app.core.config import settings
from app.core.logging import logger


class ForecastSelector:
    """
    Selects the eligible forecast vintage available at a historical decision cutoff.
    Enforces the core rule: never use a forecast published after the decision cutoff (prevents look-ahead bias).
    """

    @staticmethod
    def resolve_cutoff_datetime(delivery_date: date, cutoff_str: Optional[str] = None) -> datetime:
        """
        Construct a UTC-aware datetime for the decision cutoff on the given delivery date.
        Format: 'HH:MM' (e.g. '11:00'). Defaults to settings.DEFAULT_DECISION_CUTOFF.
        """
        raw = (cutoff_str or settings.DEFAULT_DECISION_CUTOFF).strip()
        try:
            parts = raw.split(":")
            hour = int(parts[0])
            minute = int(parts[1]) if len(parts) > 1 else 0
            if not (0 <= hour <= 23 and 0 <= minute <= 59):
                raise ValueError("Hour must be 0-23, minute 0-59")
            cutoff_t = time(hour=hour, minute=minute)
        except Exception as exc:
            logger.warning(f"Invalid cutoff string '{raw}': {exc}. Falling back to 11:00 UTC.")
            cutoff_t = time(11, 0)

        return datetime.combine(delivery_date, cutoff_t, tzinfo=timezone.utc)

    @classmethod
    def select_vintage_for_interval(
        cls,
        db: Session,
        start_time: datetime,
        cutoff_dt: datetime,
    ) -> Optional[WindForecast]:
        """
        Select the latest forecast for a specific delivery interval published on or before cutoff_dt.
        Returns None if no eligible forecast exists (never coerces to 0).
        """
        stmt = (
            select(WindForecast)
            .where(
                and_(
                    WindForecast.start_time == start_time,
                    WindForecast.publish_time <= cutoff_dt,
                )
            )
            .order_by(desc(WindForecast.publish_time))
            .limit(1)
        )
        return db.execute(stmt).scalar_one_or_none()

    @classmethod
    def select_vintages_for_delivery_date(
        cls,
        db: Session,
        delivery_date: date,
        cutoff_str: Optional[str] = None,
    ) -> Dict[datetime, Optional[WindForecast]]:
        """
        For each of the 24 hourly delivery intervals of the delivery date:
        Select the latest eligible forecast published on or before cutoff_datetime.
        Returns a dict mapping: interval_start_time -> Optional[WindForecast]
        """
        cutoff_dt = cls.resolve_cutoff_datetime(delivery_date, cutoff_str)

        # Expected 24 hourly intervals for the date in UTC
        start_dt = datetime.combine(delivery_date, time(0, 0), tzinfo=timezone.utc)
        end_dt = datetime.combine(delivery_date, time(23, 59, 59), tzinfo=timezone.utc)

        # Fetch all forecasts targeting this delivery date that were published <= cutoff_dt
        stmt = (
            select(WindForecast)
            .where(
                and_(
                    WindForecast.start_time >= start_dt,
                    WindForecast.start_time <= end_dt,
                    WindForecast.publish_time <= cutoff_dt,
                )
            )
            .order_by(WindForecast.start_time.asc(), desc(WindForecast.publish_time))
        )
        candidates = db.execute(stmt).scalars().all()

        # Group by start_time and pick the first (which has max publish_time due to desc ordering)
        selected_map: Dict[datetime, Optional[WindForecast]] = {}
        for c in candidates:
            if c.start_time not in selected_map:
                selected_map[c.start_time] = c

        # Ensure all 24 expected hourly intervals exist in output (None if missing)
        result: Dict[datetime, Optional[WindForecast]] = {}
        current_dt = start_dt
        while current_dt <= end_dt:
            result[current_dt] = selected_map.get(current_dt, None)
            from datetime import timedelta
            current_dt += timedelta(hours=1)

        return result

    @classmethod
    def get_all_vintages_for_date(
        cls,
        db: Session,
        delivery_date: date,
    ) -> Dict[datetime, List[WindForecast]]:
        """
        Retrieve all forecast publication vintages for all delivery intervals on delivery_date.
        Used to analyze forecast evolution over time as new publications arrive.
        """
        start_dt = datetime.combine(delivery_date, time(0, 0), tzinfo=timezone.utc)
        end_dt = datetime.combine(delivery_date, time(23, 59, 59), tzinfo=timezone.utc)

        stmt = (
            select(WindForecast)
            .where(
                and_(
                    WindForecast.start_time >= start_dt,
                    WindForecast.start_time <= end_dt,
                )
            )
            .order_by(WindForecast.start_time.asc(), WindForecast.publish_time.asc())
        )
        records = db.execute(stmt).scalars().all()

        grouped: Dict[datetime, List[WindForecast]] = {}
        for r in records:
            if r.start_time not in grouped:
                grouped[r.start_time] = []
            grouped[r.start_time].append(r)

        return grouped
