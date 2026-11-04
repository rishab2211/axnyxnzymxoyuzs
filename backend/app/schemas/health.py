from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class DatabaseHealth(BaseModel):
    connected: bool
    tables_initialized: bool
    record_counts: Dict[str, int] = Field(default_factory=dict)
    last_ingestion: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    project: str
    version: str
    environment: str
    timestamp: datetime
    database: DatabaseHealth
