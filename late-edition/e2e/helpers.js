import { test as base, expect } from '@playwright/test';

// Check both uncaught exceptions and browser console errors in every scenario.
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    // Legacy remote fonts are outside this issue's art pass. Supply an empty
    // stylesheet so offline CI exercises the real fallback fonts without noise.
    await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({
      contentType: 'text/css', body: '',
    }));
    await page.goto('/late-edition/?seed=83');
    await expect(page.locator('#title-screen')).toBeVisible();
    await use(page);
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
