import React from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i}:00`);

export function PeakHoursHeatmap({ data = [] }) {
  // Build lookup map for fast grid cell lookups
  const statsMap = new Map();
  let maxCount = 1;

  data.forEach((row) => {
    const key = `${row.day_of_week}-${row.hour_of_day}`;
    const count = Number(row.checkin_count) || 0;
    statsMap.set(key, count);
    if (count > maxCount) maxCount = count;
  });

  const getCellBg = (count) => {
    if (count === 0) return "bg-[#0D0D1A]";
    const ratio = count / maxCount;
    if (ratio < 0.25) return "bg-amber-900/30 text-amber-300";
    if (ratio < 0.60) return "bg-amber-600/50 text-amber-200";
    if (ratio < 0.85) return "bg-orange-500/80 text-white font-bold";
    return "bg-rose-600 text-white font-bold";
  };

  return (
    <div className="bg-theme-card border border-theme-border p-5 rounded-xl shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-slate-300">
          Peak Hours Heatmap (7-Day Average)
        </h3>
        <div className="flex items-center gap-2 text-[0.9em] text-slate-400">
          <span>Low</span>
          <span className="w-3 h-3 rounded bg-amber-900/30 border border-amber-800" />
          <span className="w-3 h-3 rounded bg-amber-600/50" />
          <span className="w-3 h-3 rounded bg-orange-500/80" />
          <span className="w-3 h-3 rounded bg-rose-600" />
          <span>Peak</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Header row with hours */}
          <div className="grid grid-cols-[60px_repeat(24,1fr)] gap-1 mb-1 text-[0.85em] text-slate-500 font-mono text-center">
            <span />
            {HOURS.map((h, i) => (
              <span key={i}>{i % 3 === 0 ? h : ""}</span>
            ))}
          </div>

          {/* Grid rows by day */}
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="grid grid-cols-[60px_repeat(24,1fr)] gap-1 mb-1 text-xs items-center">
              <span className="font-medium text-slate-400 text-[0.9em] font-mono">{day}</span>
              {Array.from({ length: 24 }).map((_, hourIndex) => {
                const count = statsMap.get(`${dayIndex}-${hourIndex}`) || 0;
                return (
                  <div
                    key={hourIndex}
                    title={`${day} ${hourIndex}:00 — ${count} avg check-ins`}
                    className={`h-7 rounded flex items-center justify-center text-[0.85em] font-mono transition border border-theme-border/40 ${getCellBg(count)}`}
                  >
                    {count > 0 ? count : ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}