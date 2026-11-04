from datetime import datetime, date, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.models.ingestion_run import IngestionRun
from app.services.elexon_client import ElexonClient
from app.services.data_processor import DataProcessor
from app.repositories.generation_repo import GenerationRepository
from app.repositories.forecast_repo import ForecastRepository
from app.repositories.ingestion_repo import IngestionRepository


class IngestionService:
    """Orchestrates end-to-end ingestion, validation, normalization, and persistence."""

    def __init__(
        self,
        elexon_client: Optional[ElexonClient] = None,
        data_processor: Optional[DataProcessor] = None,
    ):
        self.client = elexon_client or ElexonClient()
        self.processor = data_processor or DataProcessor()

    async def ingest_fuelhh(
        self,
        db: Session,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> IngestionRun:
        """Fetch, validate, and store actual FUELHH wind generation records and hourly aggregates."""
        d_from = date_from or date.fromisoformat(settings.EVALUATION_START_DATE)
        d_to = date_to or date.fromisoformat(settings.EVALUATION_END_DATE)

        dt_from = datetime.combine(d_from, datetime.min.time(), tzinfo=timezone.utc)
        dt_to = datetime.combine(d_to, datetime.max.time(), tzinfo=timezone.utc)

        run = IngestionRepository.create_run(
            db=db,
            dataset="FUELHH",
            requested_from=dt_from,
            requested_to=dt_to,
            parameters={"date_from": d_from.isoformat(), "date_to": d_to.isoformat(), "fuel_type": "WIND"},
        )

        try:
            logger.info(f"Starting FUELHH ingestion for {d_from} to {d_to}")
            raw_records = await self.client.fetch_fuelhh(d_from, d_to, fuel_type="WIND")
            validated, stats = self.processor.process_fuelhh(raw_records)

            # Persist raw 30-min actuals
            inserted_30m, updated_30m = GenerationRepository.upsert_actuals(db, validated)

            # Aggregate and persist hourly actuals
            hourly_records = self.processor.aggregate_hourly_actuals(validated)
            inserted_h, updated_h = GenerationRepository.upsert_hourly_actuals(db, hourly_records)

            logger.info(
                f"FUELHH ingestion completed: {stats['validated']} validated, "
                f"{inserted_30m} 30m inserted, {len(hourly_records)} hourly aggregates created."
            )

            completed_run = IngestionRepository.complete_run(
                db=db,
                run_id=run.id,
                status="success",
                records_received=stats["received"],
                records_inserted=inserted_30m,
                records_updated=updated_30m,
                records_rejected=stats["rejected"],
            )
            return completed_run

        except Exception as exc:
            logger.error(f"FUELHH ingestion failed: {exc}", exc_info=True)
            completed_run = IngestionRepository.complete_run(
                db=db,
                run_id=run.id,
                status="failed",
                error_message=str(exc),
            )
            return completed_run

    async def ingest_windfor(
        self,
        db: Session,
        publish_from: Optional[datetime] = None,
        publish_to: Optional[datetime] = None,
    ) -> IngestionRun:
        """Fetch, validate, and store WINDFOR forecast publication records."""
        # Include publications from Dec 30, 2025 to cover early Jan 1 delivery
        p_from = publish_from or datetime(2025, 12, 30, 0, 0, tzinfo=timezone.utc)
        p_to = publish_to or datetime(2026, 2, 1, 0, 0, tzinfo=timezone.utc)

        run = IngestionRepository.create_run(
            db=db,
            dataset="WINDFOR",
            requested_from=p_from,
            requested_to=p_to,
            parameters={"publish_from": p_from.isoformat(), "publish_to": p_to.isoformat()},
        )

        try:
            logger.info(f"Starting WINDFOR ingestion for publications {p_from} to {p_to}")
            raw_records = await self.client.fetch_windfor_chunked(p_from, p_to, chunk_days=7)
            validated, stats = self.processor.process_windfor(raw_records)

            # Persist forecast publications
            inserted, updated = ForecastRepository.upsert_forecasts(db, validated)

            logger.info(
                f"WINDFOR ingestion completed: {stats['validated']} validated, "
                f"{inserted} inserted, {updated} updated."
            )

            completed_run = IngestionRepository.complete_run(
                db=db,
                run_id=run.id,
                status="success",
                records_received=stats["received"],
                records_inserted=inserted,
                records_updated=updated,
                records_rejected=stats["rejected"],
            )
            return completed_run

        except Exception as exc:
            logger.error(f"WINDFOR ingestion failed: {exc}", exc_info=True)
            completed_run = IngestionRepository.complete_run(
                db=db,
                run_id=run.id,
                status="failed",
                error_message=str(exc),
            )
            return completed_run

    async def ingest_all(
        self,
        db: Session,
        force_reload: bool = False,
    ) -> List[IngestionRun]:
        """Ingest both FUELHH and WINDFOR datasets sequentially."""
        runs: List[IngestionRun] = []
        fuel_run = await self.ingest_fuelhh(db)
        runs.append(fuel_run)

        wind_run = await self.ingest_windfor(db)
        runs.append(wind_run)

        return runs
