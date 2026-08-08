import React, { useState } from "react";
import { startSimulator, stopSimulator, resetSimulator } from "../../services/api";

export function SimulatorControlPanel() {
  const [status, setStatus] = useState("stopped"); // 'running' | 'paused' | 'stopped'
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleStart = async (selectedSpeed) => {
    setLoading(true);
    try {
      await startSimulator(selectedSpeed);
      setStatus("running");
      setSpeed(selectedSpeed);
    } catch (err) {
      console.error("Simulator start failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await stopSimulator();
      setStatus("paused");
    } catch (err) {
      console.error("Simulator stop failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Reset simulator state to seeded baseline?")) return;
    setLoading(true);
    try {
      await resetSimulator();
      setStatus("stopped");
      setSpeed(1);
      window.location.reload();
    } catch (err) {
      console.error("Simulator reset failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-theme-card border border-theme-border p-4 rounded-xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Simulator Control Engine
        </span>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
            status === "running"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-slate-500/10 text-slate-400 border-slate-500/30"
          }`}
        >
          {status.toUpperCase()} {status === "running" && `(${speed}x)`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Speed Multiplier Options */}
        <div className="flex bg-theme-bg p-1 rounded-lg border border-theme-border text-xs font-mono mr-2">
          {[1, 5, 10].map((s) => (
            <button
              key={s}
              disabled={loading}
              onClick={() => handleStart(s)}
              className={`px-2.5 py-1 rounded transition ${
                speed === s && status === "running"
                  ? "bg-theme-brand text-white font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Start / Stop Triggers */}
        {status === "running" ? (
          <button
            disabled={loading}
            onClick={handleStop}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold transition shadow"
          >
            Pause
          </button>
        ) : (
          <button
            disabled={loading}
            onClick={() => handleStart(speed)}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition shadow"
          >
            Start
          </button>
        )}

        {/* Reset Trigger */}
        <button
          disabled={loading}
          onClick={handleReset}
          className="px-3 py-1.5 bg-theme-bg border border-theme-border hover:bg-rose-900/30 text-rose-400 rounded text-xs font-medium transition"
        >
          Reset Baseline
        </button>
      </div>
    </div>
  );
}