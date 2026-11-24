import { test, expect } from '@playwright/test';

const UNKNOWN = 'corrupt-hull-issue-141';

// Issue #141 reports a throw in the #116 renderer; main currently draws generic
// unknown hulls but does not log them. Keep only that observed missing diagnostic
// as expected-fail. The passing fallback/frame checks guard the reported freeze.
// The opt-in command
// KEEPER_141_RED=1 npx playwright test unknown-ship-regression.spec.js --retries=0
// runs the same assertions as ordinary failures against main.
function pendingUnknownHull() {
  test.fail(process.env.KEEPER_141_RED !== '1', 'Keeper #141: missing once-per-ship/type unknown-hull diagnostic');
}

async function scene(page, type) {
  await page.goto('/keeper/');
  return page.evaluate(async (type) => {
    const { createRenderer } = await import('/keeper/js/renderer.js');
    const { createState, bearingTo, isLit } = await import('/keeper/js/sim.js');
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh';
    document.body.append(canvas);
    const renderer = createRenderer(canvas);
    const state = createState(108);
    const ship = { ...state.trawler, id: 'issue-141-a', type, x: 0, y: -250, heading: 0 };
    state.fog = 0.16;
    state.schedule = [];
    state.hazards = [];
    state.ships = [ship];
    state.trawler = ship;
    state.beam = bearingTo(ship);
    window.issue141 = { canvas, renderer, state, ship };
    return { lit: isLit(state, ship), width: canvas.width, height: canvas.height };
  }, type);
}

async function markerPixels(page) {
  return page.evaluate(async () => {
    const { perception } = await import('/keeper/js/sim.js');
    const { canvas, renderer, state, ship } = window.issue141;
    // The beam reaches the hull beyond the shorter running-light range.
    // Check that the simulation also reports no independent signal to draw.
    const { runningLights, signal } = perception(state, ship);
    const ctx = canvas.getContext('2d');
    renderer.draw({ ...state, ships: [], trawler: null }, true);
    const empty = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let drawError = null;
    try { renderer.draw(state, true); }
    catch (error) { drawError = `${error.name}: ${error.message}`; }
    const actual = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let changedPixels = 0;
    for (let i = 0; i < actual.length; i += 4) {
      if (actual[i] !== empty[i] || actual[i + 1] !== empty[i + 1]
          || actual[i + 2] !== empty[i + 2] || actual[i + 3] !== empty[i + 3]) changedPixels++;
    }
    return { drawError, changedPixels, runningLights, signal };
  });
}

function expectHullOnly(result) {
  expect(result.runningLights, 'running lights must be outside their visibility range').toBe(false);
  expect(result.signal, 'the vessel must have no separately visible signal').toBe(false);
}

for (const type of ['trawler', 'coaster', 'speedboat', 'lifeboat']) {
  test(`known ${type} control draws visible pixels without throwing`, async ({ page }) => {
    expect(await scene(page, type)).toEqual({ lit: true, width: 1280, height: 720 });
    const result = await markerPixels(page);
    expect(result.drawError).toBeNull();
    expectHullOnly(result);
    expect(result.changedPixels, 'the hull must produce real on-screen Canvas pixels').toBeGreaterThan(0);
  });
}

test('Keeper #141: an unknown hull draws a visible fallback without throwing', async ({ page }) => {
  expect(await scene(page, UNKNOWN)).toEqual({ lit: true, width: 1280, height: 720 });
  const result = await markerPixels(page);
  expect(result.drawError, 'unknown hull must not interrupt draw').toBeNull();
  expectHullOnly(result);
  expect(result.changedPixels, 'the fallback must produce real on-screen Canvas pixels').toBeGreaterThan(0);
});

test('Keeper #141: unknown-hull diagnostics occur once for each ship/type pair', async ({ page }) => {
  expect((await scene(page, UNKNOWN)).lit).toBe(true);
  const diagnostics = [];
  page.on('console', (message) => {
    // Observe application diagnostics without requiring a particular message,
    // console level, or serialization of the ship/type. Resource-load messages
    // have no application JavaScript source and cannot satisfy this assertion.
    if (/\/keeper\/.*\.js$/.test(message.location().url)) diagnostics.push(message.text());
  });
  const draw = (identity) => page.evaluate((identity) => {
    const { renderer, state, ship } = window.issue141;
    Object.assign(ship, identity);
    try { renderer.draw(state, true); return null; }
    catch (error) { return `${error.name}: ${error.message}`; }
  }, identity);

  const initialError = await draw({});
  pendingUnknownHull();
  expect(initialError).toBeNull();
  expect(diagnostics).toHaveLength(1);
  expect(await draw({})).toBeNull();
  expect(await draw({})).toBeNull();
  expect(diagnostics).toHaveLength(1);
  expect(await draw({ id: 'issue-141-b' })).toBeNull();
  expect(diagnostics).toHaveLength(2);
  expect(await draw({ id: 'issue-141-a', type: `${UNKNOWN}-other` })).toBeNull();
  expect(diagnostics).toHaveLength(3);
  expect(await draw({})).toBeNull();
  expect(await draw({ id: 'issue-141-a', type: UNKNOWN })).toBeNull();
  expect(diagnostics).toHaveLength(3);
});

test('Keeper #141: a browser frame chain keeps drawing after an unknown hull', async ({ page }) => {
  expect((await scene(page, UNKNOWN)).lit).toBe(true);
  const result = await page.evaluate(() => new Promise((resolve) => {
    const { renderer, state } = window.issue141;
    let frames = 0;
    function frame() {
      try { renderer.draw(state, true); }
      catch (error) { resolve({ frames, drawError: `${error.name}: ${error.message}` }); return; }
      frames++;
      if (frames === 3) resolve({ frames, drawError: null });
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }));
  expect(result.drawError, 'a thrown draw prevents scheduling the next browser frame').toBeNull();
  expect(result.frames).toBe(3);
});
