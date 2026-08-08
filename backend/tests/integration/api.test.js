const request = require("supertest");
const express = require("express");
const pool = require("../../src/db/pool");

const gymRoutes = require("../../src/routes/gymRoutes");
const analyticsRoutes = require("../../src/routes/analyticsRoutes");
const anomalyRoutes = require("../../src/routes/anomalyRoutes");
const simulatorRoutes = require("../../src/routes/simulatorRoutes");

const app = express();
app.use(express.json());
app.use("/api/gyms", gymRoutes);
app.use("/api", analyticsRoutes);
app.use("/api/anomalies", anomalyRoutes);
app.use("/api/simulator", simulatorRoutes);

afterAll(async () => {
  await pool.end();
});

describe("Backend Integration Test Suite", () => {
  let sampleGymId = null;
  let warningAnomalyId = null;
  let criticalAnomalyId = null;

  // Test 1: GET /api/gyms returns 10 seeded gyms
  test("GET /api/gyms returns valid 10-gym array with current occupancy & revenue", async () => {
    const res = await request(app).get("/api/gyms");
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(10);

    sampleGymId = res.body.data[0].id;

    expect(res.body.data[0]).toHaveProperty("id");
    expect(res.body.data[0]).toHaveProperty("current_occupancy");
    expect(res.body.data[0]).toHaveProperty("today_revenue");
  });

  // Test 2: GET /api/gyms/:id/live returns snapshot in < 5ms payload format
  test("GET /api/gyms/:id/live returns required snapshot keys", async () => {
    const res = await request(app).get(`/api/gyms/${sampleGymId}/live`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("occupancy");
    expect(res.body).toHaveProperty("revenue");
    expect(res.body).toHaveProperty("events");
    expect(res.body).toHaveProperty("anomalies");
  });

  // Test 3: GET /api/gyms/:id/analytics returns 4 analytics panels
  test("GET /api/gyms/:id/analytics returns peak hours, revenue, churn, and member types", async () => {
    const res = await request(app).get(`/api/gyms/${sampleGymId}/analytics?dateRange=30d`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty("peakHours");
    expect(res.body.data).toHaveProperty("revenueByPlan");
    expect(res.body.data).toHaveProperty("churnRisk");
    expect(res.body.data).toHaveProperty("memberType");
  });

  // Test 4: Invalid dateRange parameter validation
  test("GET /api/gyms/:id/analytics rejects invalid dateRange with HTTP 400", async () => {
    const res = await request(app).get(`/api/gyms/${sampleGymId}/analytics?dateRange=180d`);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // Test 5: GET /api/analytics/cross-gym returns 10 ranked gyms
  test("GET /api/analytics/cross-gym ranks all 10 gyms by 30-day revenue", async () => {
    const res = await request(app).get("/api/analytics/cross-gym");
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(10);
    expect(res.body.data[0]).toHaveProperty("rank");
  });

  // Test 6: GET /api/anomalies returns unresolved anomalies array
  test("GET /api/anomalies returns list of active anomalies", async () => {
    const res = await request(app).get("/api/anomalies");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    // Setup dummy anomalies for dismissal tests
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
    expect(res.body.data.dismissed).toBe(true);
  });

  // Test 8: PATCH /api/anomalies/:id/dismiss blocks critical anomaly with HTTP 403
  test("PATCH /api/anomalies/:id/dismiss returns HTTP 403 when dismissing critical anomaly", async () => {
    const res = await request(app).patch(`/api/anomalies/${criticalAnomalyId}/dismiss`);
    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // Test 9: POST /api/simulator/start starts engine
  test("POST /api/simulator/start returns status running and valid speed", async () => {
    const res = await request(app).post("/api/simulator/start").send({ speed: 5 });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe("running");
    expect(res.body.data.speed).toBe(5);
  });

  // Test 10: POST /api/simulator/start input validation
  test("POST /api/simulator/start rejects invalid speed with HTTP 400", async () => {
    const res = await request(app).post("/api/simulator/start").send({ speed: 42 });
    expect(res.statusCode).toBe(400);
  });

  // Test 11: POST /api/simulator/stop pauses engine
  test("POST /api/simulator/stop pauses the simulator", async () => {
    const res = await request(app).post("/api/simulator/stop");
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe("paused");
  });

  // Test 12: POST /api/simulator/reset clears live open check-ins
  test("POST /api/simulator/reset resets simulation state to baseline", async () => {
    const res = await request(app).post("/api/simulator/reset");
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe("reset");
  });
});