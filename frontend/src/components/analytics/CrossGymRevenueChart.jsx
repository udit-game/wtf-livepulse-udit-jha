import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";

export function CrossGymRevenueChart({ crossGymData = [] }) {
  const formattedData = crossGymData.map((g) => ({
    name: g.gym_name.replace("WTF Gyms — ", ""),
    revenue: Number(g.total_revenue) || 0,
    rank: g.rank,
  }));

  return (
    <div className="bg-theme-card border border-theme-border p-5 rounded-xl shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
            Cross-Gym Revenue Comparison (Last 30 Days)
          </h3>
          <p className="text-[0.9em] text-slate-500">30-day performance ranking across all 10 locations</p>
        </div>
      </div>

      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formattedData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
            <XAxis dataKey="name" stroke="#64748B" fontSize={10} interval={0} angle={-25} textAnchor="end" />
            <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1A1A2E", borderColor: "#2A2A4A", borderRadius: "8px", fontSize: "12px" }}
              formatter={(val) => [`₹${val.toLocaleString("en-IN")}`, "30d Revenue"]}
            />
            <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]}>
              {formattedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.rank === 1 ? "#F97316" : "#3B82F6"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}