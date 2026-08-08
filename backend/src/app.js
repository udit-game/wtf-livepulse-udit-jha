require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const pool = require("./db/pool");
const { initWebSocket } = require("./websocket/server");
const { startSimulatorJob } = require("./jobs/simulator");
const { startAnomalyDetectorJob } = require("./jobs/anomalyDetector");
const { startViewRefresherJob } = require("./jobs/viewRefresher");

const gymRoutes = require("./routes/gymRoutes");
const liveRoutes = require("./routes/liveRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const anomalyRoutes = require("./routes/anomalyRoutes");
const simulatorRoutes = require("./routes/simulatorRoutes");

const app = express();
const server = http.createServer(app);

// Initialize WebSocket server
initWebSocket(server);

app.use(express.json());

// Enable CORS (automatically handles OPTIONS preflight requests)
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// API Routes
app.use("/api/gyms", gymRoutes);
app.use("/api", liveRoutes);
app.use("/api", analyticsRoutes);
app.use("/api/anomalies", anomalyRoutes);
app.use("/api/simulator", simulatorRoutes);

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "ok",
      service: "wtf-livepulse-backend",
      database: "connected",
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(503).json({
      status: "error",
      service: "wtf-livepulse-backend",
      database: "disconnected",
    });
  }
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Backend & WebSocket server running on port ${PORT}`);
  startSimulatorJob();
  startAnomalyDetectorJob();
  startViewRefresherJob();
});