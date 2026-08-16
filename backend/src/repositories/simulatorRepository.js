const pool = require("../db/pool");

/**
 * Reset live simulation state to baseline:
 * - Clears all open check-ins (checked_out IS NULL)
 * - Preserves closed historical check-ins
 */
async function resetToBaseline() {
  const query = `
    DELETE FROM checkins
    WHERE checked_out IS NULL;

    UPDATE members m
    SET last_checkin_at = c.max_checkin
    FROM (
      SELECT member_id, MAX(checked_in) AS max_checkin
      FROM checkins
      GROUP BY member_id
    ) c
    WHERE m.id = c.member_id;
  `;
  await pool.query(query);
}

/**
 * Simulator repository helpers
 */
async function pickActiveMemberNotCheckedIn() {
  const query = `
    SELECT m.id AS member_id, m.name AS member_name, m.gym_id, g.capacity
    FROM members m
    JOIN gyms g ON g.id = m.gym_id
    WHERE m.status = 'active'
      AND g.status = 'active'
      AND (NOW() AT TIME ZONE 'Asia/Kolkata')::time BETWEEN g.opens_at AND g.closes_at
      AND NOT EXISTS (
        SELECT 1 FROM checkins c 
        WHERE c.member_id = m.id AND c.checked_out IS NULL
      )
    ORDER BY random()
    LIMIT 1;
  `;
  const { rows } = await pool.query(query);
  return rows[0];
}

async function insertCheckin(memberId, gymId, checkedIn) {
  const query = `INSERT INTO checkins (member_id, gym_id, checked_in) VALUES ($1, $2, $3)`;
  await pool.query(query, [memberId, gymId, checkedIn]);
}

async function getCurrentOccupancy(gymId) {
  const occQuery = `SELECT COUNT(*)::INTEGER AS current_occupancy FROM checkins WHERE gym_id = $1 AND checked_out IS NULL`;
  const { rows } = await pool.query(occQuery, [gymId]);
  return rows[0].current_occupancy;
}

async function updateMemberLastCheckin(memberId, lastCheckinAt) {
  const query = `UPDATE members SET last_checkin_at = $1 WHERE id = $2`;
  await pool.query(query, [lastCheckinAt, memberId]);
}

async function pickRandomOpenCheckin() {
  const query = `
    SELECT c.id AS checkin_id, c.member_id, c.gym_id, m.name AS member_name, g.capacity
    FROM checkins c
    JOIN members m ON m.id = c.member_id
    JOIN gyms g ON g.id = c.gym_id
    WHERE c.checked_out IS NULL
    ORDER BY random()
    LIMIT 1;
  `;
  const { rows } = await pool.query(query);
  return rows[0];
}

async function closeCheckin(checkinId, checkedOutAt) {
  const query = `UPDATE checkins SET checked_out = $1 WHERE id = $2`;
  await pool.query(query, [checkedOutAt, checkinId]);
}

async function pickRandomActiveMember() {
  const query = `SELECT m.id AS member_id, m.name AS member_name, m.gym_id, m.plan_type FROM members m WHERE m.status = 'active' ORDER BY random() LIMIT 1`;
  const { rows } = await pool.query(query);
  return rows[0];
}

async function insertPayment(memberId, gymId, amount, planType, paidAt) {
  const query = `INSERT INTO payments (member_id, gym_id, amount, plan_type, payment_type, paid_at) VALUES ($1, $2, $3, $4, 'renewal', $5)`;
  await pool.query(query, [memberId, gymId, amount, planType, paidAt]);
}

async function getTodayTotal(gymId, appTimezone) {
  const query = `SELECT COALESCE(SUM(amount), 0)::FLOAT AS today_total FROM payments WHERE gym_id = $1 AND paid_at >= DATE_TRUNC('day', NOW() AT TIME ZONE '${appTimezone}') AT TIME ZONE '${appTimezone}'`;
  const { rows } = await pool.query(query, [gymId]);
  return rows[0].today_total;
}

module.exports = {
  resetToBaseline,
  pickActiveMemberNotCheckedIn,
  insertCheckin,
  getCurrentOccupancy,
  updateMemberLastCheckin,
  pickRandomOpenCheckin,
  closeCheckin,
  pickRandomActiveMember,
  insertPayment,
  getTodayTotal,
};