import React, { useState, useEffect } from "react";
import { PeakHoursHeatmap } from "./PeakHoursHeatmap";
import { RevenueBreakdownChart } from "./RevenueBreakdownChart";
import { ChurnRiskPanel } from "./ChurnRiskPanel";
import { CrossGymRevenueChart } from "./CrossGymRevenueChart";
import { fetchGymAnalytics, fetchCrossGymRevenue } from "../../services/api";
import Loader from "../ui/Loader";
import ErrorState from "../ui/ErrorState";

export function AnalyticsTab({ gymId }) {
  const [dateRange, setDateRange] = useState("7d");
  const [analytics, setAnalytics] = useState({
    peakHours: [],
    revenueByPlan: [],
    churnRisk: [],
    memberType: [],
  });
  const [crossGym, setCrossGym] = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [loadingCrossGym, setLoadingCrossGym] = useState(false);
  const [crossGymError, setCrossGymError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!gymId) return;
      setAnalyticsError("");
      setLoadingAnalytics(true);
      try {
        const data = await fetchGymAnalytics(gymId, dateRange);
        setAnalytics(data);
      } catch (err) {
        console.error(err);
        setAnalyticsError(err.message || "Failed to load analytics");
      } finally {
        setLoadingAnalytics(false);
      }
    };
    load();
  }, [gymId, dateRange]);

  useEffect(() => {
    const load = async () => {
      setCrossGymError("");
      setLoadingCrossGym(true);
      try {
        const data = await fetchCrossGymRevenue();
        setCrossGym(data);
      } catch (err) {
        console.error(err);
        setCrossGymError(err.message || "Failed to load cross-gym revenue");
      } finally {
        setLoadingCrossGym(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      {loadingAnalytics ? (
        <div className="bg-theme-card border border-theme-border p-5 rounded-xl shadow-md">
          <Loader label="Loading analytics..." />
        </div>
      ) : analyticsError ? (
        <ErrorState message={analyticsError} onRetry={() => fetchGymAnalytics(gymId, dateRange).then(setAnalytics)} />
      ) : (
        <PeakHoursHeatmap data={analytics.peakHours} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loadingAnalytics ? (
          <div className="bg-theme-card border border-theme-border p-5 rounded-xl shadow-md">
            <Loader label="Loading analytics..." />
          </div>
        ) : analyticsError ? (
          <ErrorState message={analyticsError} onRetry={() => fetchGymAnalytics(gymId, dateRange).then(setAnalytics)} />
        ) : (
          <RevenueBreakdownChart
            revenueData={analytics.revenueByPlan}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        )}

        <ChurnRiskPanel members={analytics.churnRisk} />
      </div>

      {loadingCrossGym ? (
        <div className="bg-theme-card border border-theme-border p-5 rounded-xl shadow-md">
          <Loader label="Loading cross-gym revenue..." />
        </div>
      ) : crossGymError ? (
        <ErrorState message={crossGymError} onRetry={() => fetchCrossGymRevenue().then(setCrossGym)} />
      ) : (
        <CrossGymRevenueChart crossGymData={crossGym} />
      )}
    </div>
  );
}