import { test, expect } from '@playwright/test';
import { createState, step, planSpawns } from '../js/sim.js';
import { HULLS, PHYSICS_DT } from '../js/physics.js';

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

test('title controls and first eight seconds of watch show the shared bindings; restart restores the overlay', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T18:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T18:00:01Z'));
  await page.goto('/keeper/?e2e=1');
  await expect(page.locator('#title-controls li')).toHaveCount(7);
  for (const key of ['← / A', '→ / D', 'Space', 'H · horn', 'K · signal lamp', 'Esc / P', '? · controls']) {
    await expect(page.locator('#title-controls')).toContainText(key);
  }
  await page.screenshot({ path: 'test-results/keeper-title-controls.png' });
  await page.getByRole('button', { name: 'Take the watch' }).click();
  const overlay = page.locator('#watch-controls');
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute('aria-hidden', 'false');
  expect(await page.locator('#watch-controls-list li').allTextContents()).toEqual(await page.locator('#title-controls li').allTextContents());
  await page.clock.runFor(400);
  await page.screenshot({ path: 'test-results/keeper-watch-controls.png' });
  await advance(page, 7.7 - (await snapshot(page)).time);
  await expect(overlay).toBeVisible();
  await advance(page, 0.4);
  await page.clock.runFor(400);
  await expect(overlay).toBeHidden();
  await expect(page.locator('#controls-hint')).toBeVisible();
  await advance(page, 180);
  await page.getByRole('button', { name: 'Keep the light again' }).click();
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute('aria-hidden', 'false');
});

test('first keyboard or pointer input fades controls without changing held-input behavior', async ({ page }) => {
  await openWatch(page);
  const overlay = page.locator('#watch-controls');
  await page.keyboard.down('h');
  await advance(page, 0.1);
  expect((await snapshot(page)).horn).toBe(true);
  await page.clock.runFor(400);
  await expect(overlay).toBeHidden();
  await page.keyboard.up('h');
  await advance(page, 1);
  await expect(overlay).toBeHidden();
  for (const input of ['pointer', 'unbound-key']) {
    await page.reload();
    await page.getByRole('button', { name: 'Take the watch' }).click();
    await expect(overlay).toBeVisible();
    if (input === 'pointer') await page.mouse.click(50, 300);
    else await page.keyboard.press('z');
    await page.clock.runFor(400);
    await expect(overlay).toBeHidden();
    expect((await snapshot(page)).time).toBeLessThan(2);
    await expect(page.locator('#controls-hint')).toBeVisible();
  }
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
  expect((await snapshot(page)).trawler.x).toBeLessThan(held.trawler.x);
  await page.keyboard.down('ArrowLeft'); await page.keyboard.down('ArrowRight');
  await advance(page, 2);
  expect((await snapshot(page)).speed).toBe(12);
  await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowRight'); await page.keyboard.up('Space');
  const before = await snapshot(page); await advance(page, 1);
  expect((await snapshot(page)).beam - before.beam).toBeCloseTo(12, 5);
});

test('unwarned watch wrecks, continues to dawn and persists its morning record', async ({ page }) => {
  await openWatch(page);
  await advance(page, 120);
  expect((await snapshot(page)).trawler.status).toBe('wrecked');
  await expect(page.locator('#dawn-panel')).toBeHidden();
  await advance(page, 60);
  await expect(page.locator('#summary')).toHaveText('0 ships passed safely. 1 ship wrecked. 3 passed unseen.');
  expect((await snapshot(page)).time).toBe(180);
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem('keeper.record.v1')));
  expect(record).toEqual({ version: 2, seed: 108, safe: 0, wrecked: 1 });
  await page.reload();
  await expect(page.locator('#previous-record')).toHaveText('Last watch: 0 safe · 1 wrecked');
  await page.getByRole('button', { name: 'Take the watch' }).click();
  expect((await snapshot(page)).time).toBe(0);
});

test('spot, hold and horn keeps the trawler clear; dawn avoids premature safe credit and restart clears held inputs', async ({ page }) => {
  await openWatch(page);
  await findTrawler(page);
  await page.keyboard.down('Space'); await page.keyboard.down('h');
  await advance(page, 0.2);
  await expect(page.locator('#horn-state')).toHaveText('Horn sounding');
  expect((await snapshot(page)).trawler.warnedAt).not.toBeNull();
  await page.keyboard.up('h'); await page.keyboard.up('Space');
  await advance(page, 180);
  await expect(page.locator('#summary')).toHaveText('0 ships passed safely. 0 ships wrecked. 3 passed unseen.');
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem('keeper.record.v1')));
  expect(record.safe).toBe(0);
  expect((await snapshot(page)).trawler.status).toBe('underway');
  expect((await snapshot(page)).trawler.wreckedAt).toBeNull();
  await page.getByRole('button', { name: 'Keep the light again' }).click();
  expect((await snapshot(page)).trawler.warnedAt).toBeNull();
  expect((await snapshot(page)).horn).toBe(false);
});

test('an off-beam broadcast keeps the trawler clear; warning just before impact is too late', async ({ page }) => {
  await openWatch(page);
  expect((await snapshot(page)).trawler.afterimage).toBe(0);
  await page.keyboard.down('h'); await advance(page, 0.1); await page.keyboard.up('h');
  expect((await snapshot(page)).trawler.warnedAt).not.toBeNull();
  await advance(page, 180);
  await expect(page.locator('#summary')).toHaveText('0 ships passed safely. 0 ships wrecked. 3 passed unseen.');
  await page.getByRole('button', { name: 'Keep the light again' }).click();
  // Compute the collision clock from the physical approach, never a stale magic time.
  const collisionTime = step(createState(108), {}, 180).trawler.wreckedAt;
  await advance(page, collisionTime - 0.2);
  expect((await snapshot(page)).trawler.status).toBe('underway');
  await page.keyboard.down('h'); await advance(page, 0.1);
  expect((await snapshot(page)).trawler.warnedAt).not.toBeNull();
  await advance(page, 5); await page.keyboard.up('h');
  expect((await snapshot(page)).trawler.status).toBe('wrecked');
});

test('scheduled arrivals stay absent until due, render through the fleet loop, and hear a fresh horn', async ({ page }) => {
  await openWatch(page, '?e2e=1&seed=0');
  const entry = planSpawns(0)[0];
  await advance(page, entry.spawnTime - 0.0001);
  expect((await snapshot(page)).ships.map((ship) => ship.id)).toEqual(['trawler']);
  await advance(page, 0.0002);
  const arrived = (await snapshot(page)).ships.find((ship) => ship.id === entry.id);
  expect(arrived.status).toBe('underway');
  expect(arrived.warnedAt).toBeNull();
  // Observe the real draw calls while the automatic sweep finds the new ship.
  const drawn = await page.evaluate((id) => {
    const ctx = document.getElementById('sea').getContext('2d');
    const rotate = ctx.rotate, translate = ctx.translate;
    let rotations = [], positions = [];
    ctx.rotate = function (angle) { rotations.push(angle); return rotate.call(this, angle); };
    ctx.translate = function (x, y) { positions.push({ x, y }); return translate.call(this, x, y); };
    try {
      for (let tick = 0; tick < 260; tick++) {
        rotations = []; positions = [];
        window.__keeper.advance(0.05);
        const ship = window.__keeper.state.ships.find((candidate) => candidate.id === id);
        if (ship.afterimage === 1.5) return { ship, rotations, positions };
      }
      return null;
    } finally { ctx.rotate = rotate; ctx.translate = translate; }
  }, entry.id);
  expect(drawn).not.toBeNull();
  expect(drawn.rotations.some((angle) => Math.abs(angle - drawn.ship.heading * Math.PI / 180) < 1e-10)).toBe(true);
  expect(drawn.positions.some(({ x, y }) => Math.abs(x - drawn.ship.x) < 1e-10 && Math.abs(y - drawn.ship.y) < 1e-10)).toBe(true);
  await page.screenshot({ path: 'test-results/keeper-spawn-lit.png' });
  await page.keyboard.down('h'); await advance(page, 0.1); await page.keyboard.up('h');
  const warned = (await snapshot(page)).ships.find((ship) => ship.id === entry.id);
  expect(warned.lastHorn.response).toBe('hold');
  expect(warned.warnedAt).toBeNull();
  await advance(page, 180);
  const dawn = await snapshot(page);
  expect(dawn.ships.map((ship) => ship.id)).toEqual(dawn.schedule.map((ship) => ship.id));
  expect(dawn.ships.find((ship) => ship.id === entry.id).status).toBe('safe');
  await page.getByRole('button', { name: 'Keep the light again' }).click();
  expect((await snapshot(page)).ships.map((ship) => ship.id)).toEqual(['trawler']);
});

test('invalid schedules visibly refuse to start at load and on the start-time recheck', async ({ page }) => {
  // Serve a broken content fixture through the real loader, without a production debug bypass.
  await page.route('**/keeper/js/sim.js', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace('const spawnRange = spawnRangeFor(approach);', 'const spawnRange = approach.pnrRange;');
    await route.fulfill({ response, body });
  });
  await page.goto('/keeper/?e2e=1');
  await expect(page.getByRole('alert')).toContainText('Cannot start watch: invalid ship schedule');
  await expect(page.getByRole('button', { name: 'Take the watch' })).toBeDisabled();
  expect((await snapshot(page)).time).toBe(0);
  expect(await page.evaluate(() => window.__keeper.mode)).toBe('start');
  await page.unroute('**/keeper/js/sim.js');
  await page.route('**/keeper/js/sim.js', async (route) => {
    const response = await route.fetch();
    // First construction loads valid content; the next construction imitates a bad restart/load.
    const body = 'let constructions = 0;\n' + (await response.text()).replace('const spawnRange = spawnRangeFor(approach);',
      'const spawnRange = ++constructions === 1 ? spawnRangeFor(approach) : approach.pnrRange;');
    await route.fulfill({ response, body });
  });
  await page.reload();
  await expect(page.getByRole('alert')).toBeHidden();
  await page.getByRole('button', { name: 'Take the watch' }).click();
  await expect(page.getByRole('alert')).toContainText('Cannot start watch');
  expect(await page.evaluate(() => window.__keeper.mode)).toBe('start');
  expect((await snapshot(page)).time).toBe(0);
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
  await expect(page.locator('#controls-list li')).toHaveCount(7);
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
    // Browser resize delivery can follow the synthetic animation clock tick.
    await expect.poll(() => page.evaluate(() => document.getElementById('sea').width)).toBeGreaterThanOrEqual(width);
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
  const unseen = (await snapshot(page)).trawler;
  // The retuned lane crosses chart ink. Compare with its unlit pixels so chart
  // marks cannot masquerade as a visible hull or a lingering afterimage.
  const baseline = await page.evaluate((ship) => {
    const canvas = document.getElementById('sea');
    const x = Math.round((640 + ship.x * 0.86) * canvas.width / 1280) - 40;
    const y = Math.round((478 + ship.y * 0.86) * canvas.height / 720) - 40;
    return { x, y, pixels: Array.from(canvas.getContext('2d').getImageData(x, y, 80, 80).data) };
  }, unseen);
  async function brightness(pose) {
    return page.evaluate(({ ship, baseline }) => {
      const canvas = document.getElementById('sea');
      const x = Math.round((640 + ship.x * 0.86) * canvas.width / 1280);
      const y = Math.round((478 + ship.y * 0.86) * canvas.height / 720);
      const pixels = canvas.getContext('2d').getImageData(x - 16, y - 16, 32, 32).data;
      let peak = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const column = (i / 4) % 32, row = Math.floor(i / 4 / 32);
        const prior = ((y - 16 + row - baseline.y) * 80 + x - 16 + column - baseline.x) * 4;
        for (let color = 0; color < 3; color++) peak = Math.max(peak, pixels[i + color] - baseline.pixels[prior + color]);
      }
      return peak;
    }, { ship: pose, baseline });
  }
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


test('horn reaction renders the continuous physics heading, without an instant bow snap', async ({ page }) => {
  await openWatch(page);
  const before = (await snapshot(page)).trawler;
  await page.keyboard.down('h'); await advance(page, 0.1); await page.keyboard.up('h');
  const pending = (await snapshot(page)).trawler;
  expect(pending.heading).toBe(before.heading);
  expect(pending.rudder).toBe(0);
  await advance(page, pending.reactAt - (await snapshot(page)).time + 0.5);
  let prior = (await snapshot(page)).trawler;
  expect(Math.abs(prior.rudder)).toBeGreaterThan(0);
  for (let index = 0; index < 10; index++) {
    await advance(page, PHYSICS_DT);
    const next = (await snapshot(page)).trawler;
    const change = ((next.heading - prior.heading + 540) % 360) - 180;
    expect(Math.abs(change)).toBeLessThanOrEqual(HULLS.trawler.K * HULLS.trawler.maxRudderDeg * PHYSICS_DT + 1e-8);
    prior = next;
  }
  await advance(page, 10);
  // Follow the normal sweep to the turning ship, then inspect actual canvas rotations.
  const rendered = await page.evaluate(() => {
    const context = document.getElementById('sea').getContext('2d');
    const original = context.rotate.bind(context), rotations = [];
    context.rotate = (angle) => { rotations.push(angle); original(angle); };
    for (let index = 0; index < 300; index++) {
      rotations.length = 0;
      window.__keeper.advance(0.05);
      const ship = window.__keeper.state.trawler;
      if (ship.afterimage === 1.5) {
        context.rotate = original;
        return { rotations, heading: ship.heading, yawRate: ship.yawRate };
      }
    }
    context.rotate = original;
    return null;
  });
  expect(rendered).not.toBeNull();
  expect(Math.abs(rendered.yawRate)).toBeGreaterThan(1);
  expect(rendered.rotations.some((angle) => Math.abs(angle - rendered.heading * Math.PI / 180) < 1e-10)).toBe(true);
  await page.screenshot({ path: 'test-results/keeper-physics-turn.png' });
});

// Sample the expected eastward ring edge in the real canvas, away from the beam,
// chart and lighthouse. Inspect the stroke too so a solid ignored ring cannot pass.
async function hornRingCanvas(page) {
  return page.evaluate(() => {
    const state = window.__keeper.state;
    const blastTime = state.blasts.at(-1);
    const age = state.time - blastTime;
    const radius = (700 - 350 * state.fog) * age / 2;
    const canvas = document.getElementById('sea'), ctx = canvas.getContext('2d');
    const strokes = [], arc = ctx.arc, stroke = ctx.stroke;
    let circle;
    ctx.arc = function (x, y, r, start, end) { circle = { x, y, radius: r, start, end }; return arc.call(this, x, y, r, start, end); };
    ctx.stroke = function () {
      if (circle && circle.x === 0 && circle.y === 0 && Math.abs(circle.radius - radius) < 1e-8) {
        strokes.push({ ...circle, alpha: this.globalAlpha, dash: this.getLineDash() });
      }
      circle = undefined;
      return stroke.call(this);
    };
    try { window.__keeper.advance(0); }
    finally { ctx.arc = arc; ctx.stroke = stroke; }
    const x = Math.round((640 + radius * 0.86) * canvas.width / 1280);
    const y = Math.round(478 * canvas.height / 720);
    // Include enough circumference for at least one dash plus its gap.
    const pixels = ctx.getImageData(x - 3, y - 12, 7, 25).data;
    let peak = 0;
    for (let i = 0; i < pixels.length; i += 4) peak = Math.max(peak, pixels[i], pixels[i + 1], pixels[i + 2]);
    return { radius, peak, strokes };
  });
}

test('muted horn draws expanding rings after release; spam is dimmed/dashed and trust recovers in HUD', async ({ page }) => {
  await openWatch(page);
  await page.getByRole('button', { name: 'Mute horn', exact: true }).click();
  await page.keyboard.down('Space');
  await page.keyboard.down('h'); await advance(page, 0.5); await page.keyboard.up('h');
  await advance(page, 0.1);
  await expect(page.locator('#horn-state')).toHaveText('Horn silent');
  await expect(page.locator('#trust-state')).toHaveText('Skipper trust · 100%');
  const first = await hornRingCanvas(page);
  expect(first.radius).toBeGreaterThan(150);
  expect(first.peak).toBeGreaterThan(80);
  expect(first.strokes).toHaveLength(1);
  expect(first.strokes[0].dash).toEqual([]);
  expect(first.strokes[0].end - first.strokes[0].start).toBeCloseTo(2 * Math.PI, 10);
  await advance(page, 0.4);
  const expanded = await hornRingCanvas(page);
  expect(expanded.radius).toBeGreaterThan(first.radius + 100);
  expect(expanded.strokes[0].alpha).toBeLessThan(first.strokes[0].alpha);
  for (let index = 0; index < 3; index++) {
    await page.keyboard.down('h'); await advance(page, 0.1); await page.keyboard.up('h');
    await advance(page, PHYSICS_DT);
  }
  const spam = await snapshot(page);
  expect(spam.blasts).toHaveLength(4);
  expect(spam.hornIgnoredUntil).toBeGreaterThan(spam.time + 29);
  expect(spam.trust).toBeGreaterThanOrEqual(0.75);
  expect(spam.trust).toBeLessThan(0.76);
  await advance(page, 0.4);
  const ignored = await hornRingCanvas(page);
  expect(ignored.strokes).toHaveLength(1);
  expect(ignored.strokes[0].dash.length).toBeGreaterThan(0);
  expect(ignored.strokes[0].alpha).toBeLessThan(0.35);
  expect(ignored.peak).toBeGreaterThan(20);
  expect(ignored.peak).toBeLessThan(first.peak);
  await expect(page.locator('#trust-state')).toHaveText(`Skipper trust · ${Math.round((await snapshot(page)).trust * 100)}%`);
  await page.screenshot({ path: 'test-results/keeper-horn-ignored.png' });
  const lowTrust = (await snapshot(page)).trust;
  await advance(page, 3);
  expect((await hornRingCanvas(page)).strokes).toEqual([]);
  expect((await snapshot(page)).trust).toBeCloseTo(lowTrust + 0.03, 8);
  await expect(page.locator('#trust-state')).toHaveText(`Skipper trust · ${Math.round((await snapshot(page)).trust * 100)}%`);
  await page.keyboard.up('Space');
});

test('paused horn presses create no blast, ring or trust change; resume and repress sends a new blast', async ({ page }) => {
  await openWatch(page);
  await page.keyboard.down('h'); await advance(page, 0.1);
  expect((await snapshot(page)).blasts).toHaveLength(1);
  await page.keyboard.press('p');
  expect((await snapshot(page)).horn).toBe(false);
  await page.keyboard.up('h');
  const frozen = await snapshot(page);
  await page.keyboard.down('h'); await page.clock.runFor(500); await advance(page, 3);
  expect(await snapshot(page)).toEqual(frozen);
  await page.keyboard.up('h'); await page.keyboard.press('p');
  await advance(page, 2.1);
  expect((await hornRingCanvas(page)).strokes).toEqual([]);
  await page.keyboard.down('h'); await advance(page, 0.5); await page.keyboard.up('h');
  expect((await snapshot(page)).blasts).toHaveLength(2);
  expect((await hornRingCanvas(page)).peak).toBeGreaterThan(80);
});
