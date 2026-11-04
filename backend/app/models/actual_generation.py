from sqlalchemy import (
    Column,
    BigInteger,
    DateTime,
    Date,
    SmallInteger,
    String,
    Numeric,
    Index,
    UniqueConstraint,
    JSON,
)
from sqlalchemy.sql import func
from app.database import Base


class ActualGeneration(Base):
    __tablename__ = "actual_generation"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    publish_time = Column(DateTime(timezone=True), nullable=False, index=True)
    settlement_date = Column(Date, nullable=False, index=True)
    settlement_period = Column(SmallInteger, nullable=False)
    fuel_type = Column(String(20), nullable=False, default="WIND")
    generation_mw = Column(Numeric(10, 2), nullable=False)
    source_dataset = Column(String(20), nullable=False, default="FUELHH")
    ingested_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    raw_payload = Column(JSON, nullable=True)

    __table_args__ = (
        UniqueConstraint("start_time", "fuel_type", name="uq_actual_start_fuel"),
        Index("idx_ag_start_publish", "start_time", "publish_time"),
    )
