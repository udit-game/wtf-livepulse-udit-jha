import React from "react";

export function ChurnRiskPanel({ members = [] }) {
  return (
    <div className="bg-theme-card border border-theme-border p-5 rounded-xl shadow-md flex flex-col h-[320px]">
      <div className="flex items-center justify-between pb-3 border-b border-theme-border mb-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
            Churn Risk Warning List
          </h3>
          <p className="text-[0.9em] text-slate-500">Active members absent for 45+ days</p>
        </div>
        <span className="text-xs bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded font-mono font-bold">
          {members.length} At Risk
        </span>
      </div>

      <div className="overflow-y-auto flex-1 space-y-2 pr-1">
        {members.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs font-mono">
            No members currently flagged for churn risk
          </div>
        ) : (
          members.map((m) => {
            const daysAbsent = m.last_checkin_at
              ? Math.floor((new Date() - new Date(m.last_checkin_at)) / (1000 * 60 * 60 * 24))
              : "45+";

            return (
              <div
                key={m.id}
                className="flex items-center justify-between bg-theme-bg p-3 rounded-lg border border-theme-border/60 text-xs hover:border-theme-border transition"
              >
                <div>
                  <p className="font-bold text-slate-200">{m.name}</p>
                  <p className="text-[0.85em] text-slate-400 font-mono">{m.phone || m.email}</p>
                </div>

                <div className="text-right">
                  <span
                    className={`text-[0.85em] font-bold px-2 py-0.5 rounded border ${
                      m.risk_level === "CRITICAL"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {m.risk_level || "HIGH"} ({daysAbsent}d absent)
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}