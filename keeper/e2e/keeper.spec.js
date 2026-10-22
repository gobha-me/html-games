import { test, expect } from '@playwright/test';

async function openWatch(page, query = '?e2e=1&seed=108') {
  await page.clock.install({ time: new Date('2026-01-01T18:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T18:00:01Z'));
  await page.goto('/keeper/' + query);
  await page.getByRole('button', { name: 'Take the watch' }).click();
}
async function snapshot(page) { return page.evaluate(() => window.__keeper.state); }
async function advance(page, seconds) { await page.evaluate((dt) => window.__keeper.advance(dt), seconds); }
async function findTrawler(page) {
  // Search with the real automatic sweep, never by changing beam or ship state.
  await page.evaluate(() => {
    const lit = (s) => {
      const bearing = ((Math.atan2(s.trawler.x, -s.trawler.y) * 180 / Math.PI) + 360) % 360;
      return Math.abs(((bearing - s.beam + 540) % 360) - 180) <= 6;
    };
    while (!lit(window.__keeper.state) && window.__keeper.state.time < 30) window.__keeper.advance(0.05);
  });
}

test('arcade card opens Keeper, normal visits have no debug hook, back link returns', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('a.card.keeper').click();
  await expect(page).toHaveURL(/\/keeper\/$/);
  await expect(page.getByRole('heading', { name: 'KEEPER', exact: true })).toBeVisible();
  expect(await page.evaluate(() => '__keeper' in window)).toBe(false);
  await page.getByRole('link', { name: '← Back to Arcade' }).click();
  await expect(page.locator('a.card.keeper')).toBeVisible();
  expect(errors).toEqual([]);
});

test('keyboard drives clockwise speed and hold, overlapping keys cannot reverse; pointer never aims', async ({ page }) => {
  await openWatch(page);
  const initial = await snapshot(page);
  await page.clock.runFor(1000);
  const normal = await snapshot(page);
  expect(normal.beam - initial.beam).toBeGreaterThan(27);
  await page.keyboard.down('ArrowRight'); await advance(page, 3); await page.keyboard.up('ArrowRight');
  expect((await snapshot(page)).speed).toBe(60);
  await page.keyboard.down('ArrowLeft'); await advance(page, 5); await page.keyboard.up('ArrowLeft');
  expect((await snapshot(page)).speed).toBe(12);
  await page.keyboard.down('Space');
  const held = await snapshot(page);
  await page.mouse.move(20, 20); await advance(page, 1);
  await expect(page.locator('#lens-state')).toHaveText('Lens held');
  expect((await snapshot(page)).beam).toBe(held.beam);
  expect((await snapshot(page)).trawler.x).toBeGreaterThan(held.trawler.x);
  await page.keyboard.down('ArrowLeft'); await page.keyboard.down('ArrowRight');
  await advance(page, 2);
  expect((await snapshot(page)).speed).toBe(12);
  await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowRight'); await page.keyboard.up('Space');
  const before = await snapshot(page); await advance(page, 1);
  expect((await snapshot(page)).beam - before.beam).toBeCloseTo(12, 5);
});

test('unwarned watch wrecks, continues to dawn and persists its morning record', async ({ page }) => {
  await openWatch(page);
  await advance(page, 90);
  expect((await snapshot(page)).trawler.status).toBe('wrecked');
  await expect(page.locator('#dawn-panel')).toBeHidden();
  await advance(page, 90);
  await expect(page.locator('#summary')).toHaveText('0 ship passed safely. 1 ship wrecked.');
  expect((await snapshot(page)).time).toBe(180);
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem('keeper.record.v1')));
  expect(record).toEqual({ version: 1, seed: 108, safe: 0, wrecked: 1 });
  await page.reload();
  await expect(page.locator('#previous-record')).toHaveText('Last watch: 0 safe · 1 wrecked');
  await page.getByRole('button', { name: 'Take the watch' }).click();
  expect((await snapshot(page)).time).toBe(0);
});

test('spot, hold and horn saves the trawler; dawn reports safe and restart clears held inputs', async ({ page }) => {
  await openWatch(page);
  await findTrawler(page);
  await page.keyboard.down('Space'); await page.keyboard.down('h');
  await advance(page, 0.2);
  await expect(page.locator('#horn-state')).toHaveText('Horn sounding');
  expect((await snapshot(page)).trawler.warnedAt).not.toBeNull();
  await page.keyboard.up('h'); await page.keyboard.up('Space');
  await advance(page, 180);
  await expect(page.locator('#summary')).toHaveText('1 ship passed safely. 0 ship wrecked.');
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem('keeper.record.v1')));
  expect(record.safe).toBe(1);
  await page.getByRole('button', { name: 'Keep the light again' }).click();
  expect((await snapshot(page)).trawler.warnedAt).toBeNull();
  expect((await snapshot(page)).horn).toBe(false);
});

test('late or unlit distant horn cannot rescue a ship', async ({ page }) => {
  await openWatch(page);
  await page.keyboard.down('h'); await advance(page, 0.1); await page.keyboard.up('h');
  // Initial beam is deliberately outside the 14° cone of the trawler.
  expect((await snapshot(page)).trawler.warnedAt).toBeNull();
  // Let the lens reach the reef's bearing, then clutch it until danger arrives.
  await advance(page, 3.55);
  await page.keyboard.down('Space');
  await advance(page, 68.85);
  expect((await snapshot(page)).trawler.status).toBe('underway');
  await page.keyboard.down('h'); await advance(page, 0.1);
  expect((await snapshot(page)).trawler.warnedAt).not.toBeNull();
  await advance(page, 5);
  await page.keyboard.up('h'); await page.keyboard.up('Space');
  expect((await snapshot(page)).trawler.status).toBe('wrecked');
});

test('pause/help/blur freeze the world and release horn + clutch; autorepeat cannot toggle pause', async ({ page }) => {
  await openWatch(page); await advance(page, 2);
  await page.keyboard.down('h'); await page.keyboard.down('Space'); await advance(page, 0.1);
  await page.keyboard.press('p');
  const frozen = await snapshot(page);
  await page.clock.runFor(2000); await advance(page, 2);
  expect(await snapshot(page)).toEqual(frozen);
  await expect(page.locator('#pause-panel')).toBeVisible();
  await page.keyboard.down('p'); await page.keyboard.down('p');
  await expect(page.locator('#pause-panel')).toBeHidden();
  await page.keyboard.up('p'); await page.keyboard.up('h'); await page.keyboard.up('Space');
  await advance(page, 1);
  expect((await snapshot(page)).horn).toBe(false);
  expect((await snapshot(page)).beam).not.toBe(frozen.beam);
  await page.keyboard.press('?');
  const help = await snapshot(page); await advance(page, 3);
  expect(await snapshot(page)).toEqual(help);
  await expect(page.locator('#controls-list li')).toHaveCount(6);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#pause-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Return to the light' }).click();
  await advance(page, 1);
  expect((await snapshot(page)).horn).toBe(false);
});

test('corrupted or blocked storage never stops a watch or its summary', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('keeper.record.v1', '{not json'));
  await openWatch(page);
  await expect(page.locator('#previous-record')).toBeHidden();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
  });
  await advance(page, 180);
  await expect(page.locator('#summary')).toContainText('1 ship wrecked');
  await expect(page.locator('#record-status')).toContainText('could not keep');
});

test('1280×720 layout, resize and reduced motion keep controls usable with no overflow or errors', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWatch(page);
  await page.getByRole('button', { name: 'Mute horn', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unmute horn' })).toHaveAttribute('aria-pressed', 'true');
  for (const [width, height] of [[1280, 720], [1600, 900], [960, 600], [1280, 720]]) {
    await page.setViewportSize({ width, height });
    await page.clock.runFor(32);
    await advance(page, 0.1);
    const layout = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      canvas: document.getElementById('sea').getBoundingClientRect().toJSON(),
      pixelWidth: document.getElementById('sea').width,
    }));
    expect(layout.width).toBe(layout.viewport);
    expect(layout.canvas.width).toBe(width);
    expect(layout.canvas.height).toBe(height);
    expect(layout.pixelWidth).toBeGreaterThanOrEqual(width);
    await expect(page.getByRole('link', { name: '← Back to Arcade' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Show controls' })).toBeInViewport();
  }
  await findTrawler(page);
  await page.keyboard.down('Space'); await advance(page, 0.05);
  await page.screenshot({ path: 'test-results/keeper-lit.png' });
  await page.keyboard.up('Space');
  expect(errors).toEqual([]);
});

test('canvas conceals unseen hulls, reveals a lit silhouette and fades its remembered pose', async ({ page }) => {
  await openWatch(page);
  async function brightness(pose) {
    return page.evaluate((ship) => {
      const canvas = document.getElementById('sea');
      const x = Math.round((640 + ship.x * 0.86) * canvas.width / 1280);
      const y = Math.round((478 + ship.y * 0.86) * canvas.height / 720);
      const pixels = canvas.getContext('2d').getImageData(x - 16, y - 16, 32, 32).data;
      let peak = 0;
      for (let i = 0; i < pixels.length; i += 4) peak = Math.max(peak, pixels[i], pixels[i + 1], pixels[i + 2]);
      return peak;
    }, pose);
  }
  const unseen = (await snapshot(page)).trawler;
  expect(await brightness(unseen)).toBeLessThan(15);
  await findTrawler(page);
  const lit = (await snapshot(page)).trawler;
  expect(await brightness(lit)).toBeGreaterThan(100);
  await page.keyboard.down('ArrowRight'); await advance(page, 1); await page.keyboard.up('ArrowRight');
  const ghost = (await snapshot(page)).trawler;
  expect(ghost.afterimage).toBeGreaterThan(0);
  const fading = await brightness(ghost.lastSeen);
  expect(fading).toBeGreaterThan(10);
  expect(fading).toBeLessThan(90);
  await advance(page, 1.6);
  expect((await snapshot(page)).trawler.afterimage).toBe(0);
  expect(await brightness(ghost.lastSeen)).toBeLessThan(15);
});

test('automation hook snapshots cannot change simulation, invalid seeds fall back, and opt-in alone is insufficient', async ({ page }) => {
  await openWatch(page, '?e2e=1&seed=NaN');
  const seed = await page.evaluate(() => window.__keeper.seed);
  expect(seed).toBe(108);
  await page.evaluate(() => { const s = window.__keeper.state; s.beam = 123; s.trawler.status = 'safe'; });
  expect((await snapshot(page)).trawler.status).toBe('underway');
  expect((await snapshot(page)).beam).not.toBe(123);
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  await page.goto('/keeper/?e2e=1');
  expect(await page.evaluate(() => '__keeper' in window)).toBe(false);
});
