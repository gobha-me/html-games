import { test, expect } from '@playwright/test';
import { KEYS, CONTROL_LABELS } from '../js/keys.js';

const LABELS = Object.keys(KEYS).map((action) => CONTROL_LABELS[action]);
const SIZES = [[1280, 720], [1366, 768], [1600, 900], [1920, 1080], [2560, 1440]];

async function openWatch(page, query = '?e2e=1&seed=108') {
  await page.clock.install({ time: new Date('2026-01-01T18:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T18:00:01Z'));
  await page.goto('/keeper/' + query);
  await page.getByRole('button', { name: 'Take the watch' }).click();
}
async function advance(page, seconds) { await page.evaluate((dt) => window.__keeper.advance(dt), seconds); }

// Every visible descendant box, and the element itself, sits inside the viewport
// and inside each ancestor that clips overflow; no text run is cut off.
async function unclipped(page, selector) {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector);
    const problems = [];
    const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const inside = (box, frame) => box.left >= frame.left - 0.5 && box.top >= frame.top - 0.5
      && box.right <= frame.right + 0.5 && box.bottom <= frame.bottom + 0.5;
    const nodes = [root, ...root.querySelectorAll('*')].filter((node) => node.getClientRects().length > 0
      && getComputedStyle(node).visibility !== 'hidden');
    for (const node of nodes) {
      const box = node.getBoundingClientRect();
      const name = `${node.tagName.toLowerCase()}${node.id ? '#' + node.id : ''} “${node.textContent.trim().slice(0, 24)}”`;
      if (!inside(box, viewport)) problems.push(`${name} outside viewport ${JSON.stringify(box)}`);
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (/(hidden|clip|scroll|auto)/.test(style.overflowX + style.overflowY)
          && !inside(box, parent.getBoundingClientRect())) problems.push(`${name} clipped by ${parent.tagName}#${parent.id}`);
      }
      const style = getComputedStyle(node);
      if (node.children.length === 0 && node.textContent.trim() && style.overflowX !== 'visible'
        && node.scrollWidth > node.clientWidth + 1 && !['morse-symbols', 'morse-text'].includes(node.id)) {
        problems.push(`${name} text overflows ${node.scrollWidth} > ${node.clientWidth}`);
      }
    }
    return { problems, count: nodes.length };
  }, selector);
}
async function noPageOverflow(page) {
  const size = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
    width: innerWidth, height: innerHeight,
  }));
  expect(size.scrollWidth).toBeLessThanOrEqual(size.width);
  expect(size.scrollHeight).toBeLessThanOrEqual(size.height);
}

for (const [width, height] of SIZES) {
  test(`title card, '?' controls card and footer are unclipped at ${width}×${height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto('/keeper/?e2e=1');
      await expect(page.locator('#start-panel')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'KEEPER', exact: true })).toBeInViewport({ ratio: 1 });
      for (const selector of ['#start-panel', 'footer', 'header']) {
        if (!await page.locator(selector).count()) continue;
        const result = await unclipped(page, selector);
        expect(result.count).toBeGreaterThan(0);
        expect(result.problems, `${selector} at ${width}×${height}`).toEqual([]);
      }
      expect(await page.locator('#title-controls li').allTextContents()).toEqual(LABELS);
      await expect(page.getByRole('link', { name: '← Back to Arcade' })).toBeInViewport({ ratio: 1 });
      await noPageOverflow(page);

      // The '?' card opened from the title, then from the footer during a watch.
      await page.keyboard.press('Slash');
      await expect(page.locator('#help-panel')).toBeVisible();
      expect((await unclipped(page, '#help-panel')).problems).toEqual([]);
      expect(await page.locator('#controls-list li').allTextContents()).toEqual(LABELS);
      await expect(page.getByRole('button', { name: 'Return to watch' })).toBeInViewport({ ratio: 1 });
      // The longest card variant: Morse reference shown as well.
      await page.locator('#show-reference').check();
      expect((await unclipped(page, '#help-panel')).problems).toEqual([]);
      // The reference card is a scroll container (overflow: auto) and may scroll at 1280×720.
      await expect(page.locator('#morse-reference')).toBeInViewport({ ratio: 1 });
      await noPageOverflow(page);
      await page.locator('#show-reference').uncheck();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Take the watch' }).click();
      expect((await unclipped(page, 'footer')).problems).toEqual([]);
      expect((await unclipped(page, '#watch-controls')).problems).toEqual([]);
      expect(await page.locator('#watch-controls-list li').allTextContents()).toEqual(LABELS);
      await page.getByRole('button', { name: 'Show controls' }).click();
      await expect(page.locator('#help-panel')).toBeVisible();
      expect((await unclipped(page, '#help-panel')).problems).toEqual([]);
      expect((await unclipped(page, 'footer')).problems).toEqual([]);
      await noPageOverflow(page);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test('every controls card is generated from the one key table (a changed table changes all three)', async ({ page }) => {
  // Serve a keys.js variant: if any card were hard-coded, it would not follow.
  await page.route('**/keeper/js/keys.js', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace("'H · horn'", "'H · fog horn (table edit)'")
      .replace("help: '? · controls',", "help: '? · controls', ")
      .replace("help: Object.freeze(['Slash']),", "help: Object.freeze(['Slash']),\n  zz: Object.freeze(['KeyZ']),")
      .replace("'? · controls',", "'? · controls', zz: 'Z · probe action',");
    await route.fulfill({ response, body });
  });
  await page.goto('/keeper/?e2e=1');
  const expected = ['← / A · slow', '→ / D · fast', 'Space · hold', 'H · fog horn (table edit)', 'K · signal lamp',
    'L · keeper’s log', 'Esc / P · pause', '? · controls', 'Z · probe action'];
  for (const id of ['title-controls', 'controls-list', 'watch-controls-list']) {
    expect(await page.locator(`#${id} li`).allTextContents(), id).toEqual(expected);
  }
  await expect(page.locator('#controls-hint')).toContainText('H · fog horn (table edit)');
});

test('reduced motion: no fog drift, surf or shake, and the transient overlay has no transition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/keeper/?e2e=1');
  const frames = await page.evaluate(async () => {
    const { createRenderer } = await import('/keeper/js/renderer.js');
    const { createState } = await import('/keeper/js/sim.js');
    const canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => ({ width: 1280, height: 720 });
    const renderer = createRenderer(canvas), ctx = canvas.getContext('2d');
    const state = { ...createState(108), ships: [], beam: 0 };
    const shot = (time, reduced) => {
      renderer.draw({ ...state, time }, reduced);
      return Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
    };
    const differs = (a, b) => a.some((value, i) => value !== b[i]);
    const reduced = [0, 0.5, 7.25, 10, 61.5, 179].map((time) => shot(time, true));
    const motion = [0, 10].map((time) => shot(time, false));
    return {
      reducedStill: reduced.every((frame) => !differs(frame, reduced[0])),
      motionMoves: differs(motion[0], motion[1]),
      reducedMatchesTimeZero: !differs(reduced[0], motion[0]),
    };
  });
  expect(frames.reducedStill).toBe(true);
  expect(frames.motionMoves).toBe(true); // Control: the same check detects drift when allowed.
  expect(frames.reducedMatchesTimeZero).toBe(true);

  await page.getByRole('button', { name: 'Take the watch' }).click();
  const motion = await page.evaluate(() => {
    const overlay = getComputedStyle(document.getElementById('watch-controls'));
    const transforms = [...document.querySelectorAll('body, main, canvas, footer, .panel')]
      .map((node) => getComputedStyle(node).transform);
    return {
      transition: overlay.transitionDuration.split(',').map((value) => Number.parseFloat(value)),
      transforms,
      animations: document.getAnimations().filter((animation) => animation.playState === 'running').length,
    };
  });
  expect(motion.transition.every((seconds) => seconds === 0)).toBe(true);
  expect(motion.transforms.every((value) => value === 'none')).toBe(true);
  expect(motion.animations).toBe(0);
  // No shake: a horn blast and a wreck never move the canvas or its chart transform.
  await page.keyboard.down('h'); await advance(page, 0.5); await page.keyboard.up('h');
  await advance(page, 60);
  const after = await page.evaluate(() => ({
    canvas: document.getElementById('sea').getBoundingClientRect().toJSON(),
    transform: getComputedStyle(document.getElementById('sea')).transform,
    matrix: document.getElementById('sea').getContext('2d').getTransform().toJSON(),
  }));
  expect(after.canvas.x).toBe(0);
  expect(after.canvas.y).toBe(0);
  expect(after.transform).toBe('none');
  expect([after.matrix.a, after.matrix.b, after.matrix.c, after.matrix.d, after.matrix.e, after.matrix.f])
    .toEqual([1, 0, 0, 1, 0, 0]);
});

test('changing the motion preference while paused repaints the resting scene in the new mode', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openWatch(page);
  await page.keyboard.press('Space');
  await advance(page, 12.3); // Mid-surf phase, fog well drifted.
  await page.keyboard.press('p');
  await expect(page.locator('#pause-panel')).toBeVisible();
  const frozen = await page.evaluate(() => window.__keeper.state);

  // Reference frames are drawn in-page from the frozen state with a fresh
  // renderer; comparisons stay in-page (3.6 M channels per frame).
  await page.evaluate(async (frozen) => {
    const { createRenderer } = await import('/keeper/js/renderer.js');
    const live = document.getElementById('sea');
    const frame = (reduced) => {
      const canvas = document.createElement('canvas');
      canvas.getBoundingClientRect = () => live.getBoundingClientRect();
      createRenderer(canvas).draw(frozen, reduced);
      return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    };
    window.__reference = { moving: frame(false), still: frame(true) };
  }, frozen);
  const differences = (name) => page.evaluate((name) => {
    const live = document.getElementById('sea');
    const screen = live.getContext('2d').getImageData(0, 0, live.width, live.height).data;
    const reference = window.__reference[name];
    if (screen.length !== reference.length) return -1;
    let count = 0;
    for (let i = 0; i < screen.length; i++) if (screen[i] !== reference[i]) count++;
    return count;
  }, name);
  expect(await page.evaluate(() => {
    const { moving, still } = window.__reference;
    return moving.some((value, i) => value !== still[i]);
  })).toBe(true); // Precondition: the two modes are distinguishable here.
  expect(await differences('moving')).toBe(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => differences('still')).toBe(0);
  expect(await page.evaluate(() => window.__keeper.state)).toEqual(frozen); // A repaint, not a tick.
  await expect(page.locator('#pause-panel')).toBeVisible();

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => differences('moving')).toBe(0);

  // The same holds on the help card opened over the pause.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('Slash');
  await expect(page.locator('#help-panel')).toBeVisible();
  await expect.poll(() => differences('still')).toBe(0);
  expect(await page.evaluate(() => window.__keeper.state)).toEqual(frozen);
});

test.describe('frame-time budget under 4× CPU throttling', () => {
  // Budget (documented in the #116 test notes): 120 warm-up frames are excluded
  // through the automation hook, then 240 consecutive play frames are measured
  // in real time. Per-frame synchronous work (sim + draw + HUD) must keep a p95
  // ≤ 8 ms, half of a 60 Hz frame, and the p95 RAF interval must stay ≤ 33.4 ms
  // (no worse than 30 fps). Local observations sit far inside both limits.
  test.setTimeout(120_000);
  const CPU_RATE = 4, WARMUP = 120, SAMPLES = 240;
  const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];

  test('play frames stay inside the budget after the warm-up is excluded', async ({ page }, testInfo) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });
    try {
      await page.goto('/keeper/?e2e=1&seed=108');
      const idle = await page.evaluate(() => window.__keeper.frameTiming);
      expect(idle.capacity).toBe(600);
      expect(idle.samples).toEqual([]); // Menus never sample.
      await page.getByRole('button', { name: 'Take the watch' }).click();
      await page.evaluate((frames) => window.__keeper.resetFrameTiming({ warmupFrames: frames }), WARMUP);
      expect((await page.evaluate(() => window.__keeper.frameTiming)).warmupRemaining).toBeGreaterThan(WARMUP - 10);
      await expect.poll(() => page.evaluate(() => window.__keeper.frameTiming.warmupRemaining),
        { timeout: 30_000 }).toBe(0);
      await expect.poll(() => page.evaluate(() => window.__keeper.frameTiming.samples.length),
        { timeout: 60_000 }).toBeGreaterThanOrEqual(SAMPLES);
      expect(await page.evaluate(() => window.__keeper.mode)).toBe('play');
      const { samples } = await page.evaluate(() => window.__keeper.frameTiming);
      const measured = samples.slice(-SAMPLES);
      for (let i = 1; i < measured.length; i++) {
        expect(measured[i].timestamp).toBeGreaterThan(measured[i - 1].timestamp);
      }
      expect(measured.every(({ intervalMs, workMs }) => intervalMs > 0 && workMs >= 0)).toBe(true);
      const interval = { p50: percentile(measured.map((s) => s.intervalMs), 0.5), p95: percentile(measured.map((s) => s.intervalMs), 0.95) };
      const work = { p50: percentile(measured.map((s) => s.workMs), 0.5), p95: percentile(measured.map((s) => s.workMs), 0.95) };
      await testInfo.attach('frame-timing.json', {
        body: JSON.stringify({ cpuRate: CPU_RATE, warmup: WARMUP, samples: measured.length, interval, work }, null, 2),
        contentType: 'application/json',
      });
      expect(work.p95).toBeLessThanOrEqual(8);
      expect(interval.p95).toBeLessThanOrEqual(33.4);
      // The watch really ran during sampling (not a paused or menu scene).
      expect((await page.evaluate(() => window.__keeper.state)).time).toBeGreaterThan(2);
    } finally {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    }
  });

  test('pause and menus add no samples; the interval across a pause is never recorded', async ({ page }) => {
    await page.goto('/keeper/?e2e=1&seed=108');
    await page.getByRole('button', { name: 'Take the watch' }).click();
    await page.evaluate(() => window.__keeper.resetFrameTiming({ warmupFrames: 0 }));
    await expect.poll(() => page.evaluate(() => window.__keeper.frameTiming.samples.length)).toBeGreaterThanOrEqual(10);
    await page.keyboard.press('p');
    const paused = await page.evaluate(() => window.__keeper.frameTiming.samples);
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => window.__keeper.frameTiming.samples)).toEqual(paused);
    await page.keyboard.press('p');
    await expect.poll(() => page.evaluate(() => window.__keeper.frameTiming.samples.length)).toBeGreaterThan(paused.length + 5);
    const resumed = (await page.evaluate(() => window.__keeper.frameTiming.samples)).slice(paused.length);
    expect(resumed.every(({ intervalMs }) => intervalMs < 500)).toBe(true);
    for (const bad of [-1, 1.5, Number.NaN, Infinity, 2 ** 53, '10', null]) {
      expect(await page.evaluate((frames) => {
        try { window.__keeper.resetFrameTiming({ warmupFrames: frames }); return 'accepted'; }
        catch (error) { return error.name; }
      }, bad)).toBe('RangeError');
    }
  });
});
