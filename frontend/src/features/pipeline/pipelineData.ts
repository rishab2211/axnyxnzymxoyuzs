import type { Node, Edge } from '@xyflow/react';

export interface NodeMetadata {
  id: string;
  name: string;
  stage: string;
  type: string;
  badge: string;
  summary: string;
  description: string;
  businessRules: string[];
  inputs: string[];
  outputs: string[];
  codeReference: string;
  liveKey?: 'actuals' | 'forecasts' | 'hourly' | 'matched' | 'health' | 'metrics';
}

export const PIPELINE_METADATA: Record<string, NodeMetadata> = {
  'src-fuelhh': {
    id: 'src-fuelhh',
    name: 'Elexon BMRS FUELHH',
    stage: 'Source',
    type: 'External REST API',
    badge: 'Source Data',
    summary: 'Half-hourly outturn generation by fuel type for Great Britain power grid.',
    description:
      'Official Elexon BMRS dataset publishing outturn generation per fuel type. Filtered strictly to fuelType == "WIND". Contains 48 settlement periods per delivery day (1,488 half-hour intervals in January 2026).',
    businessRules: [
      'Filter strictly for fuelType == "WIND"',
      'Records are unique per startTime + fuelType',
      'Settlement period numbers range from 1 to 48 (or 50 during clock change)',
      'Single publishTime per record — no multi-version revisions',
    ],
    inputs: ['Elexon BMRS API Endpoint: /datasets/FUELHH'],
    outputs: ['1,488 30-min settlement generation records (MW)'],
    codeReference: 'backend/app/services/elexon_client.py',
    liveKey: 'actuals',
  },
  'src-windfor': {
    id: 'src-windfor',
    name: 'Elexon BMRS WINDFOR',
    stage: 'Source',
    type: 'External REST API',
    badge: 'Source Data',
    summary: 'Day-ahead national wind generation forecast publications.',
    description:
      'National wind generation forecast time series. Published approximately 8 times per day (~02:30, 04:30, 07:30, 09:30, 11:30, 15:30, 18:30, 22:30 UTC). Published at hourly resolution (744 periods in Jan 2026).',
    businessRules: [
      'Published at 60-minute intervals (hourly), NOT 30-minute intervals',
      'No settlementDate or settlementPeriod fields in payload',
      'Multiple forecast versions published for each delivery interval',
      'Forecasts span rolling forward horizons',
    ],
    inputs: ['Elexon BMRS API Endpoint: /datasets/WINDFOR'],
    outputs: ['~18,000 multi-vintage forecast records (MW)'],
    codeReference: 'backend/app/services/elexon_client.py',
    liveKey: 'forecasts',
  },
  'proc-client': {
    id: 'proc-client',
    name: 'Async Ingestion Client',
    stage: 'Processing',
    type: 'Ingestion Engine',
    badge: 'Async Worker',
    summary: 'Resilient HTTP client with chunked requests and exponential backoff.',
    description:
      'Orchestrates API calls to Elexon BMRS using httpx. Divides the 31-day evaluation period into 7-day chunks to prevent API gateway timeouts on large WINDFOR payloads.',
    businessRules: [
      'Max 7-day request window per API call',
      'Exponential backoff: 3 retries, base 1.5x delay with jitter',
      'Handles 429 rate limits and 5xx upstream gateway errors',
      'Logs request duration and payload size for audit trail',
    ],
    inputs: ['Target date ranges (e.g., 2026-01-01 to 2026-01-31)'],
    outputs: ['Raw JSON responses parsed into structured records'],
    codeReference: 'backend/app/services/elexon_client.py',
  },
  'proc-normalize': {
    id: 'proc-normalize',
    name: 'Validation & Normalizer',
    stage: 'Processing',
    type: 'Data Normalizer',
    badge: 'Schema Validator',
    summary: 'Pydantic v2 validation, UTC timezone normalization, and anomaly audits.',
    description:
      'Parses raw JSON records, converts all timestamps to UTC-aware datetime objects, and audits outturn generation values. Detects negative generation anomalies without silently dropping data.',
    businessRules: [
      'Timestamps cast to ISO 8601 UTC-aware datetime',
      'Negative generation audited and logged as warning',
      'Duplicate startTime + publishTime records deduplicated',
      'Missing numeric values rejected before database insertion',
    ],
    inputs: ['Raw BMRS JSON payloads'],
    outputs: ['Validated ActualGeneration & WindForecast domain models'],
    codeReference: 'backend/app/services/data_processor.py',
  },
  'store-postgres': {
    id: 'store-postgres',
    name: 'PostgreSQL Database',
    stage: 'Storage',
    type: 'Relational Database',
    badge: 'Persistence',
    summary: 'ACID-compliant storage for outturns, forecasts, and ingestion runs.',
    description:
      'Primary persistence tier. Enforces unique constraints and multi-column indexes for high-concurrency lookups. Supports cross-dialect upsert for both PostgreSQL and SQLite.',
    businessRules: [
      'actual_generation: unique index on (start_time, fuel_type)',
      'wind_forecasts: unique index on (start_time, publish_time)',
      'ingestion_runs: audit log of all automated and manual cycles',
      'Indexed by start_time for sub-10ms analytical filtering',
    ],
    inputs: ['Validated domain model objects'],
    outputs: ['Indexed relational tables'],
    codeReference: 'backend/app/models/generation.py',
    liveKey: 'health',
  },
  'store-hourly': {
    id: 'store-hourly',
    name: 'Hourly Actuals Aggregator',
    stage: 'Storage',
    type: 'Data Transformation',
    badge: 'Aggregation',
    summary: 'Aggregates 30-min settlement actuals to hourly means (744 intervals).',
    description:
      'Resolves the fundamental granularity mismatch between 30-min FUELHH actuals and 60-min WINDFOR forecasts. Computes the arithmetic mean of two consecutive settlement periods.',
    businessRules: [
      'Hourly Actual = Mean(SP_2k-1, SP_2k)',
      'Tracks sp_count (expected = 2) for completeness verification',
      'Exact temporal boundary alignment with hourly WINDFOR forecasts',
      'Stores in actual_generation_hourly table for instant joins',
    ],
    inputs: ['Two consecutive 30-min actuals (e.g., 00:00 & 00:30)'],
    outputs: ['One 60-min hourly mean outturn (e.g., 00:00 - 01:00)'],
    codeReference: 'backend/app/services/data_processor.py',
    liveKey: 'hourly',
  },
  'engine-vintage': {
    id: 'engine-vintage',
    name: 'Anti-Look-Ahead Selector',
    stage: 'Analytics',
    type: 'Business Logic',
    badge: 'Vintage Selector',
    summary: 'Filters forecast publications based on the Day-Ahead decision cutoff.',
    description:
      'Strictly excludes forecasts published after the decision cutoff (default 11:00 UTC). Selects the most recent publication that was available to power trading desks before market gate closure.',
    businessRules: [
      'Cutoff Datetime = delivery_date at decision_cutoff_time (UTC)',
      'Eligible: publish_time <= Cutoff Datetime',
      'Selected: latest publication time among eligible vintages',
      'Returns null (never zero) if no eligible forecast exists',
    ],
    inputs: ['Delivery date + configured cutoff time (e.g. 11:00 UTC)'],
    outputs: ['Single authoritative day-ahead forecast per delivery interval'],
    codeReference: 'backend/app/services/forecast_selector.py',
  },
  'engine-matcher': {
    id: 'engine-matcher',
    name: 'Interval Alignment Matcher',
    stage: 'Analytics',
    type: 'Data Alignment',
    badge: 'Inner Join',
    summary: 'Aligns day-ahead forecasts with hourly aggregated actual outturn.',
    description:
      'Creates paired observation records for all 24 delivery hours. Injects 30-min actuals as context series for dual-granularity UI display.',
    businessRules: [
      'Join key: start_time (UTC hourly timestamp)',
      'Computes Signed Error: Forecast - Actual (MW)',
      'Computes Lead Time: Hours between publish_time and delivery',
      'Classifies status: matched, missing_forecast, missing_actual',
    ],
    inputs: ['Selected forecasts + hourly aggregated actuals'],
    outputs: ['744 matched hourly evaluation pairs with reference actuals'],
    codeReference: 'backend/app/services/analytics_engine.py',
    liveKey: 'matched',
  },
  'engine-accuracy': {
    id: 'engine-accuracy',
    name: 'Vectorized Accuracy Engine',
    stage: 'Analytics',
    type: 'Mathematical Engine',
    badge: 'NumPy Vectorized',
    summary: 'Calculates industry-standard forecast error metrics.',
    description:
      'Vectorized computation of MAE, RMSE, Bias, WAPE, and MAPE. Handles near-zero actuals cleanly to prevent arithmetic division errors.',
    businessRules: [
      'MAE = Mean(abs(Forecast - Actual))',
      'RMSE = sqrt(Mean((Forecast - Actual)^2))',
      'Bias = Mean(Forecast - Actual) (Positive = Over, Negative = Under)',
      'WAPE = Sum(abs(Error)) / Sum(Actual) * 100',
      'MAPE = Mean(abs(Error / Actual)) * 100 (excludes Actual <= 1.0 MW)',
    ],
    inputs: ['Matched forecast and actual generation vectors'],
    outputs: ['Statistical KPI summary, daily trends, and error distributions'],
    codeReference: 'backend/app/services/accuracy.py',
    liveKey: 'metrics',
  },
  'api-gateway': {
    id: 'api-gateway',
    name: 'FastAPI Analytical Routes',
    stage: 'API',
    type: 'REST Service',
    badge: 'FastAPI Gateway',
    summary: 'High-performance analytical endpoints with OpenAPI documentation.',
    description:
      'Serves pre-calculated and on-demand queries to the React frontend. Implements strict schema validation via Pydantic response models.',
    businessRules: [
      'GET /api/dashboard: Executive KPIs & dual-granularity time series',
      'GET /api/forecasts: Interval-level matched pairs & publication vintages',
      'GET /api/accuracy: Summary KPIs, daily trends, histogram, worst intervals',
      'GET /api/data-quality: Completeness coverage & ingestion audit trail',
      'GET /api/health: Relational connectivity and live table record counts',
    ],
    inputs: ['HTTP query parameters: delivery_date, decision_cutoff, date_from, date_to'],
    outputs: ['JSON responses conforming to OpenAPI 3.1 specification'],
    codeReference: 'backend/app/api/routes/',
  },
  'ui-dashboard': {
    id: 'ui-dashboard',
    name: 'Executive Dashboard',
    stage: 'Frontend',
    type: 'React Interface',
    badge: 'UI View',
    summary: 'Executive overview with KPIs and dual-granularity time series.',
    description:
      'Displays MAE, RMSE, Bias, WAPE cards, dual-granularity chart (30m actuals + hourly forecast), and directional over/under-forecast error bars.',
    businessRules: [
      'Interactive date picker (Jan 1-31, 2026)',
      'Configurable decision cutoff time (default 11:00 UTC)',
      'Live metric tooltips with formal mathematical definitions',
    ],
    inputs: ['/api/dashboard query response'],
    outputs: ['Executive visualization and situational awareness'],
    codeReference: 'frontend/src/features/dashboard/DashboardPage.tsx',
  },
  'ui-forecasts': {
    id: 'ui-forecasts',
    name: 'Forecast Explorer',
    stage: 'Frontend',
    type: 'React Interface',
    badge: 'UI View',
    summary: '24-hour delivery schedule table and publication evolution inspector.',
    description:
      'Tabulates all 24 delivery hours with forecast, actual, error, and lead time. Allows clicking any interval to view the full progression of forecasts published across the day.',
    businessRules: [
      'Visual indicator for cutoff-eligible vs post-cutoff publications',
      'Lead time display in decimal hours',
      'Direct comparison between published revisions',
    ],
    inputs: ['/api/forecasts & /api/forecasts/vintages'],
    outputs: ['Vintage audit inspector'],
    codeReference: 'frontend/src/features/forecasts/ForecastsPage.tsx',
  },
  'ui-accuracy': {
    id: 'ui-accuracy',
    name: 'Accuracy Analytics',
    stage: 'Frontend',
    type: 'React Interface',
    badge: 'UI View',
    summary: 'Statistical error distributions, trend analysis, and worst intervals.',
    description:
      'Comprehensive statistical suite with daily trend lines, error distribution histogram, forecast vs actual scatter plot with y=x parity line, and top-10 worst errors.',
    businessRules: [
      'Multi-day range selector with week presets',
      'Parity line reference for systematic bias inspection',
      'Worst-10 ranking by absolute error magnitude',
    ],
    inputs: ['/api/accuracy/summary, /trend, /distribution, /worst'],
    outputs: ['Statistical diagnostic charts'],
    codeReference: 'frontend/src/features/accuracy/AccuracyPage.tsx',
  },
  'ui-quality': {
    id: 'ui-quality',
    name: 'Data Quality & Lineage',
    stage: 'Frontend',
    type: 'React Interface',
    badge: 'UI View',
    summary: 'Interval completeness verification and ingestion audit logs.',
    description:
      'Exposes coverage metrics (1,488 30m vs 744 60m), missing interval reports, historical ingestion execution logs, and manual on-demand ingestion triggers.',
    businessRules: [
      'Calculates coverage percentages vs theoretical expected intervals',
      'Surfaces ingestion run status (SUCCESS, PARTIAL, FAILED)',
      'On-demand ingestion mutation trigger',
    ],
    inputs: ['/api/data-quality & /api/ingest'],
    outputs: ['Data completeness & pipeline audit trail'],
    codeReference: 'frontend/src/features/data-quality/DataQualityPage.tsx',
  },
};

export const INITIAL_NODES: Node[] = [
  // Stage 1: Sources (X: 50)
  {
    id: 'src-fuelhh',
    type: 'pipelineNode',
    position: { x: 50, y: 120 },
    data: { id: 'src-fuelhh' },
  },
  {
    id: 'src-windfor',
    type: 'pipelineNode',
    position: { x: 50, y: 380 },
    data: { id: 'src-windfor' },
  },

  // Stage 2: Processing (X: 350)
  {
    id: 'proc-client',
    type: 'pipelineNode',
    position: { x: 350, y: 240 },
    data: { id: 'proc-client' },
  },
  {
    id: 'proc-normalize',
    type: 'pipelineNode',
    position: { x: 350, y: 440 },
    data: { id: 'proc-normalize' },
  },

  // Stage 3: Storage (X: 680)
  {
    id: 'store-postgres',
    type: 'pipelineNode',
    position: { x: 680, y: 180 },
    data: { id: 'store-postgres' },
  },
  {
    id: 'store-hourly',
    type: 'pipelineNode',
    position: { x: 680, y: 400 },
    data: { id: 'store-hourly' },
  },

  // Stage 4: Analytics Engine (X: 1000)
  {
    id: 'engine-vintage',
    type: 'pipelineNode',
    position: { x: 1000, y: 120 },
    data: { id: 'engine-vintage' },
  },
  {
    id: 'engine-matcher',
    type: 'pipelineNode',
    position: { x: 1000, y: 300 },
    data: { id: 'engine-matcher' },
  },
  {
    id: 'engine-accuracy',
    type: 'pipelineNode',
    position: { x: 1000, y: 480 },
    data: { id: 'engine-accuracy' },
  },

  // Stage 5: API Layer (X: 1320)
  {
    id: 'api-gateway',
    type: 'pipelineNode',
    position: { x: 1320, y: 300 },
    data: { id: 'api-gateway' },
  },

  // Stage 6: UI Features (X: 1640)
  {
    id: 'ui-dashboard',
    type: 'pipelineNode',
    position: { x: 1640, y: 80 },
    data: { id: 'ui-dashboard' },
  },
  {
    id: 'ui-forecasts',
    type: 'pipelineNode',
    position: { x: 1640, y: 220 },
    data: { id: 'ui-forecasts' },
  },
  {
    id: 'ui-accuracy',
    type: 'pipelineNode',
    position: { x: 1640, y: 360 },
    data: { id: 'ui-accuracy' },
  },
  {
    id: 'ui-quality',
    type: 'pipelineNode',
    position: { x: 1640, y: 500 },
    data: { id: 'ui-quality' },
  },
];

export const INITIAL_EDGES: Edge[] = [
  // Sources -> Ingestion Client
  { id: 'e-fuelhh-client', source: 'src-fuelhh', target: 'proc-client', animated: true },
  { id: 'e-windfor-client', source: 'src-windfor', target: 'proc-client', animated: true },

  // Client -> Normalizer
  { id: 'e-client-norm', source: 'proc-client', target: 'proc-normalize', animated: true },

  // Normalizer -> Postgres
  { id: 'e-norm-postgres', source: 'proc-normalize', target: 'store-postgres', animated: true },

  // Postgres -> Hourly Aggregation
  { id: 'e-postgres-hourly', source: 'store-postgres', target: 'store-hourly' },

  // Postgres & Hourly -> Engine
  { id: 'e-postgres-vintage', source: 'store-postgres', target: 'engine-vintage' },
  { id: 'e-hourly-matcher', source: 'store-hourly', target: 'engine-matcher' },
  { id: 'e-vintage-matcher', source: 'engine-vintage', target: 'engine-matcher' },

  // Matcher -> Accuracy Engine
  { id: 'e-matcher-accuracy', source: 'engine-matcher', target: 'engine-accuracy', animated: true },

  // Accuracy & Matcher -> API Gateway
  { id: 'e-matcher-api', source: 'engine-matcher', target: 'api-gateway' },
  { id: 'e-accuracy-api', source: 'engine-accuracy', target: 'api-gateway', animated: true },

  // API Gateway -> Frontend Features
  { id: 'e-api-dash', source: 'api-gateway', target: 'ui-dashboard' },
  { id: 'e-api-forecasts', source: 'api-gateway', target: 'ui-forecasts' },
  { id: 'e-api-accuracy', source: 'api-gateway', target: 'ui-accuracy' },
  { id: 'e-api-quality', source: 'api-gateway', target: 'ui-quality' },
];
