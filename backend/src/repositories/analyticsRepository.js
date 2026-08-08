const pool = require("../db/pool");

const DATE_RANGES = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

async function getGymAnalytics(gymId, dateRange) {
  const days = DATE_RANGES[dateRange];

  // 1. Peak Hour Heatmap (Hits Materialized View Index - Q4: < 0.3ms)
  const peakHoursQuery = pool.query(
    `
    SELECT
      day_of_week,
      hour_of_day,
      checkin_count
    FROM gym_hourly_stats
    WHERE gym_id = $1
    ORDER BY day_of_week, hour_of_day
    `,
    [gymId]
  );

  // 2. Revenue Breakdown by Plan Type
  const revenueByPlanQuery = pool.query(
    `
    SELECT
      plan_type,
      COALESCE(SUM(amount), 0)::FLOAT AS total_revenue
    FROM payments
    WHERE gym_id = $1
      AND paid_at >= (
        DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
      ) - ($2 * INTERVAL '1 day')
    GROUP BY plan_type
    ORDER BY total_revenue DESC
    `,
    [gymId, days]
  );

  // 3. Churn Risk Members (Strictly 45+ Days - Q3 Benchmark: < 1ms)
  const churnRiskQuery = pool.query(
    `
    SELECT
      id,
      name,
      email,
      phone,
      last_checkin_at,
      plan_expires_at,
      CASE 
        WHEN last_checkin_at < NOW() - INTERVAL '60 days' THEN 'CRITICAL'
        ELSE 'HIGH'
      END AS risk_level
    FROM members
    WHERE gym_id = $1
      AND status = 'active'
      AND last_checkin_at < NOW() - INTERVAL '45 days'
    ORDER BY last_checkin_at ASC
    `,
    [gymId]
  );

  // 4. New vs Renewal Ratio (Queried from payments in selected date range)
  const memberTypeQuery = pool.query(
    `
    SELECT
      payment_type AS member_type,
      COUNT(*)::INTEGER AS count
    FROM payments
    WHERE gym_id = $1
      AND paid_at >= (
        DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
      ) - ($2 * INTERVAL '1 day')
    GROUP BY payment_type
    `,
    [gymId, days]
  );

  const [peakHours, revenueByPlan, churnRisk, memberType] = await Promise.all([
    peakHoursQuery,
    revenueByPlanQuery,
    churnRiskQuery,
    memberTypeQuery,
  ]);

  return {
    peakHours: peakHours.rows,
    revenueByPlan: revenueByPlan.rows,
    churnRisk: churnRisk.rows,
    memberType: memberType.rows,
  };
}

// Benchmark Q5 Target (< 2ms)
async function getCrossGymRevenue() {
  const query = `
    SELECT 
      g.id AS gym_id,
      g.name AS gym_name,
      COALESCE(SUM(p.amount), 0.00)::FLOAT AS total_revenue,
      DENSE_RANK() OVER (ORDER BY COALESCE(SUM(p.amount), 0.00) DESC)::INTEGER AS rank
    FROM gyms g
    LEFT JOIN payments p 
      ON g.id = p.gym_id 
     AND p.paid_at >= NOW() - INTERVAL '30 days'
    GROUP BY g.id, g.name
    ORDER BY total_revenue DESC;
  `;

  const { rows } = await pool.query(query);
  return rows;
}

module.exports = {
  getGymAnalytics,
  getCrossGymRevenue,
};