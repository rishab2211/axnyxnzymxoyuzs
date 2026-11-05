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
import { formatTimeUTC, formatMW, formatDateTimeUTC } from '@/lib/formatters';

interface ForecastActualChartProps {
  series: IntervalMatchRecord[];
  actual30mSeries: Actual30mRecord[];
}

interface ForecastActualTooltipItem {
  payload: {
    forecast: number | null;
    actualHourly: number | null;
    actual30m: number | null;
    error: number | null;
    publishTime?: string | null;
  };
}

const ForecastActualTooltip: React.FC<{
  active?: boolean;
  payload?: ForecastActualTooltipItem[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1.5 border border-slate-700 min-w-[200px]">
        <div className="font-semibold text-slate-300 border-b border-slate-700 pb-1">
          Interval: {label} UTC
        </div>
        {data.forecast !== null && (
          <div className="flex justify-between items-center text-blue-300">
            <span>Forecast (WINDFOR):</span>
            <span className="font-bold">{formatMW(data.forecast)}</span>
          </div>
        )}
        {data.actualHourly !== null && (
          <div className="flex justify-between items-center text-teal-300">
            <span>Actual (Hourly Outturn):</span>
            <span className="font-bold">{formatMW(data.actualHourly)}</span>
          </div>
        )}
        {data.actual30m !== null && (
          <div className="flex justify-between items-center text-emerald-400">
            <span>Actual (30m FUELHH):</span>
            <span className="font-bold">{formatMW(data.actual30m)}</span>
          </div>
        )}
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
            Vintage: {formatDateTimeUTC(data.publishTime)}
          </div>
        )}
      </div>
    );
  }
  return null;
};

export const ForecastActualChart: React.FC<ForecastActualChartProps> = ({
  series,
  actual30mSeries = [],
}) => {
  const [show30mOverlay, setShow30mOverlay] = React.useState<boolean>(true);

  // Build combined timeline: if actual30mSeries is provided, map across all 30m intervals
  const chartData = React.useMemo(() => {
    if (!actual30mSeries || actual30mSeries.length === 0 || !show30mOverlay) {
      return series.map((item) => ({
        time: formatTimeUTC(item.start_time),
        forecast: item.forecast_mw,
        actualHourly: item.actual_hourly_mw,
        actual30m: null,
        error: item.error_mw,
        publishTime: item.forecast_publish_time,
        status: item.status,
      }));
    }

    const hourlyMap = new Map(series.map((s) => [s.start_time, s]));
    const actual30mMap = new Map(actual30mSeries.map((a) => [a.start_time, a.generation_mw]));

    // Collect all timestamps from both series sorted
    const allTimestamps = Array.from(
      new Set([...series.map((s) => s.start_time), ...actual30mSeries.map((a) => a.start_time)])
    ).sort();

    return allTimestamps.map((ts) => {
      const hMatch = hourlyMap.get(ts);
      const a30m = actual30mMap.get(ts);
      return {
        time: formatTimeUTC(ts),
        forecast: hMatch ? hMatch.forecast_mw : null,
        actualHourly: hMatch ? hMatch.actual_hourly_mw : null,
        actual30m: a30m !== undefined ? a30m : null,
        error: hMatch ? hMatch.error_mw : null,
        publishTime: hMatch ? hMatch.forecast_publish_time : null,
        status: hMatch ? hMatch.status : '30m_actual',
      };
    });
  }, [series, actual30mSeries, show30mOverlay]);

  return (
    <ChartContainer
      title="Day-Ahead Wind Forecast vs. Actual Generation"
      subtitle="Elexon WINDFOR forecast available at cutoff compared against actual FUELHH outturn (MW)"
      headerAction={
        actual30mSeries.length > 0 ? (
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setShow30mOverlay((prev) => !prev)}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                show30mOverlay
                  ? 'bg-white text-teal-800 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {show30mOverlay ? '30m Texture: Visible' : '30m Texture: Hidden'}
            </button>
          </div>
        ) : undefined
      }
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
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `${v}`)}
              unit=" MW"
            />
            <Tooltip content={<ForecastActualTooltip />} />
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
              connectNulls={true}
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
              connectNulls={true}
              dot={{ r: 3, fill: '#0F766E' }}
              activeDot={{ r: 6 }}
            />
            {/* 30m Settlement Actual Reference Line */}
            {show30mOverlay && (
              <Line
                type="monotone"
                dataKey="actual30m"
                name="Raw 30m Actual (FUELHH)"
                stroke="#10B981"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={{ r: 2, fill: '#10B981' }}
                activeDot={{ r: 4 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center justify-between">
        <span>
          <strong className="text-slate-800">Methodology Note:</strong> WINDFOR publishes hourly forecasts; FUELHH provides 30-minute actuals. Outturn is aggregated to 1-hour resolution for 1:1 matching, with raw 30-min settlement intervals overlaid for intraday variance.
        </span>
      </div>
    </ChartContainer>
  );
};
