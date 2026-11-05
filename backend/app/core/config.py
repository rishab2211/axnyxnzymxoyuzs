import os
import shutil
from pathlib import Path
from typing import List, Union
from pydantic import field_validator
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

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str) -> str:
        if isinstance(v, str):
            # Normalise Heroku postgres:// schema to SQLAlchemy psycopg driver
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+psycopg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+"):
                return v.replace("postgresql://", "postgresql+psycopg://", 1)
            elif v.startswith("sqlite:///"):
                # If pointing to a read-only filesystem (e.g. /var/task on Vercel), copy to /tmp
                db_path_str = v.replace("sqlite:///", "")
                db_path = Path(db_path_str)
                if db_path.exists():
                    parent_dir = db_path.parent
                    if not os.access(parent_dir, os.W_OK):
                        tmp_dir = Path("/tmp")
                        if tmp_dir.exists() and os.access(tmp_dir, os.W_OK):
                            tmp_db = tmp_dir / db_path.name
                            if not tmp_db.exists() or tmp_db.stat().st_size == 0:
                                shutil.copy2(str(db_path), str(tmp_db))
                            return f"sqlite:///{tmp_db.resolve()}"
        return v

    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v == "*":
                return ["*"]
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

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
