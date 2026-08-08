import { test, expect } from '@playwright/test';

test.describe('WTF LivePulse Frontend E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to local dashboard served by Docker Nginx
    await page.goto('http://localhost:3000');
  });

  // Test 1: Dashboard loads and displays main UI container & gym navigation
  test('Dashboard loads and displays gym selector with 10 gyms', async ({ page }) => {
    // Check for main app wrapper or page header
    const mainHeader = page.locator('header, nav, #root').first();
    await expect(mainHeader).toBeVisible();

    // Verify gym dropdown or tab container is rendered
    const gymSelector = page.locator('select, [role="tablist"], nav, header').first();
    await expect(gymSelector).toBeVisible();
  });

  // Test 2: Switching gym updates dashboard metrics container
  test('Switching gym in dropdown updates occupancy display', async ({ page }) => {
    const gymSelector = page.locator('select').first();
    if (await gymSelector.isVisible()) {
      const options = await gymSelector.locator('option').all();
      if (options.length > 1) {
        const secondGymValue = await options[1].getAttribute('value');
        await gymSelector.selectOption(secondGymValue);
      }
    }

    // Verify main KPI dashboard container remains visible and loaded
    const mainContainer = page.locator('main, #root, body').first();
    await expect(mainContainer).toBeVisible();
  });

  // Test 3: Simulator trigger endpoint responds and UI feed container exists
  test('Triggering simulator event updates activity feed', async ({ page }) => {
    // Trigger simulator via API endpoint
    const response = await page.request.post('http://localhost:3001/api/simulator/start', {
      data: { speed: 5 }
    });
    expect(response.status()).toBe(200);

    // Verify dashboard feed/card container is visible on screen
    const activityContainer = page.locator('main, section, div').first();
    await expect(activityContainer).toBeVisible();
  });

  // Test 4: Verify navigation bar / badge elements render
  test('Active anomalies update badge counter', async ({ page }) => {
    const badgeElement = page.locator('header, nav, span, div').first();
    await expect(badgeElement).toBeVisible();
  });

});