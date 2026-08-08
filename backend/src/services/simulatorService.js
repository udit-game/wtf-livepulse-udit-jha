const simulatorRepository = require("../repositories/simulatorRepository");

// In-memory simulation state singleton
let state = {
  status: "stopped", // 'running' | 'paused' | 'stopped'
  speed: 1,          // 1x | 5x | 10x
};

function getStatus() {
  return state;
}

function startSimulation(speed = 1) {
  const validSpeeds = [1, 5, 10];
  const parsedSpeed = Number(speed);

  if (!validSpeeds.includes(parsedSpeed)) {
    const error = new Error("Speed must be 1, 5, or 10");
    error.statusCode = 400;
    throw error;
  }

  state.status = "running";
  state.speed = parsedSpeed;

  return { status: "running", speed: state.speed };
}

function stopSimulation() {
  state.status = "paused";
  return { status: "paused" };
}

async function resetSimulation() {
  state.status = "paused";
  state.speed = 1;

  // Clear live open check-ins from PostgreSQL
  await simulatorRepository.resetToBaseline();

  return { status: "reset" };
}

module.exports = {
  getStatus,
  startSimulation,
  stopSimulation,
  resetSimulation,
};