const express = require("express");
const gymService = require("../services/gymService");

const router = express.Router();

// no time constraint
router.get("/", async (req, res) => {
  try {
    const gyms = await gymService.getAllGyms();

    res.json({
      data: gyms,
    });
  } catch (error) {
    console.error("Failed to fetch gyms:", error);

    res.status(500).json({
      error: "Failed to fetch gyms",
    });
  }
});

module.exports = router;