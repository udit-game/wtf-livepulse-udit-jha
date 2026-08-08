const { WebSocketServer, WebSocket } = require("ws");

let wss = null;

/**
 * Initialize WebSocket Server attached to Express HTTP server
 */
function initWebSocket(server) {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("Client connected to WebSocket");

    // Ping/Pong keep-alive
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("close", () => {
      console.log("Client disconnected from WebSocket");
    });

    ws.on("error", (error) => {
      console.error("WebSocket client error:", error);
    });
  });

  // Heartbeat interval to prune dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  return wss;
}

/**
 * Broadcast structured payload to all connected WebSocket clients
 */
function broadcast(eventPayload) {
  if (!wss) return;

  const data = JSON.stringify(eventPayload);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

module.exports = {
  initWebSocket,
  broadcast,
};