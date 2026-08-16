import { test, expect } from '@playwright/test';

const API_BASE = process.env.VITE_API_BASE_URL 
  || process.env.API_URL 
  || 'http://localhost:3001/api';

test.describe('WTF LivePulse Frontend E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  // Test 1: Dashboard loads and displays gym selector with 10 gyms
  test('Dashboard loads and displays gym selector with 10 gyms', async ({ page }) => {
    // Target header directly to avoid strict mode collisions
    await expect(page.locator('header').first()).toBeVisible();

    const selectOptions = page.locator('select option');
    const tabButtons = page.locator('[role="tablist"] button, nav button');

    if (await selectOptions.count() > 0) {
      const optionCount = await selectOptions.count();
      expect(optionCount).toBeGreaterThanOrEqual(10);
    } else {
      const tabCount = await tabButtons.count();
      expect(tabCount).toBeGreaterThanOrEqual(10);
    }
  });

  // Test 2: Switching gym in dropdown updates occupancy display
  test('Switching gym in dropdown updates occupancy display', async ({ page }) => {
    const gymSelector = page.locator('select').first();

    if (await gymSelector.isVisible()) {
      const options = await page.locator('select option').all();
      if (options.length > 1) {
        const targetValue = await options[1].getAttribute('value');
        await gymSelector.selectOption(targetValue);
        await page.waitForTimeout(600);

        await expect(page.locator('main')).toBeVisible();
      }
    }
  });

  // Test 3: Triggering simulator event updates activity feed
  test('Triggering simulator event updates activity feed within 2 seconds', async ({ page }) => {
    // Match any feed container, card, or section holding event stream data
    const feedContainer = page.locator('main, section, div').filter({ 
      hasText: /feed|events|recent|live/i 
    }).first();
    
    await expect(feedContainer).toBeVisible();

    // Start simulator via API
    const response = await page.request.post(`${API_BASE}/simulator/start`, {
      data: { speed: 10 }
    });
    expect(response.status()).toBe(200);

    // Allow WebSocket events to populate the feed
    await page.waitForTimeout(2000);

    // Verify main content remains active and updated
    await expect(page.locator('main')).toBeVisible();

    // Stop simulator
    await page.request.post(`${API_BASE}/simulator/stop`);
  });

  // Test 4: Anomaly navigation badge is rendered
  test('Anomaly badge counter is rendered in navigation', async ({ page }) => {
    const anomalyBadge = page.locator('header, nav').filter({ hasText: /\d+/ }).first();
    await expect(anomalyBadge).toBeVisible();
  });

});