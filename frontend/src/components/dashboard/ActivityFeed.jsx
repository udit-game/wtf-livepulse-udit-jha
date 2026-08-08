import React from "react";

const EVENT_BADGES = {
  checkin: { label: "IN", style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  checkout: { label: "OUT", style: "bg-slate-500/10 text-slate-400 border-slate-500/30" },
  payment: { label: "PAID", style: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
};

export function ActivityFeed({ events = [] }) {
  return (
    <div className="bg-theme-card border border-theme-border p-5 rounded-xl shadow-md flex flex-col h-[380px]">
      <div className="flex items-center justify-between pb-3 border-b border-theme-border mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Recent Activity Feed
        </h3>
        <span className="text-xs text-slate-500 font-mono">Last {events.length} events</span>
      </div>

      <div className="overflow-y-auto flex-1 space-y-2.5 pr-1">
        {events.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs font-mono">
            No recent activity recorded
          </div>
        ) : (
          events.map((evt) => {
            const badge = EVENT_BADGES[evt.event_type] || EVENT_BADGES.checkin;
            const timeFormatted = new Date(evt.event_time).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });

            return (
              <div
                key={evt.id}
                className="flex items-center justify-between bg-theme-bg p-2.5 rounded-lg border border-theme-border/60 text-xs hover:border-theme-border transition"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.style}`}>
                    {badge.label}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-200">{evt.member_name}</p>
                    {evt.event_type === "payment" && (
                      <p className="text-[10px] text-amber-400 font-mono">
                        ₹{evt.amount} • {evt.plan_type}
                      </p>
                    )}
                  </div>
                </div>

                <span className="text-[11px] text-slate-500 font-mono">{timeFormatted}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}