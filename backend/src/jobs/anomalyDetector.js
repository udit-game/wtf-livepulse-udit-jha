const { broadcast } = require("../websocket/server");
const anomalyRepo = require("../repositories/anomalyRepository");

/**
 * Pure Evaluation Functions (Exported for Jest Unit Testing)
 */
function evaluateZeroCheckins(gymStatus, isOperatingHours, recentCheckinCount) {
  return gymStatus === "active" && isOperatingHours && recentCheckinCount === 0;
}

function evaluateCapacityBreach(occupancy, capacity) {
  if (!capacity || capacity <= 0) return { trigger: false, resolve: false };
  const occupancyPct = (occupancy / capacity) * 100;
  return {
    trigger: occupancyPct > 90.0,
    resolve: occupancyPct < 85.0,
    pct: occupancyPct.toFixed(1),
  };
}

function evaluateRevenueDrop(todayRevenue, lastWeekSameDayRevenue) {
  if (!lastWeekSameDayRevenue || lastWeekSameDayRevenue <= 0) {
    return { trigger: false, resolve: false };
  }
  const ratio = todayRevenue / lastWeekSameDayRevenue;
  return {
    trigger: ratio <= 0.70,  // 30%+ drop
    resolve: ratio >= 0.80,  // Recovered to within 20%
    dropPct: ((1 - ratio) * 100).toFixed(1),
  };
}

/**
 * Main Anomaly Detection Loop (Runs every 30 seconds)
 */
const config = require("../config");
const APP_TIMEZONE = config.appTimezone || 'Asia/Kolkata';
async function checkAnomalies() {
  try {
    const gyms = await anomalyRepo.getActiveGyms();

    for (const gym of gyms) {
      await evaluateGymZeroCheckins(gym);
      await evaluateGymCapacityBreach(gym);
      await evaluateGymRevenueDrop(gym);
    }
  } catch (err) {
    console.error("Error running anomaly detection loop:", err);
  }
}

/**
 * Rule 1: Zero Check-ins Alert (Warning)
 */
async function evaluateGymZeroCheckins(gym) {
  const nowInIST = new Date(new Date().toLocaleString("en-US", { timeZone: APP_TIMEZONE }));
  const currentISTTime = `${String(nowInIST.getHours()).padStart(2, '0')}:${String(nowInIST.getMinutes()).padStart(2, '0')}`;
  
  const isOperatingHours = currentISTTime >= gym.opens_at && currentISTTime <= gym.closes_at;

  const recentCount = await anomalyRepo.getRecentCheckinCount(gym.id);
  const shouldTrigger = evaluateZeroCheckins(gym.status, isOperatingHours, recentCount);

  const existingRes = await anomalyRepo.getOpenAnomalyByType(gym.id, 'zero_checkins');

  if (shouldTrigger && existingRes.length === 0) {
    await triggerAnomaly({
      gymId: gym.id,
      gymName: gym.name,
      type: "zero_checkins",
      severity: "warning",
      message: `Zero check-ins recorded in the last 2 hours during operating hours at ${gym.name}.`,
    });
  } else if (recentCount > 0 && existingRes.length > 0) {
    await resolveAnomaly(existingRes[0].id, gym.id);
  }
}

/**
 * Rule 2: Capacity Breach Alert (Critical)
 */
async function evaluateGymCapacityBreach(gym) {
  const occupancy = await anomalyRepo.getCurrentOccupancy(gym.id);
  const { trigger, resolve, pct } = evaluateCapacityBreach(occupancy, gym.capacity);

  const existingRes = await anomalyRepo.getOpenAnomalyByType(gym.id, 'capacity_breach');

  if (trigger && existingRes.length === 0) {
    await triggerAnomaly({
      gymId: gym.id,
      gymName: gym.name,
      type: "capacity_breach",
      severity: "critical",
      message: `Capacity breach detected at ${gym.name}! Occupancy is at ${pct}% (${occupancy}/${gym.capacity}).`,
    });
  } else if (resolve && existingRes.length > 0) {
    await resolveAnomaly(existingRes[0].id, gym.id);
  }
}

/**
 * Rule 3: Revenue Drop Alert (Warning)
 */
async function evaluateGymRevenueDrop(gym) {
  // Today's Revenue
  const todayRevenue = await anomalyRepo.getTodayRevenue(gym.id, APP_TIMEZONE);
  const lastWeekRevenue = await anomalyRepo.getLastWeekSameDayRevenue(gym.id, APP_TIMEZONE);

  const { trigger, resolve, dropPct } = evaluateRevenueDrop(todayRevenue, lastWeekRevenue);

  const existingRes = await anomalyRepo.getOpenAnomalyByType(gym.id, 'revenue_drop');
  if (trigger && existingRes.length === 0) {
    await triggerAnomaly({
      gymId: gym.id,
      gymName: gym.name,
      type: "revenue_drop",
      severity: "warning",
      message: `Significant revenue drop detected at ${gym.name}. Revenue today is down ${dropPct}% vs last week.`,
    });
  } else if (resolve && existingRes.length > 0) {
    await resolveAnomaly(existingRes[0].id, gym.id);
  }
}

/**
 * Writes new anomaly to DB & broadcasts ANOMALY_DETECTED event over WebSockets
 */
async function triggerAnomaly({ gymId, gymName, type, severity, message }) {
  const anomaly = await anomalyRepo.insertAnomaly({ gymId, type, severity, message });

  broadcast({
    type: "ANOMALY_DETECTED",
    anomaly_id: anomaly.id,
    gym_id: gymId,
    gym_name: gymName,
    anomaly_type: type,
    severity: severity,
    message: message,
  });
}

/**
 * Resolves anomaly in DB & broadcasts ANOMALY_RESOLVED event over WebSockets
 */
async function resolveAnomaly(anomalyId, gymId) {
  const now = new Date().toISOString();

  await anomalyRepo.resolveAnomalyById(anomalyId, now);

  broadcast({
    type: "ANOMALY_RESOLVED",
    anomaly_id: anomalyId,
    gym_id: gymId,
    resolved_at: now,
  });
}

/**
 * Starts 30-second cron job
 */
function startAnomalyDetectorJob() {
  setInterval(checkAnomalies, 30000);
  // Run an immediate check 5 seconds after startup to pick up seed anomalies
  setTimeout(checkAnomalies, 5000);
  console.log("Anomaly detector background job initialized (30s interval)");
}

module.exports = {
  startAnomalyDetectorJob,
  checkAnomalies,
  evaluateZeroCheckins,
  evaluateCapacityBreach,
  evaluateRevenueDrop,
};