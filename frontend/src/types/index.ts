export interface AccuracyMetrics {
  mae: number | null;
  rmse: number | null;
  bias: number | null;
  wape: number | null;
  mape: number | null;
  mape_excluded_count: number;
  matched_observations: number;
  expected_observations: number;
  coverage_pct: number;
}

export interface IntervalMatchRecord {
  start_time: string;
  forecast_mw: number | null;
  actual_hourly_mw: number | null;
  error_mw: number | null;
  forecast_publish_time: string | null;
  forecast_lead_hours: number | null;
  status: 'matched' | 'missing_forecast' | 'missing_actual' | 'missing_both';
}

export interface Actual30mRecord {
  start_time: string;
  settlement_period: number;
  generation_mw: number;
  publish_time: string;
}

export interface DashboardResponse {
  delivery_date: string;
  decision_cutoff: string;
  cutoff_datetime: string;
  metrics: AccuracyMetrics;
  series: IntervalMatchRecord[];
  actual_30m_series: Actual30mRecord[];
  overforecast_count: number;
  underforecast_count: number;
  zero_error_count: number;
}

export interface DailyAccuracyTrend {
  delivery_date: string;
  mae: number | null;
  rmse: number | null;
  bias: number | null;
  wape: number | null;
  matched_count: number;
  expected_count: number;
  coverage_pct: number;
}

export interface VintagePublication {
  publish_time: string;
  generation_mw: number;
  lead_hours: number;
  is_eligible: boolean;
}

export interface IntervalVintageGroup {
  start_time: string;
  selected_publish_time: string | null;
  selected_generation_mw: number | null;
  actual_generation_mw: number | null;
  vintages: {
    publish_time: string;
    generation_mw: number;
    lead_hours: number;
    is_eligible: boolean;
  }[];
}

export interface IntervalVintagesResponse {
  delivery_date: string;
  decision_cutoff: string;
  cutoff_datetime: string;
  intervals: IntervalVintageGroup[];
}

export interface WorstIntervalRecord {
  start_time: string;
  forecast_mw: number;
  actual_mw: number;
  error_mw: number;
  absolute_error_mw: number;
  percentage_error: number | null;
  forecast_publish_time: string;
}

export interface DataQualitySummary {
  date_from: string;
  date_to: string;
  expected_30m_intervals: number;
  actual_30m_records: number;
  expected_hourly_intervals: number;
  hourly_actuals_available: number;
  forecasts_available: number;
  matched_intervals: number;
  missing_forecast_intervals: number;
  missing_actual_intervals: number;
  actual_coverage_pct: number;
  forecast_coverage_pct: number;
  matched_coverage_pct: number;
  recent_ingestions: {
    id: number;
    dataset: string;
    started_at: string;
    completed_at: string | null;
    status: string;
    records_received: number;
    records_inserted: number;
    error_message: string | null;
  }[];
}

export interface FilterState {
  deliveryDate: string;
  decisionCutoff: string;
}
