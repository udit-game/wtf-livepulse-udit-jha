import React, { useState, useEffect } from "react";
import { fetchAnomalies, dismissAnomaly } from "../../services/api";

export function AnomalyLogTab({ gymId }) {
  const [anomalies, setAnomalies] = useState([]);
  const [filterGym, setFilterGym] = useState(false);
  const [severityFilter, setSeverityFilter] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const loadAnomalies = async () => {
    try {
      const data = await fetchAnomalies(filterGym ? gymId : "", severityFilter);
      setAnomalies(data);
    } catch (err) {
      console.error("Failed to load anomalies:", err);
    }
  };

  useEffect(() => {
    loadAnomalies();
  }, [gymId, filterGym, severityFilter]);

  const handleDismiss = async (anomalyId) => {
    setErrorMsg("");
    try {
      await dismissAnomaly(anomalyId);
      loadAnomalies();
    } catch (err) {
      setErrorMsg(err.message || "Failed to dismiss anomaly");
    }
  };

  return (
    <div className="bg-theme-card border border-theme-border p-5 rounded-xl shadow-md space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-theme-border">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
            System Anomaly Audit Log
          </h3>
          <p className="text-[11px] text-slate-500">Live anomaly tracking and rule resolution</p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-400">
            <input
              type="checkbox"
              checked={filterGym}
              onChange={(e) => setFilterGym(e.target.checked)}
              className="rounded bg-theme-bg border-theme-border text-theme-brand focus:ring-0"
            />
            Filter by Current Gym
          </label>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-theme-bg border border-theme-border text-slate-300 rounded px-2.5 py-1 text-xs outline-none"
          >
            <option value="">All Severities</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg">
          {errorMsg}
        </div>
      )}

      {/* Anomalies Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-theme-bg text-[#64748B] uppercase font-mono text-[10px] border-b border-theme-border">
            <tr>
              <th className="py-2.5 px-3">Severity</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Gym</th>
              <th className="py-2.5 px-3">Message</th>
              <th className="py-2.5 px-3">Detected At</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border/60">
            {anomalies.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500 font-mono">
                  No active anomalies matching criteria
                </td>
              </tr>
            ) : (
              anomalies.map((a) => (
                <tr key={a.id} className="hover:bg-theme-bg/50 transition">
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        a.severity === "critical"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {a.severity}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold text-slate-200">{a.type}</td>
                  <td className="py-3 px-3 text-slate-400">{a.gym_name || a.gym_id}</td>
                  <td className="py-3 px-3 max-w-xs truncate text-slate-300">{a.message}</td>
                  <td className="py-3 px-3 font-mono text-slate-500">
                    {new Date(a.detected_at).toLocaleTimeString("en-IN")}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {a.severity === "critical" ? (
                      <span className="text-[10px] text-slate-500 font-mono italic" title="Critical anomalies cannot be manually dismissed">
                        Locked (403)
                      </span>
                    ) : a.dismissed ? (
                      <span className="text-[10px] text-slate-500 font-mono">Dismissed</span>
                    ) : (
                      <button
                        onClick={() => handleDismiss(a.id)}
                        className="px-2.5 py-1 bg-theme-border hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium transition"
                      >
                        Dismiss
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}