const express = require("express");
const router = express.Router();
const simulatorService = require("../services/simulatorService");

// POST /api/simulator/start
router.post("/start", async (req, res, next) => {
  try {
    const { speed = 1 } = req.body;
    const data = await simulatorService.startSimulation(speed);
    return res.status(200).json(data); // Returns { status: 'running', speed: 1 } directly
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// POST /api/simulator/stop
router.post("/stop", async (req, res, next) => {
  try {
    const data = await simulatorService.stopSimulation();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/simulator/reset
router.post("/reset", async (req, res, next) => {
  try {
    const data = await simulatorService.resetSimulation();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;