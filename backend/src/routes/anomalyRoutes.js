const express = require("express");
const router = express.Router();
const anomalyService = require("../services/anomalyService");

// GET /api/anomalies?gym_id=UUID&severity=warning
router.get("/", async (req, res, next) => {
  try {
    const { gym_id, severity } = req.query;
    const data = await anomalyService.getActiveAnomalies(gym_id, severity);
    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/anomalies/:id/dismiss
router.patch("/:id/dismiss", async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = await anomalyService.dismissAnomaly(id);
    return res.status(200).json(data);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    next(err);
  }
});

module.exports = router;