import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageShell } from '@/components/layout/PageShell';
import { useFilters } from '@/hooks/useFilters';
import { api } from '@/services/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatTimeUTC, formatDateTimeUTC, formatMW, formatDateUTC } from '@/lib/formatters';
import { Clock, Layers } from 'lucide-react';

export const ForecastsPage: React.FC = () => {
  const { deliveryDate, decisionCutoff } = useFilters();
  const [selectedIntervalIndex, setSelectedIntervalIndex] = useState<number>(0);

  const { data: forecasts, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['forecasts', deliveryDate, decisionCutoff],
    queryFn: () => api.getForecasts(deliveryDate, decisionCutoff),
    staleTime: 60 * 1000,
  });

  const { data: vintagesData } = useQuery({
    queryKey: ['vintages', deliveryDate, decisionCutoff],
    queryFn: () => api.getForecastVintages(deliveryDate, decisionCutoff),
    staleTime: 60 * 1000,
  });

  const selectedIntervalVintages = vintagesData?.intervals?.[selectedIntervalIndex];

  return (
    <PageShell
      title="Forecast Explorer & Vintage Timeline"
      subtitle={`Analyze available forecast vintages before decision cutoff (${decisionCutoff} UTC) on ${formatDateUTC(deliveryDate)}`}
    >
      {isLoading && (
        <div className="space-y-6">
          <SkeletonCard />
          <div className="h-96 bg-white rounded-xl border border-slate-200 animate-pulse" />
        </div>
      )}

      {isError && (
        <ErrorState
          title="Could not load forecast intervals"
          message={(error as Error)?.message || 'An error occurred while loading interval data.'}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && forecasts && (
        <div className="space-y-8">
          {forecasts.length === 0 ? (
            <EmptyState
              title="No Forecasts Available"
              description={`No forecast records available for ${deliveryDate}.`}
            />
          ) : (
            <>
              {/* Interval Selection & Details Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 24-Interval Table */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Delivery Intervals (24 Hours)</h3>
                      <p className="text-xs text-slate-500">Select an interval to view its publication history</p>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">1:1 Hourly Matching</span>
                  </div>

                  <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 border-b border-slate-200 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Interval (UTC)</th>
                          <th className="py-2.5 px-3">Forecast</th>
                          <th className="py-2.5 px-3">Actual</th>
                          <th className="py-2.5 px-3">Error</th>
                          <th className="py-2.5 px-3">Lead Time</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {forecasts.map((row, idx) => {
                          const isSelected = idx === selectedIntervalIndex;
                          const err = row.error_mw;
                          return (
                            <tr
                              key={row.start_time}
                              onClick={() => setSelectedIntervalIndex(idx)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? 'bg-teal-50/60 font-semibold text-teal-950' : 'hover:bg-slate-50/80 text-slate-700'
                              }`}
                            >
                              <td className="py-2.5 px-3 font-sans font-medium text-slate-900 flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-teal-600' : 'bg-transparent'}`} />
                                {formatTimeUTC(row.start_time)}
                              </td>
                              <td className="py-2.5 px-3">{formatMW(row.forecast_mw)}</td>
                              <td className="py-2.5 px-3">{formatMW(row.actual_hourly_mw)}</td>
                              <td className="py-2.5 px-3">
                                {err !== null ? (
                                  <span className={err > 0 ? 'text-amber-700' : err < 0 ? 'text-rose-700' : 'text-slate-500'}>
                                    {err > 0 ? `+${err}` : err} MW
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-sans text-slate-500">
                                {row.forecast_lead_hours !== null ? `${row.forecast_lead_hours}h prior` : '—'}
                              </td>
                              <td className="py-2.5 px-3 font-sans">
                                <StatusBadge
                                  label={row.status === 'matched' ? 'Matched' : (row.status === 'missing_forecast' ? 'No Forecast' : 'No Actual')}
                                  variant={row.status === 'matched' ? 'success' : 'warning'}
                                  showDot={false}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Vintage Evolution Inspector Panel */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-900 font-semibold text-sm">
                      <Layers className="w-4 h-4 text-teal-600" />
                      <span>Publication Evolution</span>
                    </div>

                    {selectedIntervalVintages ? (
                      <div className="mt-4 space-y-4">
                        <div>
                          <div className="text-xs text-slate-500">Target Settlement Period</div>
                          <div className="text-lg font-bold text-slate-900 font-sans">
                            {formatTimeUTC(selectedIntervalVintages.start_time)} UTC
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">
                            Outturn: {formatMW(selectedIntervalVintages.actual_generation_mw)}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Forecast Publications ({selectedIntervalVintages.vintages.length})
                          </div>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                            {selectedIntervalVintages.vintages.map((v, i) => (
                              <div
                                key={i}
                                className={`p-2.5 rounded-lg border text-xs flex justify-between items-center ${
                                  v.is_eligible
                                    ? 'bg-slate-50 border-slate-200'
                                    : 'bg-rose-50/40 border-rose-100 opacity-60'
                                }`}
                              >
                                <div>
                                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    <span>{formatDateTimeUTC(v.publish_time)}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                    Lead time: {v.lead_hours}h ahead
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-slate-900 text-sm font-mono">
                                    {formatMW(v.generation_mw)}
                                  </span>
                                  <div>
                                    <StatusBadge
                                      label={v.is_eligible ? 'Eligible' : 'Past Cutoff'}
                                      variant={v.is_eligible ? 'success' : 'danger'}
                                      showDot={false}
                                      className="text-[10px] py-0 px-1.5"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 py-10 text-center">
                        Select an interval on the left to inspect historical vintages.
                      </div>
                    )}
                  </div>

                  <div className="mt-4 p-3 bg-slate-50 rounded-lg text-[11px] text-slate-500 border border-slate-100">
                    Forecasts published after the decision cutoff are flagged as <em>Past Cutoff</em> and strictly excluded from day-ahead decision reconstruction.
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </PageShell>
  );
};
