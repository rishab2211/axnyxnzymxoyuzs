from datetime import datetime, date, timezone
from sqlalchemy.orm import Session

from app.models.wind_forecast import WindForecast
from app.services.forecast_selector import ForecastSelector


def test_resolve_cutoff_datetime():
    target_date = date(2026, 1, 2)

    # Default cutoff 11:00
    dt_default = ForecastSelector.resolve_cutoff_datetime(target_date)
    assert dt_default == datetime(2026, 1, 2, 11, 0, tzinfo=timezone.utc)

    # Custom cutoff 08:30
    dt_custom = ForecastSelector.resolve_cutoff_datetime(target_date, "08:30")
    assert dt_custom == datetime(2026, 1, 2, 8, 30, tzinfo=timezone.utc)

    # Fallback on invalid string
    dt_invalid = ForecastSelector.resolve_cutoff_datetime(target_date, "invalid")
    assert dt_invalid == datetime(2026, 1, 2, 11, 0, tzinfo=timezone.utc)


def test_forecast_selector_excludes_future_publications(db_session: Session):
    """Critical anti-look-ahead test: publications after decision cutoff must be excluded."""
    start_time = datetime(2026, 1, 2, 14, 0, tzinfo=timezone.utc)
    cutoff_dt = datetime(2026, 1, 2, 11, 0, tzinfo=timezone.utc)

    # Eligible publication 1 (04:30)
    db_session.add(
        WindForecast(
            start_time=start_time,
            publish_time=datetime(2026, 1, 2, 4, 30, tzinfo=timezone.utc),
            generation_mw=9000.0,
        )
    )
    # Eligible publication 2 (09:30) - LATEST ELIGIBLE
    db_session.add(
        WindForecast(
            start_time=start_time,
            publish_time=datetime(2026, 1, 2, 9, 30, tzinfo=timezone.utc),
            generation_mw=9500.0,
        )
    )
    # INELIGIBLE publication 3 (11:30 - published after 11:00 cutoff)
    db_session.add(
        WindForecast(
            start_time=start_time,
            publish_time=datetime(2026, 1, 2, 11, 30, tzinfo=timezone.utc),
            generation_mw=12000.0,
        )
    )
    db_session.commit()

    selected = ForecastSelector.select_vintage_for_interval(
        db=db_session,
        start_time=start_time,
        cutoff_dt=cutoff_dt,
    )

    assert selected is not None
    # Must select 09:30 (9500 MW), NOT 11:30 (12000 MW)
    assert selected.generation_mw == 9500.0
    assert selected.publish_time == datetime(2026, 1, 2, 9, 30, tzinfo=timezone.utc)


def test_forecast_selector_returns_none_if_no_eligible_vintage(db_session: Session):
    """When no publication exists on or before cutoff, return None (never zero)."""
    start_time = datetime(2026, 1, 2, 14, 0, tzinfo=timezone.utc)
    cutoff_dt = datetime(2026, 1, 2, 11, 0, tzinfo=timezone.utc)

    # Only one forecast exists, published after cutoff
    db_session.add(
        WindForecast(
            start_time=start_time,
            publish_time=datetime(2026, 1, 2, 15, 30, tzinfo=timezone.utc),
            generation_mw=10000.0,
        )
    )
    db_session.commit()

    selected = ForecastSelector.select_vintage_for_interval(
        db=db_session,
        start_time=start_time,
        cutoff_dt=cutoff_dt,
    )

    assert selected is None
