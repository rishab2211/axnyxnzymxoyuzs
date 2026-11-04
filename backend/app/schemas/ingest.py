from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class IngestionRequest(BaseModel):
    dataset: str = Field(..., description="Dataset name: 'FUELHH', 'WINDFOR', or 'ALL'")
    start_date: Optional[date] = Field(None, description="Start date for ingestion (YYYY-MM-DD)")
    end_date: Optional[date] = Field(None, description="End date for ingestion (YYYY-MM-DD)")
    force_reload: bool = Field(False, description="Whether to reload existing records idempotently")


class IngestionRunSummary(BaseModel):
    id: int
    dataset: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    records_received: int
    records_inserted: int
    records_updated: int
    records_rejected: int
    error_message: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None


class IngestionResponse(BaseModel):
    status: str
    message: str
    runs: List[IngestionRunSummary]
