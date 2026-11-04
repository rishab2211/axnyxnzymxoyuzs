# WindScope — Day-Ahead Renewable Intelligence

> **Version 1.0.0** | Enterprise Wind Generation Forecast Evaluation & Analytics for Great Britain Electricity Settlement

WindScope is a production-grade full-stack energy analytics platform designed for UK electricity utilities, power trading desks, and grid analysts. It evaluates national day-ahead wind generation forecasts from Elexon BMRS against settlement outturn generation across January 2026, strictly enforcing decision cutoffs and resolving fundamental market dataset granularity mismatches.

---

## 1. Executive Summary & Value Proposition

In the Great Britain electricity market (BETTA), wind generation unpredictability drives significant balancing costs. Commercial power traders and portfolio managers face two severe data hurdles when evaluating forecast reliability:

1. **Granularity Divergence:** Actual generation outturn (`FUELHH`) is published at **30-minute settlement periods** (1,488 intervals in January 2026), whereas day-ahead national forecasts (`WINDFOR`) are published at **60-minute resolution** (744 intervals).
2. **Look-Ahead Bias:** Energy trading desks operate under strict gate closure deadlines. Forecast evaluations that naively pick the latest publication published *after* market decision cutoff introduce severe look-ahead bias, inflating apparent model accuracy.

**WindScope resolves both challenges:**
- Combines consecutive 30-minute settlement actuals into mathematically rigorous hourly outturn means ($\bar{x}_t = (SP_{2t-1} + SP_{2t}) / 2$) while preserving high-resolution 30-minute actuals as a dual-granularity reference series.
- Enforces an anti-look-ahead vintage selection engine that filters publications against a configurable day-ahead decision cutoff (default **11:00 UTC** proxy).
- Provides an interactive **React Flow Data Pipeline Explorer** displaying the live 14-node architecture, governing business rules, and ingress/egress lineage.

---

## 2. Architecture & Data Flow

```mermaid
flowchart LR
    subgraph S1["1. External Sources"]
        F1["Elexon BMRS FUELHH\n(Half-Hourly Outturn)"]
        F2["Elexon BMRS WINDFOR\n(Day-Ahead Forecasts)"]
    end

    subgraph S2["2. Ingestion & Normalization"]
        P1["Async HTTPX Client\n(7-Day Chunking + 3x Retries)"]
        P2["Pydantic v2 Normalizer\n(UTC Parse + Anomaly Audit)"]
    end

    subgraph S3["3. Persistence"]
        DB["PostgreSQL Relational DB\n(Indexed Time-Series Storage)"]
        AGG["Hourly Aggregator\n(30m -> 60m Arithmetic Mean)"]
    end

    subgraph S4["4. Analytics Engine"]
        SEL["Anti-Look-Ahead Selector\n(publish_time <= 11:00 UTC)"]
        MAT["Interval Matcher\n(1:1 Temporal Alignment)"]
        ACC["Vectorized Accuracy Engine\n(NumPy: MAE, RMSE, Bias, WAPE, MAPE)"]
    end

    subgraph S5["5. Delivery"]
        API["FastAPI REST Routes\n(OpenAPI 3.1 Specification)"]
        UI["React 19 Frontend Shell\n(Recharts + React Flow v12)"]
    end

    F1 --> P1
    F2 --> P1
    P1 --> P2
    P2 --> DB
    DB --> AGG
    DB --> SEL
    AGG --> MAT
    SEL --> MAT
    MAT --> ACC
    ACC --> API
    MAT --> API
    API --> UI
```

### Technology Stack

| Layer | Component | Specification |
|---|---|---|
| **Backend** | Python 3.14 / FastAPI | High-performance asynchronous REST API with Pydantic v2 schemas |
| **ORM & Database** | SQLAlchemy 2.0 / Alembic / PostgreSQL 16 | ACID-compliant storage with migration versioning and SQLite test dialect support |
| **Data Math** | NumPy / Pandas | Vectorized forecast error formulations and safe zero-division handling |
| **Frontend** | React 19 / TypeScript 5.8 / Vite 8 | Strict TypeScript compilation with `@/*` path mapping and TanStack Query v5 |
| **UI & Styling** | Tailwind CSS v4 / Lucide Icons | Responsive desktop/tablet/mobile layouts with energy domain color tokens |
| **Visualizations** | Recharts 3.10 | Dual-granularity time-series, error histograms, and scatter parity plots |
| **Architecture Lineage** | `@xyflow/react` 12 | Interactive 14-node architecture diagram with live query cache bindings |
| **DevOps** | Docker / Docker Compose / Nginx | Multi-stage container builds with healthchecks and SPA reverse proxy |

---

## 3. Elexon BMRS API Investigation & Methodology

### Strict Scope Boundary
- **Fuel Type:** Great Britain national `WIND` generation only.
- **Evaluation Period:** January 1, 2026 00:00 UTC through January 31, 2026 23:59 UTC.
- **Publication Horizon:** Includes forecast vintages published December 30–31, 2025 for January 1, 2026 delivery intervals.
- **Exclusions:** Solar, hydro, interconnectors, embedded distributed generation, power price forecasting, and automated bidding.

### Key Domain Findings & Implementations

#### 1. Granularity Mismatch Resolution
- `WINDFOR` is published strictly at **60-minute intervals** (744 total intervals across January 2026).
- `FUELHH` is published at **30-minute settlement periods** (1,488 total settlement periods across January 2026).
- **Engine Formulation:** For every delivery hour $t$, the hourly actual generation $a_t$ is computed from settlement periods $SP_{2t-1}$ and $SP_{2t}$:
  $$\bar{a}_t = \frac{SP_{2t-1} + SP_{2t}}{2}$$
- **User Interface Dual-Resolution:** The 30-minute raw outturn curve is rendered as an amber area background, while the hourly aggregated outturn and day-ahead forecast are rendered as discrete aligned line series.

#### 2. Anti-Look-Ahead Cutoff Enforcement
- `WINDFOR` forecasts are issued approximately **8 times per day** (~02:30, 04:30, 07:30, 09:30, 11:30, 15:30, 18:30, 22:30 UTC).
- In actual power trading, bids must be submitted before gate closure. The system defaults to **11:00 UTC** on the delivery day (configurable via UI controls or API parameters):
  $$\mathcal{V}(t) = \left\{ f \in \text{WINDFOR} : f.\text{start\_time} = t \land f.\text{publish\_time} \le \text{Cutoff}(delivery\_date) \right\}$$
  $$\hat{f}(t) = \operatorname{argmax}_{f \in \mathcal{V}(t)} \left( f.\text{publish\_time} \right)$$
- If no forecast was published on or before the cutoff, the engine returns `null` (missing observation). **Forecasts are never backfilled with 0 MW.**

#### 3. Zero-Denominator Safeguard in MAPE
- Traditional Mean Absolute Percentage Error (MAPE) divides by actual generation. When wind generation drops to zero or near-zero, division produces division-by-zero errors or infinite distortions.
- **Safeguard Rule:** Intervals where $a_t \le 1.0\text{ MW}$ are excluded from the MAPE denominator. Excluded intervals are strictly audited and returned in `mape_excluded_count`.

---

## 4. Mathematical Formulations

Given $N$ matched hourly intervals with forecast $\hat{f}_t$ and actual outturn $a_t$:

| Metric | Mathematical Formula | Interpretation |
|---|---|---|
| **Signed Error** | $e_t = \hat{f}_t - a_t$ | Positive = Overforecast (excess scheduled); Negative = Underforecast (shortage) |
| **Mean Absolute Error (MAE)** | $\text{MAE} = \frac{1}{N} \sum_{t=1}^N \|e_t\|$ | Average absolute error magnitude in Megawatts (MW) |
| **Root Mean Square Error (RMSE)** | $\text{RMSE} = \sqrt{\frac{1}{N} \sum_{t=1}^N e_t^2}$ | Penalizes large outlier forecast errors heavily |
| **Forecast Bias** | $\text{Bias} = \frac{1}{N} \sum_{t=1}^N e_t$ | Net directional tendency: $> 0$ overforecasting, $< 0$ underforecasting |
| **Weighted Absolute Percentage Error (WAPE)** | $\text{WAPE} = \frac{\sum_{t=1}^N \|e_t\|}{\sum_{t=1}^N a_t} \times 100\%$ | Error percentage weighted by total national wind generation volume |
| **Mean Absolute Percentage Error (MAPE)** | $\text{MAPE} = \frac{1}{\|K\|} \sum_{t \in K} \left\| \frac{e_t}{a_t} \right\| \times 100\%$ | Percentage error on valid intervals $K = \{t : a_t > 1.0\text{ MW}\}$ |

---

## 5. Quickstart & Local Setup

### Option A: Complete Docker Compose (Recommended)

Run the database, backend service, and frontend web server with a single command:

```bash
# 1. Clone the repository
git clone https://github.com/rishab-bhatnagar/windscope.git
cd windscope

# 2. Build and launch all 3 containers
docker compose up --build
```

The services will become available at:
- **Frontend Web UI:** [http://localhost:5173](http://localhost:5173) (or [http://localhost:3000](http://localhost:3000))
- **Backend API:** [http://localhost:8000](http://localhost:8000)
- **Interactive OpenAPI Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Diagnostics:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

### Option B: Local Development Setup

#### Backend (Python 3.12+)
```bash
cd backend

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations (against SQLite or local PostgreSQL)
alembic upgrade head

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```

#### Frontend (Node 20+)
```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

---

## 6. Environment Variables Reference

Copy `.env.example` to `.env` to configure deployment environments:

| Variable | Default Value | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://postgres:postgres@postgres:5432/windscope` | SQLAlchemy database connection URI |
| `DEFAULT_DECISION_CUTOFF` | `11:00` | Default UTC decision cutoff time (`HH:MM`) |
| `AUTO_INGEST_ON_STARTUP` | `true` | Automatically fetches Elexon data on startup if DB is empty |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Allowed CORS origins for frontend access |
| `EVALUATION_START_DATE` | `2026-01-01` | Start of January evaluation period |
| `EVALUATION_END_DATE` | `2026-01-31` | End of January evaluation period |
| `ELEXON_API_BASE_URL` | `https://data.elexon.co.uk/bmrs/api/v1` | Primary Elexon BMRS Open Data API base URL |

---

## 7. API Specification Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` / `/api/health` | Service connectivity, table record counts, and last ingestion status |
| `GET` | `/api/dashboard` | Executive KPIs, dual-granularity time series, and directional error counts |
| `GET` | `/api/forecasts` | 24-interval matched delivery schedule with error and lead time |
| `GET` | `/api/forecasts/vintages` | Publication vintage evolution timeline per delivery interval |
| `GET` | `/api/accuracy/summary` | Period aggregate metrics (MAE, RMSE, Bias, WAPE, MAPE) |
| `GET` | `/api/accuracy/trend` | Daily forecast accuracy time series across delivery days |
| `GET` | `/api/accuracy/distribution` | Error histogram bins and forecast vs. actual scatter coordinates |
| `GET` | `/api/accuracy/worst` | Top-N intervals with largest absolute forecast deviations |
| `GET` | `/api/data-quality` | Completeness coverage percentages and ingestion execution history |
| `POST`| `/api/ingest` | Triggers on-demand ingestion for `ALL`, `FUELHH`, or `WINDFOR` |

---

## 8. Automated Test Suite

The backend contains a test harness covering metric accuracy, look-ahead exclusion, negative generation handling, and integration edge cases.

```bash
# Run backend pytest suite
cd backend
.venv/bin/pytest tests/ -v
# Verified: 35 passed, 100% passing

# Run frontend TypeScript typecheck and production build
cd frontend
npm run build
# Verified: tsc -b && vite build exited with 0 errors
```

---

## 9. Interactive React Flow Pipeline Explorer (`/pipeline`)

Located at the `/pipeline` route, WindScope features a 14-node interactive visualization:
- **Sources (Stage 1):** `Elexon BMRS FUELHH` (30m actuals) & `Elexon BMRS WINDFOR` (60m forecasts).
- **Processing (Stage 2):** Resilient `HTTPX Async Client` (7-day chunking + exponential backoff) and `Schema Normalizer` (UTC conversion + negative generation audit).
- **Storage (Stage 3):** `PostgreSQL Database` and `Hourly Actuals Aggregator` ($\bar{x}_t$).
- **Analytics (Stage 4):** `Anti-Look-Ahead Selector` (11:00 UTC cutoff), `Interval Matcher`, and `Vectorized Accuracy Engine`.
- **API & UI (Stages 5 & 6):** `FastAPI Gateway` connected to the 4 frontend views.
- **Zero Overhead:** The slide-in node inspector pulls live record counts from the TanStack Query cache, incurring **zero additional network calls**.

---

## 10. Known Limitations & Explicit Assumptions

1. **Gate Closure Proxy [ASSUMPTION]:** Market gate closure is modeled as **11:00 UTC** of the delivery date (aligned with day-ahead spot auction schedules). Commercial traders can change this cutoff dynamically in the UI header.
2. **Post-Evaluation Revisions [VERIFIED]:** Elexon BMRS `FUELHH` records are treated as final outturn without subsequent settlement reconciliation runs (R1/R2/SF/RF settlement runs).
3. **Embedded Generation [VERIFIED]:** Only transmission-connected wind generation metered by Elexon BMRS is evaluated. Unmetered distributed rooftop solar or small-scale wind is excluded.

---

## 11. AI Tools Disclosure

This platform was developed using agentic AI pairing (Google DeepMind Antigravity) under strict senior engineer review:
- **Architecture & Formulas:** Human-specified and verified against official Elexon BMRS data documentation.
- **Implementation:** Code generation was verified iteratively via strict automated testing (`pytest` 35/35 passing, TypeScript strict compilation with zero errors).
- **Adversarial Scrutiny:** Every architectural decision, granularity mismatch resolution, and zero-handling policy was vetted against look-ahead bias and production edge cases.

---

## 12. License

MIT License. Copyright © 2026 WindScope Contributors.
