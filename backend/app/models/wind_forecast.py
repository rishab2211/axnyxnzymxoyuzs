from sqlalchemy import (
    Column,
    BigInteger,
    Integer,
    DateTime,
    String,
    Numeric,
    Index,
    UniqueConstraint,
    JSON,
)
from sqlalchemy.sql import func
from app.database import Base


class WindForecast(Base):
    __tablename__ = "wind_forecasts"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    publish_time = Column(DateTime(timezone=True), nullable=False, index=True)
    generation_mw = Column(Numeric(10, 2), nullable=False)
    source_dataset = Column(String(20), nullable=False, default="WINDFOR")
    ingested_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    raw_payload = Column(JSON, nullable=True)

    __table_args__ = (
        UniqueConstraint("start_time", "publish_time", name="uq_forecast_start_publish"),
        Index("idx_wf_start_publish", "start_time", "publish_time"),
    )
