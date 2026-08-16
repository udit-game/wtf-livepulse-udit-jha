import React from "react";
import { theme } from "../../theme";
import Loader from "../ui/Loader";
import ErrorState from "../ui/ErrorState";

export function KPIOccupancyCard({ occupancy = 0, capacity = 100, isLoading = false, error = "", onRetry }) {
  const capacityPct = capacity > 0 ? parseFloat(((occupancy / capacity) * 100).toFixed(1)) : 0;
  const status = theme.getOccupancyStatus(capacityPct);

  return (
    <div className="bg-theme-card border border-theme-border p-5 rounded-xl flex flex-col justify-between shadow-md">
      {error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : isLoading ? (
        <Loader label="Loading occupancy..." />
      ) : null}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Live Occupancy
        </span>
        <span className={`text-[0.85em] font-bold px-2 py-0.5 rounded-full border ${status.className}`}>
          {status.label} ({capacityPct}%)
        </span>
      </div>

      <div className="my-4 flex items-baseline gap-2">
        <span className="font-mono text-4xl font-bold text-white tracking-tight">{occupancy}</span>
        <span className="text-sm font-medium text-slate-400">/ {capacity} capacity</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-theme-bg h-2 rounded-full overflow-hidden border border-theme-border">
        <div
          className="h-full transition-all duration-500 rounded-full"
          style={{
            width: `${Math.min(capacityPct, 100)}%`,
            backgroundColor: status.color,
          }}
        />
      </div>
    </div>
  );
}