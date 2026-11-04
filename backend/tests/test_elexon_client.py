import pytest
import httpx
from datetime import datetime, date, timezone
from app.services.elexon_client import ElexonClient, ElexonAPIError


@pytest.mark.asyncio
async def test_elexon_client_success(monkeypatch):
    mock_data = [
        {"dataset": "FUELHH", "startTime": "2026-01-01T00:00:00Z", "publishTime": "2026-01-01T00:30:00Z", "fuelType": "WIND", "generation": 10000}
    ]

    async def mock_get(self, url, params=None, timeout=None):
        return httpx.Response(200, json=mock_data)

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    client = ElexonClient()
    result = await client.fetch_fuelhh(date(2026, 1, 1), date(2026, 1, 1))

    assert len(result) == 1
    assert result[0]["fuelType"] == "WIND"


@pytest.mark.asyncio
async def test_elexon_client_retries_on_500(monkeypatch):
    call_count = 0

    async def mock_get(self, url, params=None, timeout=None):
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            return httpx.Response(500, text="Internal Elexon Error")
        return httpx.Response(200, json=[{"status": "recovered"}])

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    client = ElexonClient(max_retries=3, backoff_factor=0.01)
    result = await client.fetch_fuelhh(date(2026, 1, 1), date(2026, 1, 1))

    assert call_count == 3
    assert result == [{"status": "recovered"}]


@pytest.mark.asyncio
async def test_elexon_client_exhausts_retries(monkeypatch):
    async def mock_get(self, url, params=None, timeout=None):
        return httpx.Response(503, text="Service Unavailable")

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    client = ElexonClient(max_retries=2, backoff_factor=0.01)
    with pytest.raises(ElexonAPIError) as exc_info:
        await client.fetch_fuelhh(date(2026, 1, 1), date(2026, 1, 1))

    assert exc_info.value.status_code == 503


@pytest.mark.asyncio
async def test_elexon_client_chunked_windfor(monkeypatch):
    requested_ranges = []

    async def mock_get(self, url, params=None, timeout=None):
        requested_ranges.append((params["publishDateTimeFrom"], params["publishDateTimeTo"]))
        return httpx.Response(200, json=[{"dataset": "WINDFOR"}])

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    client = ElexonClient()
    p_from = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    p_to = datetime(2026, 1, 15, 0, 0, tzinfo=timezone.utc)

    records = await client.fetch_windfor_chunked(p_from, p_to, chunk_days=7)

    # 14 days with 7-day chunking = 2 chunks
    assert len(requested_ranges) == 2
    assert requested_ranges[0] == ("2026-01-01T00:00:00Z", "2026-01-08T00:00:00Z")
    assert requested_ranges[1] == ("2026-01-08T00:00:00Z", "2026-01-15T00:00:00Z")
    assert len(records) == 2
