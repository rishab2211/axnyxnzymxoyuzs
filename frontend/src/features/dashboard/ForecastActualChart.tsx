import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { ChartContainer } from '@/components/charts/ChartContainer';
import type { IntervalMatchRecord, Actual30mRecord } from '@/types';
import { formatTimeUTC, formatMW } from '@/lib/formatters';

interface ForecastActualChartProps {
  series: IntervalMatchRecord[];
  actual30mSeries: Actual30mRecord[];
}

export const ForecastActualChart: React.FC<ForecastActualChartProps> = ({
  series,
}) => {
  // Format data for Recharts
  const chartData = series.map((item) => ({
    time: formatTimeUTC(item.start_time),
    forecast: item.forecast_mw,
    actualHourly: item.actual_hourly_mw,
    error: item.error_mw,
    publishTime: item.forecast_publish_time,
    status: item.status,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1.5 border border-slate-700 min-w-[200px]">
          <div className="font-semibold text-slate-300 border-b border-slate-700 pb-1">
            Interval: {label} UTC
          </div>
          <div className="flex justify-between items-center text-blue-300">
            <span>Forecast (WINDFOR):</span>
            <span className="font-bold">{formatMW(data.forecast)}</span>
          </div>
          <div className="flex justify-between items-center text-teal-300">
            <span>Actual (Hourly Outturn):</span>
            <span className="font-bold">{formatMW(data.actualHourly)}</span>
          </div>
          {data.error !== null && (
            <div className="flex justify-between items-center text-slate-300 pt-1 border-t border-slate-800">
              <span>Deviation:</span>
              <span className={`font-bold ${data.error > 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                {data.error > 0 ? `+${data.error}` : data.error} MW
              </span>
            </div>
          )}
          {data.publishTime && (
            <div className="text-[10px] text-slate-400 pt-1">
              Vintage: {new Date(data.publishTime).toUTCString().slice(17, 22)} UTC
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <ChartContainer
      title="Day-Ahead Wind Forecast vs. Actual Generation"
      subtitle="Elexon WINDFOR forecast available at cutoff compared against actual FUELHH outturn (MW)"
    >
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              unit=" MW"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: '16px', fontSize: '12px' }}
            />
            {/* Forecast Line */}
            <Line
              type="monotone"
              dataKey="forecast"
              name="Day-Ahead Forecast (WINDFOR)"
              stroke="#2563EB"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#2563EB' }}
              activeDot={{ r: 6 }}
            />
            {/* Actual Outturn Line */}
            <Line
              type="monotone"
              dataKey="actualHourly"
              name="Actual Generation (Hourly Outturn)"
              stroke="#0F766E"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#0F766E' }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center justify-between">
        <span>
          <strong className="text-slate-800">Methodology Note:</strong> WINDFOR publishes hourly forecasts; FUELHH provides 30-minute actuals. Outturn is aggregated to 1-hour resolution for 1:1 matching without synthetic interpolation.
        </span>
      </div>
    </ChartContainer>
  );
};
