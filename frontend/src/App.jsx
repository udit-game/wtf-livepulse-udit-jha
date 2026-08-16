import React from "react";
import { Navbar } from "./components/Navbar";
import { DashboardTab } from "./components/dashboard/DashboardTab";
import { AnalyticsTab } from "./components/analytics/AnalyticsTab";
import { AnomalyLogTab } from "./components/anomalies/AnomalyLogTab";
import { SimulatorControlPanel } from "./components/simulator/SimulatorControlPanel";
import { useGymDashboard } from "./hooks/useGymDashboard";

export default function App() {
  const {
    gyms,
    selectedGymId,
    setSelectedGymId,
    activeTab,
    setActiveTab,
    snapshot,
    activeGym,
    allGymSummary,
    unreadAnomalyCount,
    isConnected,
  } = useGymDashboard();

  return (
    <div className="min-h-screen bg-theme-bg text-slate-200 flex flex-col justify-between">
      <div>
        <Navbar
          gyms={gyms}
          selectedGymId={selectedGymId}
          onSelectGym={setSelectedGymId}
          isConnected={isConnected}
          allGymSummary={allGymSummary}
          unreadAnomalyCount={unreadAnomalyCount}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        <main className="pt-22 p-6 max-w-7xl mx-auto space-y-6">
          <SimulatorControlPanel />

          {activeTab === "dashboard" && (
            <DashboardTab
              snapshot={snapshot}
              gymCapacity={activeGym?.capacity ?? 100}
            />
          )}

          {activeTab === "analytics" && (
            <AnalyticsTab gymId={selectedGymId} />
          )}

          {activeTab === "anomalies" && (
            <AnomalyLogTab gymId={selectedGymId} />
          )}
        </main>
      </div>

      <footer className="p-4 border-t border-theme-border text-center text-xs text-slate-500 font-mono">
        WTF LivePulse Command Center • Low Latency Operational Intelligence
      </footer>
    </div>
  );
}