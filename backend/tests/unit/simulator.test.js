const { getTrafficMultiplier } = require("../../src/jobs/simulator");

describe("Simulator Traffic Multiplier Unit Tests", () => {
  // Test 10: Peak morning rush hour multiplier
  test("getTrafficMultiplier applies 1.0x multiplier during peak morning rush (08:00 IST)", () => {
    const morningDate = new Date("2026-08-08T08:00:00+05:30");
    const multiplier = getTrafficMultiplier(morningDate);
    expect(multiplier).toBe(1.0);
  });

  // Test 11: Dead night zero traffic multiplier
  test("getTrafficMultiplier applies 0.0x multiplier during closed hours (02:00 IST)", () => {
    const nightDate = new Date("2026-08-08T02:00:00+05:30");
    const multiplier = getTrafficMultiplier(nightDate);
    expect(multiplier).toBe(0.0);
  });

  // Test 12: Peak evening rush hour multiplier (19:00 IST)
  test("getTrafficMultiplier applies peak multiplier during evening rush (19:00 IST)", () => {
    const eveningDate = new Date("2026-08-08T19:00:00+05:30");
    const multiplier = getTrafficMultiplier(eveningDate);
    expect(multiplier).toBeGreaterThanOrEqual(0.8);
  });
});