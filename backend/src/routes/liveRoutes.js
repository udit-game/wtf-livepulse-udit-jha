const express = require("express");
const liveService = require("../services/liveService");

const router = express.Router();

router.get("/gyms/:id/live", async (req, res) => {
  try {
    const data = await liveService.getGymLiveSnapshot(
      req.params.id
    );

    res.status(200).json(data);
  } catch (error) {
    console.error("Failed to fetch live gym snapshot:", error);

    res.status(500).json({
      error: "Failed to fetch live gym snapshot",
    });
  }
});

module.exports = router;