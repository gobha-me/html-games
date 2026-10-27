import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  AFTERIMAGE_SECONDS, bearingTo, createState, installSpecialty, isLit, specialtyApproach, step,
} from '../js/sim.js';
import { READABILITY, VESSEL_MARKS, createRenderer, vesselReadability } from '../js/renderer.js';
import { createRecordingCanvas, filledPolygons } from './canvas-recorder.mjs';

// Independent copies of the #116 contract and the fixed chart transform.
const MARKS = {
  trawler: [[0, -16], [7, -7], [8, 10], [-7, 10], [-7, -7]],
  coaster: [[0, -24], [7, -16], [7, 18], [4, 22], [-4, 22], [-7, 18], [-7, -16]],
  speedboat: [[0, -15], [5, -3], [6, 10], [-6, 10], [-5, -3]],
  lifeboat: [[0, -10], [6, -5], [6, 5], [0, 10], [-6, 5], [-6, -5]],
};
const SPANS = { trawler: 12.9, coaster: 12.04, speedboat: 10.32, lifeboat: 10.32 };
const TYPES = Object.keys(MARKS);
const DT = 1 / 60;
const VIEWPORTS = [[1280, 720], [1280, 1080], [1600, 900], [1920, 1080], [1920, 720], [2560, 1440]];
const close = (actual, expected, message, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: ${actual} ≠ ${expected}`);

function project([x, y], pose, width = 1280, height = 720) {
  const a = pose.heading * Math.PI / 180;
  const cx = pose.x + x * Math.cos(a) - y * Math.sin(a);
  const cy = pose.y + x * Math.sin(a) + y * Math.cos(a);
  return { x: (640 + cx * 0.86) * width / 1280, y: (478 + cy * 0.86) * height / 720 };
}
function shoelace(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i], [x1, y1] = points[(i + 1) % points.length];
    sum += x0 * y1 - x1 * y0;
  }
  return Math.abs(sum) / 2;
}
// One live vessel, lit by aiming the real beam at it or left dark behind it
// (optionally with a remembered image at the same pose).
function fixture(type, x, y, heading = 0, { lit = true, afterimage = 0, status = 'underway' } = {}) {
  const state = structuredClone(createState(108));
  const ship = { ...state.trawler, id: `${type}-fixture`, type, x, y, heading, status, afterimage,
    lastSeen: afterimage > 0 ? { x, y, heading, status } : null, smuggler: false, distress: false };
  state.ships = [ship];
  state.trawler = ship;
  state.beam = (bearingTo(ship) + (lit ? 0 : 180)) % 360;
  assert.equal(isLit(state, ship), lit, 'fixture precondition: beam state');
  return { state, ship };
}
function drawAt(state, width = 1280, height = 720) {
  const previous = globalThis.window;
  globalThis.window = { devicePixelRatio: 1 };
  try {
    const recording = createRecordingCanvas({ width, height });
    createRenderer(recording.canvas).draw(state, false);
    return recording.ops;
  } finally {
    globalThis.window = previous;
  }
}
function paintedHulls(ops, type) {
  return filledPolygons(ops, MARKS[type]).filter((entry) => ['#b0ad98', '#444941'].includes(entry.fillStyle));
}

test('READABILITY and VESSEL_MARKS pin the contract and are deeply frozen', () => {
  assert.deepEqual({ ...READABILITY }, { deadlineSeconds: 1, revealSeconds: 0, litOpacity: 1, minimumSpanPixels: 8 });
  assert.ok(Object.isFrozen(READABILITY));
  assert.throws(() => { READABILITY.deadlineSeconds = 5; }, TypeError);
  assert.deepEqual(Object.keys(VESSEL_MARKS), TYPES);
  assert.ok(Object.isFrozen(VESSEL_MARKS));
  assert.throws(() => { VESSEL_MARKS.submarine = VESSEL_MARKS.trawler; }, TypeError);
  for (const type of TYPES) {
    const mark = VESSEL_MARKS[type];
    assert.deepEqual(mark.outline.map((point) => [...point]), MARKS[type], type);
    assert.equal(mark.mast, type === 'trawler', `${type} mast`);
    assert.ok(mark.cabins.length >= 1);
    for (const part of [mark, mark.outline, mark.cabins, ...mark.outline, ...mark.cabins]) assert.ok(Object.isFrozen(part), type);
    assert.throws(() => { mark.outline[0][1] = -40; }, TypeError);
    assert.throws(() => { mark.outline.push([0, 0]); }, TypeError);
    assert.throws(() => { mark.cabins[0][2] = 0; }, TypeError);
    assert.throws(() => { mark.mast = !mark.mast; }, TypeError);
  }
  assert.deepEqual(VESSEL_MARKS.coaster.cabins.map((r) => [...r]), [[-4, -13, 8, 10], [-4, 8, 8, 9]]);
  assert.deepEqual(VESSEL_MARKS.trawler.cabins.map((r) => [...r]), [[-4, -3, 8, 9]]);
  assert.deepEqual(VESSEL_MARKS.speedboat.cabins.map((r) => [...r]), [[-3, 1, 6, 7]]);
  assert.deepEqual(VESSEL_MARKS.lifeboat.cabins.map((r) => [...r]), [[-4, -1, 8, 2]]);
  // Four hull types are distinguishable by silhouette, not only by colour.
  const keys = new Set(TYPES.map((type) => JSON.stringify(MARKS[type])));
  assert.equal(keys.size, 4);
});

test('a lit on-screen hull is identifiable on its first lit frame: full opacity, no reveal delay, ≥8 px span', () => {
  for (const type of TYPES) {
    for (const heading of [0, 37, 90, 135, 180, 222.5, 270, 359]) {
      for (const [x, y] of [[0, -300], [250, -120], [-260, 90], [120, 200]]) {
        const { state, ship } = fixture(type, x, y, heading);
        const label = `${type} ${heading}° (${x},${y})`;
        const view = vesselReadability(state, ship, { width: 1280, height: 720 });
        assert.equal(view.lit, true, label);
        assert.equal(view.onScreen, true, label);
        assert.equal(view.inScope, true, label);
        assert.equal(view.clipped, false, label);
        assert.equal(view.type, type, label);
        assert.equal(view.opacity, 1, label);
        assert.equal(view.revealSeconds, 0, label);
        assert.ok(view.revealSeconds <= READABILITY.deadlineSeconds, label);
        close(view.minimumSpanPixels, SPANS[type], label);
        assert.ok(view.minimumSpanPixels >= READABILITY.minimumSpanPixels, label);
        assert.equal(view.visibleFraction, 1, label);
        const expected = MARKS[type].map((point) => project(point, ship));
        assert.equal(view.outline.length, expected.length);
        view.outline.forEach((point, i) => { close(point.x, expected[i].x, label); close(point.y, expected[i].y, label); });
        close(view.visibleAreaPixels, shoelace(MARKS[type]) * 0.86 * 0.86, label, 1e-6);
        assert.deepEqual(view.visibleOutline, view.outline, label);

        // And the renderer really paints that silhouette, fully opaque, at the pose.
        const hulls = paintedHulls(drawAt(state), type);
        assert.equal(hulls.length, 1, label);
        assert.equal(hulls[0].globalAlpha, READABILITY.litOpacity, label);
        assert.equal(hulls[0].fillStyle, '#b0ad98', label);
        hulls[0].path.slice(0, -1).forEach(({ at }, i) => {
          close(at.x, expected[i].x, `${label} painted`, 1e-6); close(at.y, expected[i].y, `${label} painted`, 1e-6);
        });
      }
    }
  }
});

test('full-silhouette span scales with the CSS viewport (min axis), never with DPR backing size', () => {
  for (const type of TYPES) {
    const { state, ship } = fixture(type, 100, -100, 45);
    for (const [width, height] of VIEWPORTS) {
      const view = vesselReadability(state, ship, { width, height });
      close(view.minimumSpanPixels, SPANS[type] * Math.min(width / 1280, height / 720), `${type} ${width}×${height}`);
      assert.ok(view.minimumSpanPixels >= READABILITY.minimumSpanPixels);
      assert.equal(view.inScope, true);
    }
    // Omitted viewport means the 1280×720 minimum desktop.
    assert.deepEqual(vesselReadability(state, ship), vesselReadability(state, ship, { width: 1280, height: 720 }));
    // Rotation must not inflate the narrow dimension.
    const spans = [0, 30, 45, 60, 90].map((heading) => vesselReadability(fixture(type, 0, -200, heading).state,
      fixture(type, 0, -200, heading).ship).minimumSpanPixels);
    assert.equal(new Set(spans).size, 1, `${type} span is rotation-invariant`);
  }
});

test('partly clipped lit hulls stay in scope with exact visible area and fraction', () => {
  // Bottom edge: chart y where 478 + 0.86y = 720. Cut the heading-0 trawler at local y = 0.
  const edge = (720 - 478) / 0.86;
  const { state, ship } = fixture('trawler', 0, edge, 0);
  const view = vesselReadability(state, ship);
  assert.equal(view.lit, true);
  assert.equal(view.clipped, true);
  assert.equal(view.onScreen, true);
  assert.equal(view.inScope, true);
  const upper = 63 + 7 * (14 + 14 + 7 / 17) / 2; // bow triangle + trapezoid down to y = 0
  close(view.visibleAreaPixels, upper * 0.86 * 0.86, 'visible area', 1e-6);
  close(view.visibleFraction, upper / 309.5, 'visible fraction', 1e-9);
  assert.ok(view.visibleOutline.every(({ y }) => y <= 720 + 1e-9));
  assert.ok(view.visibleOutline.some(({ y }) => Math.abs(y - 720) < 1e-9), 'clip edge vertices lie on the canvas edge');
  close(view.minimumSpanPixels, SPANS.trawler, 'span is for the complete silhouette');

  // Vertex [7, -7] and [-7, -7] lie directly on the bottom edge y = 720 while the bow [0, -16] is inside
  // and the stern [8, 10], [-7, 10] is outside: boundary vertices must be kept without duplication.
  const shoulderOnEdge = fixture('trawler', 0, edge + 7, 0);
  const shoulderView = vesselReadability(shoulderOnEdge.state, shoulderOnEdge.ship);
  assert.equal(shoulderView.clipped, true);
  assert.equal(shoulderView.visibleOutline.length, 5);
  close(shoulderView.visibleAreaPixels, 63 * 0.86 * 0.86, 'bow triangle area when shoulders lie on edge', 1e-6);

  // Hulls touching a canvas edge from the inside (x = 0, x = width, y = 0, y = height) are unclipped
  // and keep their exact vertex list without duplicating boundary vertices.
  for (const [label, x, y, lit, height] of [
    ['left-touch', -640 / 0.86 + 7, -100, false, 720],
    ['right-touch', 640 / 0.86 - 8, -100, false, 720],
    ['top-touch', 0, -(478 * 100 / 720) / (0.86 * 100 / 720) + 16, false, 100],
    ['bottom-touch', 0, (720 - 478) / 0.86 - 10, true, 720],
  ]) {
    const touch = fixture('trawler', x, y, 0, { lit, afterimage: lit ? 0 : AFTERIMAGE_SECONDS / 2 });
    const touchView = vesselReadability(touch.state, touch.ship, { width: 1280, height });
    assert.equal(touchView.clipped, false, `${label}: touching edge from inside is not clipped`);
    assert.equal(touchView.onScreen, true, label);
    assert.equal(touchView.inScope, lit, label);
    assert.deepEqual(touchView.visibleOutline, touchView.outline, `${label}: no duplicate or dropped boundary vertices`);
  }
});

test('clipping works against every canvas edge for remembered images, which are never in scope', () => {
  const left = -640 / 0.86, right = 640 / 0.86, top = -478 / 0.86, bottom = (720 - 478) / 0.86;
  for (const [name, x, y, heading, check] of [
    ['left', left, -100, 90, (p) => p.x >= -1e-9],
    ['right', right, -100, 90, (p) => p.x <= 1280 + 1e-9],
    ['top', 0, top, 0, (p) => p.y >= -1e-9],
    ['bottom', 0, bottom, 0, (p) => p.y <= 720 + 1e-9],
  ]) {
    const { state, ship } = fixture('coaster', x, y, heading, { lit: false, afterimage: AFTERIMAGE_SECONDS / 2 });
    const view = vesselReadability(state, ship);
    assert.equal(view.lit, false, name);
    assert.equal(view.onScreen, true, name);
    assert.equal(view.inScope, false, `${name}: remembered images never satisfy the floor`);
    assert.equal(view.clipped, true, name);
    assert.equal(view.revealSeconds, null, name);
    close(view.opacity, 0.15, name);
    assert.ok(view.visibleOutline.every(check), name);
    assert.ok(view.visibleFraction > 0.3 && view.visibleFraction < 0.7, `${name} fraction ${view.visibleFraction}`);
  }
  // Remembered images are painted dim, never at lit opacity.
  const { state } = fixture('lifeboat', 0, -200, 0, { lit: false, afterimage: AFTERIMAGE_SECONDS });
  const hulls = paintedHulls(drawAt(state), 'lifeboat');
  assert.equal(hulls.length, 1);
  close(hulls[0].globalAlpha, 0.3, 'afterimage alpha');
});

test('lit hulls entirely off the canvas or merely tangent to it are excluded from the floor', () => {
  const below = (720 - 478) / 0.86;
  // Bow (local y = -16) exactly on the bottom edge at heading 0: zero drawable area.
  const tangentY = below + 16;
  assert.equal(478 + tangentY * 0.86 - 16 * 0.86, 720, 'precondition: exact tangency in floating point');
  for (const [label, y] of [['tangent', tangentY], ['below', below + 60], ['far below', 400]]) {
    const { state, ship } = fixture('trawler', 0, y, 0);
    const view = vesselReadability(state, ship);
    assert.equal(view.lit, true, label);
    assert.equal(view.onScreen, false, label);
    assert.equal(view.inScope, false, label);
    assert.equal(view.visibleAreaPixels, 0, label);
    assert.equal(view.visibleFraction, 0, label);
    assert.equal(view.clipped, true, label);
    assert.equal(view.type, 'trawler', label);
    assert.equal(view.opacity, 1, label);
  }
});

test('unseen hulls expose nothing: null type, zero opacity and empty geometry', () => {
  for (const type of TYPES) {
    const { state, ship } = fixture(type, 0, -200, 0, { lit: false, afterimage: 0 });
    assert.deepEqual(vesselReadability(state, ship), {
      lit: false, onScreen: false, inScope: false, clipped: false, type: null, opacity: 0, revealSeconds: null,
      minimumSpanPixels: 0, visibleAreaPixels: 0, visibleFraction: 0, outline: [], visibleOutline: [],
    });
    assert.equal(paintedHulls(drawAt(state), type).length, 0, `${type} is not painted`);
  }
});

test('pinned off-screen illumination: seed 108 ship-1 (~30.8 s) and seed 3 trawler (~8.3 s) are excluded', () => {
  for (const [seed, id, firstLit] of [[108, 'ship-1', 30.8], [3, 'trawler', 8.3]]) {
    let state = createState(seed);
    let first = null;
    for (let i = 0; i < 400 && (first === null || state.time < first + 1); i++) {
      state = step(state, {}, 0.1);
      const ship = state.ships.find((candidate) => candidate.id === id);
      if (!ship) continue;
      if (first === null && isLit(state, ship)) first = state.time;
      if (first === null) continue;
      for (const [width, height] of VIEWPORTS) {
        const view = vesselReadability(state, ship, { width, height });
        const label = `seed ${seed} ${id} t=${state.time.toFixed(1)} ${width}×${height}`;
        assert.equal(view.onScreen, false, label);
        assert.equal(view.inScope, false, label);
        assert.equal(view.visibleAreaPixels, 0, label);
        assert.deepEqual(view.visibleOutline, [], label);
        assert.ok(view.outline.every(({ y }) => y > height), `${label}: wholly south of the canvas`);
      }
    }
    assert.ok(first !== null && Math.abs(first - firstLit) < 0.051, `seed ${seed}: lit at ${first}`);
  }
});

test('real nights: every lit on-screen vessel is identifiable on its first in-scope frame, all hull types', () => {
  const seen = new Set();
  const check = (state, ship, label) => {
    const view = vesselReadability(state, ship);
    if (!view.inScope) return false;
    assert.equal(view.type, ship.type, label);
    assert.equal(view.opacity, READABILITY.litOpacity, label);
    assert.equal(view.revealSeconds, READABILITY.revealSeconds, label);
    assert.ok(view.minimumSpanPixels >= READABILITY.minimumSpanPixels, label);
    assert.ok(view.visibleAreaPixels > 0 && view.visibleFraction > 0, label);
    const hulls = paintedHulls(drawAt(state), ship.type).filter(({ matrix }) => {
      const at = project([0, 0], ship);
      return Math.abs(matrix[4] - at.x) < 1e-6 && Math.abs(matrix[5] - at.y) < 1e-6;
    });
    assert.equal(hulls.length, 1, `${label}: painted on the same frame`);
    assert.equal(hulls[0].globalAlpha, 1, label);
    seen.add(ship.type);
    return true;
  };
  // Scheduled traffic: trawlers and coasters at default fog.
  for (const seed of [108, 3, 7, 21, 42]) {
    let state = createState(seed);
    const done = new Set();
    while (state.time < 100) {
      state = step(state, {}, DT);
      for (const ship of state.ships) {
        if (!done.has(ship.id) && check(state, ship, `seed ${seed} ${ship.id} t=${state.time.toFixed(2)}`)) done.add(ship.id);
      }
    }
    assert.ok(done.size >= 1, `seed ${seed} lit something on screen`);
  }
  // Specialty arrivals: a dark launch and a distress lifeboat on visible bearings.
  for (const [type, bearing] of [['speedboat', 20], ['speedboat', 300], ['lifeboat', 70], ['lifeboat', 250]]) {
    let state = installSpecialty(createState(108), specialtyApproach({ id: `x-${type}`, type, bearing, spawnRange: 300 }));
    let found = false;
    while (!found && state.time < 30) {
      state = step(state, {}, DT);
      const ship = state.ships.find((candidate) => candidate.id === `x-${type}`);
      if (ship && isLit(state, ship)) found = check(state, ship, `${type}@${bearing}`) || assert.fail(`${type} lit off-screen`);
    }
    assert.ok(found, `${type}@${bearing} revealed`);
  }
  assert.deepEqual([...seen].sort(), [...TYPES].sort());
});

test('invalid viewports, unknown hull types and non-finite poses are rejected', () => {
  const { state, ship } = fixture('trawler', 0, -200, 0);
  for (const size of [{ width: 0, height: 720 }, { width: 1280, height: 0 }, { width: -1280, height: 720 },
    { width: 1280, height: -1 }, { width: NaN, height: 720 }, { width: 1280, height: Infinity },
    { width: '1280', height: 720 }, { width: 1280, height: null }, { width: 1280 }, {}]) {
    assert.throws(() => vesselReadability(state, ship, size), {
      name: 'RangeError',
      message: /Readability viewport dimensions must be positive and finite/,
    }, JSON.stringify(size));
  }
  for (const type of ['submarine', '', '__proto__', 'toString', 'constructor', 'hasOwnProperty', undefined, null, 7, ['trawler']]) {
    assert.throws(() => vesselReadability(state, { ...ship, type }), {
      name: 'RangeError',
      message: /Unknown vessel type/,
    }, String(type));
  }
  for (const heading of [NaN, Infinity, -Infinity]) {
    const lit = fixture('coaster', 0, -200, 0);
    lit.ship.heading = heading;
    assert.throws(() => vesselReadability(lit.state, lit.ship), {
      name: 'TypeError',
      message: /Vessel pose must be finite/,
    }, `lit heading ${heading}`);
    const image = fixture('coaster', 0, -200, 0, { lit: false, afterimage: 1 });
    image.ship.lastSeen.heading = heading;
    assert.throws(() => vesselReadability(image.state, image.ship), {
      name: 'TypeError',
      message: /Vessel pose must be finite/,
    }, `remembered heading ${heading}`);
  }
  const remembered = fixture('coaster', 0, -200, 0, { lit: false, afterimage: 1 });
  remembered.ship.lastSeen.x = NaN;
  assert.throws(() => vesselReadability(remembered.state, remembered.ship), {
    name: 'TypeError',
    message: /Vessel pose must be finite/,
  });
  // Finite but enormous poses overflow the projection rather than reporting a hull.
  const huge = fixture('coaster', 0, -200, 0, { lit: false, afterimage: 1 });
  huge.ship.lastSeen.x = Number.MAX_VALUE * 0.9;
  assert.equal(Number.isFinite(huge.ship.lastSeen.x), true, 'precondition: the pose itself is finite');
  assert.throws(() => vesselReadability(huge.state, huge.ship, { width: 2560, height: 1440 }), {
    name: 'RangeError',
    message: /Projected vessel coordinates must be finite/,
  });
  // Partial overflow: port vertices stay finite while starboard vertices overflow to Infinity.
  const partialOverflow = fixture('trawler', 0, -200, 0, { lit: false, afterimage: 1 });
  partialOverflow.ship.lastSeen.x = 951814;
  assert.throws(() => vesselReadability(partialOverflow.state, partialOverflow.ship, {
    width: Number.MAX_VALUE / 640,
    height: 720,
  }), {
    name: 'RangeError',
    message: /Projected vessel coordinates must be finite/,
  });
});

test('the probe is pure: inputs and shared marks are untouched, results are deterministic', () => {
  const { state, ship } = fixture('speedboat', 0, (720 - 478) / 0.86, 0);
  const before = structuredClone(state);
  const marks = JSON.stringify(VESSEL_MARKS);
  const first = vesselReadability(state, ship, { width: 1600, height: 900 });
  const second = vesselReadability(state, ship, { width: 1600, height: 900 });
  assert.deepEqual(state, before);
  assert.equal(JSON.stringify(VESSEL_MARKS), marks);
  assert.deepEqual(first, second);
  assert.notStrictEqual(first.outline, second.outline);
  first.outline[0].x = -1;
  assert.notEqual(vesselReadability(state, ship, { width: 1600, height: 900 }).outline[0].x, -1);
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    for (const name of ['window', 'document', 'navigator', 'localStorage', 'performance']) {
      Object.defineProperty(globalThis, name, { get() { throw new Error(name + ' read'); }, configurable: true });
    }
    Math.random = () => { throw new Error('Math.random called'); };
    const { createState } = await import(${JSON.stringify(new URL('../js/sim.js', import.meta.url).href)});
    const { vesselReadability } = await import(${JSON.stringify(new URL('../js/renderer.js', import.meta.url).href)});
    const state = createState(108);
    vesselReadability(state, state.trawler);
  `], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
