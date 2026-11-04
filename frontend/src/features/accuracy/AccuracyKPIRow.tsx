import React from 'react';
import type { AccuracyMetrics } from '@/types';
import { KPICard } from '@/components/kpi/KPICard';
import { formatMW, formatPercent } from '@/lib/formatters';

interface AccuracyKPIRowProps {
  metrics: AccuracyMetrics;
}

export const AccuracyKPIRow: React.FC<AccuracyKPIRowProps> = ({ metrics }) => {
  const biasStatus =
    metrics.bias === null
      ? 'neutral'
      : Math.abs(metrics.bias) < 250
      ? 'good'
      : metrics.bias > 0
      ? 'warning'
      : 'danger';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <KPICard
        label="Mean Absolute Error"
        value={formatMW(metrics.mae)}
        description="Average error magnitude across period"
        formula="Mean(abs(Forecast - Actual))"
        interpretation="Lower is better"
        status={metrics.mae !== null && metrics.mae < 600 ? 'good' : 'neutral'}
        sampleCount={metrics.matched_observations}
      />

      <KPICard
        label="Root Mean Square Error"
        value={formatMW(metrics.rmse)}
        description="High penalty on peak errors"
        formula="sqrt(Mean((Forecast - Actual)^2))"
        interpretation="Lower is better"
        status="neutral"
        sampleCount={metrics.matched_observations}
      />

      <KPICard
        label="Forecast Bias"
        value={formatMW(metrics.bias)}
        description={
          metrics.bias && metrics.bias > 0
            ? 'Net positive bias (Overforecasting)'
            : metrics.bias && metrics.bias < 0
            ? 'Net negative bias (Underforecasting)'
            : 'Zero / neutral bias'
        }
        formula="Mean(Forecast - Actual)"
        interpretation="Positive = Over, Negative = Under"
        status={biasStatus}
        sampleCount={metrics.matched_observations}
      />

      <KPICard
        label="Weighted Absolute Error"
        value={formatPercent(metrics.wape)}
        description="Error relative to total wind outturn"
        formula="Sum(abs(Error)) / Sum(Actual) * 100"
        interpretation="Lower is better"
        status={metrics.wape !== null && metrics.wape < 15 ? 'good' : 'neutral'}
        sampleCount={metrics.matched_observations}
      />

      <KPICard
        label="Mean Absolute % Error"
        value={formatPercent(metrics.mape)}
        description={`Excluded ${metrics.mape_excluded_count} intervals with Actual <= 1 MW`}
        formula="Mean(abs(Error / Actual)) * 100"
        interpretation="Excludes near-zero actuals"
        status="neutral"
        sampleCount={metrics.matched_observations - metrics.mape_excluded_count}
      />
    </div>
  );
};
