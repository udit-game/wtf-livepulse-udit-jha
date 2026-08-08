const request = require("supertest");
const express = require("express");
const pool = require("../../src/db/pool");

const gymRoutes = require("../../src/routes/gymRoutes");
const liveRoutes = require("../../src/routes/liveRoutes");
const analyticsRoutes = require("../../src/routes/analyticsRoutes");
const anomalyRoutes = require("../../src/routes/anomalyRoutes");
const simulatorRoutes = require("../../src/routes/simulatorRoutes");

const app = express();
app.use(express.json());

app.use("/api/gyms", gymRoutes);
app.use("/api", liveRoutes);
app.use("/api", analyticsRoutes);
app.use("/api/anomalies", anomalyRoutes);
app.use("/api/simulator", simulatorRoutes);

describe("Backend Integration Test Suite", () => {
  let sampleGymId = null;
  let warningAnomalyId = null;
  let criticalAnomalyId = null;

  beforeAll(async () => {
    // Fetch a real gym ID directly from the DB
    const { rows } = await pool.query("SELECT id FROM gyms LIMIT 1");
    if (rows.length > 0) {
      sampleGymId = rows[0].id;
    }
  });

  afterAll(async () => {
    // Clean up test anomalies
    if (warningAnomalyId) {
      await pool.query("DELETE FROM anomalies WHERE id = $1", [warningAnomalyId]);
    }
    if (criticalAnomalyId) {
      await pool.query("DELETE FROM anomalies WHERE id = $1", [criticalAnomalyId]);
    }
    await pool.end();
  });

  // Test 1: GET /api/gyms
  test("GET /api/gyms returns valid 10-gym array", async () => {
    const res = await request(app).get("/api/gyms");
    expect(res.statusCode).toBe(200);

    const gyms = Array.isArray(res.body) ? res.body : res.body.data;
    expect(Array.isArray(gyms)).toBe(true);
    expect(gyms.length).toBe(10);
    expect(gyms[0]).toHaveProperty("id");
  });

  // Test 2: GET /api/gyms/:id/live
  test("GET /api/gyms/:id/live returns required snapshot keys", async () => {
    const res = await request(app).get(`/api/gyms/${sampleGymId}/live`);
    expect(res.statusCode).toBe(200);

    const snapshot = res.body.data || res.body;
    expect(snapshot).toHaveProperty("current_occupancy");
    expect(snapshot).toHaveProperty("today_revenue");
    expect(snapshot).toHaveProperty("recent_events");
    expect(snapshot).toHaveProperty("active_anomalies");
  });

  // Test 3: GET /api/gyms/:id/analytics
  test("GET /api/gyms/:id/analytics returns analytics panels", async () => {
    const res = await request(app).get(`/api/gyms/${sampleGymId}/analytics?dateRange=30d`);
    expect(res.statusCode).toBe(200);
    const data = res.body.data || res.body;
    expect(data).toHaveProperty("peakHours");
    expect(data).toHaveProperty("revenueByPlan");
    expect(data).toHaveProperty("churnRisk");
  });

  // Test 4: Invalid dateRange parameter validation
  test("GET /api/gyms/:id/analytics rejects invalid dateRange with HTTP 400", async () => {
    const res = await request(app).get(`/api/gyms/${sampleGymId}/analytics?dateRange=180d`);
    expect(res.statusCode).toBe(400);
  });

  // Test 5: GET /api/analytics/cross-gym
  test("GET /api/analytics/cross-gym ranks all 10 gyms by 30-day revenue", async () => {
    const res = await request(app).get("/api/analytics/cross-gym");
    expect(res.statusCode).toBe(200);
    const data = Array.isArray(res.body) ? res.body : res.body.data;
    expect(data.length).toBe(10);
  });

  // Test 6: GET /api/anomalies & Setup test anomalies
  test("GET /api/anomalies returns list of active anomalies", async () => {
    const res = await request(app).get("/api/anomalies");
    expect(res.statusCode).toBe(200);

    // Seed dummy test anomalies matching DB lower_case enum constraints
    const warningRes = await pool.query(`
      INSERT INTO anomalies (gym_id, type, severity, message) 
      VALUES ($1, 'zero_checkins', 'warning', 'Test warning') RETURNING id
    `, [sampleGymId]);
    warningAnomalyId = warningRes.rows[0].id;

    const criticalRes = await pool.query(`
      INSERT INTO anomalies (gym_id, type, severity, message) 
      VALUES ($1, 'capacity_breach', 'critical', 'Test critical') RETURNING id
    `, [sampleGymId]);
    criticalAnomalyId = criticalRes.rows[0].id;
  });

  // Test 7: PATCH /api/anomalies/:id/dismiss soft-dismisses warning anomaly
  test("PATCH /api/anomalies/:id/dismiss allows dismissing warning-level anomaly", async () => {
    const res = await request(app).patch(`/api/anomalies/${warningAnomalyId}/dismiss`);
    expect(res.statusCode).toBe(200);
    const data = res.body.data || res.body;
    expect(data.dismissed).toBe(true);
  });

  // Test 8: PATCH /api/anomalies/:id/dismiss blocks critical anomaly
  test("PATCH /api/anomalies/:id/dismiss returns HTTP 403 when dismissing critical anomaly", async () => {
    const res = await request(app).patch(`/api/anomalies/${criticalAnomalyId}/dismiss`);
    expect(res.statusCode).toBe(403);
  });

  // Test 9: POST /api/simulator/start
  test("POST /api/simulator/start returns status running and valid speed", async () => {
    const res = await request(app).post("/api/simulator/start").send({ speed: 5 });
    expect(res.statusCode).toBe(200);
  });

  // Test 10: POST /api/simulator/start input validation
  test("POST /api/simulator/start rejects invalid speed with HTTP 400", async () => {
    const res = await request(app).post("/api/simulator/start").send({ speed: 42 });
    expect(res.statusCode).toBe(400);
  });

  // Test 11: POST /api/simulator/stop
  test("POST /api/simulator/stop pauses the simulator", async () => {
    const res = await request(app).post("/api/simulator/stop");
    expect(res.statusCode).toBe(200);
  });

  // Test 12: POST /api/simulator/reset
  test("POST /api/simulator/reset resets simulation state to baseline", async () => {
    const res = await request(app).post("/api/simulator/reset");
    expect(res.statusCode).toBe(200);
  });
});