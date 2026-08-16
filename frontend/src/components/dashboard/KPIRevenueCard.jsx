import React from "react";

export function KPIRevenueCard({ todayRevenue = 0 }) {
  return (
    <div className="bg-theme-card border border-theme-border p-5 rounded-xl flex flex-col justify-between shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Today's Revenue
        </span>
        <span className="text-[0.9em] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">
          REAL-TIME
        </span>
      </div>

      <div className="my-4">
        <div className="font-mono text-4xl font-bold text-amber-400 tracking-tight">
          ₹{Number(todayRevenue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </div>
      </div>

      <p className="text-xs text-slate-400">Accumulated revenue since midnight IST</p>
    </div>
  );
}