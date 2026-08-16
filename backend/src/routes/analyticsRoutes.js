const express = require("express");
const router = express.Router();
const analyticsService = require("../services/analyticsService");

// GET /api/gyms/:id/analytics?dateRange=7d
router.get("/gyms/:id/analytics", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { dateRange = "7d" } = req.query;

    const data = await analyticsService.getGymAnalytics(id, dateRange);
    return res.status(200).json(data);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    next(err);
  }
});

// GET /api/analytics/cross-gym
router.get("/analytics/cross-gym", async (req, res, next) => {
  try {
    const data = await analyticsService.getCrossGymRevenue();
    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;