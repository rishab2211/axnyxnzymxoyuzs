import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { PageShell } from '@/components/layout/PageShell';
import { KPICard } from '@/components/kpi/KPICard';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatPercent, formatDateTimeUTC, formatDateUTC } from '@/lib/formatters';
import { DateInput } from '@/components/ui/DateInput';
import { useFilters } from '@/hooks/useFilters';
import {
  RefreshCw,
  AlertTriangle,
  Layers,
  CheckCircle2,
} from 'lucide-react';

export const DataQualityPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { decisionCutoff } = useFilters();
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-01-31');
  const [ingestStatusMessage, setIngestStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const isDateRangeValid = dateFrom <= dateTo;

  const { data: bounds } = useQuery({
    queryKey: ['data-bounds'],
    queryFn: () => api.getDataBounds(),
    staleTime: 60_000,
  });

  const {
    data: quality,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['data-quality', dateFrom, dateTo, decisionCutoff],
    queryFn: () => api.getDataQuality(dateFrom, dateTo, decisionCutoff),
    enabled: isDateRangeValid,
  });

  const ingestMutation = useMutation({
    mutationFn: (dataset: string) => api.triggerIngest(dataset, dateFrom, dateTo),
    onSuccess: (data) => {
      setIngestStatusMessage({
        type: 'success',
        text: `Ingestion successfully triggered: ${data.message || 'Records ingested.'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['data-quality'] });
      queryClient.invalidateQueries({ queryKey: ['health'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['accuracy-summary'] });
    },
    onError: (err: Error) => {
      setIngestStatusMessage({
        type: 'error',
        text: `Ingestion failed: ${err.message || 'Unknown network error.'}`,
      });
    },
  });

  const handleIngest = (dataset: string) => {
    setIngestStatusMessage(null);
    ingestMutation.mutate(dataset);
  };

  return (
    <PageShell
      title="Data Quality & Lineage Diagnostics"
      subtitle={`Coverage completeness, granularity alignment verification, and Elexon BMRS ingestion audit logs (Cutoff: ${decisionCutoff} UTC)`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Range Presets */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => {
                if (bounds?.min_date && bounds?.max_date) {
                  setDateFrom(bounds.min_date);
                  setDateTo(bounds.max_date);
                }
              }}
              className="px-2 py-0.5 rounded hover:text-slate-900 transition-colors"
            >
              Full Scope
            </button>
            <button
              type="button"
              onClick={() => {
                const endStr = bounds?.max_date || '2026-01-31';
                const end = new Date(endStr + 'T00:00:00Z');
                const start = new Date(end);
                start.setUTCDate(start.getUTCDate() - 6);
                setDateFrom(start.toISOString().slice(0, 10));
                setDateTo(endStr);
              }}
              className="px-2 py-0.5 rounded hover:text-slate-900 transition-colors"
            >
              Last 7D
            </button>
          </div>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs shadow-xs">
            <span className="text-slate-500 font-medium">Evaluation Period:</span>
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
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-teal-600' : ''}`} />
            Refresh
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {!isDateRangeValid && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-xs font-medium flex items-center gap-2">
            <span>Invalid Date Range: Start date ({dateFrom}) cannot be after end date ({dateTo}). Please select a valid period.</span>
          </div>
        )}

        {/* Notification Banner */}
        {ingestStatusMessage && (
          <div
            className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
              ingestStatusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {ingestStatusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{ingestStatusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setIngestStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600 ml-4 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {isLoading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <SkeletonCard className="h-48" />
            <SkeletonCard className="h-64" />
          </div>
        )}

        {error && (
          <ErrorState
            title="Failed to Load Data Quality Diagnostics"
            message="Could not retrieve interval completeness or ingestion history from backend."
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !error && quality && (
          <>
            {/* KPI Coverage Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                label="Actual 30m Settlement Intervals"
                value={`${quality.actual_30m_records} / ${quality.expected_30m_intervals}`}
                description="BMRS FUELHH wind generation records"
                formula="Received Records / (Days * 48 SPs)"
                interpretation={`${formatPercent(quality.actual_coverage_pct)} coverage`}
                status={quality.actual_coverage_pct >= 95 ? 'good' : 'warning'}
                sampleCount={quality.actual_30m_records}
              />

              <KPICard
                label="Forecast Hourly Intervals"
                value={`${quality.forecasts_available} / ${quality.expected_hourly_intervals}`}
                description="BMRS WINDFOR raw published records"
                formula="Available Forecasts / (Days * 24 Hours)"
                interpretation={`${formatPercent(quality.forecast_coverage_pct)} raw coverage`}
                status={quality.forecast_coverage_pct >= 95 ? 'good' : 'warning'}
                sampleCount={quality.forecasts_available}
              />

              <KPICard
                label="Matched Evaluation Pairs"
                value={`${quality.matched_intervals} / ${quality.expected_hourly_intervals}`}
                description={
                  quality.cutoff_eligible_forecasts !== undefined
                    ? `${quality.cutoff_eligible_forecasts} eligible before cutoff`
                    : "Joined forecast + aggregated actual pairs"
                }
                formula="Matched (Forecast & Actual) / Expected Hourly"
                interpretation={`${formatPercent(quality.matched_coverage_pct)} complete`}
                status={quality.matched_coverage_pct >= 95 ? 'good' : 'warning'}
                sampleCount={quality.matched_intervals}
              />

              <KPICard
                label="Missing Observations"
                value={quality.missing_forecast_intervals + quality.missing_actual_intervals}
                description={
                  quality.missing_cutoff_forecast_intervals && quality.missing_cutoff_forecast_intervals > quality.missing_forecast_intervals
                    ? `${quality.missing_actual_intervals} missing actuals, ${quality.missing_cutoff_forecast_intervals - quality.missing_forecast_intervals} past cutoff`
                    : `${quality.missing_forecast_intervals} missing forecast, ${quality.missing_actual_intervals} missing actual`
                }
                formula="Expected Hourly - Available Pairs"
                interpretation="Surfaced as null in calculations"
                status={quality.missing_forecast_intervals + quality.missing_actual_intervals === 0 ? 'good' : 'danger'}
              />
            </div>

            {/* Granularity & Architecture Lineage Audit Notice */}
            <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg text-teal-400 shrink-0">
                  <Layers className="w-6 h-6" />
                </div>
                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Granularity Alignment & Anti-Look-Ahead Verification
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Critical architectural methodology governing UK electricity settlement pairing:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-1">
                    <div className="bg-slate-800/80 rounded-lg p-3.5 border border-slate-700/60">
                      <span className="text-teal-400 font-semibold block mb-1">
                        1. Granularity Resolution
                      </span>
                      <p className="text-slate-300 leading-relaxed">
                        Elexon BMRS <code className="text-teal-300">WINDFOR</code> forecasts are published at hourly intervals (744 in Jan 2026), whereas <code className="text-teal-300">FUELHH</code> actuals arrive at 30-min settlement intervals (1,488). We aggregate pairs of actual SPs into an hourly mean for exact 1:1 error computation.
                      </p>
                    </div>

                    <div className="bg-slate-800/80 rounded-lg p-3.5 border border-slate-700/60">
                      <span className="text-teal-400 font-semibold block mb-1">
                        2. Anti-Look-Ahead Gate
                      </span>
                      <p className="text-slate-300 leading-relaxed">
                        To reflect real power market day-ahead trading, only forecasts published at or before the decision cutoff (default 11:00 UTC) are eligible. Later publications are excluded from evaluation metrics to prevent look-ahead bias.
                      </p>
                    </div>

                    <div className="bg-slate-800/80 rounded-lg p-3.5 border border-slate-700/60">
                      <span className="text-teal-400 font-semibold block mb-1">
                        3. Zero &amp; Missing Policy
                      </span>
                      <p className="text-slate-300 leading-relaxed">
                        Missing forecasts are treated as <code className="text-rose-300">null</code>, never fabricated as 0 MW. MAPE denominator exclusions are strictly tracked for intervals with actual generation &le; 1.0 MW to avoid infinite percentage distortions.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Manual Ingestion Trigger Console */}
            <ChartContainer
              title="Manual Ingestion & Synchronization Console"
              subtitle="Fetch and normalize historical or fresh data directly from Elexon BMRS API"
              headerAction={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={ingestMutation.isPending}
                    onClick={() => handleIngest('ALL')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${ingestMutation.isPending ? 'animate-spin' : ''}`} />
                    Ingest All (FUELHH + WINDFOR)
                  </button>
                  <button
                    type="button"
                    disabled={ingestMutation.isPending}
                    onClick={() => handleIngest('FUELHH')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium shadow-xs disabled:opacity-50 transition-colors"
                  >
                    Ingest Actuals Only
                  </button>
                  <button
                    type="button"
                    disabled={ingestMutation.isPending}
                    onClick={() => handleIngest('WINDFOR')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium shadow-xs disabled:opacity-50 transition-colors"
                  >
                    Ingest Forecasts Only
                  </button>
                </div>
              }
            >
              <div className="text-xs text-slate-600 bg-slate-50 rounded-lg p-4 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-900 block mb-0.5">
                    Target Ingestion Date Window
                  </span>
                  <span>
                    Range: <span className="font-mono font-medium text-slate-800">{formatDateUTC(dateFrom)}</span> to{' '}
                    <span className="font-mono font-medium text-slate-800">{formatDateUTC(dateTo)}</span> (7-day chunking with exponential backoff)
                  </span>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <span>API rate limit: 10 req/s • Timeout: 30s • Max retries: 3</span>
                </div>
              </div>
            </ChartContainer>

            {/* Ingestion Runs History Audit Log */}
            <ChartContainer
              title="Historical Ingestion Run Audit Logs"
              subtitle="Audit trail of automated and manual Elexon BMRS ingestion cycles"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Run ID</th>
                      <th className="py-2.5 px-3">Dataset</th>
                      <th className="py-2.5 px-3">Started At</th>
                      <th className="py-2.5 px-3">Completed At</th>
                      <th className="py-2.5 px-3 text-right">Received</th>
                      <th className="py-2.5 px-3 text-right">Inserted</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Diagnostic Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {quality.recent_ingestions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-400">
                          No historical ingestion runs recorded in database yet.
                        </td>
                      </tr>
                    ) : (
                      quality.recent_ingestions.map((run) => {
                        const normStatus = (run.status || '').toLowerCase();
                        const statusVariant =
                          normStatus === 'success'
                            ? 'success'
                            : normStatus === 'running'
                            ? 'info'
                            : normStatus === 'partial'
                            ? 'warning'
                            : 'danger';

                        return (
                          <tr key={run.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              #{run.id}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-teal-800">
                              {run.dataset}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {formatDateTimeUTC(run.started_at)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {run.completed_at ? formatDateTimeUTC(run.completed_at) : 'In progress...'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-800">
                              {run.records_received.toLocaleString('en-GB')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-medium text-emerald-700">
                              {run.records_inserted.toLocaleString('en-GB')}
                            </td>
                            <td className="py-2.5 px-3">
                              <StatusBadge
                                label={run.status}
                                variant={statusVariant}
                                className="py-0.5 px-2 text-[10px]"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                              {run.error_message || 'Completed without anomalies.'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </ChartContainer>
          </>
        )}
      </div>
    </PageShell>
  );
};
