from datetime import datetime
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.models.wind_forecast import WindForecast
from app.schemas.data_processing import ValidatedWindforRecord


class ForecastRepository:
    """Repository for persisting and querying WINDFOR forecast publications."""

    @staticmethod
    def upsert_forecasts(
        db: Session,
        records: List[ValidatedWindforRecord],
        batch_size: int = 1000,
    ) -> Tuple[int, int]:
        """
        Idempotently insert or update WINDFOR publications.
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
                    "generation_mw": r.generation_mw,
                    "source_dataset": r.source_dataset,
                    "raw_payload": r.raw_payload,
                }
                for r in chunk
            ]

            if dialect_name == "postgresql":
                from sqlalchemy.dialects.postgresql import insert as pg_insert
                stmt = pg_insert(WindForecast).values(payloads)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["start_time", "publish_time"],
                    set_={
                        "generation_mw": stmt.excluded.generation_mw,
                        "raw_payload": stmt.excluded.raw_payload,
                    },
                )
                db.execute(stmt)
                inserted += len(chunk)
            elif dialect_name == "sqlite":
                from sqlalchemy.dialects.sqlite import insert as sqlite_insert
                stmt = sqlite_insert(WindForecast).values(payloads)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["start_time", "publish_time"],
                    set_={
                        "generation_mw": stmt.excluded.generation_mw,
                        "raw_payload": stmt.excluded.raw_payload,
                    },
                )
                db.execute(stmt)
                inserted += len(chunk)
            else:
                for p in payloads:
                    existing = db.execute(
                        select(WindForecast).where(
                            and_(
                                WindForecast.start_time == p["start_time"],
                                WindForecast.publish_time == p["publish_time"],
                            )
                        )
                    ).scalar_one_or_none()
                    if existing:
                        existing.generation_mw = p["generation_mw"]
                        existing.raw_payload = p["raw_payload"]
                        updated += 1
                    else:
                        db.add(WindForecast(**p))
                        inserted += 1

        db.commit()
        return inserted, updated

    @staticmethod
    def get_forecasts_for_intervals(
        db: Session,
        start_dt: datetime,
        end_dt: datetime,
    ) -> List[WindForecast]:
        """Retrieve all forecast publications targeting intervals between start_dt and end_dt."""
        stmt = (
            select(WindForecast)
            .where(
                and_(
                    WindForecast.start_time >= start_dt,
                    WindForecast.start_time < end_dt,
                )
            )
            .order_by(WindForecast.start_time.asc(), WindForecast.publish_time.asc())
        )
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def get_vintages_for_interval(
        db: Session,
        interval_start: datetime,
    ) -> List[WindForecast]:
        """Retrieve all historical forecast publication vintages targeting a single delivery interval."""
        stmt = (
            select(WindForecast)
            .where(WindForecast.start_time == interval_start)
            .order_by(WindForecast.publish_time.asc())
        )
        return list(db.execute(stmt).scalars().all())
