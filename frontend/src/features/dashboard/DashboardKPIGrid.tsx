import React from 'react';
import type { AccuracyMetrics } from '@/types';
import { KPICard } from '@/components/kpi/KPICard';
import { formatMW, formatPercent } from '@/lib/formatters';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface DashboardKPIGridProps {
  metrics: AccuracyMetrics;
  overCount: number;
  underCount: number;
  zeroCount: number;
}

export const DashboardKPIGrid: React.FC<DashboardKPIGridProps> = ({
  metrics,
  overCount,
  underCount,
  zeroCount,
}) => {
  const biasStatus = metrics.bias === null ? 'neutral' : (Math.abs(metrics.bias) < 200 ? 'good' : (metrics.bias > 0 ? 'warning' : 'danger'));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard
          label="Mean Absolute Error (MAE)"
          value={formatMW(metrics.mae)}
          description="Average error magnitude"
          formula="Mean(abs(Forecast - Actual))"
          interpretation="Lower is better"
          status={metrics.mae !== null && metrics.mae < 500 ? 'good' : 'neutral'}
          sampleCount={metrics.matched_observations}
        />

        <KPICard
          label="Root Mean Square Error"
          value={formatMW(metrics.rmse)}
          description="Penalizes large errors heavily"
          formula="sqrt(Mean((Forecast - Actual)^2))"
          interpretation="Lower is better"
          status="neutral"
          sampleCount={metrics.matched_observations}
        />

        <KPICard
          label="Forecast Bias"
          value={formatMW(metrics.bias)}
          description={metrics.bias && metrics.bias > 0 ? 'Systematic Overforecasting' : (metrics.bias && metrics.bias < 0 ? 'Systematic Underforecasting' : 'Neutral signed bias')}
          formula="Mean(Forecast - Actual)"
          interpretation="Positive = Overforecast, Negative = Underforecast"
          status={biasStatus}
          sampleCount={metrics.matched_observations}
        />

        <KPICard
          label="Weighted Error (WAPE)"
          value={formatPercent(metrics.wape)}
          description="Error relative to total outturn"
          formula="Sum(abs(Error)) / Sum(Actual) * 100"
          interpretation="Lower is better"
          status={metrics.wape !== null && metrics.wape < 10 ? 'good' : 'neutral'}
          sampleCount={metrics.matched_observations}
        />
      </div>

      {/* Coverage & Directional Summary Strip */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 shadow-xs">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-slate-400">Matched Coverage: </span>
            <span className="font-bold text-slate-800">{metrics.coverage_pct}%</span>
            <span className="text-slate-400 text-[11px]"> ({metrics.matched_observations}/{metrics.expected_observations} hourly intervals)</span>
          </div>
          <div className="hidden sm:block h-4 w-px bg-slate-200" />
          <div>
            <span className="text-slate-400">Granularity Policy: </span>
            <span className="font-medium text-slate-700">1:1 Hourly Matching (Aggregated FUELHH)</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge variant="warning" label={`${overCount} Overforecast`} />
          <StatusBadge variant="danger" label={`${underCount} Underforecast`} />
          {zeroCount > 0 && <StatusBadge variant="neutral" label={`${zeroCount} Exact Match`} />}
        </div>
      </div>
    </div>
  );
};
