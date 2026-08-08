export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api",
  wsUrl: import.meta.env.VITE_WS_URL || "ws://localhost:3001",
};