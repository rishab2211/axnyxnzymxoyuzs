import pytest
from app.services.accuracy import AccuracyEngine
from app.schemas.analytics import IntervalMatchRecord
from datetime import datetime, timezone


def test_metric_calculations_with_known_vectors():
    """
    Test accuracy metrics with known vectors:
    Forecasts = [100.0, 200.0, 300.0]
    Actuals   = [110.0, 190.0, 320.0]
    Errors    = [-10.0, +10.0, -20.0] -> abs = [10.0, 10.0, 20.0]
    MAE  = (10 + 10 + 20) / 3 = 13.33 MW
    RMSE = sqrt((100 + 100 + 400) / 3) = sqrt(200) = 14.14 MW
    BIAS = (-10 + 10 - 20) / 3 = -6.67 MW (underforecast)
    WAPE = 40 / (110 + 190 + 320) * 100 = 40 / 620 * 100 = 6.45 %
    """
    pairs = [
        (100.0, 110.0),
        (200.0, 190.0),
        (300.0, 320.0),
    ]

    metrics = AccuracyEngine.compute_metrics(pairs, expected_observations=3)

    assert metrics.mae == 13.33
    assert metrics.rmse == 14.14
    assert metrics.bias == -6.67
    assert metrics.wape == 6.45
    assert metrics.matched_observations == 3
    assert metrics.coverage_pct == 100.0


def test_mape_zero_denominator_exclusion():
    """MAPE must safely exclude zero and near-zero actuals and report exclusion count."""
    pairs = [
        (100.0, 0.0),    # zero actual -> must be excluded
        (50.0, 0.5),     # < 1.0 MW noise -> must be excluded
        (200.0, 200.0),  # error = 0 -> 0%
        (110.0, 100.0),  # error = 10 -> 10%
    ]

    metrics = AccuracyEngine.compute_metrics(pairs, expected_observations=4)

    assert metrics.mape_excluded_count == 2
    # Valid sample MAPE = mean(0%, 10%) = 5.0%
    assert metrics.mape == 5.0


def test_empty_matched_pairs_behavior():
    """When no matched pairs exist, metrics must be None, not zero."""
    metrics = AccuracyEngine.compute_metrics([], expected_observations=24)

    assert metrics.mae is None
    assert metrics.rmse is None
    assert metrics.bias is None
    assert metrics.wape is None
    assert metrics.mape is None
    assert metrics.matched_observations == 0
    assert metrics.coverage_pct == 0.0


def test_worst_intervals_ranking():
    """Top N worst intervals must be ranked in descending order of absolute error."""
    now = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    records = [
        IntervalMatchRecord(start_time=now, forecast_mw=100.0, actual_hourly_mw=105.0, error_mw=-5.0, status="matched"),
        IntervalMatchRecord(start_time=now, forecast_mw=200.0, actual_hourly_mw=150.0, error_mw=50.0, status="matched"),
        IntervalMatchRecord(start_time=now, forecast_mw=300.0, actual_hourly_mw=210.0, error_mw=90.0, status="matched"),
        IntervalMatchRecord(start_time=now, forecast_mw=150.0, actual_hourly_mw=230.0, error_mw=-80.0, status="matched"),
        IntervalMatchRecord(start_time=now, forecast_mw=None, actual_hourly_mw=100.0, error_mw=None, status="missing_forecast"),
    ]

    worst = AccuracyEngine.get_worst_intervals(records, limit=2)

    assert len(worst) == 2
    assert worst[0].error_mw == 90.0
    assert worst[0].absolute_error_mw == 90.0
    assert worst[1].error_mw == -80.0
    assert worst[1].absolute_error_mw == 80.0


def test_compute_histogram_zero_boundary():
    """Histogram must align zero as a bin boundary when errors span negative and positive."""
    errors = [-500.0, -200.0, -50.0, 10.0, 100.0, 300.0]
    hist = AccuracyEngine.compute_histogram(errors, bins=6)

    assert hist["total_samples"] == 6
    assert hist["min_error"] == -500.0
    assert hist["max_error"] == 300.0

    # Verify that 0.0 is an exact boundary separating negative and positive bins
    boundary_found = False
    for b in hist["bins"]:
        if b["max"] == 0.0 or b["min"] == 0.0:
            boundary_found = True
    assert boundary_found is True
