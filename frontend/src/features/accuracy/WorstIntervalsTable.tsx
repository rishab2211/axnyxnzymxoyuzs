import React from 'react';
import type { WorstIntervalRecord } from '@/types';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatMW, formatDateTimeUTC, formatPercent } from '@/lib/formatters';

interface WorstIntervalsTableProps {
  records: WorstIntervalRecord[];
}

export const WorstIntervalsTable: React.FC<WorstIntervalsTableProps> = ({ records }) => {
  return (
    <ChartContainer
      title="Top 10 Largest Forecast Deviation Intervals"
      subtitle="Ranked by absolute forecast error magnitude (|Forecast - Actual|)"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-3"># Rank</th>
              <th className="py-2.5 px-3">Delivery Interval</th>
              <th className="py-2.5 px-3 text-right">Forecast</th>
              <th className="py-2.5 px-3 text-right">Actual Outturn</th>
              <th className="py-2.5 px-3 text-right">Abs Error</th>
              <th className="py-2.5 px-3 text-right">Signed Error</th>
              <th className="py-2.5 px-3 text-right">% Error</th>
              <th className="py-2.5 px-3">Forecast Published</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((rec, index) => {
              const isOver = rec.error_mw > 0;
              return (
                <tr key={`${rec.start_time}-${index}`} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 inline-flex items-center justify-center font-mono text-[10px]">
                      {index + 1}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-900">
                    {formatDateTimeUTC(rec.start_time)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-medium text-teal-700">
                    {formatMW(rec.forecast_mw)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-medium text-emerald-700">
                    {formatMW(rec.actual_mw)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                    {formatMW(rec.absolute_error_mw)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    <span className={isOver ? 'text-amber-700 font-semibold' : 'text-rose-700 font-semibold'}>
                      {isOver ? '+' : ''}
                      {formatMW(rec.error_mw)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {rec.percentage_error !== null ? formatPercent(rec.percentage_error) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">
                    <div className="flex items-center gap-2">
                      <span>{formatDateTimeUTC(rec.forecast_publish_time)}</span>
                      <StatusBadge
                        label={isOver ? 'Overforecast' : 'Underforecast'}
                        variant={isOver ? 'warning' : 'danger'}
                        showDot={false}
                        className="py-0.5 px-1.5 text-[10px]"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ChartContainer>
  );
};
