from datetime import datetime, date, timezone, timedelta
from typing import List, Dict, Any, Tuple, Optional
from collections import defaultdict
import math

from app.core.logging import logger
from app.schemas.data_processing import (
    ValidatedFuelHHRecord,
    ValidatedWindforRecord,
    ValidatedHourlyActualRecord,
)


class DataProcessor:
    """Validates, cleans, normalizes, and aggregates Elexon actual and forecast datasets."""

    @staticmethod
    def _parse_utc_datetime(dt_val: Any) -> Optional[datetime]:
        """Safely parse a timestamp string to timezone-aware UTC datetime."""
        if not dt_val:
            return None
        if isinstance(dt_val, datetime):
            if dt_val.tzinfo is None:
                return dt_val.replace(tzinfo=timezone.utc)
            return dt_val.astimezone(timezone.utc)
        try:
            # Handle ISO strings like '2026-01-01T00:00:00Z' or with offset
            cleaned = str(dt_val).replace("Z", "+00:00")
            parsed = datetime.fromisoformat(cleaned)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except Exception as exc:
            logger.warning(f"Failed to parse datetime '{dt_val}': {exc}")
            return None

    @staticmethod
    def _parse_settlement_date(date_val: Any) -> Optional[date]:
        """Parse settlement date value to a date object."""
        if not date_val:
            return None
        if isinstance(date_val, date):
            return date_val
        try:
            return date.fromisoformat(str(date_val).split("T")[0])
        except Exception as exc:
            logger.warning(f"Failed to parse settlementDate '{date_val}': {exc}")
            return None

    def process_fuelhh(
        self,
        raw_records: List[Dict[str, Any]],
    ) -> Tuple[List[ValidatedFuelHHRecord], Dict[str, int]]:
        """
        Validate, normalize, and deduplicate FUELHH actual wind generation records.
        Returns: (validated_records, stats_dict)
        """
        stats = {
            "received": len(raw_records),
            "validated": 0,
            "rejected": 0,
            "duplicates": 0,
            "negative_generation": 0,
        }

        dedup_map: Dict[Tuple[datetime, str], ValidatedFuelHHRecord] = {}

        for record in raw_records:
            try:
                # 1. Fuel type validation
                fuel_type = str(record.get("fuelType", "")).upper()
                if fuel_type != "WIND":
                    stats["rejected"] += 1
                    continue

                # 2. Timestamps
                start_time = self._parse_utc_datetime(record.get("startTime"))
                publish_time = self._parse_utc_datetime(record.get("publishTime"))
                if not start_time or not publish_time:
                    logger.warning(f"FUELHH record missing valid timestamps: {record}")
                    stats["rejected"] += 1
                    continue

                # 3. Settlement info
                settlement_date = self._parse_settlement_date(record.get("settlementDate"))
                settlement_period = int(record.get("settlementPeriod", 0))
                if not settlement_date or not (1 <= settlement_period <= 50):
                    logger.warning(f"FUELHH record invalid settlement window: {record}")
                    stats["rejected"] += 1
                    continue

                # 4. Generation value
                gen_raw = record.get("generation")
                if gen_raw is None or (isinstance(gen_raw, float) and math.isnan(gen_raw)):
                    logger.warning(f"FUELHH record missing numerical generation: {record}")
                    stats["rejected"] += 1
                    continue

                gen_float = float(gen_raw)
                if gen_float < 0:
                    stats["negative_generation"] += 1
                    logger.warning(
                        f"FUELHH negative generation ({gen_float} MW) detected at {start_time}. Preserving for audit."
                    )

                validated = ValidatedFuelHHRecord(
                    start_time=start_time,
                    publish_time=publish_time,
                    settlement_date=settlement_date,
                    settlement_period=settlement_period,
                    fuel_type="WIND",
                    generation_mw=round(gen_float, 2),
                    source_dataset="FUELHH",
                    raw_payload=record,
                )

                # Deduplication key: (start_time, fuel_type)
                dedup_key = (start_time, "WIND")
                if dedup_key in dedup_map:
                    stats["duplicates"] += 1
                    # Keep latest published record
                    if publish_time > dedup_map[dedup_key].publish_time:
                        dedup_map[dedup_key] = validated
                else:
                    dedup_map[dedup_key] = validated

            except Exception as exc:
                logger.warning(f"FUELHH parsing exception on record: {exc}")
                stats["rejected"] += 1

        validated_list = sorted(dedup_map.values(), key=lambda r: r.start_time)
        stats["validated"] = len(validated_list)
        return validated_list, stats

    def process_windfor(
        self,
        raw_records: List[Dict[str, Any]],
    ) -> Tuple[List[ValidatedWindforRecord], Dict[str, int]]:
        """
        Validate, normalize, and deduplicate WINDFOR forecast publications.
        Returns: (validated_records, stats_dict)
        """
        stats = {
            "received": len(raw_records),
            "validated": 0,
            "rejected": 0,
            "duplicates": 0,
            "negative_generation": 0,
        }

        # Deduplication key: (start_time, publish_time)
        dedup_map: Dict[Tuple[datetime, datetime], ValidatedWindforRecord] = {}

        for record in raw_records:
            try:
                start_time = self._parse_utc_datetime(record.get("startTime"))
                publish_time = self._parse_utc_datetime(record.get("publishTime"))
                if not start_time or not publish_time:
                    stats["rejected"] += 1
                    continue

                gen_raw = record.get("generation")
                if gen_raw is None or (isinstance(gen_raw, float) and math.isnan(gen_raw)):
                    stats["rejected"] += 1
                    continue

                gen_float = float(gen_raw)
                if gen_float < 0:
                    stats["negative_generation"] += 1
                    logger.warning(
                        f"WINDFOR negative forecast ({gen_float} MW) at {start_time} (pub: {publish_time})."
                    )

                validated = ValidatedWindforRecord(
                    start_time=start_time,
                    publish_time=publish_time,
                    generation_mw=round(gen_float, 2),
                    source_dataset="WINDFOR",
                    raw_payload=record,
                )

                dedup_key = (start_time, publish_time)
                if dedup_key in dedup_map:
                    stats["duplicates"] += 1
                else:
                    dedup_map[dedup_key] = validated

            except Exception as exc:
                logger.warning(f"WINDFOR parsing exception on record: {exc}")
                stats["rejected"] += 1

        validated_list = sorted(dedup_map.values(), key=lambda r: (r.start_time, r.publish_time))
        stats["validated"] = len(validated_list)
        return validated_list, stats

    def aggregate_hourly_actuals(
        self,
        fuelhh_records: List[ValidatedFuelHHRecord],
    ) -> List[ValidatedHourlyActualRecord]:
        """
        Aggregate 30-minute settlement period actuals into 1-hour intervals for 1:1 matching with WINDFOR.
        Hour bucket: [h:00 to (h+1):00)
        SP1: h:00 to h:30
        SP2: h:30 to (h+1):00
        """
        hourly_groups: Dict[datetime, List[float]] = defaultdict(list)

        for rec in fuelhh_records:
            # Round down start_time to nearest hour
            hour_bucket = rec.start_time.replace(minute=0, second=0, microsecond=0)
            hourly_groups[hour_bucket].append(rec.generation_mw)

        aggregated: List[ValidatedHourlyActualRecord] = []
        for hour_start in sorted(hourly_groups.keys()):
            gens = hourly_groups[hour_start]
            sp_count = len(gens)
            if sp_count == 2:
                avg_mw = round(sum(gens) / 2.0, 2)
            elif sp_count == 1:
                # Missing one SP in the hour: flag as incomplete
                logger.warning(
                    f"Hourly actual at {hour_start} has only 1 settlement period ({gens[0]} MW)."
                )
                avg_mw = round(gens[0], 2)
            else:
                avg_mw = None

            aggregated.append(
                ValidatedHourlyActualRecord(
                    hour_start_time=hour_start,
                    generation_mw=avg_mw,
                    sp_count=sp_count,
                )
            )

        return aggregated
