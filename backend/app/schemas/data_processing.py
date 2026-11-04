from datetime import datetime, date
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class ValidatedFuelHHRecord(BaseModel):
    start_time: datetime
    publish_time: datetime
    settlement_date: date
    settlement_period: int = Field(..., ge=1, le=50)
    fuel_type: str = "WIND"
    generation_mw: float
    source_dataset: str = "FUELHH"
    raw_payload: Optional[Dict[str, Any]] = None

    @field_validator("fuel_type")
    @classmethod
    def validate_fuel_type(cls, v: str) -> str:
        if v.upper() != "WIND":
            raise ValueError(f"Unexpected fuelType: {v}. Only WIND is accepted.")
        return "WIND"

    @field_validator("start_time", "publish_time")
    @classmethod
    def ensure_timezone(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            from datetime import timezone
            return v.replace(tzinfo=timezone.utc)
        return v


class ValidatedWindforRecord(BaseModel):
    start_time: datetime
    publish_time: datetime
    generation_mw: float
    source_dataset: str = "WINDFOR"
    raw_payload: Optional[Dict[str, Any]] = None

    @field_validator("start_time", "publish_time")
    @classmethod
    def ensure_timezone(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            from datetime import timezone
            return v.replace(tzinfo=timezone.utc)
        return v


class ValidatedHourlyActualRecord(BaseModel):
    hour_start_time: datetime
    generation_mw: Optional[float] = None
    sp_count: int = 2
