import React from 'react';
import { ChartContainer } from '@/components/charts/ChartContainer';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

interface ErrorDistributionChartProps {
  distribution: {
    bins: { range: string; min: number; max: number; count: number }[];
    total_samples: number;
    min_error: number;
    max_error: number;
  };
}

export const ErrorDistributionChart: React.FC<ErrorDistributionChartProps> = ({
  distribution,
}) => {
  const data = distribution.bins.map((b) => ({
    name: `${Math.round(b.min)} to ${Math.round(b.max)}`,
    count: b.count,
    min: b.min,
    max: b.max,
    pct: distribution.total_samples > 0 ? ((b.count / distribution.total_samples) * 100).toFixed(1) : '0.0',
  }));

  const getBarColor = (min: number, max: number) => {
    if (max <= 0) return '#f43f5e'; // Underforecast (Actual > Forecast -> Error < 0)
    if (min >= 0) return '#f59e0b'; // Overforecast (Forecast > Actual -> Error > 0)
    return '#0d9488'; // Centered near zero error
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white rounded-lg p-3 shadow-lg text-xs space-y-1 border border-slate-700">
          <p className="font-semibold text-slate-200">Error Band: {item.name} MW</p>
          <p className="text-teal-400">
            Intervals: <span className="font-mono font-medium">{item.count}</span> ({item.pct}%)
          </p>
          <p className="text-slate-400 text-[11px]">
            {item.max <= 0
              ? 'Underforecasting'
              : item.min >= 0
              ? 'Overforecasting'
              : 'Near-zero balanced error'}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ChartContainer
      title="Forecast Error Distribution"
      subtitle={`Histogram of ${distribution.total_samples} hourly matched error intervals (Forecast - Actual)`}
    >
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="name"
              angle={-25}
              textAnchor="end"
              tick={{ fill: '#64748b', fontSize: 10 }}
              interval={0}
              height={45}
            />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.min, entry.max)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-6 mt-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-rose-500 inline-block" />
          Underforecast (Error &lt; 0 MW)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-teal-600 inline-block" />
          Near Balanced (0 MW)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
          Overforecast (Error &gt; 0 MW)
        </span>
      </div>
    </ChartContainer>
  );
};
