from datetime import datetime, date, timezone
from app.services.data_processor import DataProcessor


def test_fuelhh_validation_and_deduplication():
    processor = DataProcessor()
    raw_data = [
        # Valid record 1
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-01T00:30:00Z",
            "startTime": "2026-01-01T00:00:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 1,
            "fuelType": "WIND",
            "generation": 12500,
        },
        # Duplicate record 1 with earlier publishTime (should be replaced)
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-01T00:25:00Z",
            "startTime": "2026-01-01T00:00:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 1,
            "fuelType": "WIND",
            "generation": 12400,
        },
        # Valid record 2
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-01T01:00:00Z",
            "startTime": "2026-01-01T00:30:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 2,
            "fuelType": "WIND",
            "generation": 13000,
        },
        # Non-WIND record (must be rejected)
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-01T00:30:00Z",
            "startTime": "2026-01-01T00:00:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 1,
            "fuelType": "NUCLEAR",
            "generation": 5000,
        },
        # Missing generation (must be rejected)
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-01T00:30:00Z",
            "startTime": "2026-01-01T01:00:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 3,
            "fuelType": "WIND",
            "generation": None,
        },
    ]

    validated, stats = processor.process_fuelhh(raw_data)

    assert stats["received"] == 5
    assert stats["validated"] == 2
    assert stats["rejected"] == 2  # NUCLEAR + None generation
    assert stats["duplicates"] == 1

    assert len(validated) == 2
    # Verify latest publishTime record was preserved
    assert validated[0].generation_mw == 12500.0
    assert validated[0].settlement_period == 1
    assert validated[0].start_time.tzinfo == timezone.utc


def test_fuelhh_negative_generation_flagged():
    processor = DataProcessor()
    raw = [
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-01T00:30:00Z",
            "startTime": "2026-01-01T00:00:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 1,
            "fuelType": "WIND",
            "generation": -15.5,
        }
    ]
    validated, stats = processor.process_fuelhh(raw)
    assert stats["validated"] == 1
    assert stats["negative_generation"] == 1
    assert validated[0].generation_mw == -15.5


def test_windfor_validation_and_vintages():
    processor = DataProcessor()
    raw_data = [
        # Vintage 1 for 00:00
        {
            "dataset": "WINDFOR",
            "publishTime": "2025-12-31T02:30:00Z",
            "startTime": "2026-01-01T00:00:00Z",
            "generation": 11000,
        },
        # Vintage 2 for 00:00 (different publishTime -> both must be preserved)
        {
            "dataset": "WINDFOR",
            "publishTime": "2025-12-31T09:30:00Z",
            "startTime": "2026-01-01T00:00:00Z",
            "generation": 11500,
        },
        # Duplicate of Vintage 2 (exact same start and publish time)
        {
            "dataset": "WINDFOR",
            "publishTime": "2025-12-31T09:30:00Z",
            "startTime": "2026-01-01T00:00:00Z",
            "generation": 11500,
        },
        # Corrupt record with invalid timestamp
        {
            "dataset": "WINDFOR",
            "publishTime": "not-a-timestamp",
            "startTime": "2026-01-01T00:00:00Z",
            "generation": 12000,
        },
    ]

    validated, stats = processor.process_windfor(raw_data)

    assert stats["received"] == 4
    assert stats["validated"] == 2
    assert stats["rejected"] == 1
    assert stats["duplicates"] == 1

    # Both distinct vintages for the interval must be stored
    assert len(validated) == 2
    assert validated[0].generation_mw == 11000.0
    assert validated[1].generation_mw == 11500.0


def test_hourly_actual_aggregation():
    processor = DataProcessor()
    raw_sp = [
        # Hour 00:00 - SP1 and SP2
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-01T00:30:00Z",
            "startTime": "2026-01-01T00:00:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 1,
            "fuelType": "WIND",
            "generation": 10000,
        },
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-01T01:00:00Z",
            "startTime": "2026-01-01T00:30:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 2,
            "fuelType": "WIND",
            "generation": 12000,
        },
        # Hour 01:00 - Only SP3 (SP4 missing)
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-01T01:30:00Z",
            "startTime": "2026-01-01T01:00:00Z",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 3,
            "fuelType": "WIND",
            "generation": 14000,
        },
    ]

    validated_sp, _ = processor.process_fuelhh(raw_sp)
    hourly = processor.aggregate_hourly_actuals(validated_sp)

    assert len(hourly) == 2

    # Hour 0: mean(10000, 12000) = 11000, sp_count = 2
    assert hourly[0].hour_start_time == datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    assert hourly[0].generation_mw == 11000.0
    assert hourly[0].sp_count == 2

    # Hour 1: only 1 SP present
    assert hourly[1].hour_start_time == datetime(2026, 1, 1, 1, 0, tzinfo=timezone.utc)
    assert hourly[1].generation_mw == 14000.0
    assert hourly[1].sp_count == 1


def test_hourly_aggregation_handles_extra_settlement_periods():
    processor = DataProcessor()
    # Simulate an hour bucket with 3 SP records
    from app.schemas.data_processing import ValidatedFuelHHRecord

    records = [
        ValidatedFuelHHRecord(
            start_time=datetime(2026, 1, 1, 2, 0, tzinfo=timezone.utc),
            publish_time=datetime(2026, 1, 1, 2, 30, tzinfo=timezone.utc),
            settlement_date=date(2026, 1, 1),
            settlement_period=5,
            fuel_type="WIND",
            generation_mw=9000.0,
        ),
        ValidatedFuelHHRecord(
            start_time=datetime(2026, 1, 1, 2, 20, tzinfo=timezone.utc),
            publish_time=datetime(2026, 1, 1, 2, 40, tzinfo=timezone.utc),
            settlement_date=date(2026, 1, 1),
            settlement_period=6,
            fuel_type="WIND",
            generation_mw=12000.0,
        ),
        ValidatedFuelHHRecord(
            start_time=datetime(2026, 1, 1, 2, 40, tzinfo=timezone.utc),
            publish_time=datetime(2026, 1, 1, 3, 0, tzinfo=timezone.utc),
            settlement_date=date(2026, 1, 1),
            settlement_period=7,
            fuel_type="WIND",
            generation_mw=15000.0,
        ),
    ]

    hourly = processor.aggregate_hourly_actuals(records)
    assert len(hourly) == 1
    assert hourly[0].sp_count == 3
    # mean of 9000, 12000, 15000 = 12000.0 (must not be None!)
    assert hourly[0].generation_mw == 12000.0
