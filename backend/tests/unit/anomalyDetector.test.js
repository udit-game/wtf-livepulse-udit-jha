const {
  evaluateZeroCheckins,
  evaluateCapacityBreach,
  evaluateRevenueDrop,
} = require("../../src/jobs/anomalyDetector");

describe("Anomaly Detector Unit Tests", () => {
  // Test 1: Zero check-ins trigger condition
  test("evaluateZeroCheckins returns true when active, operating hours, and 0 check-ins", () => {
    const result = evaluateZeroCheckins("active", true, 0);
    expect(result).toBe(true);
  });

  // Test 2: Zero check-ins negative condition (outside operating hours)
  test("evaluateZeroCheckins returns false outside operating hours", () => {
    const result = evaluateZeroCheckins("active", false, 0);
    expect(result).toBe(false);
  });

  // Test 3: Zero check-ins negative condition (has check-ins)
  test("evaluateZeroCheckins returns false if recent check-ins exist", () => {
    const result = evaluateZeroCheckins("active", true, 5);
    expect(result).toBe(false);
  });

  // Test 4: Capacity breach trigger (> 90%)
  test("evaluateCapacityBreach triggers when occupancy exceeds 90%", () => {
    const { trigger, resolve, pct } = evaluateCapacityBreach(275, 300); // 91.7%
    expect(trigger).toBe(true);
    expect(resolve).toBe(false);
    expect(pct).toBe("91.7");
  });

  // Test 5: Capacity breach auto-resolution condition (< 85%)
  test("evaluateCapacityBreach resolves when occupancy drops below 85%", () => {
    const { trigger, resolve } = evaluateCapacityBreach(250, 300); // 83.3%
    expect(trigger).toBe(false);
    expect(resolve).toBe(true);
  });

  // Test 6: Capacity breach edge case (null capacity handling)
  test("evaluateCapacityBreach handles invalid or zero capacity gracefully", () => {
    const { trigger, resolve } = evaluateCapacityBreach(50, 0);
    expect(trigger).toBe(false);
    expect(resolve).toBe(false);
  });

  // Test 7: Revenue drop trigger (30%+ drop vs prior week)
  test("evaluateRevenueDrop triggers when revenue drop is 30% or more", () => {
    const { trigger, resolve, dropPct } = evaluateRevenueDrop(3000, 15000); // 80% drop
    expect(trigger).toBe(true);
    expect(resolve).toBe(false);
    expect(dropPct).toBe("80.0");
  });

  // Test 8: Revenue drop auto-resolution condition (recovers to within 20%)
  test("evaluateRevenueDrop resolves when revenue recovers to at least 80% of prior week", () => {
    const { trigger, resolve } = evaluateRevenueDrop(12500, 15000); // 83.3% ratio
    expect(trigger).toBe(false);
    expect(resolve).toBe(true);
  });

  // Test 9: Revenue drop edge case (zero baseline prior week)
  test("evaluateRevenueDrop returns false if prior week revenue is 0", () => {
    const { trigger, resolve } = evaluateRevenueDrop(5000, 0);
    expect(trigger).toBe(false);
    expect(resolve).toBe(false);
  });
});