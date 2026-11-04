import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import { ChartContainer } from '@/components/charts/ChartContainer';
import type { IntervalMatchRecord } from '@/types';
import { formatTimeUTC } from '@/lib/formatters';

interface ErrorChartProps {
  series: IntervalMatchRecord[];
}

export const ErrorChart: React.FC<ErrorChartProps> = ({ series }) => {
  const chartData = series.map((item) => ({
    time: formatTimeUTC(item.start_time),
    error: item.error_mw,
    isOverforecast: item.error_mw !== null && item.error_mw > 0,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      if (data.error === null) return null;
      return (
        <div className="bg-slate-900 text-white p-2.5 rounded-lg shadow-xl text-xs border border-slate-700">
          <div className="text-slate-400">{label} UTC</div>
          <div className="font-bold text-sm mt-0.5">
            Error: {data.error > 0 ? `+${data.error}` : data.error} MW
          </div>
          <div className="text-[11px] text-slate-300 mt-1">
            {data.error > 0 ? 'Overforecast (Procurement Surplus)' : (data.error < 0 ? 'Underforecast (Procurement Shortfall)' : 'Zero Deviation')}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <ChartContainer
      title="Forecast Error Over Time (Forecast - Actual)"
      subtitle="Positive error indicates overforecasting (amber); negative indicates underforecasting (rose)"
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={{ stroke: '#CBD5E1' }}
              tick={{ fill: '#64748B', fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: '#CBD5E1' }}
              tick={{ fill: '#64748B', fontSize: 11 }}
              tickFormatter={(v) => `${v}`}
              unit=" MW"
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
            <Bar dataKey="error" radius={[2, 2, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.error === null ? '#CBD5E1' : (entry.isOverforecast ? '#D97706' : '#DC2626')}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
};
