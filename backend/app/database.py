from datetime import timezone
from typing import Generator
from sqlalchemy import create_engine, DateTime, TypeDecorator
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings


class UTCDateTime(TypeDecorator):
    """DateTime type that guarantees UTC timezone-awareness across all database dialects."""
    impl = DateTime(timezone=True)
    cache_ok = True

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        elif value is not None:
            return value.astimezone(timezone.utc)
        return value

    def process_bind_param(self, value, dialect):
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        elif value is not None:
            return value.astimezone(timezone.utc)
        return value


# Engine configuration with connection pooling (dialect-aware for Postgres and SQLite)
is_sqlite = settings.DATABASE_URL.startswith("sqlite")
engine_kwargs = {"pool_pre_ping": True}
if is_sqlite:
    from sqlalchemy.pool import StaticPool
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    engine_kwargs["poolclass"] = StaticPool
else:
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

engine = create_engine(
    settings.DATABASE_URL,
    **engine_kwargs,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
