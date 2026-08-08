const liveRepository = require("../repositories/liveRepository");

async function getGymLiveSnapshot(gymId) {
  const gymResult = await liveRepository.getGymSnapshot(gymId);

  return {
    current_occupancy: Number(
      gymResult.occupancy.current_occupancy
    ),
    today_revenue: Number(
      gymResult.revenue.today_revenue
    ),
    recent_events: gymResult.events,
    active_anomalies: gymResult.anomalies,
  };
}

module.exports = {
  getGymLiveSnapshot,
};