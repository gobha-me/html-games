import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1280, height: 720 }, { width: 1600, height: 900 }]) {
  for (const deviceScaleFactor of [1, 2]) {
    test(`beam starts at the lamp: ${viewport.width}×${viewport.height}, DPR ${deviceScaleFactor}`, async ({ browser }, testInfo) => {
      const context = await browser.newContext({ viewport, deviceScaleFactor, reducedMotion: 'reduce' });
      try {
        const page = await context.newPage();
        await page.clock.install({ time: new Date('2026-01-01T18:00:00Z') });
        await page.clock.pauseAt(new Date('2026-01-01T18:00:01Z'));
        await page.goto('/keeper/?e2e=1');
        await page.getByRole('button', { name: 'Take the watch' }).click();
        await page.keyboard.press('Space'); // Dismiss the discovery overlay.

        for (const bearing of [0, 15, 45, 90, 135, 180, 225, 270, 315, 359.5]) {
          const rendered = await page.evaluate(async (bearing) => {
            const { LAMP, toScreen } = await import('/keeper/js/renderer.js');
            const canvas = document.getElementById('sea'), ctx = canvas.getContext('2d');
            const lamp = toScreen(LAMP, canvas);
            const starts = [], glows = [];
            const moveTo = ctx.moveTo, gradient = ctx.createRadialGradient;
            // Inspect the real drawing too: a displaced cone hidden by the glint must fail.
            ctx.moveTo = function (x, y) {
              starts.push(this.getTransform().transformPoint({ x, y }).toJSON());
              return moveTo.call(this, x, y);
            };
            ctx.createRadialGradient = function (x0, y0, r0, x1, y1, r1) {
              if (r0 === 0 && r1 > 400) {
                glows.push(this.getTransform().transformPoint({ x: x0, y: y0 }).toJSON());
              }
              return gradient.call(this, x0, y0, r0, x1, y1, r1);
            };
            const state = window.__keeper.state;
            try { window.__keeper.advance(((bearing - state.beam + 360) % 360) / state.speed); }
            finally { ctx.moveTo = moveTo; ctx.createRadialGradient = gradient; }

            const radius = 24 * devicePixelRatio;
            const left = Math.floor(lamp.x - radius), top = Math.floor(lamp.y - radius);
            const size = radius * 2;
            const pixels = ctx.getImageData(left, top, size, size).data;
            let peak = -1, count = 0, xSum = 0, ySum = 0;
            for (let y = 0; y < size; y++) {
              for (let x = 0; x < size; x++) {
                const offset = (y * size + x) * 4;
                const brightness = pixels[offset] + pixels[offset + 1] + pixels[offset + 2];
                if (brightness > peak) { peak = brightness; count = 0; xSum = 0; ySum = 0; }
                if (brightness === peak) {
                  count++; xSum += left + x + 0.5; ySum += top + y + 0.5;
                }
              }
            }
            // The glint covers several equally bright pixels: use their centroid,
            // measuring pixel centers, instead of choosing a convenient tied pixel.
            return {
              lamp, brightest: { x: xSum / count, y: ySum / count }, peak, starts, glows,
              width: canvas.width, height: canvas.height,
            };
          }, bearing);

          expect(rendered.width).toBe(viewport.width * deviceScaleFactor);
          expect(rendered.height).toBe(viewport.height * deviceScaleFactor);
          expect(rendered.lamp.x).toBe(640 * rendered.width / 1280);
          expect(rendered.lamp.y).toBe(478 * rendered.height / 720);
          expect(rendered.peak).toBe(255 + 240 + 201);
          expect(Math.abs(rendered.brightest.x - rendered.lamp.x)).toBeLessThanOrEqual(0.75);
          expect(Math.abs(rendered.brightest.y - rendered.lamp.y)).toBeLessThanOrEqual(0.75);
          expect(rendered.starts.some((point) => Math.hypot(point.x - rendered.lamp.x, point.y - rendered.lamp.y) < 1e-8)).toBe(true);
          expect(rendered.glows).toHaveLength(1);
          expect(rendered.glows[0].x).toBeCloseTo(rendered.lamp.x, 8);
          expect(rendered.glows[0].y).toBeCloseTo(rendered.lamp.y, 8);
        }
        await page.screenshot({ path: testInfo.outputPath('lamp-and-island.png') });
      } finally {
        await context.close();
      }
    });
  }
}

test('shoreline surf is deterministic, animated from simulation time, and static with reduced motion', async ({ page }) => {
  await page.goto('/keeper/');
  const pixels = await page.evaluate(async () => {
    const { createRenderer, toScreen } = await import('/keeper/js/renderer.js');
    const { createState } = await import('/keeper/js/sim.js');
    const canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => ({ width: 1280, height: 720 });
    const renderer = createRenderer(canvas), ctx = canvas.getContext('2d');
    const state = { ...createState(), ships: [], beam: 0 };
    // Southern shoreline only: the northward beam and its fog cannot affect it.
    const corner = toScreen({ x: -58, y: 22 }, canvas);
    function surf(time, reduced) {
      renderer.draw({ ...state, time }, reduced);
      return Array.from(ctx.getImageData(Math.floor(corner.x), Math.floor(corner.y), 100, 30).data);
    }
    return {
      initial: surf(0, false), repeated: surf(0, false), next: surf(0.5, false),
      cycle: surf(2, false), reducedInitial: surf(0, true), reducedLater: surf(12.5, true),
    };
  });
  expect(pixels.repeated).toEqual(pixels.initial);
  expect(pixels.next).not.toEqual(pixels.initial);
  expect(pixels.cycle).toEqual(pixels.initial);
  expect(pixels.reducedInitial).toEqual(pixels.initial);
  expect(pixels.reducedLater).toEqual(pixels.reducedInitial);
});
