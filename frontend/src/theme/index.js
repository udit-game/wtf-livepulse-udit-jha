export const theme = {
  colors: {
    bg: {
      primary: "#0D0D1A",    // Deep near-black background
      card: "#1A1A2E",       // Dark card container
      elevated: "#2A2A4A",   // Hover/active state or borders
    },
    text: {
      primary: "#E2E8F0",    // Primary readable text
      secondary: "#64748B",  // Muted labels/subtitles
      muted: "#475569",      // Disabled / faint text
    },
    accent: {
      brand: "#F97316",      // WTF Gyms bold orange accent
      brandHover: "#EA580C",
    },
    status: {
      success: "#10B981",    // Green (< 60% capacity / active)
      warning: "#F59E0B",    // Yellow (60-85% capacity / warnings)
      danger: "#EF4444",     // Red (> 85% capacity / critical)
    },
  },
  
  // Occupancy threshold helper matching PRD specs (M-03)
  getOccupancyStatus(capacityPct) {
    if (capacityPct < 60) {
      return { color: theme.colors.status.success, label: "NORMAL", className: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" };
    }
    if (capacityPct <= 85) {
      return { color: theme.colors.status.warning, label: "BUSY", className: "text-amber-400 border-amber-500/30 bg-amber-500/10" };
    }
    return { color: theme.colors.status.danger, label: "CRITICAL", className: "text-rose-400 border-rose-500/30 bg-rose-500/10" };
  },
};