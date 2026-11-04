from datetime import datetime, date, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.actual_generation import ActualGeneration
from app.models.actual_hourly import ActualGenerationHourly
from app.models.wind_forecast import WindForecast


def seed_test_data(db: Session):
    """Seed test data for Jan 1, 2026."""
    # Add two 30-min actuals for Hour 00:00 (SP1 and SP2)
    db.add(
        ActualGeneration(
            start_time=datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc),
            publish_time=datetime(2026, 1, 1, 0, 30, tzinfo=timezone.utc),
            settlement_date=date(2026, 1, 1),
            settlement_period=1,
            fuel_type="WIND",
            generation_mw=10000.0,
            source_dataset="FUELHH",
        )
    )
    db.add(
        ActualGeneration(
            start_time=datetime(2026, 1, 1, 0, 30, tzinfo=timezone.utc),
            publish_time=datetime(2026, 1, 1, 1, 0, tzinfo=timezone.utc),
            settlement_date=date(2026, 1, 1),
            settlement_period=2,
            fuel_type="WIND",
            generation_mw=12000.0,
            source_dataset="FUELHH",
        )
    )

    # Add hourly actual for Hour 00:00 (mean = 11000 MW)
    db.add(
        ActualGenerationHourly(
            hour_start_time=datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc),
            generation_mw=11000.0,
            sp_count=2,
        )
    )

    # Add eligible forecast for Hour 00:00 published on Dec 31 11:30 (before cutoff)
    db.add(
        WindForecast(
            start_time=datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc),
            publish_time=datetime(2025, 12, 31, 11, 30, tzinfo=timezone.utc),
            generation_mw=11500.0,
            source_dataset="WINDFOR",
        )
    )
    # Add another vintage published at 09:30 (earlier)
    db.add(
        WindForecast(
            start_time=datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc),
            publish_time=datetime(2025, 12, 31, 9, 30, tzinfo=timezone.utc),
            generation_mw=10800.0,
            source_dataset="WINDFOR",
        )
    )
    db.commit()


def test_dashboard_endpoint(client: TestClient, db_session: Session):
    seed_test_data(db_session)

    response = client.get("/api/dashboard?delivery_date=2026-01-01&decision_cutoff=11:00")
    assert response.status_code == 200
    data = response.json()

    assert data["delivery_date"] == "2026-01-01"
    assert data["decision_cutoff"] == "11:00"
    assert data["metrics"]["matched_observations"] == 1
    # Error for 00:00 = 11500 (forecast) - 11000 (actual) = +500 MW (overforecast)
    assert data["metrics"]["mae"] == 500.0
    assert data["metrics"]["bias"] == 500.0
    assert data["overforecast_count"] == 1

    # Series verification
    assert len(data["series"]) == 24
    hour_0 = data["series"][0]
    assert hour_0["status"] == "matched"
    assert hour_0["forecast_mw"] == 11500.0
    assert hour_0["actual_hourly_mw"] == 11000.0
    assert hour_0["error_mw"] == 500.0

    # Raw 30m series verification (dual granularity context)
    assert len(data["actual_30m_series"]) == 2
    assert data["actual_30m_series"][0]["settlement_period"] == 1
    assert data["actual_30m_series"][0]["generation_mw"] == 10000.0


def test_forecasts_endpoint(client: TestClient, db_session: Session):
    seed_test_data(db_session)
    response = client.get("/api/forecasts?delivery_date=2026-01-01")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 24


def test_forecast_vintages_endpoint(client: TestClient, db_session: Session):
    seed_test_data(db_session)
    response = client.get("/api/forecasts/vintages?delivery_date=2026-01-01")
    assert response.status_code == 200
    data = response.json()
    assert data["delivery_date"] == "2026-01-01"
    assert len(data["intervals"]) == 24
    # Hour 0 has 2 vintages
    assert len(data["intervals"][0]["vintages"]) == 2


def test_accuracy_summary_endpoint(client: TestClient, db_session: Session):
    seed_test_data(db_session)
    response = client.get("/api/accuracy/summary?date_from=2026-01-01&date_to=2026-01-01")
    assert response.status_code == 200
    data = response.json()
    assert data["matched_observations"] == 1
    assert data["mae"] == 500.0


def test_accuracy_trend_endpoint(client: TestClient, db_session: Session):
    seed_test_data(db_session)
    response = client.get("/api/accuracy/trend?date_from=2026-01-01&date_to=2026-01-02")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["delivery_date"] == "2026-01-01"
    assert data[0]["matched_count"] == 1


def test_data_quality_endpoint(client: TestClient, db_session: Session):
    seed_test_data(db_session)
    response = client.get("/api/data-quality?date_from=2026-01-01&date_to=2026-01-01")
    assert response.status_code == 200
    data = response.json()
    assert data["expected_30m_intervals"] == 48
    assert data["actual_30m_records"] == 2
    assert data["expected_hourly_intervals"] == 24
    assert data["matched_intervals"] == 1


def test_invalid_date_range_returns_422(client: TestClient):
    # date_from after date_to
    response = client.get("/api/accuracy/summary?date_from=2026-01-05&date_to=2026-01-01")
    assert response.status_code == 422
