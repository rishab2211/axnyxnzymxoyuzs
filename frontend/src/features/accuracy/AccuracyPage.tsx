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
import { SmartIngestionTrigger } from '@/components/ui/SmartIngestionTrigger';
import { DateInput } from '@/components/ui/DateInput';
import { formatDateUTC } from '@/lib/formatters';
import { Calendar } from 'lucide-react';

export const AccuracyPage: React.FC = () => {
  const { decisionCutoff } = useFilters();
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-01-31');

  const isDateRangeValid = dateFrom <= dateTo;

  const { data: bounds } = useQuery({
    queryKey: ['data-bounds'],
    queryFn: () => api.getDataBounds(),
    staleTime: 60_000,
  });

  const {
    data: summary,
    isLoading: isSummaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['accuracy-summary', dateFrom, dateTo, decisionCutoff],
    queryFn: () => api.getAccuracySummary(dateFrom, dateTo, decisionCutoff),
    enabled: isDateRangeValid,
  });

  const {
    data: trends,
    isLoading: isTrendsLoading,
    error: trendsError,
  } = useQuery({
    queryKey: ['accuracy-trend', dateFrom, dateTo, decisionCutoff],
    queryFn: () => api.getAccuracyTrend(dateFrom, dateTo, decisionCutoff),
    enabled: isDateRangeValid,
  });

  const {
    data: distribution,
    isLoading: isDistLoading,
    error: distError,
  } = useQuery({
    queryKey: ['accuracy-distribution', dateFrom, dateTo, decisionCutoff],
    queryFn: () => api.getAccuracyDistribution(dateFrom, dateTo, decisionCutoff, 12),
    enabled: isDateRangeValid,
  });

  const {
    data: worst,
    isLoading: isWorstLoading,
    error: worstError,
  } = useQuery({
    queryKey: ['accuracy-worst', dateFrom, dateTo, decisionCutoff],
    queryFn: () => api.getWorstIntervals(dateFrom, dateTo, decisionCutoff, 10),
    enabled: isDateRangeValid,
  });

  const isError = Boolean(summaryError || trendsError || distError || worstError);

  const setRangePreset = (start: string, end: string) => {
    setDateFrom(start);
    setDateTo(end);
  };

  const handleLastNDays = (days: number) => {
    const endStr = bounds?.max_date || '2026-01-31';
    const end = new Date(endStr + 'T00:00:00Z');
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    setDateFrom(start.toISOString().slice(0, 10));
    setDateTo(endStr);
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
              onClick={() => {
                if (bounds?.min_date && bounds?.max_date) {
                  setRangePreset(bounds.min_date, bounds.max_date);
                } else {
                  setRangePreset('2026-01-01', '2026-01-31');
                }
              }}
              className={`px-2.5 py-1 rounded transition-colors ${
                (bounds && dateFrom === bounds.min_date && dateTo === bounds.max_date) ||
                (dateFrom === '2026-01-01' && dateTo === '2026-01-31')
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              Full Range
            </button>
            <button
              type="button"
              onClick={() => handleLastNDays(7)}
              className="px-2 py-1 rounded hover:text-slate-900 transition-colors"
            >
              Last 7D
            </button>
            <button
              type="button"
              onClick={() => handleLastNDays(14)}
              className="px-2 py-1 rounded hover:text-slate-900 transition-colors"
            >
              Last 14D
            </button>
            <button
              type="button"
              onClick={() => setRangePreset('2026-01-01', '2026-01-15')}
              className={`px-2 py-1 rounded transition-colors ${
                dateFrom === '2026-01-01' && dateTo === '2026-01-15'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              01–15 Jan
            </button>
            <button
              type="button"
              onClick={() => setRangePreset('2026-01-16', '2026-01-31')}
              className={`px-2 py-1 rounded transition-colors ${
                dateFrom === '2026-01-16' && dateTo === '2026-01-31'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              16–31 Jan
            </button>
          </div>

          {/* Date range pickers */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 pointer-events-none" />
            <DateInput
              value={dateFrom}
              onChange={setDateFrom}
            />
            <span className="text-slate-400 font-sans">to</span>
            <DateInput
              value={dateTo}
              onChange={setDateTo}
            />
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {!isDateRangeValid && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-xs font-medium flex items-center gap-2">
            <span>Invalid Date Range: Start date ({dateFrom}) cannot be after end date ({dateTo}). Please select a valid evaluation period.</span>
          </div>
        )}

        {isError && isDateRangeValid && (
          <ErrorState
            title="Failed to Load Accuracy Analytics"
            message="Unable to compute statistical accuracy metrics. Verify database connection and date filters."
            onRetry={() => refetchSummary()}
          />
        )}

        {isDateRangeValid && !isError && summary && summary.matched_observations === 0 && !isSummaryLoading && (
          <SmartIngestionTrigger
            startDate={dateFrom}
            endDate={dateTo}
            title={`No Matched Records for ${formatDateUTC(dateFrom)} to ${formatDateUTC(dateTo)}`}
            description={`No paired forecast and actual generation records exist in the database for ${formatDateUTC(dateFrom)} to ${formatDateUTC(dateTo)}. Click below to ingest from Elexon BMRS.`}
            buttonLabel={`Ingest Data for ${formatDateUTC(dateFrom)} to ${formatDateUTC(dateTo)}`}
            onSuccess={() => refetchSummary()}
          />
        )}

        {isDateRangeValid && !isError && (
          <>
            {/* KPI Cards Header */}
            {isSummaryLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : summary && summary.matched_observations > 0 ? (
              <AccuracyKPIRow metrics={summary} />
            ) : null}

            {/* Row 1: Daily Trend and Error Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {isTrendsLoading ? (
                <SkeletonCard className="h-80" />
              ) : trends ? (
                <AccuracyTrendChart data={trends} />
              ) : null}

              {isDistLoading ? (
                <SkeletonCard className="h-80" />
              ) : distribution ? (
                <ErrorDistributionChart distribution={distribution.histogram} />
              ) : null}
            </div>

            {/* Row 2: Scatter Plot & Worst-N Intervals */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {isDistLoading ? (
                <SkeletonCard className="h-80" />
              ) : distribution ? (
                <ForecastActualScatterChart scatter={distribution.scatter} />
              ) : null}

              {isWorstLoading ? (
                <SkeletonCard className="h-80" />
              ) : worst ? (
                <WorstIntervalsTable records={worst} />
              ) : null}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
};
