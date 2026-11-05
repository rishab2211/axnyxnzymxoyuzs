import React from 'react';
import { ChartContainer } from '@/components/charts/ChartContainer';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { formatTimeUTC, formatDateUTC } from '@/lib/formatters';

interface ScatterPoint {
  actual: number;
  forecast: number;
  error: number;
  time: string;
}

interface ForecastActualScatterChartProps {
  scatter: ScatterPoint[];
}

const ScatterTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload: ScatterPoint }>;
}> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const p = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white rounded-lg p-3 shadow-lg text-xs space-y-1 border border-slate-700">
        <p className="font-semibold text-slate-200">
          {formatDateUTC(p.time)} • {formatTimeUTC(p.time)} UTC
        </p>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Actual Outturn:</span>
          <span className="font-mono font-medium text-emerald-400">{Math.round(p.actual)} MW</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Day-Ahead Forecast:</span>
          <span className="font-mono font-medium text-teal-400">{Math.round(p.forecast)} MW</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-slate-800 pt-1">
          <span className="text-slate-400">Error (F - A):</span>
          <span
            className={`font-mono font-bold ${
              p.error > 0 ? 'text-amber-400' : p.error < 0 ? 'text-rose-400' : 'text-slate-300'
            }`}
          >
            {p.error > 0 ? '+' : ''}
            {Math.round(p.error)} MW
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const ForecastActualScatterChart: React.FC<ForecastActualScatterChartProps> = ({
  scatter,
}) => {
  // Find max value to calibrate 1:1 scale
  const maxVal = Math.max(
    ...scatter.map((p) => Math.max(p.actual, p.forecast)),
    1000
  );
  const ceiling = Math.ceil(maxVal / 1000) * 1000;

  return (
    <ChartContainer
      title="Forecast vs Actual Dispersion"
      subtitle="Scatter plot comparing day-ahead forecast vs actual hourly outturn against 1:1 parity line"
    >
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              type="number"
              dataKey="actual"
              name="Actual"
              unit=" MW"
              domain={[0, ceiling]}
              tick={{ fill: '#64748b', fontSize: 11 }}
              label={{
                value: 'Actual Generation (MW)',
                position: 'insideBottom',
                offset: -5,
                fill: '#64748b',
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="forecast"
              name="Forecast"
              unit=" MW"
              domain={[0, ceiling]}
              tick={{ fill: '#64748b', fontSize: 11 }}
              label={{
                value: 'Forecast (MW)',
                angle: -90,
                position: 'insideLeft',
                fill: '#64748b',
                fontSize: 11,
              }}
            />
            <Tooltip content={<ScatterTooltip />} />
            {/* Parity Line (y = x) */}
            <ReferenceLine
              segment={[
                { x: 0, y: 0 },
                { x: ceiling, y: ceiling },
              ]}
              stroke="#64748b"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: 'Parity line (y = x)',
                position: 'insideTopRight',
                fill: '#64748b',
                fontSize: 10,
              }}
            />
            <Scatter
              name="Intervals"
              data={scatter}
              fill="#0d9488"
              opacity={0.65}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between mt-2 text-xs text-slate-500 px-2">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 border-t-2 border-dashed border-slate-500 inline-block" />
          Parity line (y = x: Perfect Accuracy)
        </span>
        <span>Points above line: Overforecast • Points below line: Underforecast</span>
      </div>
    </ChartContainer>
  );
};
