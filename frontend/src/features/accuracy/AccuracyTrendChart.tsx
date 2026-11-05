import React, { useState } from 'react';
import type { DailyAccuracyTrend } from '@/types';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { formatDateUTC } from '@/lib/formatters';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';

interface AccuracyTrendChartProps {
  data: DailyAccuracyTrend[];
}

interface TooltipPayloadItem {
  payload: {
    fullDate: string;
    matchedCount: number;
    mae: number | null;
    rmse: number | null;
    bias: number | null;
    wape: number | null;
  };
}

const AccuracyTrendTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadItem[];
}> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white rounded-lg p-3 shadow-lg text-xs space-y-1.5 border border-slate-700">
        <p className="font-semibold text-slate-200 border-b border-slate-700 pb-1">
          Date: {item.fullDate} ({item.matchedCount}/24 hrs)
        </p>
        <div className="flex justify-between gap-4">
          <span className="text-teal-400">MAE:</span>
          <span className="font-mono font-medium">{item.mae !== null ? `${item.mae} MW` : '—'}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-indigo-400">RMSE:</span>
          <span className="font-mono font-medium">{item.rmse !== null ? `${item.rmse} MW` : '—'}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-amber-400">Bias:</span>
          <span className="font-mono font-medium">{item.bias !== null ? `${item.bias > 0 ? '+' : ''}${item.bias} MW` : '—'}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-rose-400">WAPE:</span>
          <span className="font-mono font-medium">{item.wape !== null ? `${item.wape}%` : '—'}</span>
        </div>
      </div>
    );
  }
  return null;
};

export const AccuracyTrendChart: React.FC<AccuracyTrendChartProps> = ({ data }) => {
  const [metricMode, setMetricMode] = useState<'mw' | 'wape'>('mw');

  const chartData = data.map((d) => {
    const parts = d.delivery_date.split('-');
    const shortDate = parts.length === 3 ? `${parts[2]}-${parts[1]}` : d.delivery_date; // 'DD-MM'
    return {
      date: shortDate,
      fullDate: formatDateUTC(d.delivery_date), // 'DD-MM-YYYY'
      mae: d.mae !== null ? Math.round(d.mae) : null,
      rmse: d.rmse !== null ? Math.round(d.rmse) : null,
      bias: d.bias !== null ? Math.round(d.bias) : null,
      wape: d.wape !== null ? Number(d.wape.toFixed(1)) : null,
      matchedCount: d.matched_count,
    };
  });

  return (
    <ChartContainer
      title="Daily Forecast Accuracy Evolution"
      subtitle="Track daily MAE, RMSE, Bias, and WAPE across the delivery month"
      headerAction={
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setMetricMode('mw')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              metricMode === 'mw'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Absolute (MW)
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('wape')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              metricMode === 'wape'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Percentage (WAPE %)
          </button>
        </div>
      }
    >
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {metricMode === 'mw' ? (
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis
                unit=" MW"
                tick={{ fill: '#64748b', fontSize: 11 }}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<AccuracyTrendTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
              />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="2 2" />
              <Bar dataKey="bias" name="Bias (MW)" fill="#cbd5e1" opacity={0.6} />
              <Line
                type="monotone"
                dataKey="mae"
                name="MAE (MW)"
                stroke="#0d9488"
                strokeWidth={2.5}
                connectNulls={false}
                dot={{ r: 3, fill: '#0d9488' }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="rmse"
                name="RMSE (MW)"
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="4 4"
                connectNulls={false}
                dot={{ r: 2.5, fill: '#6366f1' }}
              />
            </ComposedChart>
          ) : (
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis unit="%" tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip content={<AccuracyTrendTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
              />
              <Line
                type="monotone"
                dataKey="wape"
                name="WAPE (%)"
                stroke="#f43f5e"
                strokeWidth={2.5}
                connectNulls={false}
                dot={{ r: 3.5, fill: '#f43f5e' }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-[11px] text-slate-500 text-right">
        Gaps in trend lines represent dates with no matched forecast-actual observations.
      </div>
    </ChartContainer>
  );
};
