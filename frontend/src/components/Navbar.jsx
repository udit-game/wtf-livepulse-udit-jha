import React from "react";
import { theme } from "../theme";

export function Navbar({
  gyms,
  selectedGymId,
  onSelectGym,
  isConnected,
  allGymSummary,
  unreadAnomalyCount,
  activeTab,
  setActiveTab,
}) {
  return (
    <header className="sticky top-0 z-50 bg-theme-card border-b border-theme-border text-slate-200 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
      {/* Brand & Connection Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-wider text-themeBrand uppercase">WTF</span>
          <span className="text-xl font-light text-white">LivePulse</span>
        </div>

        {/* Pulsing WebSocket Status Indicator */}
        <div className="flex items-center gap-2 bg-themeBg px-3 py-1 rounded-full text-xs font-medium border border-themeBorder">
          <span
            className="h-2.5 w-2.5 rounded-full transition-colors duration-300"
            style={{ backgroundColor: isConnected ? theme.colors.status.success : theme.colors.status.danger }}
          />
          <span className={isConnected ? "text-emerald-400" : "text-rose-400"}>
            {isConnected ? "LIVE" : "DISCONNECTED"}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-4">
        <nav className="flex bg-themeBg p-1 rounded-lg border border-themeBorder text-sm">
          {["dashboard", "analytics", "anomalies"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-4 py-1.5 rounded-md font-medium capitalize transition ${
                activeTab === tab
                  ? "bg-themeBorder text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab}
              {tab === "anomalies" && unreadAnomalyCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[0.9em] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
                  {unreadAnomalyCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Gym Selector Dropdown */}
        <select
          value={selectedGymId}
          onChange={(e) => onSelectGym(e.target.value)}
          className="bg-themeBg border border-themeBorder text-white text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-themeBrand outline-none cursor-pointer"
        >
          {gyms.map((gym) => (
            <option key={gym.id} value={gym.id}>
              {gym.name} ({gym.city})
            </option>
          ))}
        </select>
      </div>

      {/* Aggregate All-Gym Summary Header Bar */}
      <div className="hidden lg:flex items-center gap-6 text-xs bg-themeBg px-4 py-2 rounded-lg border border-themeBorder">
        <div>
          <p className="text-slate-400">TOTAL OCCUPANCY</p>
          <p className="text-sm font-bold text-emerald-400">{allGymSummary.totalOccupancy} members</p>
        </div>
        <div className="h-6 w-px bg-themeBorder" />
        <div>
          <p className="text-slate-400">TODAY'S REVENUE</p>
          <p className="text-sm font-bold text-amber-400">₹{allGymSummary.totalRevenue.toLocaleString("en-IN")}</p>
        </div>
      </div>
    </header>
  );
}