import { test as base, expect } from '@playwright/test';

// Check both uncaught exceptions and browser console errors in every scenario.
export const test = base.extend({
  openTitle: [true, { option: true }],
  page: async ({ page, openTitle }, use, testInfo) => {
    const requests = [];
    page.on('request', (request) => requests.push(request.url()));
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    if (openTitle) {
      await page.goto('/late-edition/?seed=83');
      await expect(page.locator('#title-screen')).toBeVisible();
    }
    await use(page);
    await testInfo.attach('network-log', { body: JSON.stringify(requests, null, 2), contentType: 'application/json' });
    expect(requests.filter((url) => new URL(url).origin !== 'http://127.0.0.1:8123'),
      'No external origins in the actual network log').toEqual([]);
    expect(errors, 'No console errors or uncaught exceptions').toEqual([]);
  },
});

// Shared by existing desk scenarios: pass the real opening controls before play.
export async function skipColdOpen(page) {
  await page.locator('#btn-skip-intro').click();
  await expect(page.locator('#cold-open')).toBeHidden();
}

export async function startDesk(page, { dispatch = true } = {}) {
  await page.getByRole('button', { name: 'Start the night shift', exact: true }).click();
  await skipColdOpen(page);
  if (dispatch) await page.locator('#lead-list button').first().click();
}

export { expect };
