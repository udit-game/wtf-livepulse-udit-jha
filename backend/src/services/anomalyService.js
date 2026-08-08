const anomalyRepository = require("../repositories/anomalyRepository");

async function getActiveAnomalies(gymId, severity) {
  return anomalyRepository.getActiveAnomalies(gymId, severity);
}

async function dismissAnomaly(id) {
  const anomaly = await anomalyRepository.getAnomalyById(id);

  if (!anomaly) {
    const error = new Error("Anomaly not found");
    error.statusCode = 404;
    throw error;
  }

  // CONSTRAINT: Critical severity anomalies cannot be dismissed
  if (anomaly.severity === "critical") {
    const error = new Error("Critical anomalies cannot be dismissed");
    error.statusCode = 403;
    throw error;
  }

  return anomalyRepository.dismissAnomaly(id);
}

module.exports = {
  getActiveAnomalies,
  dismissAnomaly,
};