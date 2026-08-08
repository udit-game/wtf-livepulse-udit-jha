const analyticsRepository = require("../repositories/analyticsRepository");

const VALID_DATE_RANGES = new Set(["7d", "30d", "90d"]);

async function getGymAnalytics(gymId, dateRange = "7d") {
  if (!VALID_DATE_RANGES.has(dateRange)) {
    const error = new Error(
      "dateRange must be one of: 7d, 30d, 90d"
    );

    error.statusCode = 400;
    throw error;
  }

  return analyticsRepository.getGymAnalytics(
    gymId,
    dateRange
  );
}

async function getCrossGymRevenue() {
  return analyticsRepository.getCrossGymRevenue();
}

module.exports = {
  getGymAnalytics,
  getCrossGymRevenue,
};