from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import select, desc

from app.models.ingestion_run import IngestionRun


class IngestionRepository:
    """Repository for auditing ingestion runs and operational metadata."""

    @staticmethod
    def create_run(
        db: Session,
        dataset: str,
        requested_from: Optional[datetime] = None,
        requested_to: Optional[datetime] = None,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> IngestionRun:
        run = IngestionRun(
            dataset=dataset,
            requested_from=requested_from,
            requested_to=requested_to,
            started_at=datetime.now(timezone.utc),
            status="running",
            records_received=0,
            records_inserted=0,
            records_updated=0,
            records_rejected=0,
            parameters=parameters,
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        return run

    @staticmethod
    def complete_run(
        db: Session,
        run_id: int,
        status: str,
        records_received: int = 0,
        records_inserted: int = 0,
        records_updated: int = 0,
        records_rejected: int = 0,
        error_message: Optional[str] = None,
    ) -> IngestionRun:
        run = db.get(IngestionRun, run_id)
        if run:
            run.status = status
            run.completed_at = datetime.now(timezone.utc)
            run.records_received = records_received
            run.records_inserted = records_inserted
            run.records_updated = records_updated
            run.records_rejected = records_rejected
            run.error_message = error_message
            db.commit()
            db.refresh(run)
        return run

    @staticmethod
    def list_runs(db: Session, limit: int = 20) -> List[IngestionRun]:
        stmt = select(IngestionRun).order_by(desc(IngestionRun.started_at)).limit(limit)
        return list(db.execute(stmt).scalars().all())
