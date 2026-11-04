import pytest
from datetime import datetime, date, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.services.ingestion import IngestionService
from app.services.elexon_client import ElexonClient
from app.models.actual_generation import ActualGeneration
from app.models.wind_forecast import WindForecast
from app.models.actual_hourly import ActualGenerationHourly
from app.models.ingestion_run import IngestionRun


@pytest.mark.asyncio
async def test_fuelhh_ingestion_and_idempotency(db_session: Session, monkeypatch):
    mock_fuelhh = [
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-01T00:30:00Z",
            "startTime": "2026-01-01T00:00:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 1,
            "fuelType": "WIND",
            "generation": 10000,
        },
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-01T01:00:00Z",
            "startTime": "2026-01-01T00:30:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 2,
            "fuelType": "WIND",
            "generation": 12000,
        },
    ]

    async def mock_fetch_fuelhh(self, date_from, date_to, fuel_type="WIND"):
        return mock_fuelhh

    monkeypatch.setattr(ElexonClient, "fetch_fuelhh", mock_fetch_fuelhh)

    service = IngestionService()

    # First run
    run1 = await service.ingest_fuelhh(db_session, date(2026, 1, 1), date(2026, 1, 1))
    assert run1.status == "success"
    assert run1.records_received == 2

    # Verify database rows
    actuals = db_session.query(ActualGeneration).all()
    assert len(actuals) == 2

    hourly = db_session.query(ActualGenerationHourly).all()
    assert len(hourly) == 1
    assert hourly[0].generation_mw == 11000.0

    # Second run (idempotency test: should not duplicate records)
    run2 = await service.ingest_fuelhh(db_session, date(2026, 1, 1), date(2026, 1, 1))
    assert run2.status == "success"

    actuals_after = db_session.query(ActualGeneration).all()
    assert len(actuals_after) == 2  # Still 2 records!


@pytest.mark.asyncio
async def test_windfor_ingestion_and_vintages(db_session: Session, monkeypatch):
    mock_windfor = [
        {"dataset": "WINDFOR", "publishTime": "2025-12-31T02:30:00Z", "startTime": "2026-01-01T00:00:00Z", "generation": 9500},
        {"dataset": "WINDFOR", "publishTime": "2025-12-31T09:30:00Z", "startTime": "2026-01-01T00:00:00Z", "generation": 10500},
    ]

    async def mock_fetch_windfor(self, p_from, p_to, chunk_days=7):
        return mock_windfor

    monkeypatch.setattr(ElexonClient, "fetch_windfor_chunked", mock_fetch_windfor)

    service = IngestionService()
    run = await service.ingest_windfor(db_session)
    assert run.status == "success"
    assert run.records_received == 2

    forecasts = db_session.query(WindForecast).all()
    assert len(forecasts) == 2


def test_ingest_api_endpoint(client: TestClient, monkeypatch):
    async def mock_ingest_fuelhh(self, db, date_from=None, date_to=None):
        return IngestionRun(
            id=101,
            dataset="FUELHH",
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
            status="success",
            records_received=48,
            records_inserted=48,
            records_updated=0,
            records_rejected=0,
        )

    monkeypatch.setattr(IngestionService, "ingest_fuelhh", mock_ingest_fuelhh)

    payload = {
        "dataset": "FUELHH",
        "start_date": "2026-01-01",
        "end_date": "2026-01-01",
        "force_reload": False,
    }

    response = client.post("/api/ingest", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(data["runs"]) == 1
    assert data["runs"][0]["dataset"] == "FUELHH"
    assert data["runs"][0]["records_received"] == 48


def test_ingest_api_invalid_dataset(client: TestClient):
    payload = {"dataset": "SOLAR"}
    response = client.post("/api/ingest", json=payload)
    assert response.status_code == 422
