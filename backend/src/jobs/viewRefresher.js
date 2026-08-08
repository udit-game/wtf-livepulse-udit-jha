const pool = require("../db/pool");

function startViewRefresherJob() {
  setInterval(async () => {
    try {
      await pool.query("REFRESH MATERIALIZED VIEW CONCURRENTLY gym_hourly_stats;");
      console.log("Materialized view gym_hourly_stats refreshed successfully");
    } catch (err) {
      console.error("Failed to refresh materialized view:", err);
    }
  }, 15 * 60 * 1000); // 15 minutes
}

module.exports = { startViewRefresherJob };