const simulatorRepository = require("../repositories/simulatorRepository");

let state = {
  status: "stopped",
  speed: 1,
};

async function startSimulation(speed = 1) {
  const parsedSpeed = Number(speed);

  if (![1, 5, 10].includes(parsedSpeed)) {
    const error = new Error("Speed must be 1, 5, or 10");
    error.statusCode = 400;
    throw error;
  }

  state.status = "running";
  state.speed = parsedSpeed;

  return { status: "running", speed: state.speed };
}

async function stopSimulation() {
  state.status = "paused";
  return { status: "paused" };
}

async function resetSimulation() {
  state.status = "paused";
  state.speed = 1;

  await simulatorRepository.resetToBaseline();

  return { status: "reset" };
}

module.exports = {
  startSimulation,
  stopSimulation,
  resetSimulation,
};