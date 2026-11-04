import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageShell } from '@/components/layout/PageShell';
import { useFilters } from '@/hooks/useFilters';
import { api } from '@/services/api';
import { DashboardKPIGrid } from './DashboardKPIGrid';
import { ForecastActualChart } from './ForecastActualChart';
import { ErrorChart } from './ErrorChart';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateUTC } from '@/lib/formatters';

export const DashboardPage: React.FC = () => {
  const { deliveryDate, decisionCutoff } = useFilters();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', deliveryDate, decisionCutoff],
    queryFn: () => api.getDashboard(deliveryDate, decisionCutoff),
    staleTime: 60 * 1000,
  });

  return (
    <PageShell
      title="Day-Ahead Wind Forecast Overview"
      subtitle={`National GB wind outturn vs. forecasts available as of ${decisionCutoff} UTC on ${formatDateUTC(deliveryDate)}`}
    >
      {isLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="h-80 bg-white rounded-xl border border-slate-200 animate-pulse" />
          <div className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse" />
        </div>
      )}

      {isError && (
        <ErrorState
          title="Could not load executive dashboard"
          message={(error as Error)?.message || 'An unexpected error occurred while communicating with the backend.'}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && data && (
        <div className="space-y-8">
          {data.metrics.matched_observations === 0 ? (
            <EmptyState
              title="No Forecast Observations Found"
              description={`No eligible forecasts or actual records found for delivery date ${deliveryDate} with cutoff ${decisionCutoff} UTC. Please verify that data has been ingested.`}
              action={
                <button
                  onClick={() => api.triggerIngest('ALL')}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  Trigger Full Ingestion
                </button>
              }
            />
          ) : (
            <>
              <DashboardKPIGrid
                metrics={data.metrics}
                overCount={data.overforecast_count}
                underCount={data.underforecast_count}
                zeroCount={data.zero_error_count}
              />

              <ForecastActualChart
                series={data.series}
                actual30mSeries={data.actual_30m_series}
              />

              <ErrorChart series={data.series} />
            </>
          )}
        </div>
      )}
    </PageShell>
  );
};
