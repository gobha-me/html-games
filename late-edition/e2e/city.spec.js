import { test, expect, startDesk } from './helpers.js';

for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  test(`ten map addresses dispatch through art at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const retiredRequests = [];
    page.on('request', (request) => {
      if (/\/unit_[^/]+\.png/.test(request.url())) retiredRequests.push(request.url());
    });
    await page.setViewportSize(viewport);
    await page.reload(); // Capture requests from title, pass portraits, and unlocked plates too.
    await startDesk(page, { dispatch: false });
    await page.evaluate(() => {
      const { sim } = window.lateEditionApp;
      sim.paused = true;
      sim.edition = 4;
      window.lateEditionApp._syncFullUI();
    });
    const dispatched = [];
    for (let i = 0; i < 10; i++) {
      const target = await page.evaluate(() => {
        const app = window.lateEditionApp, { sim } = app;
        sim.selectOperative('rep_1');
        const lead = sim.leads[0];
        // Keep idle staff away from the address: operative selection has always
        // taken precedence within 30 world px and must continue to do so.
        sim.operatives.forEach((op, i) => { op.x = 580 + i * 80; op.y = 520; });
        const rect = app.canvas.getBoundingClientRect();
        app.renderer.render(sim, 0);
        return { uid: lead.uid, x: rect.left + lead.x / 1400 * rect.width,
          y: rect.top + lead.y / 1000 * rect.height };
      });
      await page.mouse.click(target.x, target.y);
      expect(await page.evaluate(() => window.lateEditionApp.sim.operatives[0].targetLeadId)).toBe(target.uid);
      dispatched.push(target.uid);
      await page.evaluate(() => {
        const { sim } = window.lateEditionApp;
        sim.completeLeadScoop(sim.leads[0]);
      });
    }
    expect(new Set(dispatched).size).toBe(10);
    expect(retiredRequests).toEqual([]);
  });
}

test('art never widens the lead hit radius, steals unit clicks, or dispatches after lockup', async ({ page }) => {
  await startDesk(page, { dispatch: false });
  const clickWorld = async (x, y) => {
    const point = await page.locator('#city-canvas').evaluate((canvas, { x, y }) => {
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + x / 1400 * rect.width, y: rect.top + y / 1000 * rect.height };
    }, { x, y });
    await page.mouse.click(point.x, point.y);
  };
  await page.evaluate(() => {
    const { sim } = window.lateEditionApp;
    sim.paused = true;
    sim.selectOperative('rep_1');
    sim.leads[0].x = 700; sim.leads[0].y = 300;
  });
  // Native click coordinates are rounded to CSS pixels; leave enough margin
  // that both sides of the legacy 46px point-dispatch snap radius survive
  // scaling. The canvas first checks 36px, then delegates to that sim fallback.
  await clickWorld(750, 300);
  expect(await page.evaluate(() => window.lateEditionApp.sim.operatives[0].targetLeadId)).toBe(null);
  await clickWorld(742, 300);
  expect(await page.evaluate(() => window.lateEditionApp.sim.operatives[0].targetLeadId)).not.toBe(null);
  await page.evaluate(() => {
    const { sim } = window.lateEditionApp;
    sim.operatives[1].x = 700; sim.operatives[1].y = 300;
    sim.operatives[0].targetLeadId = null;
  });
  await clickWorld(700, 300);
  expect(await page.evaluate(() => window.lateEditionApp.sim.selectedOpId)).toBe('rep_2');
  expect(await page.evaluate(() => window.lateEditionApp.sim.operatives[0].targetLeadId)).toBe(null);
  await page.evaluate(() => {
    const { sim } = window.lateEditionApp;
    sim.operatives[1].x = 800; sim.operatives[1].y = 500;
    sim.lockUp();
    window.lateEditionApp._syncFullUI();
  });
  await clickWorld(700, 300);
  expect(await page.evaluate(() => window.lateEditionApp.sim.operatives[1].targetLeadId)).toBe(null);
});

test('reduced motion title is pixel-static, including a live preference change', async ({ page }) => {
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => window.lateEditionApp.titleRenderer.reducedMotion)).toBe(true);
  const first = await page.locator('#title-city').evaluate((canvas) => canvas.toDataURL());
  await page.waitForTimeout(300);
  expect(await page.locator('#title-city').evaluate((canvas) => canvas.toDataURL())).toBe(first);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(300);
  expect(await page.locator('#title-city').evaluate((canvas) => canvas.toDataURL())).not.toBe(first);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(100);
  const frozen = await page.locator('#title-city').evaluate((canvas) => canvas.toDataURL());
  await page.waitForTimeout(300);
  expect(await page.locator('#title-city').evaluate((canvas) => canvas.toDataURL())).toBe(frozen);
});

test('1080p SwiftShader live play stays within the frame budget over five seconds', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/late-edition/?seed=89&preview=combat');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500); // Warm static caches/font loading before steady-state sampling.
  const metrics = await page.evaluate(async () => {
    const app = window.lateEditionApp;
    const startClock = app.sim.clockSec;
    const frames = [], costs = [];
    const original = app.renderer.render;
    const cache = app.renderer.cache;
    app.renderer.render = function (...args) {
      const start = performance.now();
      try { return original.apply(this, args); }
      finally { costs.push(performance.now() - start); }
    };
    let duration;
    try {
      duration = await new Promise((resolve) => {
        let start, last;
        const sample = (timestamp) => {
          start ??= timestamp;
          if (last !== undefined) frames.push(timestamp - last);
          last = timestamp;
          if (timestamp - start >= 5000) resolve(timestamp - start);
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
    } finally { app.renderer.render = original; }
    const p95 = (values) => values.toSorted((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
    return { duration, frameP95: p95(frames), renderP95: p95(costs), frames: frames.length,
      renders: costs.length, cacheStable: cache === app.renderer.cache, elapsed: app.sim.clockSec - startClock,
      viewport: [innerWidth, innerHeight], dpr: devicePixelRatio };
  });
  await testInfo.attach('swiftshader-frame-budget', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
  expect(metrics.viewport).toEqual([1920, 1080]);
  // The application's existing 50ms catch-up clamp can discard elapsed time
  // after a host scheduling stall. Require live simulation and five real seconds.
  expect(metrics.duration).toBeGreaterThanOrEqual(5000);
  expect(metrics.elapsed).toBeGreaterThan(1);
  expect(metrics.frames).toBeGreaterThan(100);
  expect(metrics.renders).toBeGreaterThan(100);
  expect(metrics.cacheStable).toBe(true);
  expect(metrics.frameP95).toBeLessThan(20);
  expect(metrics.renderP95).toBeLessThan(8);
});
