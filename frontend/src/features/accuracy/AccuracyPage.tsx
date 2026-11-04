import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useFilters } from '@/hooks/useFilters';
import { PageShell } from '@/components/layout/PageShell';
import { AccuracyKPIRow } from './AccuracyKPIRow';
import { AccuracyTrendChart } from './AccuracyTrendChart';
import { ErrorDistributionChart } from './ErrorDistributionChart';
import { ForecastActualScatterChart } from './ForecastActualScatterChart';
import { WorstIntervalsTable } from './WorstIntervalsTable';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Calendar } from 'lucide-react';

export const AccuracyPage: React.FC = () => {
  const { decisionCutoff } = useFilters();
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-01-31');

  const {
    data: summary,
    isLoading: isSummaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['accuracy-summary', dateFrom, dateTo, decisionCutoff],
    queryFn: () => api.getAccuracySummary(dateFrom, dateTo, decisionCutoff),
  });

  const {
    data: trends,
    isLoading: isTrendsLoading,
    error: trendsError,
  } = useQuery({
    queryKey: ['accuracy-trend', dateFrom, dateTo, decisionCutoff],
    queryFn: () => api.getAccuracyTrend(dateFrom, dateTo, decisionCutoff),
  });

  const {
    data: distribution,
    isLoading: isDistLoading,
    error: distError,
  } = useQuery({
    queryKey: ['accuracy-distribution', dateFrom, dateTo, decisionCutoff],
    queryFn: () => api.getAccuracyDistribution(dateFrom, dateTo, decisionCutoff, 12),
  });

  const {
    data: worst,
    isLoading: isWorstLoading,
    error: worstError,
  } = useQuery({
    queryKey: ['accuracy-worst', dateFrom, dateTo, decisionCutoff],
    queryFn: () => api.getWorstIntervals(dateFrom, dateTo, decisionCutoff, 10),
  });

  const isLoading = isSummaryLoading || isTrendsLoading || isDistLoading || isWorstLoading;
  const isError = Boolean(summaryError || trendsError || distError || worstError);

  const setRangePreset = (start: string, end: string) => {
    setDateFrom(start);
    setDateTo(end);
  };

  return (
    <PageShell
      title="Accuracy Analytics & Error Statistics"
      subtitle={`Statistical error distributions, trend analysis, and worst-interval diagnostics (Cutoff: ${decisionCutoff} UTC)`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setRangePreset('2026-01-01', '2026-01-31')}
              className={`px-2 py-1 rounded transition-colors ${
                dateFrom === '2026-01-01' && dateTo === '2026-01-31'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              Full Jan
            </button>
            <button
              type="button"
              onClick={() => setRangePreset('2026-01-01', '2026-01-07')}
              className={`px-2 py-1 rounded transition-colors ${
                dateFrom === '2026-01-01' && dateTo === '2026-01-07'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              W1 (1-7)
            </button>
            <button
              type="button"
              onClick={() => setRangePreset('2026-01-08', '2026-01-14')}
              className={`px-2 py-1 rounded transition-colors ${
                dateFrom === '2026-01-08' && dateTo === '2026-01-14'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              W2 (8-14)
            </button>
            <button
              type="button"
              onClick={() => setRangePreset('2026-01-15', '2026-01-21')}
              className={`px-2 py-1 rounded transition-colors ${
                dateFrom === '2026-01-15' && dateTo === '2026-01-21'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              W3 (15-21)
            </button>
            <button
              type="button"
              onClick={() => setRangePreset('2026-01-22', '2026-01-31')}
              className={`px-2 py-1 rounded transition-colors ${
                dateFrom === '2026-01-22' && dateTo === '2026-01-31'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              W4 (22-31)
            </button>
          </div>

          {/* Date range pickers */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              min="2026-01-01"
              max="2026-01-31"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs font-medium text-slate-800 bg-transparent focus:outline-none"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              min="2026-01-01"
              max="2026-01-31"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-xs font-medium text-slate-800 bg-transparent focus:outline-none"
            />
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {isLoading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SkeletonCard className="h-80" />
              <SkeletonCard className="h-80" />
            </div>
          </div>
        )}

        {isError && (
          <ErrorState
            title="Failed to Load Accuracy Analytics"
            message="Unable to compute statistical accuracy metrics. Verify database connection and date filters."
            onRetry={() => refetchSummary()}
          />
        )}

        {!isLoading && !isError && summary && summary.matched_observations === 0 && (
          <EmptyState
            title="No Matched Forecasts in Selected Date Range"
            description="No paired forecast and actual generation records found for this period. Try extending the date range or adjusting the decision cutoff."
          />
        )}

        {!isLoading && !isError && summary && summary.matched_observations > 0 && (
          <>
            {/* KPI Cards Header */}
            <AccuracyKPIRow metrics={summary} />

            {/* Row 1: Daily Trend and Error Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {trends && <AccuracyTrendChart data={trends} />}
              {distribution && <ErrorDistributionChart distribution={distribution.histogram} />}
            </div>

            {/* Row 2: Scatter Plot & Worst-N Intervals */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {distribution && <ForecastActualScatterChart scatter={distribution.scatter} />}
              {worst && <WorstIntervalsTable records={worst} />}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
};
