import React from "react";
import { KPIOccupancyCard } from "./KPIOccupancyCard";
import { KPIRevenueCard } from "./KPIRevenueCard";
import { ActivityFeed } from "./ActivityFeed";

export function DashboardTab({ snapshot, gymCapacity = 100 }) {
  const currentOccupancy = snapshot?.occupancy?.current_occupancy ?? 0;
  const todayRevenue = snapshot?.revenue?.today_revenue ?? 0;
  const events = snapshot?.events ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KPIOccupancyCard occupancy={currentOccupancy} capacity={gymCapacity} />
        <KPIRevenueCard todayRevenue={todayRevenue} />
      </div>

      <ActivityFeed events={events} />
    </div>
  );
}