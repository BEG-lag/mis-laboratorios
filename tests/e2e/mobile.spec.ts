import { expect, test, type Page } from '@playwright/test';
import { ready, waitDrafts } from './helpers.ts';

const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('sin desplazamiento horizontal a 375 px en todas las vistas', async ({ page }) => {
  await page.goto('./');
  await ready(page, { serviceWorker: false });
  expect(page.viewportSize()?.width).toBe(375);
  expect(await noHorizontalScroll(page), 'portada').toBe(true);
  await page.locator('#demo-btn').click();
  await waitDrafts(page, 7);
  expect(await noHorizontalScroll(page), 'revisión').toBe(true);
  await page.locator('#confirm-all').click();
  await waitDrafts(page, 0);
  for (const tab of ['dashboard', 'chart', 'studies']) {
    await page.locator(`#tab-${tab}`).click();
    expect(await noHorizontalScroll(page), tab).toBe(true);
  }
  await page.locator('#tab-chart').click();
  const box = await page.locator('#chart-box').boundingBox();
  expect(box!.width).toBeLessThanOrEqual(375);
  await page.locator('#chart-box svg .pt').nth(3).tap();
  await expect(page.locator('#chart-tip')).toBeVisible();
  const tip = await page.locator('#chart-tip').boundingBox();
  expect(tip!.x).toBeGreaterThanOrEqual(0);
  expect(tip!.x + tip!.width).toBeLessThanOrEqual(375);
});
