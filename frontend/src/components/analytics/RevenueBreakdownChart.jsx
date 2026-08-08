import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";

const COLORS = ["#F97316", "#3B82F6", "#10B981"];

export function RevenueBreakdownChart({ revenueData = [], dateRange, onDateRangeChange }) {
  const formattedData = revenueData.map((item) => ({
    plan: item.plan_type.toUpperCase(),
    revenue: Number(item.total_revenue) || 0,
  }));

  return (
    <div className="bg-theme-card border border-theme-border p-5 rounded-xl shadow-md flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Revenue by Plan Type
        </h3>

        {/* Date Range Selector */}
        <div className="flex bg-theme-bg p-1 rounded-lg border border-theme-border text-xs font-mono">
          {["7d", "30d", "90d"].map((range) => (
            <button
              key={range}
              onClick={() => onDateRangeChange(range)}
              className={`px-2.5 py-1 rounded transition ${
                dateRange === range
                  ? "bg-theme-border text-white font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[220px] w-full">
        {formattedData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">
            No revenue recorded for selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="plan" stroke="#64748B" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1A1A2E", borderColor: "#2A2A4A", borderRadius: "8px", fontSize: "12px" }}
                formatter={(val) => [`₹${val.toLocaleString("en-IN")}`, "Revenue"]}
              />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                {formattedData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}