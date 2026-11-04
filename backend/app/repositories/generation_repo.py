from datetime import datetime, date
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.models.actual_generation import ActualGeneration
from app.models.actual_hourly import ActualGenerationHourly
from app.schemas.data_processing import ValidatedFuelHHRecord, ValidatedHourlyActualRecord


class GenerationRepository:
    """Repository for persisting and querying FUELHH actual wind generation records."""

    @staticmethod
    def upsert_actuals(
        db: Session,
        records: List[ValidatedFuelHHRecord],
        batch_size: int = 1000,
    ) -> Tuple[int, int]:
        """
        Idempotently insert or update 30-minute FUELHH records.
        Returns: (inserted_count, updated_count)
        """
        if not records:
            return 0, 0

        dialect_name = db.bind.dialect.name if db.bind else "postgresql"
        inserted = 0
        updated = 0

        for i in range(0, len(records), batch_size):
            chunk = records[i : i + batch_size]
            payloads = [
                {
                    "start_time": r.start_time,
                    "publish_time": r.publish_time,
                    "settlement_date": r.settlement_date,
                    "settlement_period": r.settlement_period,
                    "fuel_type": r.fuel_type,
                    "generation_mw": r.generation_mw,
                    "source_dataset": r.source_dataset,
                    "raw_payload": r.raw_payload,
                }
                for r in chunk
            ]

            if dialect_name == "postgresql":
                from sqlalchemy.dialects.postgresql import insert as pg_insert
                stmt = pg_insert(ActualGeneration).values(payloads)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["start_time", "fuel_type"],
                    set_={
                        "publish_time": stmt.excluded.publish_time,
                        "generation_mw": stmt.excluded.generation_mw,
                        "raw_payload": stmt.excluded.raw_payload,
                    },
                )
                result = db.execute(stmt)
                inserted += len(chunk)
            elif dialect_name == "sqlite":
                from sqlalchemy.dialects.sqlite import insert as sqlite_insert
                stmt = sqlite_insert(ActualGeneration).values(payloads)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["start_time", "fuel_type"],
                    set_={
                        "publish_time": stmt.excluded.publish_time,
                        "generation_mw": stmt.excluded.generation_mw,
                        "raw_payload": stmt.excluded.raw_payload,
                    },
                )
                db.execute(stmt)
                inserted += len(chunk)
            else:
                # Generic fallback
                for p in payloads:
                    existing = db.execute(
                        select(ActualGeneration).where(
                            and_(
                                ActualGeneration.start_time == p["start_time"],
                                ActualGeneration.fuel_type == p["fuel_type"],
                            )
                        )
                    ).scalar_one_or_none()
                    if existing:
                        existing.generation_mw = p["generation_mw"]
                        existing.publish_time = p["publish_time"]
                        existing.raw_payload = p["raw_payload"]
                        updated += 1
                    else:
                        db.add(ActualGeneration(**p))
                        inserted += 1

        db.commit()
        return inserted, updated

    @staticmethod
    def upsert_hourly_actuals(
        db: Session,
        records: List[ValidatedHourlyActualRecord],
        batch_size: int = 1000,
    ) -> Tuple[int, int]:
        """
        Idempotently insert or update hourly aggregated actual records.
        Returns: (inserted_count, updated_count)
        """
        if not records:
            return 0, 0

        dialect_name = db.bind.dialect.name if db.bind else "postgresql"
        inserted = 0
        updated = 0

        for i in range(0, len(records), batch_size):
            chunk = records[i : i + batch_size]
            payloads = [
                {
                    "hour_start_time": r.hour_start_time,
                    "generation_mw": r.generation_mw,
                    "sp_count": r.sp_count,
                }
                for r in chunk
            ]

            if dialect_name == "postgresql":
                from sqlalchemy.dialects.postgresql import insert as pg_insert
                stmt = pg_insert(ActualGenerationHourly).values(payloads)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["hour_start_time"],
                    set_={
                        "generation_mw": stmt.excluded.generation_mw,
                        "sp_count": stmt.excluded.sp_count,
                    },
                )
                db.execute(stmt)
                inserted += len(chunk)
            elif dialect_name == "sqlite":
                from sqlalchemy.dialects.sqlite import insert as sqlite_insert
                stmt = sqlite_insert(ActualGenerationHourly).values(payloads)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["hour_start_time"],
                    set_={
                        "generation_mw": stmt.excluded.generation_mw,
                        "sp_count": stmt.excluded.sp_count,
                    },
                )
                db.execute(stmt)
                inserted += len(chunk)
            else:
                for p in payloads:
                    existing = db.execute(
                        select(ActualGenerationHourly).where(
                            ActualGenerationHourly.hour_start_time == p["hour_start_time"]
                        )
                    ).scalar_one_or_none()
                    if existing:
                        existing.generation_mw = p["generation_mw"]
                        existing.sp_count = p["sp_count"]
                        updated += 1
                    else:
                        db.add(ActualGenerationHourly(**p))
                        inserted += 1

        db.commit()
        return inserted, updated

    @staticmethod
    def get_actuals_by_date(
        db: Session,
        delivery_date: date,
    ) -> List[ActualGeneration]:
        """Retrieve 30-min actuals for a specific settlement date."""
        stmt = (
            select(ActualGeneration)
            .where(ActualGeneration.settlement_date == delivery_date)
            .order_by(ActualGeneration.settlement_period.asc())
        )
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def get_hourly_actuals_by_range(
        db: Session,
        start_dt: datetime,
        end_dt: datetime,
    ) -> List[ActualGenerationHourly]:
        """Retrieve hourly actuals within a datetime window."""
        stmt = (
            select(ActualGenerationHourly)
            .where(
                and_(
                    ActualGenerationHourly.hour_start_time >= start_dt,
                    ActualGenerationHourly.hour_start_time < end_dt,
                )
            )
            .order_by(ActualGenerationHourly.hour_start_time.asc())
        )
        return list(db.execute(stmt).scalars().all())
