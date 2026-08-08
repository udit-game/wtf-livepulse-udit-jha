const pool = require("../db/pool");
const { broadcast } = require("../websocket/server");
const simulatorService = require("../services/simulatorService");

// Hourly Traffic Multipliers (00:00 - 23:00 IST)
const HOURLY_MULTIPLIERS = [
  0.00, 0.00, 0.00, 0.00, 0.00, 0.30, // 00:00 - 05:59
  0.60, 1.00, 1.00, 1.00,             // 06:00 - 09:59 (Morning Rush)
  0.40, 0.40,                         // 10:00 - 11:59
  0.30, 0.30,                         // 12:00 - 13:59
  0.20, 0.20, 0.20,                   // 14:00 - 16:59
  0.90, 0.90, 0.90, 0.90,             // 17:00 - 20:59 (Evening Rush)
  0.35, 0.35,                         // 21:00 - 22:30
  0.00                                // 23:00
];

/**
 * Pure helper function to get current traffic multiplier based on IST hour
 * (Exported for Jest Unit Testing)
 */
function getTrafficMultiplier(date = new Date()) {
  const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false };
  const hourString = new Intl.DateTimeFormat([], options).format(date);
  const hour = parseInt(hourString, 10) % 24;
  return HOURLY_MULTIPLIERS[hour] ?? 0.0;
}

/**
 * Executes a single simulation tick
 */
async function tickSimulator() {
  const state = simulatorService.getStatus();
  if (state.status !== "running") return;

  try {
    const multiplier = getTrafficMultiplier();
    
    // Apply speed multiplier to event probability
    const eventProbability = 0.6 * multiplier * state.speed;
    if (Math.random() > Math.min(eventProbability, 0.95)) return;

    // Randomly select event type: 45% checkin, 45% checkout, 10% payment
    const roll = Math.random();

    if (roll < 0.45) {
      await handleCheckinEvent();
    } else if (roll < 0.90) {
      await handleCheckoutEvent();
    } else {
      await handlePaymentEvent();
    }
  } catch (err) {
    console.error("Error during simulator tick:", err);
  }
}

/**
 * Handle Simulated Check-in Event
 */
async function handleCheckinEvent() {
  // Pick an active gym and an active member who is NOT currently checked in
  const query = `
    SELECT m.id AS member_id, m.name AS member_name, m.gym_id, g.capacity
    FROM members m
    JOIN gyms g ON g.id = m.gym_id
    WHERE m.status = 'active'
      AND g.status = 'active'
      AND m.id NOT IN (SELECT member_id FROM checkins WHERE checked_out IS NULL)
    ORDER BY random()
    LIMIT 1;
  `;

  const { rows } = await pool.query(query);
  if (rows.length === 0) return;

  const member = rows[0];
  const now = new Date().toISOString();

  // Insert open check-in record
  await pool.query(
    `INSERT INTO checkins (member_id, gym_id, checked_in) VALUES ($1, $2, $3)`,
    [member.member_id, member.gym_id, now]
  );

  // Get updated gym occupancy
  const occQuery = await pool.query(
    `SELECT COUNT(*)::INTEGER AS current_occupancy FROM checkins WHERE gym_id = $1 AND checked_out IS NULL`,
    [member.gym_id]
  );

  const currentOccupancy = occQuery.rows[0].current_occupancy;
  const capacityPct = parseFloat(((currentOccupancy / member.capacity) * 100).toFixed(1));

  // Update member last_checkin_at
  await pool.query(
    `UPDATE members SET last_checkin_at = $1 WHERE id = $2`,
    [now, member.member_id]
  );

  // Broadcast CHECKIN_EVENT payload over WebSockets
  broadcast({
    type: "CHECKIN_EVENT",
    gym_id: member.gym_id,
    member_name: member.member_name,
    timestamp: now,
    current_occupancy: currentOccupancy,
    capacity_pct: capacityPct,
  });
}

/**
 * Handle Simulated Check-out Event
 */
async function handleCheckoutEvent() {
  // Pick an existing open check-in
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
  if (rows.length === 0) return;

  const checkin = rows[0];
  const now = new Date().toISOString();

  // Close the check-in
  await pool.query(
    `UPDATE checkins SET checked_out = $1 WHERE id = $2`,
    [now, checkin.checkin_id]
  );

  // Get updated gym occupancy
  const occQuery = await pool.query(
    `SELECT COUNT(*)::INTEGER AS current_occupancy FROM checkins WHERE gym_id = $1 AND checked_out IS NULL`,
    [checkin.gym_id]
  );

  const currentOccupancy = occQuery.rows[0].current_occupancy;
  const capacityPct = parseFloat(((currentOccupancy / checkin.capacity) * 100).toFixed(1));

  // Broadcast CHECKOUT_EVENT payload over WebSockets
  broadcast({
    type: "CHECKOUT_EVENT",
    gym_id: checkin.gym_id,
    member_name: checkin.member_name,
    timestamp: now,
    current_occupancy: currentOccupancy,
    capacity_pct: capacityPct,
  });
}

/**
 * Handle Simulated Payment Event
 */
async function handlePaymentEvent() {
  const query = `
    SELECT m.id AS member_id, m.name AS member_name, m.gym_id, m.plan_type
    FROM members m
    WHERE m.status = 'active'
    ORDER BY random()
    LIMIT 1;
  `;

  const { rows } = await pool.query(query);
  if (rows.length === 0) return;

  const member = rows[0];
  const now = new Date().toISOString();

  const amounts = { monthly: 1499.00, quarterly: 3999.00, annual: 11999.00 };
  const amount = amounts[member.plan_type] || 1499.00;

  // Insert payment record
  await pool.query(
    `INSERT INTO payments (member_id, gym_id, amount, plan_type, payment_type, paid_at) 
     VALUES ($1, $2, $3, $4, 'renewal', $5)`,
    [member.member_id, member.gym_id, amount, member.plan_type, now]
  );

  // Get updated today total for the gym
  const revQuery = await pool.query(
    `SELECT COALESCE(SUM(amount), 0)::FLOAT AS today_total
     FROM payments
     WHERE gym_id = $1 AND paid_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'`,
    [member.gym_id]
  );

  // Broadcast PAYMENT_EVENT payload over WebSockets
  broadcast({
    type: "PAYMENT_EVENT",
    gym_id: member.gym_id,
    amount: amount,
    plan_type: member.plan_type,
    member_name: member.member_name,
    today_total: revQuery.rows[0].today_total,
  });
}

/**
 * Start 2-second background ticker
 */
function startSimulatorJob() {
  setInterval(tickSimulator, 2000);
  console.log("Simulator background job initialized (2s interval)");
}

module.exports = {
  startSimulatorJob,
  getTrafficMultiplier,
  tickSimulator,
};