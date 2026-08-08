const pool = require("../db/pool");

async function getAllGyms() {
  const result = await pool.query(`
    SELECT
      g.id,
      g.name,
      g.city,
      g.capacity,
      g.status,

      COALESCE(occupancy.current_occupancy, 0)::INTEGER
        AS current_occupancy,

      COALESCE(revenue.today_revenue, 0)::NUMERIC(10, 2)
        AS today_revenue

    FROM gyms g

    LEFT JOIN (
      SELECT
        gym_id,
        COUNT(*)::INTEGER AS current_occupancy
      FROM checkins
      WHERE checked_out IS NULL
      GROUP BY gym_id
    ) occupancy
      ON occupancy.gym_id = g.id

    LEFT JOIN (
      SELECT
        gym_id,
        SUM(amount) AS today_revenue
      FROM payments
      WHERE paid_at >= CURRENT_DATE
        AND paid_at < CURRENT_DATE + INTERVAL '1 day'
      GROUP BY gym_id
    ) revenue
      ON revenue.gym_id = g.id

    ORDER BY g.name ASC;
  `);

  return result.rows;
}

module.exports = {
  getAllGyms,
};