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
  `;
  await pool.query(query);
}

module.exports = {
  resetToBaseline,
};