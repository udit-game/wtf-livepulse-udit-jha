// Frontend runtime config; prefers Vite env vars but falls back to sensible defaults.
const defaultApi = typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:${process.env.BACKEND_PORT || 3001}/api` : "http://localhost:3001/api";
const defaultWs = typeof window !== "undefined" ? `ws://${window.location.hostname}:${process.env.BACKEND_PORT || 3001}/ws` : "ws://localhost:3001/ws";

export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || defaultApi,
  wsUrl: import.meta.env.VITE_WS_URL || defaultWs,
};