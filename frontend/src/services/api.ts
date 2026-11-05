import type {
  DashboardResponse,
  IntervalMatchRecord,
  IntervalVintagesResponse,
  AccuracyMetrics,
  DailyAccuracyTrend,
  WorstIntervalRecord,
  DataQualitySummary,
  HealthResponse,
  IngestionResponse,
} from '@/types';

const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL;
const API_BASE = RAW_API_BASE ? `${RAW_API_BASE.replace(/\/$/, '')}/api` : '/api';

class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let errorDetail = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body.detail) errorDetail = body.detail;
    } catch {
      // Ignore json parse error on non-json error responses
    }
    throw new ApiError(errorDetail, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getDashboard: (deliveryDate: string, decisionCutoff: string) => {
    const params = new URLSearchParams({
      delivery_date: deliveryDate,
      decision_cutoff: decisionCutoff,
    });
    return fetchJson<DashboardResponse>(`${API_BASE}/dashboard?${params.toString()}`);
  },

  getForecasts: (deliveryDate: string, decisionCutoff: string) => {
    const params = new URLSearchParams({
      delivery_date: deliveryDate,
      decision_cutoff: decisionCutoff,
    });
    return fetchJson<IntervalMatchRecord[]>(`${API_BASE}/forecasts?${params.toString()}`);
  },

  getForecastVintages: (deliveryDate: string, decisionCutoff: string) => {
    const params = new URLSearchParams({
      delivery_date: deliveryDate,
      decision_cutoff: decisionCutoff,
    });
    return fetchJson<IntervalVintagesResponse>(`${API_BASE}/forecasts/vintages?${params.toString()}`);
  },

  getAccuracySummary: (dateFrom: string, dateTo: string, decisionCutoff: string) => {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
      decision_cutoff: decisionCutoff,
    });
    return fetchJson<AccuracyMetrics>(`${API_BASE}/accuracy/summary?${params.toString()}`);
  },

  getAccuracyTrend: (dateFrom: string, dateTo: string, decisionCutoff: string) => {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
      decision_cutoff: decisionCutoff,
    });
    return fetchJson<DailyAccuracyTrend[]>(`${API_BASE}/accuracy/trend?${params.toString()}`);
  },

  getAccuracyDistribution: (dateFrom: string, dateTo: string, decisionCutoff: string, bins = 10) => {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
      decision_cutoff: decisionCutoff,
      bins: bins.toString(),
    });
    return fetchJson<{
      histogram: { bins: { range: string; min: number; max: number; count: number }[]; total_samples: number; min_error: number; max_error: number };
      scatter: { actual: number; forecast: number; error: number; time: string }[];
      total_points: number;
    }>(`${API_BASE}/accuracy/distribution?${params.toString()}`);
  },

  getWorstIntervals: (dateFrom: string, dateTo: string, decisionCutoff: string, limit = 10) => {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
      decision_cutoff: decisionCutoff,
      limit: limit.toString(),
    });
    return fetchJson<WorstIntervalRecord[]>(`${API_BASE}/accuracy/worst?${params.toString()}`);
  },

  getDataQuality: (dateFrom: string, dateTo: string, decisionCutoff?: string) => {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
    });
    if (decisionCutoff) {
      params.append('decision_cutoff', decisionCutoff);
    }
    return fetchJson<DataQualitySummary>(`${API_BASE}/data-quality?${params.toString()}`);
  },

  getDataBounds: () => {
    return fetchJson<{
      min_date: string | null;
      max_date: string | null;
      total_actual_records: number;
      total_forecast_records: number;
    }>(`${API_BASE}/data-quality/bounds`);
  },

  getHealth: () => {
    return fetchJson<HealthResponse>(`${API_BASE}/health`);
  },

  triggerIngest: (dataset: string, startDate?: string, endDate?: string) => {
    return fetchJson<IngestionResponse>(`${API_BASE}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataset,
        start_date: startDate,
        end_date: endDate,
        force_reload: false,
      }),
    });
  },
};
