import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "./useWebSocket";
import { fetchGyms, fetchGymLiveSnapshot, fetchAnomalies } from "../services/api";

const EMPTY_SNAPSHOT = {
  occupancy: { current_occupancy: 0 },
  revenue: { today_revenue: 0 },
  events: [],
  anomalies: [],
};

// Normalize the backend's flat live-snapshot shape into the nested shape
// that the dashboard components consume.
function normalizeSnapshot(data) {
  return {
    occupancy: { current_occupancy: data?.current_occupancy ?? 0 },
    revenue: { today_revenue: data?.today_revenue ?? 0 },
    events: data?.recent_events ?? [],
    anomalies: data?.active_anomalies ?? [],
  };
}

export function useGymDashboard() {
  const [gyms, setGyms] = useState([]);
  const [selectedGymId, setSelectedGymId] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");

  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [unreadAnomalies, setUnreadAnomalies] = useState([]);
  const [resolvedAnomalies, setResolvedAnomalies] = useState([]);

  // Load initial gyms list on mount
  useEffect(() => {
    fetchGyms()
      .then((data) => {
        setGyms(data);
        if (data.length > 0) setSelectedGymId(data[0].id);
      })
      .catch(console.error);
  }, []);

  // Fetch full snapshot when selected gym changes
  const loadSnapshot = useCallback(async (gymId) => {
    if (!gymId) return;
    try {
      const data = await fetchGymLiveSnapshot(gymId);
      setSnapshot(normalizeSnapshot(data));
    } catch (err) {
      console.error("Failed to load gym snapshot:", err);
    }
  }, []);

  useEffect(() => {
    if (selectedGymId) loadSnapshot(selectedGymId);
  }, [selectedGymId, loadSnapshot]);

  // Load active unread anomalies for badge count
  useEffect(() => {
    fetchAnomalies()
      .then((data) => {
        setUnreadAnomalies(data.filter((a) => !a.resolved || !a.dismissed));
      })
      .catch(console.error);
  }, []);

  // Handle incoming real-time WebSocket events
  const handleWebSocketEvent = useCallback(
    (event) => {
      // Keep the per-gym list in sync so the all-gym summary stays live
      setGyms((prev) =>
        prev.map((g) =>
          g.id === event.gym_id
            ? {
                ...g,
                ...(event.type === "CHECKIN_EVENT" || event.type === "CHECKOUT_EVENT"
                  ? { current_occupancy: event.current_occupancy }
                  : {}),
                ...(event.type === "PAYMENT_EVENT"
                  ? { today_revenue: event.today_total }
                  : {}),
              }
            : g
        )
      );

      if (event.gym_id === selectedGymId) {
        setSnapshot((prev) => {
          let updatedOccupancy = prev.occupancy;
          let updatedRevenue = prev.revenue;
          let updatedEvents = [...prev.events];

          if (event.type === "CHECKIN_EVENT" || event.type === "CHECKOUT_EVENT") {
            updatedOccupancy = { current_occupancy: event.current_occupancy };
            const newEvent = {
              id: `${event.gym_id}-${event.timestamp}-${Math.random()}`,
              event_type: event.type === "CHECKIN_EVENT" ? "checkin" : "checkout",
              member_name: event.member_name,
              event_time: event.timestamp,
            };
            updatedEvents = [newEvent, ...updatedEvents.slice(0, 19)];
          } else if (event.type === "PAYMENT_EVENT") {
            updatedRevenue = { today_revenue: event.today_total };
            const newEvent = {
              id: `${event.gym_id}-${event.timestamp}-${Math.random()}`,
              event_type: "payment",
              member_name: event.member_name,
              amount: event.amount,
              plan_type: event.plan_type,
              event_time: new Date().toISOString(),
            };
            updatedEvents = [newEvent, ...updatedEvents.slice(0, 19)];
          }

          return {
            ...prev,
            occupancy: updatedOccupancy,
            revenue: updatedRevenue,
            events: updatedEvents,
          };
        });
      }

      if (event.type === "ANOMALY_DETECTED") {
        setUnreadAnomalies((prev) => [{ ...event, id: event.anomaly_id }, ...prev]);
      } else if (event.type === "ANOMALY_RESOLVED") {
        setUnreadAnomalies((prev) => prev.filter((a) => a.id !== event.anomaly_id));
        // Record resolved anomaly events for downstream consumers (AnomalyLogTab)
        setResolvedAnomalies((prev) => [{ ...event, id: event.anomaly_id }, ...prev]);
      }
    },
    [selectedGymId]
  );

  const { isConnected } = useWebSocket(handleWebSocketEvent);

  const activeGym = gyms.find((g) => g.id === selectedGymId);

  // S-06: Aggregate totals across ALL gyms (not just the selected one)
  const allGymSummary = {
    totalOccupancy: gyms.reduce((sum, g) => sum + (Number(g.current_occupancy) || 0), 0),
    totalRevenue: gyms.reduce((sum, g) => sum + (Number(g.today_revenue) || 0), 0),
  };

  return {
    gyms,
    selectedGymId,
    setSelectedGymId,
    activeTab,
    setActiveTab,
    snapshot,
    activeGym,
    allGymSummary,
    unreadAnomalyCount: unreadAnomalies.length,
    resolvedAnomalies,
    isConnected,
  };
}