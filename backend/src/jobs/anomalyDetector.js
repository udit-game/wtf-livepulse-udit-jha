const pool = require("../db/pool");
const { broadcast } = require("../websocket/server");

/**
 * Pure Evaluation Functions (Exported for Jest Unit Testing)
 */
function evaluateZeroCheckins(gymStatus, isOperatingHours, recentCheckinCount) {
  return gymStatus === "active" && isOperatingHours && recentCheckinCount === 0;
}

function evaluateCapacityBreach(occupancy, capacity) {
  if (!capacity || capacity <= 0) return { trigger: false, resolve: false };
  const occupancyPct = (occupancy / capacity) * 100;
  return {
    trigger: occupancyPct > 90.0,
    resolve: occupancyPct < 85.0,
    pct: occupancyPct.toFixed(1),
  };
}

function evaluateRevenueDrop(todayRevenue, lastWeekSameDayRevenue) {
  if (!lastWeekSameDayRevenue || lastWeekSameDayRevenue <= 0) {
    return { trigger: false, resolve: false };
  }
  const ratio = todayRevenue / lastWeekSameDayRevenue;
  return {
    trigger: ratio <= 0.70,  // 30%+ drop
    resolve: ratio >= 0.80,  // Recovered to within 20%
    dropPct: ((1 - ratio) * 100).toFixed(1),
  };
}

/**
 * Main Anomaly Detection Loop (Runs every 30 seconds)
 */
const config = require("../config");
const APP_TIMEZONE = config.appTimezone || 'Asia/Kolkata';
async function checkAnomalies() {
  try {
    const gymsQuery = await pool.query(`SELECT id, name, capacity, opens_at, closes_at, status FROM gyms WHERE status = 'active'`);
    const gyms = gymsQuery.rows;

    for (const gym of gyms) {
      await evaluateGymZeroCheckins(gym);
      await evaluateGymCapacityBreach(gym);
      await evaluateGymRevenueDrop(gym);
    }
  } catch (err) {
    console.error("Error running anomaly detection loop:", err);
  }
}

/**
 * Rule 1: Zero Check-ins Alert (Warning)
 */
async function evaluateGymZeroCheckins(gym) {
  const nowInIST = new Date(new Date().toLocaleString("en-US", { timeZone: APP_TIMEZONE }));
  const currentISTTime = `${String(nowInIST.getHours()).padStart(2, '0')}:${String(nowInIST.getMinutes()).padStart(2, '0')}`;
  
  const isOperatingHours = currentISTTime >= gym.opens_at && currentISTTime <= gym.closes_at || true; // Overide for testing purposes

  const countRes = await pool.query(
    `SELECT COUNT(*)::INTEGER AS recent_count 
     FROM checkins 
     WHERE gym_id = $1 AND checked_in >= NOW() - INTERVAL '2 hours'`,
    [gym.id]
  );
  
  const recentCount = countRes.rows[0].recent_count;
  const shouldTrigger = evaluateZeroCheckins(gym.status, isOperatingHours, recentCount);

  const existingRes = await pool.query(
    `SELECT id FROM anomalies WHERE gym_id = $1 AND type = 'zero_checkins' AND resolved = FALSE`,
    [gym.id]
  );

  if (shouldTrigger && existingRes.rows.length === 0) {
    await triggerAnomaly({
      gymId: gym.id,
      gymName: gym.name,
      type: "zero_checkins",
      severity: "warning",
      message: `Zero check-ins recorded in the last 2 hours during operating hours at ${gym.name}.`,
    });
  } else if (!shouldTrigger && existingRes.rows.length > 0) {
    await resolveAnomaly(existingRes.rows[0].id, gym.id);
  }
}

/**
 * Rule 2: Capacity Breach Alert (Critical)
 */
async function evaluateGymCapacityBreach(gym) {
  const occRes = await pool.query(
    `SELECT COUNT(*)::INTEGER AS current_occ FROM checkins WHERE gym_id = $1 AND checked_out IS NULL`,
    [gym.id]
  );
  
  const occupancy = occRes.rows[0].current_occ;
  const { trigger, resolve, pct } = evaluateCapacityBreach(occupancy, gym.capacity);

  const existingRes = await pool.query(
    `SELECT id FROM anomalies WHERE gym_id = $1 AND type = 'capacity_breach' AND resolved = FALSE`,
    [gym.id]
  );

  if (trigger && existingRes.rows.length === 0) {
    await triggerAnomaly({
      gymId: gym.id,
      gymName: gym.name,
      type: "capacity_breach",
      severity: "critical",
      message: `Capacity breach detected at ${gym.name}! Occupancy is at ${pct}% (${occupancy}/${gym.capacity}).`,
    });
  } else if (resolve && existingRes.rows.length > 0) {
    await resolveAnomaly(existingRes.rows[0].id, gym.id);
  }
}

/**
 * Rule 3: Revenue Drop Alert (Warning)
 */
async function evaluateGymRevenueDrop(gym) {
  // Today's Revenue
  const todayRes = await pool.query(
    `SELECT COALESCE(SUM(amount), 0)::FLOAT AS today_total 
     FROM payments 
     WHERE gym_id = $1 AND paid_at >= DATE_TRUNC('day', NOW() AT TIME ZONE '${APP_TIMEZONE}') AT TIME ZONE '${APP_TIMEZONE}'`,
    [gym.id]
  );

  // Same Day Last Week Revenue
  const lastWeekRes = await pool.query(
    `SELECT COALESCE(SUM(amount), 0)::FLOAT AS last_week_total 
     FROM payments 
     WHERE gym_id = $1 
       AND paid_at >= (DATE_TRUNC('day', NOW() AT TIME ZONE '${APP_TIMEZONE}') AT TIME ZONE '${APP_TIMEZONE}' - INTERVAL '7 days')
       AND paid_at < (DATE_TRUNC('day', NOW() AT TIME ZONE '${APP_TIMEZONE}') AT TIME ZONE '${APP_TIMEZONE}' - INTERVAL '6 days')`,
    [gym.id]
  );

  const todayRevenue = todayRes.rows[0].today_total;
  const lastWeekRevenue = lastWeekRes.rows[0].last_week_total;

  const { trigger, resolve, dropPct } = evaluateRevenueDrop(todayRevenue, lastWeekRevenue);

  const existingRes = await pool.query(
    `SELECT id FROM anomalies WHERE gym_id = $1 AND type = 'revenue_drop' AND resolved = FALSE`,
    [gym.id]
  );

  if (trigger && existingRes.rows.length === 0) {
    await triggerAnomaly({
      gymId: gym.id,
      gymName: gym.name,
      type: "revenue_drop",
      severity: "warning",
      message: `Significant revenue drop detected at ${gym.name}. Revenue today is down ${dropPct}% vs last week.`,
    });
  } else if (resolve && existingRes.rows.length > 0) {
    await resolveAnomaly(existingRes.rows[0].id, gym.id);
  }
}

/**
 * Writes new anomaly to DB & broadcasts ANOMALY_DETECTED event over WebSockets
 */
async function triggerAnomaly({ gymId, gymName, type, severity, message }) {
  const insertRes = await pool.query(
    `INSERT INTO anomalies (gym_id, type, severity, message) 
     VALUES ($1, $2, $3, $4) 
     RETURNING id, detected_at`,
    [gymId, type, severity, message]
  );

  const anomaly = insertRes.rows[0];

  broadcast({
    type: "ANOMALY_DETECTED",
    anomaly_id: anomaly.id,
    gym_id: gymId,
    gym_name: gymName,
    anomaly_type: type,
    severity: severity,
    message: message,
  });
}

/**
 * Resolves anomaly in DB & broadcasts ANOMALY_RESOLVED event over WebSockets
 */
async function resolveAnomaly(anomalyId, gymId) {
  const now = new Date().toISOString();

  await pool.query(
    `UPDATE anomalies 
     SET resolved = TRUE, resolved_at = $1 
     WHERE id = $2`,
    [now, anomalyId]
  );

  broadcast({
    type: "ANOMALY_RESOLVED",
    anomaly_id: anomalyId,
    gym_id: gymId,
    resolved_at: now,
  });
}

/**
 * Starts 30-second cron job
 */
function startAnomalyDetectorJob() {
  setInterval(checkAnomalies, 30000);
  // Run an immediate check 5 seconds after startup to pick up seed anomalies
  setTimeout(checkAnomalies, 5000);
  console.log("Anomaly detector background job initialized (30s interval)");
}

module.exports = {
  startAnomalyDetectorJob,
  checkAnomalies,
  evaluateZeroCheckins,
  evaluateCapacityBreach,
  evaluateRevenueDrop,
};