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
    const ship = {
      ...state.trawler, id: 'issue-141-a', type, x: 0, y: -200, heading: 0,
      afterimage: 0, lastSeen: null,
    };
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
    const ctx = canvas.getContext('2d');
    function pixels(frame) {
      renderer.draw(frame, true);
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    }
    function empty(frame) {
      return pixels({ ...frame, ships: [], trawler: null });
    }
    function changed(before, after, i) {
      return before[i] !== after[i] || before[i + 1] !== after[i + 1]
        || before[i + 2] !== after[i + 2] || before[i + 3] !== after[i + 3];
    }

    // The same vessel out of the beam supplies a native running-light mask.
    // Use an empty frame for each beam position so the beam itself cancels.
    const dark = { ...state, beam: (state.beam + 180) % 360 };
    const darkView = perception(dark, ship);
    const lightOnly = !darkView.lit && darkView.hull === null
      && darkView.runningLights && !darkView.signal;
    const darkBackground = empty(dark);
    const darkVessel = pixels(dark);
    const litBackground = empty(state);
    let drawError = null;
    let litVessel;
    try { litVessel = pixels(state); }
    catch (error) { drawError = `${error.name}: ${error.message}`; }
    let maskedPixels = 0;
    let hullPixels = 0;
    for (let i = 0; i < darkVessel.length; i += 4) {
      if (changed(darkBackground, darkVessel, i)) maskedPixels++;
      else if (litVessel && changed(litBackground, litVessel, i)) hullPixels++;
    }
    return { drawError, hullPixels, lightOnly, maskedPixels, signal: perception(state, ship).signal };
  });
}

function expectLightsMask(result) {
  expect(result.lightOnly, 'the off-beam vessel must expose only its running lights').toBe(true);
  expect(result.maskedPixels, 'real running lights must contribute Canvas pixels').toBeGreaterThan(0);
  expect(result.signal, 'the vessel must have no separately visible signal').toBe(false);
}

for (const type of ['trawler', 'coaster', 'speedboat', 'lifeboat']) {
  test(`known ${type} control draws visible pixels without throwing`, async ({ page }) => {
    expect(await scene(page, type)).toEqual({ lit: true, width: 1280, height: 720 });
    const result = await markerPixels(page);
    expect(result.drawError).toBeNull();
    expectLightsMask(result);
    expect(result.hullPixels, 'the hull must produce Canvas pixels outside the running lights').toBeGreaterThan(0);
  });
}

test('Keeper #141: an unknown hull draws a visible fallback without throwing', async ({ page }) => {
  expect(await scene(page, UNKNOWN)).toEqual({ lit: true, width: 1280, height: 720 });
  const result = await markerPixels(page);
  expect(result.drawError, 'unknown hull must not interrupt draw').toBeNull();
  expectLightsMask(result);
  expect(result.hullPixels, 'the fallback must produce Canvas pixels outside the running lights').toBeGreaterThan(0);
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
