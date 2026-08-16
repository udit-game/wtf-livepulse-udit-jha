# WTF LivePulse — Real-Time Multi-Gym Intelligence Engine

WTF LivePulse is an operations command center and real-time analytics engine engineered for WTF Gyms. The platform delivers sub-millisecond visibility into live gym occupancy, revenue streams, churn risk scoring, capacity breaches, and automated anomaly detection across all locations.

## 1. Quick Start

The entire stack is containerized and starts with a single command. PostgreSQL auto-seeds on first boot with 10 gyms, 5,000 members, and 90 days of realistic check-ins and payments.

### Prerequisites

* Docker Desktop 4.0+ installed and running.
* Free host ports:

  * `3000` (Frontend)
  * `3001` (Backend API & WebSockets)
  * `5432` (PostgreSQL)

### Booting the Application

```bash
docker compose up -d
```

* **Frontend Operations Dashboard:** http://localhost:3000
* **Backend REST & WebSocket API:** http://localhost:3001
* **PostgreSQL Database:** `localhost:5432`

  * `user: wtf`
  * `password: wtf_secret`
  * `db: wtf_livepulse`

### Running Tests

Ensure Docker is running so the database container is available for integration and E2E suites.

```bash
# 1. Run Backend Unit & Integration Tests (Jest + Supertest)
cd backend
npm install
npm test

# 2. Run Frontend End-to-End Tests (Playwright)
cd ../frontend
npm install
npx playwright install chromium
npx playwright test
```

## 2. Architecture Decisions

```text
                           ┌────────────────────────┐
                           │   React 18 Dashboard   │
                           │  (Vite + TailwindCSS)  │
                           └───────▲────────▲───────┘
                                   │        │
                     REST Snapshots│        │WebSocket Stream
                     (Initial Load)│        │(Mutations / Tickers)
                                   │        │
                           ┌───────┴────────┴───────┐
                           │    Node.js 20 Server   │
                           │   (Express + ws + pg)  │
                           └───────▲────────▲───────┘
                                   │        │
               Parameterized SQL   │        │Cron / Background Loop
               (Sub-ms Execution)  │        │(Anomaly & Simulator Engine)
                                   │        │
                           ┌───────┴────────┴───────┐
                           │ PostgreSQL 15 Database │
                           │ (Indexes + Mat. Views) │
                           └────────────────────────┘
```

### Database & Indexing Strategy

The database layer is engineered to avoid sequential scans on high-traffic append-only tables (`checkins` and `payments`) and ensure sub-millisecond query execution.

* **Partial B-Tree Indexes for State Filtering:**

  * `idx_members_churn_risk` on `members (last_checkin_at) WHERE status = 'active'`: Filters out inactive and frozen members from the index tree. Scans only active members at churn risk (`< 0.3 ms`).
  * `idx_anomalies_active` on `anomalies (detected_at DESC, gym_id) WHERE resolved = FALSE`: Indexes only active, unresolved issues. Placing `detected_at DESC` first allows global dashboard log retrieval via a direct index scan without sorting overhead.

* **Composite Covering Indexes:**

  * `idx_checkins_live_occupancy` on `checkins (gym_id, checked_out) WHERE checked_out IS NULL`: Enables zero-heap-fetch `Index Only Scans` for the live occupancy counter.
  * `idx_payments_date` on `payments (paid_at DESC, gym_id, amount)`: A covering index that includes `amount` and `gym_id`, allowing 30-day aggregate revenue ranking queries to execute without touching raw heap pages.

* **Event Stream Pagination Indexes (Custom Optimization):**

  * `idx_checkins_gym_checked_in` on `checkins (gym_id, checked_in DESC)`: Accelerates the real-time event feed on the live dashboard.
  * `idx_checkins_gym_checked_out` on `checkins (gym_id, checked_out DESC) WHERE checked_out IS NOT NULL`: Optimizes recent checkout lookups and session duration calculations.

* **BRIN (Block Range Index):**

  * `idx_checkins_time_brin` on `checkins USING BRIN (checked_in)`: Provides minimal disk footprint for physical time-series ranges on append-only historical check-ins.

* **Materialized View for Aggregation Precomputation:**

  * `gym_hourly_stats`: Pre-aggregates the 7-day rolling peak-hours heatmap by `(gym_id, day_of_week, hour_of_day)`. This replaces costly runtime `GROUP BY` aggregations across 270,000+ check-in rows with a direct index scan running in `0.093 ms`.

### Real-Time Hybrid Synchronization Architecture

* **Snapshot + Mutation Handshake:** When selecting a gym, the client fetches a complete state snapshot via `GET /api/gyms/:id/live` for instant paint. It then establishes a persistent native WebSocket connection to subscribe to real-time events (`CHECKIN_EVENT`, `CHECKOUT_EVENT`, `PAYMENT_EVENT`, `ANOMALY_DETECTED`).
* **Decoupled Simulator & Anomaly Service:** Simulator and anomaly detector services operate as background workers that write persistent states to PostgreSQL and broadcast structured JSON payloads over WebSockets in under 30 seconds of condition breach.

## 3. AI Tools Used

An AI-native workflow was leveraged to compress multi-day architecture and implementation into rapid parallel workstreams.

### Tool Breakdown & Responsibilities

| **Tool**                           | **Workstream / Responsibility**       | **Specific Contribution & Prompt Workflow**                                                                                                                                                                                                                                                              |
| ---------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **VS Code Built-in Agent**         | Scaffolding & Refactoring             | Bootstrapped directory scaffolding, boilerplate Express routes, Docker Compose orchestration, and environment variables. Handled repetitive refactoring across repositories, services, and React component styling.                                                                                      |
| **Anthropic Claude 3.5 Sonnet**    | Data Modeling & Seed Generation       | Generated the initial 90-day relational seed logic (5,000 members, diurnal Gaussian traffic patterns, plan revenue distributions).                                                                                                                                                                       |
| **Google Gemini (Browser Engine)** | Systems Thinking & Query Optimization | Analyzed PostgreSQL query plans (`EXPLAIN (ANALYZE, BUFFERS)`). Identified planner traps (e.g., Q6 sequential scan caused by index leading-column order; subquery `InitPlan` overhead vs parameterized lookups). Architected the Jest unit test isolation strategy and structured Playwright E2E suites. |

### Multi-Agent Parallel Execution Strategy

1. **System Design & Context Scaffolding:** Provided the full PRD specification to the VS Code agent to generate directory trees, database migration skeletons, and container manifests.
2. **Context-Isolated Workstreams:** Split work into 4 parallel branches (Database/Seed, Backend Services, Frontend Dashboard, Test Suites).
3. **Continuous Cross-Verification:** Tested generated code against PRD edge cases using browser-based Gemini to inspect PostgreSQL buffer reads, verify database isolation in unit tests, and resolve planner fallbacks.

## 4. Query Benchmarks

All 6 benchmark queries were tested against the full seeded database (5,000 members, 90 days of check-ins, 270,000+ records) using `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)`. Every query passed the required SLA targets with zero sequential scans on high-traffic tables.

| **#**  | **Benchmark Name**           | **Target SLA** | **Measured Execution Time** | **Plan Type & Index Used**                        | **Screenshot Reference**                     |
| ------ | ---------------------------- | -------------- | --------------------------- | ------------------------------------------------- | -------------------------------------------- |
| **Q1** | Live Occupancy — Single Gym  | `< 0.5 ms`     | **`0.070 ms`**              | `Index Only Scan` (`idx_checkins_live_occupancy`) | `benchmarks/screenshots/benchmarks_full.png` |
| **Q2** | Today's Revenue — Single Gym | `< 0.8 ms`     | **`0.052 ms`**              | `Index Scan` (`idx_payments_gym_date`)            | `benchmarks/screenshots/benchmarks_full.png` |
| **Q3** | Churn Risk Members           | `< 1.0 ms`     | **`0.203 ms`**              | `Bitmap Index Scan` (`idx_members_churn_risk`)    | `benchmarks/screenshots/benchmarks_full.png` |
| **Q4** | Peak Hour Heatmap (7d)       | `< 0.3 ms`     | **`0.093 ms`**              | `Bitmap Index Scan` (`idx_gym_hourly_stats`)      | `benchmarks/screenshots/benchmarks_full.png` |
| **Q5** | Cross-Gym Revenue Ranking    | `< 2.0 ms`     | **`0.423 ms`**              | `Bitmap Index Scan` (`idx_payments_date`)         | `benchmarks/screenshots/benchmarks_full.png` |
| **Q6** | Active Anomalies — All Gyms  | `< 0.3 ms`     | **`0.020 ms`**              | `Index Scan` (`idx_anomalies_active`)             | `benchmarks/screenshots/benchmarks_full.png` |

All benchmark verification outputs and terminal plan captures are archived in the `/benchmarks` directory.

## 5. Known Limitations

* **Snapshot-to-WebSocket Race Condition:** A slight timing window exists between when the frontend receives the initial REST snapshot (`GET /api/gyms/:id/live`) and when the WebSocket connection is fully established. Any event generated by the simulator during this sub-100ms window may not be reflected until the next state sync.
* **Deterministic Distribution in Seed Generation:** Without an explicit database-level random seed (`setSeed()`), slight variances can occur in member distribution and revenue totals across cold database builds.
* **Low-Cardinality Planner Heuristic on Anomalies:** Because the `anomalies` table contains very few rows (< 10 rows in baseline state), the PostgreSQL cost optimizer may favor a single-page sequential scan over an index hop unless table size scales or planner heuristics are tuned (`enable_seqscan = off`).
