import { test, expect } from '@playwright/test';

async function advance(page, seconds) {
  await page.evaluate((dt) => window.__keeper.advance(dt), seconds);
}
async function snapshot(page) {
  return page.evaluate(() => window.__keeper.state);
}

test('L opens and closes the keeper’s log, freezes the watch, cancels horn and Morse, and persists revealed sightings', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T18:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T18:00:01Z'));
  await page.goto('/keeper/?e2e=1&seed=108');
  await page.getByRole('button', { name: 'Take the watch' }).click();

  // Before any ship is lit, the sighting selector and submit button are disabled.
  await page.keyboard.press('l');
  await expect(page.locator('#log-panel')).toBeVisible();
  await expect(page.locator('#log-what')).toBeDisabled();
  await expect(page.locator('#add-log-entry')).toBeDisabled();
  await expect(page.locator('#log-empty')).toBeVisible();
  await page.keyboard.press('l');
  await expect(page.locator('#log-panel')).toBeHidden();

  // Sweep until the beam reveals the opening trawler, then hold Space + H + K and open the log.
  await page.evaluate(() => {
    while (!window.__keeper.state.trawler.everSeen && window.__keeper.state.time < 30) {
      window.__keeper.advance(0.05);
    }
  });
  await page.keyboard.down('Space');
  await page.keyboard.down('h');
  await page.keyboard.down('k');
  await advance(page, 0.1);
  expect((await snapshot(page)).horn).toBe(true);
  expect((await snapshot(page)).lamp).toBe(true);

  await page.keyboard.press('l');
  await expect(page.locator('#log-panel')).toBeVisible();
  const frozen = await snapshot(page);
  expect(frozen.horn).toBe(false);
  expect(frozen.lamp).toBe(false);
  expect(frozen.morse.events).toEqual([]);

  // While open, gameplay inputs and simulation ticks are frozen.
  await page.keyboard.press('h');
  await page.keyboard.press('k');
  await advance(page, 5);
  expect(await snapshot(page)).toEqual(frozen);

  // Record the revealed trawler with a preset note, close, and verify fresh presses are required.
  await expect(page.locator('#log-what')).toBeEnabled();
  await page.locator('#log-note').selectOption('running dark');
  await page.locator('#add-log-entry').click();
  await expect(page.locator('#log-entries li')).toHaveCount(1);
  await expect(page.locator('#log-entries li').first()).toContainText('Trawler · running dark');

  await page.keyboard.press('l');
  await expect(page.locator('#log-panel')).toBeHidden();
  await page.keyboard.up('Space');
  await page.keyboard.up('h');
  await page.keyboard.up('k');
  await advance(page, 1.5);
  const afterClose = await snapshot(page);
  expect(afterClose.horn).toBe(false);
  expect(afterClose.lamp).toBe(false);
  expect(afterClose.morse.lastMessage).toBeNull();
  expect(afterClose.beam).not.toBe(frozen.beam);
});
