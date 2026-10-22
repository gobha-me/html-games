import { test, expect } from './helpers.js';
import { summarize, supportsFrameBudget, sampleFrameIntervals, sampleRenderCosts } from './performance-metrics.js';

// Keep SwiftShader scoped here: virtual-clock gameplay scenarios should not pay
// software-compositor wall time unrelated to their assertions.
// Calibration must precede *any* game rendering, including the shared title
// fixture: otherwise queued title raster work pollutes the blank-page probe.
test.use({ openTitle: false, launchOptions: {
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
} });

for (const rate of [1, 4]) {
  test(`1080p SwiftShader render budget (CPU ${rate}x)`, async ({ page }, testInfo) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('about:blank');
    const calibration = {};
    for (const key of ['empty', 'canvas']) {
      calibration[key] = summarize(await page.evaluate(sampleFrameIntervals, { durationMs: 1500, draw: key === 'canvas' }));
    }
    const frameBudgetSupported = supportsFrameBudget(calibration);
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await page.goto('/late-edition/?seed=89&preview=combat');
      await page.evaluate(() => document.fonts.ready);
      await expect.poll(() => page.evaluate(() => Boolean(window.lateEditionApp.renderer.cache))).toBe(true);
      // Steady-state budget: first wait for 30 consecutive on-budget frames.
      // Cache preparation completes before the first desk frame. Record its
      // cost and navigation-to-steady time too: moving work before this probe
      // must not conceal a slow load behind a short post-preparation warm-up.
      const warmupMs = await page.evaluate(() => new Promise((resolve) => {
        const t0 = performance.now(); let last = t0, streak = 0;
        const tick = (t) => {
          streak = t - last < 20 ? streak + 1 : 0; last = t;
          if (streak >= 30 || t - t0 > 8000) resolve(t - t0); else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }));
      console.log(`perf-warmup cpu${rate}x ${Math.round(warmupMs)}ms`);
      const startup = await page.evaluate(() => ({
        navigationToSteadyMs: performance.now(),
        cityPreparationMs: performance.getEntriesByName('late-edition:city-raster-ready').map(({ duration }) => duration),
      }));
      console.log(`perf-startup cpu${rate}x ${JSON.stringify(startup)}`);
      expect(warmupMs, 'desk must reach a steady 60 fps within 2 s of cache preparation').toBeLessThan(2000);
      // Total cold load is gated too so the fence cannot just relocate the stall:
      // 43d7940 measured ~5.2 s warm-up alone; 6 s total is that plus margin (#102).
      // 4x throttle is a stress case; total cold load is gated at real CPU speed.
      if (rate === 1) expect(startup.navigationToSteadyMs, 'navigation to steady 60 fps').toBeLessThan(6000);
      const { deterministic, live, frames, ...state } = await page.evaluate(sampleRenderCosts);
      const metrics = { ...state, cpuRate: rate, calibration, frameBudgetSupported, warmupMs, startup,
        deterministic: summarize(deterministic), live: summarize(live), frames: summarize(frames) };
      await testInfo.attach('swiftshader-frame-budget', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
      // Echo to stdout so CI logs show the numbers without downloading artifacts.
      console.log(`perf-metrics cpu${rate}x ${JSON.stringify({ calibration: metrics.calibration, frames: metrics.frames, live: metrics.live, deterministic: metrics.deterministic })}`);
      expect(metrics.viewport).toEqual([1920, 1080]);
      expect(metrics.duration).toBeGreaterThanOrEqual(5000);
      // The app caps catch-up at 50ms/frame. A minimum game-second count would
      // reintroduce the same presentation-dependent failure as the old sample gate.
      expect(metrics.elapsed).toBeGreaterThan(0);
      expect(metrics.simulationUntouched).toBe(true);
      expect(metrics.cacheStable).toBe(true);
      expect(metrics.deterministic.samples).toBeGreaterThanOrEqual(100);
      expect(metrics.deterministic.p95).toBeLessThan(rate === 1 ? 8 : 16);
      expect(metrics.live.samples).toBeGreaterThan(0);
      expect(metrics.live.p95).toBeLessThan(rate === 1 ? 8 : 16);
      // Renderer submission remains mandatory on every machine. Presentation
      // additionally needs a compositor that can meet 60Hz on the blank probes.
      // A 2-vCPU SwiftShader runner may miss that even without any game work;
      // waiving only frame pacing there avoids testing the host's raster speed.
      // 4x CPU deliberately slows submission; its regression budget is 16ms.
      if (rate === 1 && frameBudgetSupported) {
        expect(metrics.frames.samples).toBeGreaterThan(100);
        expect(metrics.frames.p95).toBeLessThan(20);
      } else {
        testInfo.annotations.push({ type: 'frame-pacing', description: rate === 4
          ? '4x CPU stress: render budget enforced; live pacing recorded.'
          : 'Blank-page/canvas calibration below 55fps or p95 >=20ms; render budget enforced.' });
      }
    } finally {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await cdp.detach();
    }
  });
}

test('starved rAF still supplies 150 samples and exposes an over-budget renderer', async ({ page }) => {
  // Match the budget cases: SwiftShader may drain their synchronous GPU batch
  // during this context's setup. Keep that setup headroom out of timing gates;
  // the 5 s live window, 150 samples and >=10 ms cost assertions stay mandatory.
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/late-edition/?seed=89&preview=combat');
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => Boolean(window.lateEditionApp.renderer.cache))).toBe(true);
  await page.evaluate(() => {
    const renderer = window.lateEditionApp.renderer;
    const originalRender = renderer.render;
    const nativeRAF = window.requestAnimationFrame;
    window.perfOriginalRender = originalRender;
    window.perfOriginalRAF = nativeRAF;
    // Force the CI failure shape (<100 presentations) independently of load,
    // and force an expensive real render. A no-op/sampling bug must not pass.
    renderer.render = function (...args) {
      const start = performance.now();
      while (performance.now() - start < 10) { /* Deliberate adversarial CPU cost. */ }
      return originalRender.apply(this, args);
    };
    window.requestAnimationFrame = (callback) => {
      let remaining = 5;
      const tick = (time) => {
        if (--remaining === 0) callback(time);
        // Capture the native callback: a pending tick can outlive restoration.
        else nativeRAF(tick);
      };
      return nativeRAF(tick);
    };
  });
  try {
    const metrics = await page.evaluate(sampleRenderCosts);
    expect(metrics.deterministic).toHaveLength(150);
    expect(summarize(metrics.deterministic).p95).toBeGreaterThanOrEqual(10);
    expect(summarize(metrics.live).p95).toBeGreaterThanOrEqual(10);
    expect(metrics.frames.length).toBeLessThan(100);
    expect(metrics.live.length).toBeGreaterThan(0);
    expect(metrics.live.length).toBeLessThan(100);
    expect(metrics.simulationUntouched).toBe(true);
    expect(metrics.elapsed).toBeGreaterThan(0);
  } finally {
    await page.evaluate(() => {
      window.lateEditionApp.renderer.render = window.perfOriginalRender;
      window.requestAnimationFrame = window.perfOriginalRAF;
      delete window.perfOriginalRender;
      delete window.perfOriginalRAF;
    });
  }
});
