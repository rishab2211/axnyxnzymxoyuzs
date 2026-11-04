import math
from typing import List, Tuple, Optional, Dict, Any
import numpy as np

from app.schemas.analytics import AccuracyMetrics, IntervalMatchRecord, WorstIntervalRecord


class AccuracyEngine:
    """Statistical accuracy engine for wind forecast evaluation against actual outturn."""

    @staticmethod
    def calculate_error(forecast_mw: float, actual_mw: float) -> float:
        """Error definition: Forecast - Actual. Positive = Overforecast, Negative = Underforecast."""
        return round(forecast_mw - actual_mw, 2)

    @classmethod
    def compute_metrics(
        cls,
        matched_pairs: List[Tuple[float, float]],
        expected_observations: int,
    ) -> AccuracyMetrics:
        """
        Compute standard energy forecast accuracy metrics: MAE, RMSE, Bias, WAPE, and conditional MAPE.
        matched_pairs: list of (forecast_mw, actual_mw)
        """
        n = len(matched_pairs)
        coverage_pct = round((n / expected_observations * 100.0) if expected_observations > 0 else 0.0, 1)

        if n == 0:
            return AccuracyMetrics(
                mae=None,
                rmse=None,
                bias=None,
                wape=None,
                mape=None,
                mape_excluded_count=0,
                matched_observations=0,
                expected_observations=expected_observations,
                coverage_pct=coverage_pct,
            )

        forecasts = np.array([p[0] for p in matched_pairs], dtype=np.float64)
        actuals = np.array([p[1] for p in matched_pairs], dtype=np.float64)

        errors = forecasts - actuals
        abs_errors = np.abs(errors)

        # MAE: Mean Absolute Error (MW)
        mae = float(np.mean(abs_errors))

        # RMSE: Root Mean Square Error (MW)
        rmse = float(np.sqrt(np.mean(errors ** 2)))

        # BIAS: Mean Error (MW). Positive = systematic overforecast, Negative = underforecast
        bias = float(np.mean(errors))

        # WAPE: Weighted Absolute Percentage Error (%)
        # Sum(abs(Forecast - Actual)) / Sum(abs(Actual)) * 100
        sum_actuals = float(np.sum(np.abs(actuals)))
        if sum_actuals > 0:
            wape = float((np.sum(abs_errors) / sum_actuals) * 100.0)
        else:
            wape = None

        # MAPE: Mean Absolute Percentage Error (%)
        # Strictly exclude actual == 0 to prevent division by zero or extreme instability
        valid_mask = actuals > 1.0  # Exclude generation under 1 MW as near-zero noise
        excluded_count = int(np.sum(~valid_mask))
        if np.sum(valid_mask) > 0:
            mape_vals = (abs_errors[valid_mask] / actuals[valid_mask]) * 100.0
            mape = float(np.mean(mape_vals))
        else:
            mape = None

        return AccuracyMetrics(
            mae=round(mae, 2),
            rmse=round(rmse, 2),
            bias=round(bias, 2),
            wape=round(wape, 2) if wape is not None else None,
            mape=round(mape, 2) if mape is not None else None,
            mape_excluded_count=excluded_count,
            matched_observations=n,
            expected_observations=expected_observations,
            coverage_pct=coverage_pct,
        )

    @classmethod
    def get_worst_intervals(
        cls,
        matched_records: List[IntervalMatchRecord],
        limit: int = 10,
    ) -> List[WorstIntervalRecord]:
        """Identify the top N largest absolute forecast error intervals."""
        eligible = [
            r for r in matched_records
            if r.forecast_mw is not None and r.actual_hourly_mw is not None and r.error_mw is not None
        ]

        # Sort by absolute error descending
        sorted_records = sorted(eligible, key=lambda r: abs(r.error_mw), reverse=True)
        top_n = sorted_records[:limit]

        results = []
        for r in top_n:
            abs_err = abs(r.error_mw)
            pct_err = round((abs_err / r.actual_hourly_mw * 100.0), 1) if r.actual_hourly_mw > 0 else None
            results.append(
                WorstIntervalRecord(
                    start_time=r.start_time,
                    forecast_mw=r.forecast_mw,
                    actual_mw=r.actual_hourly_mw,
                    error_mw=r.error_mw,
                    absolute_error_mw=round(abs_err, 2),
                    percentage_error=pct_err,
                    forecast_publish_time=r.forecast_publish_time or r.start_time,
                )
            )
        return results

    @classmethod
    def compute_histogram(
        cls,
        errors: List[float],
        bins: int = 10,
    ) -> Dict[str, Any]:
        """Generate error distribution histogram bins and frequencies."""
        if not errors:
            return {"bins": [], "counts": []}

        counts, bin_edges = np.histogram(errors, bins=bins)
        formatted_bins = []
        for i in range(len(counts)):
            formatted_bins.append({
                "range": f"{bin_edges[i]:.0f} to {bin_edges[i+1]:.0f} MW",
                "min": round(float(bin_edges[i]), 1),
                "max": round(float(bin_edges[i+1]), 1),
                "count": int(counts[i]),
            })

        return {
            "total_samples": len(errors),
            "min_error": round(float(min(errors)), 1),
            "max_error": round(float(max(errors)), 1),
            "bins": formatted_bins,
        }
