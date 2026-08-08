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
    WHERE a.resolved = FALSE
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

module.exports = {
  getActiveAnomalies,
  findById,
  getAnomalyById: findById, // Alias to satisfy anomalyService calls
  dismissAnomaly,
};