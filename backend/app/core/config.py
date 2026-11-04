from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "WindScope - Day-Ahead Renewable Intelligence"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "postgresql+psycopg://windscope:windscope@localhost:5432/windscope_db"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    # Elexon API Configuration
    ELEXON_API_BASE_URL: str = "https://data.elexon.co.uk/bmrs/api/v1"
    ELEXON_RATE_LIMIT_PER_MINUTE: int = 5000
    ELEXON_REQUEST_TIMEOUT_SECONDS: float = 30.0
    ELEXON_MAX_RETRIES: int = 3
    ELEXON_BACKOFF_FACTOR: float = 1.5

    # Evaluation & Business Rules Defaults
    DEFAULT_DECISION_CUTOFF: str = "11:00"  # HH:MM UTC assumption
    EVALUATION_START_DATE: str = "2026-01-01"
    EVALUATION_END_DATE: str = "2026-01-31"

    # Ingestion Controls
    AUTO_INGEST_ON_STARTUP: bool = True


settings = Settings()
