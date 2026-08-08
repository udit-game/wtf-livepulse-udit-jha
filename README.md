# ⚡ WTF LivePulse

### Low-Latency Gym Intelligence Dashboard

> A real-time operational command center for multi-location gym management — built to process live check-ins, track revenue, detect capacity/payment anomalies, and visualize peak occupancy with ultra-low-latency PostgreSQL queries.

---

## 📌 Overview

**WTF LivePulse** is a real-time gym intelligence and operations dashboard designed for multi-location gym management.

The system provides:

* 🔴 **Live occupancy tracking**
* 💰 **Real-time revenue monitoring**
* 🚨 **Payment & capacity anomaly detection**
* 📊 **Peak-hour occupancy heatmaps**
* 👥 **Member churn-risk identification**
* 🏢 **Cross-gym analytics**
* ⚡ **Sub-millisecond database query performance**
* 🔌 **Real-time updates through WebSockets**

The entire application can be started from a fresh clone using **Docker Compose** with zero manual service configuration.

---

## 🏗️ System Architecture

```text
                        ┌──────────────────────┐
                        │      Browser         │
                        │   React Dashboard    │
                        └──────────┬───────────┘
                                   │
                         HTTP / WebSocket
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │        Nginx         │
                        │    Reverse Proxy     │
                        │      :3000           │
                        └──────────┬───────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
          ┌──────────────────┐          ┌──────────────────┐
          │   Express API    │          │   WebSocket      │
          │     :3001        │          │     Server       │
          └────────┬─────────┘          └────────┬─────────┘
                   │                             │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                       ┌──────────────────────┐
                       │    PostgreSQL 16     │
                       │                      │
                       │ • B-Tree Indexes     │
                       │ • Partial Indexes    │
                       │ • Materialized Views │
                       └──────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer                       | Technology                                          |
| --------------------------- | --------------------------------------------------- |
| **Frontend**                | React.js, Vite                                      |
| **Styling**                 | Tailwind CSS                                        |
| **Icons**                   | Lucide Icons                                        |
| **Charts**                  | Recharts                                            |
| **Backend**                 | Node.js, Express                                    |
| **Real-Time Communication** | Native WebSockets (`ws`)                            |
| **Database**                | PostgreSQL 16                                       |
| **Database Optimization**   | B-Tree Indexes, Partial Indexes, Materialized Views |
| **Reverse Proxy**           | Nginx                                               |
| **Containerization**        | Docker, Docker Compose                              |
| **E2E Testing**             | Playwright                                          |

---

# 🚀 Quickstart

## Prerequisites

The only requirement for a production-style cold start is:

* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed
* Docker daemon running

No local Node.js or PostgreSQL installation is required for the Docker deployment.

---

## 🐳 Zero-Config Cold Start

Clone the repository and run:

```bash
docker compose up --build
```

This will:

1. Build all application containers
2. Start PostgreSQL
3. Initialize the database
4. Run migrations
5. Create optimized indexes
6. Seed the database
7. Start the backend
8. Start the frontend
9. Start the Nginx reverse proxy

Once the stack is ready:

| Service               | URL                       |
| --------------------- | ------------------------- |
| 🌐 **Live Dashboard** | http://localhost:3000     |
| 🔌 **Backend API**    | http://localhost:3001/api |
| 🗄️ **PostgreSQL**    | `localhost:5432`          |

### Database Credentials

```text
Database: wtf_livepulse
Username: wtf
Password: wtf_secret
Host: localhost
Port: 5432
```

---

# 🗄️ Database Architecture

The PostgreSQL schema is optimized for two primary workloads:

### High-Concurrency Writes

The system continuously receives operational events such as:

* Member check-ins
* Member check-outs
* Payments
* Attendance events
* Anomaly events

### Low-Latency Reads

The dashboard simultaneously performs analytical queries for:

* Current occupancy
* Revenue
* Churn risk
* Peak hours
* Active anomalies
* Cross-gym analytics

To support both workloads, the database uses **targeted indexing and pre-aggregation rather than relying solely on full-table scans**.

---

# ⚡ Database Optimization

## Specialized Indexes

### Live Occupancy

```sql
idx_checkins_live_occupancy
```

A partial B-Tree index on:

```sql
(gym_id)
WHERE checked_out IS NULL
```

This allows active check-ins to be retrieved efficiently without indexing already checked-out records.

**Observed scan:** `Index Only Scan`

---

### Gym Revenue

```sql
idx_payments_gym_date
```

Composite B-Tree index on:

```sql
(gym_id, paid_at)
```

Optimized for:

* Daily revenue
* Monthly revenue
* Gym-specific revenue aggregation

---

### Member Churn Risk

```sql
idx_members_churn_risk
```

Composite index on:

```sql
(status, last_checkin_at)
```

Used to efficiently identify inactive members, particularly members who have not checked in for more than **45 days**.

---

### Active Anomalies

```sql
idx_anomalies_active
```

Partial index on:

```sql
(resolved, detected_at)
WHERE resolved = FALSE
```

Optimized for rapidly calculating the number of unresolved anomalies displayed by the dashboard.

---

# 📊 Materialized Views

## `gym_hourly_stats`

Historical check-in events are aggregated into hourly statistics for each gym.

The materialized view supports:

* Peak-hour analysis
* Occupancy heatmaps
* Historical trend visualization
* Reduced computation during dashboard reads

The view is refreshed asynchronously through background worker jobs rather than recalculating historical aggregates on every dashboard request.

---

# 📈 Query Benchmarks

All benchmark queries were executed against populated seed data containing:

* **5,000 members**
* **90 days of check-in history**
* Pre-seeded anomaly scenarios
* PostgreSQL running inside the Docker container

### Results

| Query                       | Execution Time | Scan / Index Method | Shared Buffers | Status |
| --------------------------- | -------------: | ------------------- | -------------: | :----: |
| **Q1 — Live Occupancy**     |   **0.295 ms** | Index Only Scan     |              3 | ✅ PASS |
| **Q2 — Today's Revenue**    |   **0.052 ms** | Index Scan          |              3 | ✅ PASS |
| **Q3 — Churn Risk Members** |   **0.646 ms** | Bitmap Index Scan   |             90 | ✅ PASS |
| **Q4 — Peak Hour Heatmap**  |   **0.093 ms** | Bitmap Index Scan   |             11 | ✅ PASS |
| **Q5 — Cross-Gym Revenue**  |   **0.855 ms** | Bitmap Index Scan   |             81 | ✅ PASS |
| **Q6 — Active Anomalies**   |   **0.049 ms** | Sequential Scan*    |              4 | ✅ PASS |

> **Note:** Q6 uses a sequential scan because the `anomalies` table fits within a very small number of cached pages. A sequential scan can therefore be cheaper than using an index for this particular workload.

---

# 🔬 Re-running Benchmarks

The benchmark suite can be executed directly against the running PostgreSQL container.

```bash
docker exec -i wtf_livepulse_db \
  psql -U wtf \
  -d wtf_livepulse \
  -P pager=off \
  < benchmarks/run_benchmarks.sql \
  > benchmarks/results.txt
```

Results will be written to:

```text
benchmarks/results.txt
```

---

# 🧪 End-to-End Testing

The project uses **Playwright** for browser-level E2E testing against the live Docker environment.

## Install Playwright

From the frontend directory:

```bash
cd frontend

npm install -D @playwright/test

npx playwright install chromium
```

## Run Tests

```bash
npx playwright test
```

---

## Test Coverage

| Test      | Description                                                              |
| --------- | ------------------------------------------------------------------------ |
| **E2E-1** | Validates dashboard header mounting and gym selector rendering           |
| **E2E-2** | Verifies KPI dashboard updates when switching gyms                       |
| **E2E-3** | Verifies the POST trigger endpoint for the simulator background job      |
| **E2E-4** | Confirms anomaly badge indicators render correctly in the navigation bar |

---

# 🔐 Environment Variables

Docker Compose provides the default environment configuration required for a zero-config deployment.

For local development, use `.env.example` as the reference.

```env
POSTGRES_DB=wtf_livepulse
POSTGRES_USER=wtf
POSTGRES_PASSWORD=wtf_secret

DATABASE_URL=postgres://wtf:wtf_secret@db:5432/wtf_livepulse

BACKEND_PORT=3001
FRONTEND_PORT=3000

NODE_ENV=production
```

> ⚠️ **Production:** Replace the default database credentials before deploying outside a local/development environment.

---

# 📁 Project Structure

A typical project layout:

```text
wtf-livepulse/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── backend/
│   ├── src/
│   ├── routes/
│   ├── services/
│   └── ...
│
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── ...
│
├── benchmarks/
│   ├── run_benchmarks.sql
│   └── results.txt
│
├── e2e/
│   └── ...
│
├── nginx/
│   └── ...
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

# 🔄 Real-Time Data Flow

A typical live check-in flows through the system as follows:

```text
Member Check-In
      │
      ▼
Backend API
      │
      ├──────────────► PostgreSQL
      │                    │
      │                    ▼
      │              Indexed Event
      │
      ▼
WebSocket Broadcast
      │
      ▼
React Dashboard
      │
      ├── Live Occupancy
      ├── KPI Updates
      ├── Anomaly Indicators
      └── Revenue Updates
```

This allows dashboard clients to receive operational updates without repeatedly polling the backend.

---

# 🎯 Key Engineering Goals

| Goal                              | Implementation                     |
| --------------------------------- | ---------------------------------- |
| **Low-latency reads**             | Targeted PostgreSQL indexes        |
| **Efficient live occupancy**      | Partial index + Index Only Scan    |
| **Fast analytics**                | Materialized views                 |
| **Real-time UI**                  | Native WebSockets                  |
| **Multi-gym support**             | Gym-scoped queries and analytics   |
| **Reproducible deployment**       | Docker Compose                     |
| **Automated verification**        | Playwright E2E tests               |
| **Operational anomaly detection** | Indexed unresolved anomaly records |
| **Historical analytics**          | Pre-aggregated hourly statistics   |

---

# 📊 Performance Highlights

> Benchmarked against seeded PostgreSQL data containing **5,000 members and 90 days of check-in history**.

### ⚡ Sub-Millisecond Queries

All six benchmark queries completed in **under 1 ms** under the benchmark environment.

```text
Live Occupancy       0.295 ms
Today's Revenue      0.052 ms
Churn Risk           0.646 ms
Peak Hour Heatmap    0.093 ms
Cross-Gym Revenue    0.855 ms
Active Anomalies     0.049 ms
```

The results demonstrate the effectiveness of combining:

**Targeted indexes + partial indexes + materialized views + PostgreSQL query planning**

for dashboard-oriented workloads.

---

# 🐳 Docker Services

The application is designed to run as a multi-container stack:

```text
┌───────────────────────────────────────────┐
│              Docker Compose               │
│                                           │
│   ┌─────────┐    ┌─────────┐              │
│   │  Nginx  │───►│ Backend │              │
│   │  :3000  │    │  :3001  │              │
│   └────┬────┘    └────┬────┘              │
│        │              │                   │
│        │              ▼                   │
│        │        ┌─────────────┐            │
│        └───────►│ PostgreSQL  │            │
│                 │    :5432    │            │
│                 └─────────────┘            │
│                                           │
└───────────────────────────────────────────┘
```

---

# 🛑 Stopping the Application

To stop the running containers:

```bash
docker compose down
```

To stop the containers and remove persisted database volumes:

```bash
docker compose down -v
```

> ⚠️ `docker compose down -v` deletes the PostgreSQL volume and therefore removes the local database data.

---

# 🧹 Rebuilding From Scratch

If you need a completely clean environment:

```bash
docker compose down -v
docker compose up --build
```

This recreates the containers and initializes the database from scratch.

---

# 🏁 Summary

**WTF LivePulse** combines real-time event processing, WebSockets, PostgreSQL optimization, materialized analytics, and containerized deployment into a single operational dashboard for multi-location gyms.

The architecture focuses on:

> **Real-time updates → optimized database reads → pre-aggregated analytics → reproducible deployment**

with benchmarked dashboard queries consistently operating in the **sub-millisecond range** under the provided test dataset.
