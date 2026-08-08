import { useEffect, useRef, useState, useCallback } from "react";
import { config } from "../config/env";

export function useWebSocket(onEventReceived) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const handlerRef = useRef(onEventReceived);

  useEffect(() => {
    handlerRef.current = onEventReceived;
  }, [onEventReceived]);

  const connect = useCallback(() => {
    try {
      // Dynamic fallback to current host if env variable is relative
      const wsUrl = config.wsUrl || `ws://${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data);
          if (handlerRef.current) {
            handlerRef.current(parsedData);
          }
        } catch (err) {
          console.error("Failed to parse WS payload:", err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        ws.close();
      };
    } catch (err) {
      console.error("WebSocket connection error:", err);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { isConnected };
}