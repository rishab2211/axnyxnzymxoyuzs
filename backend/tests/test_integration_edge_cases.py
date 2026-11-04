import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import ActualGeneration, WindForecast, ActualGenerationHourly


def seed_multi_vintage_test_data(db: Session):
    """Seed multiple forecast publications and actuals for interval 2026-01-02 14:00 UTC."""
    delivery_interval = datetime(2026, 1, 2, 14, 0, tzinfo=timezone.utc)
    target_date = delivery_interval.date()

    # Seed 3 distinct publications for the same 14:00 delivery interval:
    # 1. Published early morning at 04:30
    # 2. Published morning at 09:30
    # 3. Published midday at 11:30
    # 4. Published afternoon at 15:30 (post-delivery, should never be selected)
    vintages = [
        WindForecast(
            start_time=delivery_interval,
            publish_time=datetime(2026, 1, 2, 4, 30, tzinfo=timezone.utc),
            generation_mw=9000.0,
        ),
        WindForecast(
            start_time=delivery_interval,
            publish_time=datetime(2026, 1, 2, 9, 30, tzinfo=timezone.utc),
            generation_mw=9500.0,
        ),
        WindForecast(
            start_time=delivery_interval,
            publish_time=datetime(2026, 1, 2, 11, 30, tzinfo=timezone.utc),
            generation_mw=10200.0,
        ),
        WindForecast(
            start_time=delivery_interval,
            publish_time=datetime(2026, 1, 2, 15, 30, tzinfo=timezone.utc),
            generation_mw=11000.0,
        ),
    ]
    for v in vintages:
        db.add(v)

    # Add hourly aggregated actual
    hourly_actual = ActualGenerationHourly(
        hour_start_time=delivery_interval,
        generation_mw=9800.0,
        sp_count=2,
    )
    db.add(hourly_actual)

    # Add an interval with actual outturn <= 1.0 MW to test MAPE zero-exclusion
    zero_delivery = datetime(2026, 1, 2, 15, 0, tzinfo=timezone.utc)
    db.add(
        WindForecast(
            start_time=zero_delivery,
            publish_time=datetime(2026, 1, 2, 9, 30, tzinfo=timezone.utc),
            generation_mw=50.0,
        )
    )
    db.add(
        ActualGenerationHourly(
            hour_start_time=zero_delivery,
            generation_mw=0.5,  # <= 1.0 MW near-zero actual
            sp_count=2,
        )
    )

    # Add an interval with missing actual (forecast available, no actual)
    missing_act_interval = datetime(2026, 1, 2, 16, 0, tzinfo=timezone.utc)
    db.add(
        WindForecast(
            start_time=missing_act_interval,
            publish_time=datetime(2026, 1, 2, 9, 30, tzinfo=timezone.utc),
            generation_mw=8000.0,
        )
    )

    # Add an interval with missing forecast (actual available, no forecast)
    missing_fc_interval = datetime(2026, 1, 2, 17, 0, tzinfo=timezone.utc)
    db.add(
        ActualGenerationHourly(
            hour_start_time=missing_fc_interval,
            generation_mw=7500.0,
            sp_count=2,
        )
    )

    db.commit()


def test_decision_cutoff_enforcement_dynamically_selects_correct_vintage(client: TestClient, db_session: Session):
    """Verify that different decision cutoffs dynamically select the latest eligible vintage."""
    seed_multi_vintage_test_data(db_session)

    # 1. With cutoff = 09:00 -> Only 04:30 publication is eligible (9000 MW)
    res_0900 = client.get("/api/forecasts?delivery_date=2026-01-02&decision_cutoff=09:00")
    assert res_0900.status_code == 200
    interval_14 = next(x for x in res_0900.json() if "14:00:00" in x["start_time"])
    assert interval_14["forecast_mw"] == 9000.0
    assert "04:30" in interval_14["forecast_publish_time"]

    # 2. With cutoff = 11:00 (default) -> 09:30 publication is eligible (9500 MW), 11:30 is NOT
    res_1100 = client.get("/api/forecasts?delivery_date=2026-01-02&decision_cutoff=11:00")
    assert res_1100.status_code == 200
    interval_14 = next(x for x in res_1100.json() if "14:00:00" in x["start_time"])
    assert interval_14["forecast_mw"] == 9500.0
    assert "09:30" in interval_14["forecast_publish_time"]

    # 3. With cutoff = 12:00 -> 11:30 publication is eligible (10200 MW)
    res_1200 = client.get("/api/forecasts?delivery_date=2026-01-02&decision_cutoff=12:00")
    assert res_1200.status_code == 200
    interval_14 = next(x for x in res_1200.json() if "14:00:00" in x["start_time"])
    assert interval_14["forecast_mw"] == 10200.0
    assert "11:30" in interval_14["forecast_publish_time"]

    # 4. With cutoff = 04:00 (before earliest publication) -> No forecast eligible, returns null
    res_0400 = client.get("/api/forecasts?delivery_date=2026-01-02&decision_cutoff=04:00")
    assert res_0400.status_code == 200
    interval_14 = next(x for x in res_0400.json() if "14:00:00" in x["start_time"])
    assert interval_14["forecast_mw"] is None
    assert interval_14["status"] == "missing_forecast"


def test_missing_data_returns_null_not_zero(client: TestClient, db_session: Session):
    """Verify that intervals with missing forecast or missing actual return null values and correct status."""
    seed_multi_vintage_test_data(db_session)

    res = client.get("/api/forecasts?delivery_date=2026-01-02&decision_cutoff=11:00")
    assert res.status_code == 200
    data = res.json()

    # Interval 16:00 has forecast but missing actual
    int_16 = next(x for x in data if "16:00:00" in x["start_time"])
    assert int_16["forecast_mw"] == 8000.0
    assert int_16["actual_hourly_mw"] is None
    assert int_16["error_mw"] is None
    assert int_16["status"] == "missing_actual"

    # Interval 17:00 has actual but missing forecast
    int_17 = next(x for x in data if "17:00:00" in x["start_time"])
    assert int_17["forecast_mw"] is None
    assert int_17["actual_hourly_mw"] == 7500.0
    assert int_17["error_mw"] is None
    assert int_17["status"] == "missing_forecast"


def test_zero_denominator_mape_exclusion(client: TestClient, db_session: Session):
    """Verify that actual <= 1.0 MW is safely excluded from MAPE and tracked in mape_excluded_count."""
    seed_multi_vintage_test_data(db_session)

    res = client.get("/api/accuracy/summary?date_from=2026-01-02&date_to=2026-01-02&decision_cutoff=11:00")
    assert res.status_code == 200
    metrics = res.json()

    # Matched observations include interval 14:00 (actual=9800) and interval 15:00 (actual=0.5)
    assert metrics["matched_observations"] == 2
    # 15:00 is excluded from MAPE because actual <= 1.0 MW
    assert metrics["mape_excluded_count"] == 1
    assert metrics["mape"] is not None


def test_invalid_parameter_validations_return_422(client: TestClient):
    """Verify that all endpoints validate query parameter bounds and schemas."""
    # 1. Invalid date_from > date_to
    res1 = client.get("/api/accuracy/summary?date_from=2026-01-20&date_to=2026-01-10")
    assert res1.status_code == 422

    # 2. Invalid date format string
    res2 = client.get("/api/dashboard?delivery_date=not-a-date")
    assert res2.status_code == 422

    # 3. Invalid bins in distribution (< 5 or > 30)
    res3 = client.get("/api/accuracy/distribution?bins=2")
    assert res3.status_code == 422
    res4 = client.get("/api/accuracy/distribution?bins=50")
    assert res4.status_code == 422

    # 4. Invalid limit in worst intervals (< 1 or > 50)
    res5 = client.get("/api/accuracy/worst?limit=0")
    assert res5.status_code == 422
    res6 = client.get("/api/accuracy/worst?limit=100")
    assert res6.status_code == 422


def test_openapi_schema_endpoint(client: TestClient):
    """Verify OpenAPI 3.1 documentation schema is generated and contains all routes."""
    res = client.get("/openapi.json")
    assert res.status_code == 200
    schema = res.json()
    assert "paths" in schema
    assert "/api/dashboard" in schema["paths"]
    assert "/api/forecasts" in schema["paths"]
    assert "/api/forecasts/vintages" in schema["paths"]
    assert "/api/accuracy/summary" in schema["paths"]
    assert "/api/accuracy/trend" in schema["paths"]
    assert "/api/accuracy/distribution" in schema["paths"]
    assert "/api/accuracy/worst" in schema["paths"]
    assert "/api/data-quality" in schema["paths"]
    assert "/api/health" in schema["paths"]
    assert "/api/ingest" in schema["paths"]
