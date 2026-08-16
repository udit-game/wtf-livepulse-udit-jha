const pool = require("../db/pool");

/**
 * Fetch active (unresolved) anomalies ordered by detected_at DESC
 * Optionally filter by gym_id and severity
 */
async function getActiveAnomalies({ gym_id, severity } = {}) {
  let query = `
    SELECT 
      a.id,
      a.gym_id,
      g.name AS gym_name,
      a.type,
      a.severity,
      a.message,
      a.resolved,
      a.dismissed,
      a.detected_at,
      a.resolved_at
    FROM anomalies a
    JOIN gyms g ON g.id = a.gym_id
    WHERE (a.resolved = FALSE OR a.resolved_at >= NOW() - INTERVAL '24 hours')
  `;

  const queryParams = [];

  if (gym_id) {
    queryParams.push(gym_id);
    query += ` AND a.gym_id = $${queryParams.length}`;
  }

  if (severity) {
    queryParams.push(severity);
    query += ` AND a.severity = $${queryParams.length}`;
  }

  query += ` ORDER BY a.detected_at DESC;`;

  const { rows } = await pool.query(query, queryParams);
  return rows;
}

/**
 * Find anomaly by ID for constraint checks
 */
async function findById(id) {
  const query = `
    SELECT id, gym_id, type, severity, message, resolved, dismissed, detected_at
    FROM anomalies
    WHERE id = $1;
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
}

/**
 * Soft-dismiss warning-level anomaly
 */
async function dismissAnomaly(id) {
  const query = `
    UPDATE anomalies
    SET dismissed = TRUE
    WHERE id = $1 AND severity != 'critical'
    RETURNING id, gym_id, type, severity, message, resolved, dismissed, detected_at;
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
}

/** Repository helper implementations **/
async function getActiveGyms() {
  const query = `SELECT id, name, capacity, opens_at, closes_at, status FROM gyms WHERE status = 'active'`;
  const { rows } = await pool.query(query);
  return rows;
}

async function getRecentCheckinCount(gymId) {
  const query = `
    SELECT COUNT(*)::INTEGER AS recent_count 
    FROM checkins 
    WHERE gym_id = $1 AND checked_in >= NOW() - INTERVAL '2 hours'
  `;
  const { rows } = await pool.query(query, [gymId]);
  return rows[0].recent_count;
}

async function getOpenAnomalyByType(gymId, type) {
  const query = `SELECT id FROM anomalies WHERE gym_id = $1 AND type = $2 AND resolved = FALSE`;
  const { rows } = await pool.query(query, [gymId, type]);
  return rows;
}

async function insertAnomaly({ gymId, type, severity, message }) {
  const query = `
    INSERT INTO anomalies (gym_id, type, severity, message) 
    VALUES ($1, $2, $3, $4) 
    RETURNING id, detected_at
  `;
  const { rows } = await pool.query(query, [gymId, type, severity, message]);
  return rows[0];
}

async function resolveAnomalyById(anomalyId, resolvedAt) {
  const query = `
    UPDATE anomalies 
    SET resolved = TRUE, resolved_at = $1 
    WHERE id = $2
    RETURNING id
  `;
  const { rows } = await pool.query(query, [resolvedAt, anomalyId]);
  return rows[0] || null;
}

async function getCurrentOccupancy(gymId) {
  const query = `SELECT COUNT(*)::INTEGER AS current_occ FROM checkins WHERE gym_id = $1 AND checked_out IS NULL`;
  const { rows } = await pool.query(query, [gymId]);
  return rows[0].current_occ;
}

async function getTodayRevenue(gymId, appTimezone) {
  const query = `SELECT COALESCE(SUM(amount), 0)::FLOAT AS today_total 
    FROM payments 
    WHERE gym_id = $1 AND paid_at >= DATE_TRUNC('day', NOW() AT TIME ZONE '${appTimezone}') AT TIME ZONE '${appTimezone}'`;
  const { rows } = await pool.query(query, [gymId]);
  return rows[0].today_total;
}

async function getLastWeekSameDayRevenue(gymId, appTimezone) {
  const query = `SELECT COALESCE(SUM(amount), 0)::FLOAT AS last_week_total 
    FROM payments 
    WHERE gym_id = $1 
      AND paid_at >= (DATE_TRUNC('day', NOW() AT TIME ZONE '${appTimezone}') AT TIME ZONE '${appTimezone}' - INTERVAL '7 days')
      AND paid_at < (DATE_TRUNC('day', NOW() AT TIME ZONE '${appTimezone}') AT TIME ZONE '${appTimezone}' - INTERVAL '6 days')`;
  const { rows } = await pool.query(query, [gymId]);
  return rows[0].last_week_total;
}

module.exports = {
  getActiveAnomalies,
  findById,
  getAnomalyById: findById,
  dismissAnomaly,
  getActiveGyms,
  getRecentCheckinCount,
  getOpenAnomalyByType,
  insertAnomaly,
  resolveAnomalyById,
  getCurrentOccupancy,
  getTodayRevenue,
  getLastWeekSameDayRevenue,
};