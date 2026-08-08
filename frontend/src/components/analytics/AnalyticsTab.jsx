import React, { useState, useEffect } from "react";
import { PeakHoursHeatmap } from "./PeakHoursHeatmap";
import { RevenueBreakdownChart } from "./RevenueBreakdownChart";
import { ChurnRiskPanel } from "./ChurnRiskPanel";
import { CrossGymRevenueChart } from "./CrossGymRevenueChart";
import { fetchGymAnalytics, fetchCrossGymRevenue } from "../../services/api";

export function AnalyticsTab({ gymId }) {
  const [dateRange, setDateRange] = useState("7d");
  const [analytics, setAnalytics] = useState({
    peakHours: [],
    revenueByPlan: [],
    churnRisk: [],
    memberType: [],
  });
  const [crossGym, setCrossGym] = useState([]);

  useEffect(() => {
    if (gymId) {
      fetchGymAnalytics(gymId, dateRange)
        .then(setAnalytics)
        .catch(console.error);
    }
  }, [gymId, dateRange]);

  useEffect(() => {
    fetchCrossGymRevenue()
      .then(setCrossGym)
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <PeakHoursHeatmap data={analytics.peakHours} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RevenueBreakdownChart
          revenueData={analytics.revenueByPlan}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
        <ChurnRiskPanel members={analytics.churnRisk} />
      </div>

      <CrossGymRevenueChart crossGymData={crossGym} />
    </div>
  );
}