import asyncio
import random
from datetime import datetime, date, timedelta, timezone
from typing import List, Dict, Any, Optional
import httpx

from app.core.config import settings
from app.core.logging import logger


class ElexonAPIError(Exception):
    """Raised when an unrecoverable Elexon BMRS API error occurs."""
    def __init__(self, message: str, status_code: Optional[int] = None, response_text: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_text = response_text


class ElexonClient:
    """Async client for fetching datasets from Elexon BMRS API with resilient retries and chunking."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        max_retries: Optional[int] = None,
        backoff_factor: Optional[float] = None,
    ):
        self.base_url = (base_url or settings.ELEXON_API_BASE_URL).rstrip("/")
        self.timeout = timeout or settings.ELEXON_REQUEST_TIMEOUT_SECONDS
        self.max_retries = max_retries or settings.ELEXON_MAX_RETRIES
        self.backoff_factor = backoff_factor or settings.ELEXON_BACKOFF_FACTOR

    async def _execute_with_retry(
        self,
        client: httpx.AsyncClient,
        endpoint: str,
        params: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        url = f"{self.base_url}{endpoint}"
        total_attempts = self.max_retries + 1

        for attempt in range(1, total_attempts + 1):
            start_time = asyncio.get_event_loop().time()
            try:
                logger.info(f"Elexon API request: GET {endpoint} (params={params}, attempt={attempt}/{total_attempts})")
                response = await client.get(url, params=params, timeout=self.timeout)
                duration = asyncio.get_event_loop().time() - start_time

                # 429 Rate limit handling
                if response.status_code == 429:
                    if attempt >= total_attempts:
                        raise ElexonAPIError(
                            "Elexon API rate limit exceeded after maximum retries.",
                            status_code=429,
                            response_text=response.text,
                        )
                    retry_after = float(response.headers.get("Retry-After", 2.0))
                    jitter = random.uniform(0.1, 0.5)
                    wait_time = retry_after + jitter
                    logger.warning(
                        f"Elexon rate limit (429) hit. Backing off for {wait_time:.2f}s (attempt {attempt}/{total_attempts})"
                    )
                    await asyncio.sleep(wait_time)
                    continue

                # 5xx Server errors
                if response.status_code >= 500:
                    if attempt >= total_attempts:
                        raise ElexonAPIError(
                            f"Elexon API server error {response.status_code} after max retries.",
                            status_code=response.status_code,
                            response_text=response.text,
                        )
                    delay = (self.backoff_factor ** attempt) + random.uniform(0.1, 0.5)
                    logger.warning(
                        f"Elexon server error ({response.status_code}) on {endpoint}. "
                        f"Retrying in {delay:.2f}s (attempt {attempt}/{total_attempts})"
                    )
                    await asyncio.sleep(delay)
                    continue

                # 4xx Client errors (other than 429)
                if response.status_code >= 400:
                    raise ElexonAPIError(
                        f"Elexon API client error {response.status_code}: {response.text}",
                        status_code=response.status_code,
                        response_text=response.text,
                    )

                # Successful parse
                payload = response.json()
                if isinstance(payload, list):
                    records = payload
                elif isinstance(payload, dict):
                    records = payload.get("data", payload.get("items", []))
                else:
                    records = []

                logger.info(
                    f"Elexon API success: {endpoint} returned {len(records)} records in {duration:.2f}s"
                )
                return records

            except (httpx.TimeoutException, httpx.NetworkError) as net_err:
                duration = asyncio.get_event_loop().time() - start_time
                if attempt >= total_attempts:
                    raise ElexonAPIError(
                        f"Elexon API network error after {self.max_retries} retries: {net_err}"
                    ) from net_err
                delay = (self.backoff_factor ** attempt) + random.uniform(0.2, 0.8)
                logger.warning(
                    f"Elexon network error ({type(net_err).__name__}) after {duration:.2f}s on {endpoint}. "
                    f"Retrying in {delay:.2f}s (attempt {attempt}/{total_attempts})"
                )
                await asyncio.sleep(delay)

        raise ElexonAPIError(f"Failed to fetch {endpoint} after {self.max_retries} retries.")

    async def fetch_fuelhh(
        self,
        date_from: date,
        date_to: date,
        fuel_type: str = "WIND",
    ) -> List[Dict[str, Any]]:
        """Fetch actual generation outturn from FUELHH/stream for a settlement date window."""
        params = {
            "settlementDateFrom": date_from.isoformat(),
            "settlementDateTo": date_to.isoformat(),
            "fuelType": fuel_type,
        }
        async with httpx.AsyncClient() as client:
            return await self._execute_with_retry(client, "/datasets/FUELHH/stream", params)

    async def fetch_windfor(
        self,
        publish_from: Union[datetime, date],
        publish_to: Union[datetime, date],
    ) -> List[Dict[str, Any]]:
        """Fetch wind generation forecast publications from WINDFOR/stream for a publication window."""
        if isinstance(publish_from, datetime):
            p_from_dt = publish_from.astimezone(timezone.utc) if publish_from.tzinfo else publish_from.replace(tzinfo=timezone.utc)
        else:
            p_from_dt = datetime.combine(publish_from, datetime.min.time(), tzinfo=timezone.utc)

        if isinstance(publish_to, datetime):
            p_to_dt = publish_to.astimezone(timezone.utc) if publish_to.tzinfo else publish_to.replace(tzinfo=timezone.utc)
        else:
            p_to_dt = datetime.combine(publish_to, datetime.max.time(), tzinfo=timezone.utc)

        p_from_str = p_from_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        p_to_str = p_to_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        params = {
            "publishDateTimeFrom": p_from_str,
            "publishDateTimeTo": p_to_str,
        }
        async with httpx.AsyncClient() as client:
            return await self._execute_with_retry(client, "/datasets/WINDFOR/stream", params)

    async def fetch_windfor_chunked(
        self,
        publish_from: datetime,
        publish_to: datetime,
        chunk_days: int = 7,
    ) -> List[Dict[str, Any]]:
        """
        Fetch wind forecasts across a wide range by dividing it into sequential chunks.
        Prevents gateway timeouts on large historical payloads (~18k records).
        """
        all_records: List[Dict[str, Any]] = []
        current_from = publish_from

        async with httpx.AsyncClient() as client:
            while current_from < publish_to:
                current_to = min(current_from + timedelta(days=chunk_days), publish_to)
                p_from_str = current_from.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                p_to_str = current_to.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                params = {
                    "publishDateTimeFrom": p_from_str,
                    "publishDateTimeTo": p_to_str,
                }
                logger.info(f"Fetching WINDFOR chunk: {p_from_str} -> {p_to_str}")
                chunk_records = await self._execute_with_retry(client, "/datasets/WINDFOR/stream", params)
                all_records.extend(chunk_records)
                current_from = current_to

        return all_records
