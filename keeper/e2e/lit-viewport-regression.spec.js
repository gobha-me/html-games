import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
];

test.use({ deviceScaleFactor: 1, reducedMotion: 'reduce' });

async function renderVesselDifference(page, y) {
  await page.goto('/keeper/');
  return page.evaluate(async (y) => {
    try {
      const { createRenderer } = await import('/keeper/js/renderer.js');
      const { createState, bearingTo, fogReach, isLit, perception } = await import('/keeper/js/sim.js');
      const canvas = document.createElement('canvas');
      Object.assign(canvas.style, {
        position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: '2147483647',
      });
      document.body.append(canvas);
      try {
        // Keep the native DOM sizing and native Canvas 2D renderer. No drawing
        // commands, transforms, perception functions or renderer methods are replaced.
        const renderer = createRenderer(canvas);
        const ctx = canvas.getContext('2d');
        const state = createState(108);
        const vessel = {
          ...state.trawler,
          id: 'viewport-regression', type: 'trawler', status: 'underway',
          x: 0, y, heading: 0, afterimage: 0, lastSeen: null, everSeen: true,
        };
        state.time = 12;
        state.fog = 0.16;
        state.beam = bearingTo(vessel);
        state.ships = [vessel];
        state.trawler = vessel;
        const absent = { ...state, ships: [], trawler: null };

        function pixels(frame) {
          renderer.draw(frame, true);
          return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        }
        function changedPixels(before, after) {
          let changed = 0;
          for (let index = 0; index < before.length; index += 4) {
            if (before[index] !== after[index] || before[index + 1] !== after[index + 1]
              || before[index + 2] !== after[index + 2] || before[index + 3] !== after[index + 3]) changed++;
          }
          return changed;
        }

        const view = perception(state, vessel);
        const withoutShip = pixels(absent);
        const withShip = pixels(state);
        const withoutShipAgain = pixels(absent);
        return {
          error: null,
          width: canvas.width, height: canvas.height,
          range: Math.hypot(vessel.x, vessel.y), reach: fogReach(state.fog),
          lit: isLit(state, vessel),
          perceivedHull: view.hull === null ? null : { x: view.hull.x, y: view.hull.y },
          runningLights: view.runningLights,
          signal: view.signal,
          unchangedBackgroundPixels: changedPixels(withoutShip, withoutShipAgain),
          changedPixels: changedPixels(withoutShip, withShip),
        };
      } finally {
        canvas.remove();
      }
    } catch (error) {
      return { error: String(error) };
    }
  }, y);
}

function assertFixture(rendered, viewport, y) {
  // These preconditions precede test.fail(), so an import/draw failure or an
  // unlit fixture cannot count as the expected visibility defect.
  expect(rendered.error, 'the real renderer must complete the fixture').toBeNull();
  expect(rendered.width).toBe(viewport.width);
  expect(rendered.height).toBe(viewport.height);
  expect(rendered.range).toBeLessThan(rendered.reach);
  expect(rendered.lit).toBe(true);
  expect(rendered.perceivedHull).toEqual({ x: 0, y });
  expect(rendered.runningLights, 'running lights must be outside their visibility range').toBe(false);
  expect(rendered.signal, 'the vessel must have no separately visible signal').toBe(false);
  expect(rendered.unchangedBackgroundPixels, 'fixed state/time must redraw identical background pixels').toBe(0);
}

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('on-screen lit trawler changes real viewport pixels (positive control)', async ({ page }) => {
      const rendered = await renderVesselDifference(page, -250);
      assertFixture(rendered, viewport, -250);
      expect(rendered.changedPixels, 'a lit on-screen hull must change viewport pixels').toBeGreaterThan(0);
    });

    test('#140: lit southern trawler or its edge indicator is visible', async ({ page }, testInfo) => {
      const rendered = await renderVesselDifference(page, 330);
      await testInfo.attach('native-canvas-visibility.json', {
        body: JSON.stringify(rendered, null, 2), contentType: 'application/json',
      });
      assertFixture(rendered, viewport, 330);
      // #140: lit ships south of about 281 chart units are outside the fixed
      // chart viewport on main. Preserve this named bug as expected-fail until
      // a separate CODE session provides a fix; KEEPER_140_RED=1 exposes the red.
      test.fail(process.env.KEEPER_140_RED !== '1', '#140: lit southern vessel has no visible hull or edge indicator');
      // Scan the full viewport: either a fitted visible hull OR a real edge
      // marker is allowed. Pinning toScreen() would reject the permitted marker fix.
      expect(rendered.changedPixels, '#140: the lit vessel must produce visible hull or indicator pixels').toBeGreaterThan(0);
    });
  });
}
