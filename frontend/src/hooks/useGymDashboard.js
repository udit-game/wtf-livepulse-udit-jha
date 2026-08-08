import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "./useWebSocket";
import { fetchGyms, fetchGymLiveSnapshot, fetchAnomalies } from "../services/api";

export function useGymDashboard() {
  const [gyms, setGyms] = useState([]);
  const [selectedGymId, setSelectedGymId] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");

  const [snapshot, setSnapshot] = useState({
    occupancy: { current_occupancy: 0 },
    revenue: { today_revenue: 0 },
    events: [],
    anomalies: [],
  });
  const [unreadAnomalies, setUnreadAnomalies] = useState([]);

  // Load initial gyms list on mount
  useEffect(() => {
    fetchGyms().then((data) => {
      setGyms(data);
      if (data.length > 0) setSelectedGymId(data[0].id);
    }).catch(console.error);
  }, []);

  // Fetch full snapshot when selected gym changes
  const loadSnapshot = useCallback(async (gymId) => {
    if (!gymId) return;
    try {
      const data = await fetchGymLiveSnapshot(gymId);
      setSnapshot(data);
    } catch (err) {
      console.error("Failed to load gym snapshot:", err);
    }
  }, []);

  useEffect(() => {
    if (selectedGymId) loadSnapshot(selectedGymId);
  }, [selectedGymId, loadSnapshot]);

  // Load active unread anomalies for badge count
  useEffect(() => {
    fetchAnomalies().then((data) => {
      setUnreadAnomalies(data.filter((a) => !a.dismissed));
    }).catch(console.error);
  }, []);

  // Handle incoming real-time WebSocket events
  const handleWebSocketEvent = useCallback((event) => {
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

        return { ...prev, occupancy: updatedOccupancy, revenue: updatedRevenue, events: updatedEvents };
      });
    }

    if (event.type === "ANOMALY_DETECTED") {
      setUnreadAnomalies((prev) => [event, ...prev]);
    } else if (event.type === "ANOMALY_RESOLVED") {
      setUnreadAnomalies((prev) => prev.filter((a) => a.id !== event.anomaly_id));
    }
  }, [selectedGymId]);

  const { isConnected } = useWebSocket(handleWebSocketEvent);

  const activeGym = gyms.find((g) => g.id === selectedGymId);
  const allGymSummary = {
    totalOccupancy: snapshot?.occupancy?.current_occupancy ?? 0,
    totalRevenue: snapshot?.revenue?.today_revenue ?? 0,
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
    isConnected,
  };
}