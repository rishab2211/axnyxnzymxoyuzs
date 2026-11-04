from sqlalchemy import (
    Column,
    BigInteger,
    Integer,
    DateTime,
    SmallInteger,
    Numeric,
)
from sqlalchemy.sql import func
from app.database import Base


class ActualGenerationHourly(Base):
    __tablename__ = "actual_generation_hourly"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    hour_start_time = Column(DateTime(timezone=True), nullable=False, unique=True, index=True)
    generation_mw = Column(Numeric(10, 2), nullable=True)
    sp_count = Column(SmallInteger, nullable=False, default=2)
    ingested_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
