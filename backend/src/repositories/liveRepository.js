const pool = require("../db/pool");

async function getGymSnapshot(gymId) {
  const occupancyQuery = pool.query(
    `
    SELECT COUNT(*)::INTEGER AS current_occupancy
    FROM checkins
    WHERE gym_id = $1
      AND checked_out IS NULL
    `,
    [gymId]
  );

  const revenueQuery = pool.query(
    `
    SELECT COALESCE(SUM(amount), 0)::NUMERIC(10, 2) AS today_revenue
    FROM payments
    WHERE gym_id = $1
      AND paid_at >= DATE_TRUNC(
        'day',
        NOW() AT TIME ZONE 'Asia/Kolkata'
      ) AT TIME ZONE 'Asia/Kolkata'
      AND paid_at < (
        DATE_TRUNC(
          'day',
          NOW() AT TIME ZONE 'Asia/Kolkata'
        ) AT TIME ZONE 'Asia/Kolkata'
      ) + INTERVAL '1 day'
    `,
    [gymId]
  );

  const eventsQuery = pool.query(
  `
  WITH recent_checkins AS (
    SELECT 
      c.id::TEXT || '-in' AS id,
      'checkin' AS event_type,
      c.member_id,
      m.name AS member_name,
      c.checked_in AS event_time,
      'checked_in' AS action,
      NULL::NUMERIC AS amount,
      NULL::TEXT AS plan_type
    FROM checkins c
    JOIN members m ON m.id = c.member_id
    WHERE c.gym_id = $1
    ORDER BY c.checked_in DESC
    LIMIT 20
  ),
  recent_checkouts AS (
    SELECT 
      c.id::TEXT || '-out' AS id,
      'checkout' AS event_type,
      c.member_id,
      m.name AS member_name,
      c.checked_out AS event_time,
      'checked_out' AS action,
      NULL::NUMERIC AS amount,
      NULL::TEXT AS plan_type
    FROM checkins c
    JOIN members m ON m.id = c.member_id
    WHERE c.gym_id = $1 AND c.checked_out IS NOT NULL
    ORDER BY c.checked_out DESC
    LIMIT 20
  ),
  recent_payments AS (
    SELECT 
      p.id::TEXT AS id,
      'payment' AS event_type,
      p.member_id,
      m.name AS member_name,
      p.paid_at AS event_time,
      'paid' AS action,
      p.amount,
      p.plan_type
    FROM payments p
    JOIN members m ON m.id = p.member_id
    WHERE p.gym_id = $1
    ORDER BY p.paid_at DESC
    LIMIT 20
  )
  SELECT * FROM (
    SELECT * FROM recent_checkins
    UNION ALL
    SELECT * FROM recent_checkouts
    UNION ALL
    SELECT * FROM recent_payments
  ) combined
  ORDER BY event_time DESC
  LIMIT 20
  `,
  [gymId]
);

  const anomaliesQuery = pool.query(
    `
    SELECT
      id,
      type,
      severity,
      message,
      detected_at
    FROM anomalies
    WHERE gym_id = $1
      AND resolved = FALSE
    ORDER BY detected_at DESC
    `,
    [gymId]
  );

  const [occupancy, revenue, events, anomalies] =
    await Promise.all([
      occupancyQuery,
      revenueQuery,
      eventsQuery,
      anomaliesQuery,
    ]);

  return {
    occupancy: occupancy.rows[0],
    revenue: revenue.rows[0],
    events: events.rows,
    anomalies: anomalies.rows,
  };
}

module.exports = {
  getGymSnapshot,
};