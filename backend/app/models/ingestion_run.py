from sqlalchemy import (
    Column,
    BigInteger,
    Integer,
    String,
    Text,
    JSON,
)
from sqlalchemy.sql import func
from app.database import Base, UTCDateTime


class IngestionRun(Base):
    __tablename__ = "ingestion_runs"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    dataset = Column(String(20), nullable=False)
    requested_from = Column(UTCDateTime, nullable=True)
    requested_to = Column(UTCDateTime, nullable=True)
    started_at = Column(UTCDateTime, nullable=False, server_default=func.now())
    completed_at = Column(UTCDateTime, nullable=True)
    status = Column(String(20), nullable=False, default="running")  # running, success, failed, partial
    records_received = Column(Integer, nullable=False, default=0)
    records_inserted = Column(Integer, nullable=False, default=0)
    records_updated = Column(Integer, nullable=False, default=0)
    records_rejected = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)
    parameters = Column(JSON, nullable=True)
