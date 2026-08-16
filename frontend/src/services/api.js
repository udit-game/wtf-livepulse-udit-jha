import { config } from "../config/env";

const BASE_URL = config.apiBaseUrl;

async function handleResponse(res) {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const error = new Error(errorData.error || `HTTP Error ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export async function fetchGyms() {
  const res = await fetch(`${BASE_URL}/gyms`);
  const json = await handleResponse(res);
  return json.data || [];
}

export async function fetchGymLiveSnapshot(gymId) {
  const res = await fetch(`${BASE_URL}/gyms/${gymId}/live`);
  const json = await handleResponse(res);
  return json.data;
}

export async function fetchGymAnalytics(gymId, dateRange = "7d") {
  const res = await fetch(`${BASE_URL}/gyms/${gymId}/analytics?dateRange=${dateRange}`);
  const json = await handleResponse(res);
  return json.data || {};
}

export async function fetchCrossGymRevenue() {
  const res = await fetch(`${BASE_URL}/analytics/cross-gym`);
  const json = await handleResponse(res);
  return json.data || [];
}

export async function fetchAnomalies(gymId = "", severity = "") {
  let url = `${BASE_URL}/anomalies?`;
  if (gymId) url += `gym_id=${gymId}&`;
  if (severity) url += `severity=${severity}`;
  
  const res = await fetch(url);
  const json = await handleResponse(res);
  return json.data || [];
}

export async function dismissAnomaly(anomalyId) {
  const res = await fetch(`${BASE_URL}/anomalies/${anomalyId}/dismiss`, {
    method: "PATCH",
  });
  const json = await handleResponse(res);
  return json.data;
}

export async function startSimulator(speed = 1) {
  const res = await fetch(`${BASE_URL}/simulator/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ speed }),
  });
  const json = await handleResponse(res);
  // Backend now returns the simulation state directly (e.g. { status: 'running', speed: 1 })
  return json;
}

export async function stopSimulator() {
  const res = await fetch(`${BASE_URL}/simulator/stop`, {
    method: "POST",
  });
  const json = await handleResponse(res);
  return json.data;
}

export async function resetSimulator() {
  const res = await fetch(`${BASE_URL}/simulator/reset`, {
    method: "POST",
  });
  const json = await handleResponse(res);
  return json.data;
}
