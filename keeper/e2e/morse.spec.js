import { test, expect } from '@playwright/test';
import { keyingFor } from '../js/morse.js';

async function advance(page, seconds) {
  await page.evaluate((dt) => window.__keeper.advance(dt), seconds);
}
async function snapshot(page) { return page.evaluate(() => window.__keeper.state); }
async function openWatch(page) {
  await page.keyboard.up('Space');
  await page.clock.install({ time: new Date('2026-01-01T18:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T18:00:01Z'));
  await page.goto('/keeper/?e2e=1&seed=108');
  await page.locator('#start').click();
  await page.evaluate(() => {
    while (window.__keeper.state.time < 20) {
      const s = window.__keeper.state;
      const bearing = (Math.atan2(s.trawler.x, -s.trawler.y) * 180 / Math.PI + 360) % 360;
      if (Math.abs((bearing - s.beam + 540) % 360 - 180) < 3) break;
      window.__keeper.advance(0.025);
    }
  });
  await page.keyboard.down('Space');
}
async function keyMessage(page, text, finish = true) {
  let elapsed = 0;
  for (const { on, off } of keyingFor(text)) {
    if (on > elapsed) await advance(page, (on - elapsed) / 1000);
    await page.keyboard.down('k');
    await advance(page, (off - on) / 1000);
    await expect(page.locator('#lamp-state')).toHaveText('● Lamp open');
    await page.keyboard.up('k');
    elapsed = off;
  }
  await advance(page, finish ? 1.05 : 0.001);
}
// Inspect real canvas draw calls; no simulation or renderer mutation.
async function signalDrawn(page, seconds) {
  return page.evaluate((dt) => {
    const ctx = document.getElementById('sea').getContext('2d');
    const arc = ctx.arc, flashes = [];
    ctx.arc = function (x, y, radius, ...rest) {
      if (radius === 3 && this.fillStyle === '#fff0c9') flashes.push({ x, y });
      return arc.call(this, x, y, radius, ...rest);
    };
    try {
      window.__keeper.advance(dt);
      const ship = window.__keeper.state.trawler;
      return flashes.some((point) => Math.hypot(point.x - ship.x, point.y - ship.y) < 1e-6);
    } finally { ctx.arc = arc; }
  }, seconds);
}

test('K is discoverable in shared hints/help and real keying updates the live decode strip', async ({ page }) => {
  await openWatch(page);
  await expect(page.locator('#controls-hint')).toContainText('K · signal lamp');
  await keyMessage(page, 'R', false);
  await expect(page.locator('#morse-symbols')).toHaveText('·−·');
  await expect(page.locator('#morse-text')).toHaveText('R');
  await expect(page.locator('#morse-delivery')).toHaveText('Keying…');
  expect((await snapshot(page)).morse.lastMessage).toBeNull();
  await advance(page, 1.049);
  await expect(page.locator('#morse-delivery')).toHaveText('Sent · vessel in beam');
  expect((await snapshot(page)).trawler.reply).toBeNull();
  await page.keyboard.press('?');
  await expect(page.locator('#controls-list')).toContainText('K · signal lamp');
  await expect(page.getByLabel('Morse reference card')).toBeHidden();
  await page.getByLabel('Show Morse reference').check();
  await expect(page.getByLabel('Morse reference card')).toBeVisible();
  await expect(page.locator('#morse-alphabet span')).toHaveCount(36);
  await expect(page.locator('#morse-alphabet')).toContainText('R .-.');
  await page.getByRole('button', { name: 'Return to watch' }).click();
  await expect(page.getByLabel('Morse reference card')).toBeVisible();
  await page.screenshot({ path: 'test-results/keeper-morse-reference.png' });
});

for (const wpm of [8, 5]) {
  test(`ROCKS warns the lit ship and its actual reply point blinks at ${wpm} WPM`, async ({ page }) => {
    await openWatch(page);
    if (wpm === 5) {
      await page.keyboard.press('?');
      await page.getByLabel('Ship replies').selectOption('5');
      await page.getByRole('button', { name: 'Return to watch' }).click();
      await page.keyboard.up('Space');
      await page.keyboard.down('Space');
    }
    await keyMessage(page, 'ROCKS');
    await expect(page.locator('#morse-text')).toHaveText('ROCKS');
    const state = await snapshot(page);
    expect(state.morse.lastMessage.recipient).toBe('trawler');
    expect(state.trawler.warnedAt).not.toBeNull();
    expect(state.trawler.reply.flashes).toEqual(keyingFor('R', wpm));
    expect(state.trust).toBe(1);
    expect(await signalDrawn(page, 0)).toBe(true);
    await page.screenshot({ path: `test-results/keeper-morse-reply-${wpm}.png` });
    const unit = 1.2 / wpm;
    expect(await signalDrawn(page, unit + 0.01)).toBe(false);
    expect(await signalDrawn(page, unit)).toBe(true);
    expect(await signalDrawn(page, 3 * unit)).toBe(false);
    expect(await signalDrawn(page, unit)).toBe(true);
    expect(await signalDrawn(page, unit)).toBe(false);
    await expect(page.locator('#morse-text')).toHaveText('ROCKS');
  });
}

test('held K is cancelled across pause, help and focus loss, with no phantom dash after resume', async ({ page }) => {
  for (const interruption of ['pause', 'help', 'blur']) {
    await openWatch(page);
    await page.keyboard.down('k'); await advance(page, 0.1);
    expect((await snapshot(page)).lamp).toBe(true);
    if (interruption === 'pause') await page.keyboard.press('Escape');
    else if (interruption === 'help') await page.keyboard.press('?');
    else await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const pausedAt = (await snapshot(page)).time;
    await advance(page, 15);
    expect((await snapshot(page)).time).toBe(pausedAt);
    expect((await snapshot(page)).lamp).toBe(false);
    await page.keyboard.up('k');
    if (interruption === 'help') await page.getByRole('button', { name: 'Return to watch' }).click();
    else await page.getByRole('button', { name: 'Return to the light' }).click();
    await advance(page, 2);
    expect((await snapshot(page)).morse.lastMessage).toBeNull();
    expect((await snapshot(page)).morse.events).toEqual([]);
    await expect(page.locator('#lamp-state')).toHaveText('○ Lamp shuttered');
    await page.keyboard.down('Space');
    await keyMessage(page, 'K');
    await expect(page.locator('#morse-text')).toHaveText('K');
  }
});

test('unlit keying decodes but has no recipient, reply or warning', async ({ page }) => {
  await openWatch(page);
  await page.keyboard.up('Space');
  await advance(page, 1);
  await page.keyboard.down('Space');
  await keyMessage(page, 'ROCKS');
  await expect(page.locator('#morse-text')).toHaveText('ROCKS');
  await expect(page.locator('#morse-delivery')).toHaveText('Sent · no vessel in beam');
  expect((await snapshot(page)).trawler.warnedAt).toBeNull();
  expect((await snapshot(page)).trawler.reply).toBeNull();
});
