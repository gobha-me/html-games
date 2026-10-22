import { test, expect } from './helpers.js';

// Scope software rendering to this smoke. Other scenarios use Playwright's
// default backend; forcing SwiftShader across virtual-clock tests makes every
// simulated frame pay software-compositor wall time unrelated to their assertions.
test.use({ launchOptions: {
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
} });

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
