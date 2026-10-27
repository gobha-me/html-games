import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bearingTo, createState, fogReach, isLit } from '../js/sim.js';
import { VESSEL_MARKS, createRenderer } from '../js/renderer.js';
import { createRecordingCanvas } from './canvas-recorder.mjs';
import { digestScenes, lockedScenes, traceScenes } from './locked-scenes.mjs';

// Per-op digests recorded from the #116 base renderer (5ac8981). DESIGN §10
// locks the chart, compass, labels, island, lamp housing/cone/reach and fog.
const BASE = JSON.parse(readFileSync(new URL('./fixtures/locked-scenes-5ac8981.json', import.meta.url), 'utf8'));
const RAD = Math.PI / 180;
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} ≠ ${expected}`);

function draw(state, { width = 1280, height = 720, reduced = false } = {}) {
  const previous = globalThis.window;
  globalThis.window = { devicePixelRatio: 1 };
  try {
    const recording = createRecordingCanvas({ width, height });
    createRenderer(recording.canvas).draw(state, reduced);
    return recording.ops;
  } finally {
    globalThis.window = previous;
  }
}
function vessel(type, { x = 60, y = -200, heading = 30, lit = true, ...extra } = {}) {
  const state = structuredClone(createState(108));
  const ship = { ...state.trawler, id: 'v', type, x, y, heading, status: 'underway', smuggler: false, distress: false,
    afterimage: 0, lastSeen: null, reply: null, ...extra };
  state.ships = [ship]; state.trawler = ship;
  state.beam = (bearingTo(ship) + (lit ? 0 : 180)) % 360;
  assert.equal(isLit(state, ship), lit, 'fixture precondition');
  return state;
}
// Ops painted in the vessel's own frame (translate to pose, rotate by heading).
function inHullFrame(ops, ship) {
  const cos = Math.cos(ship.heading * RAD), sin = Math.sin(ship.heading * RAD);
  const x = 640 + ship.x * 0.86, y = 478 + ship.y * 0.86;
  const expected = [0.86 * cos, 0.86 * sin, -0.86 * sin, 0.86 * cos, x, y];
  return ops.filter(({ matrix }) => matrix && matrix.every((value, i) => Math.abs(value - expected[i]) < 1e-9));
}

test('locked layers draw exactly as the #116 base renderer did, in every fixture scene', () => {
  const current = digestScenes(traceScenes(createRenderer));
  const traces = traceScenes(createRenderer);
  assert.deepEqual(Object.keys(current), lockedScenes().map(({ name }) => name));
  assert.deepEqual(Object.keys(BASE), Object.keys(current));
  for (const [name, digests] of Object.entries(BASE)) {
    const index = digests.findIndex((digest, i) => digest !== current[name][i]);
    assert.equal(current[name].length, digests.length, `${name}: op count`);
    assert.equal(index, -1, `${name}: first divergence at op ${index}: ${JSON.stringify(traces[name][index])}`);
  }
});

test('the fixture scenes really exercise the locked layers they claim to', () => {
  const traces = traceScenes(createRenderer);
  const texts = traces.title.filter(({ op }) => op === 'fillText').map(({ text }) => text);
  for (const label of ['N', '030', '090', '180', '330', 'T H E  T E E T H', 'CHARTED REEF · KEEP CLEAR', 'S K E R R Y  R O C K']) {
    assert.ok(texts.includes(label), label);
  }
  assert.equal(traces['keyed-lamp'].filter(({ op }) => op === 'strokeRect').length, 1, 'keyed lamp frame');
  assert.equal(traces.title.filter(({ op }) => op === 'strokeRect').length, 0);
  assert.equal(traces['horn-rings'].filter(({ op, dash }) => op === 'setLineDash' && dash.length === 2 && dash[0] === 6).length, 1, 'one ignored ring');
  // Reduced motion freezes both drift and surf: two reduced scenes at different times draw the same fog/surf.
  const fog = (ops) => ops.filter(({ op }) => op === 'createRadialGradient').map(({ gradient }) => gradient.args);
  assert.notDeepEqual(fog(traces['north-early']).slice(1, 33), fog(traces['east-drifted']).slice(1, 33));
});

test('every hull type paints its shared outline, cabins and (trawler only) mast in the hull frame', () => {
  for (const type of Object.keys(VESSEL_MARKS)) {
    const state = vessel(type);
    const ship = state.ships[0];
    const local = inHullFrame(draw(state), ship);
    const mark = VESSEL_MARKS[type];
    const hull = local.filter(({ op, fillStyle }) => op === 'fill' && fillStyle === '#b0ad98');
    assert.equal(hull.length, 1, type);
    assert.deepEqual(hull[0].path.map(({ op }) => op), ['moveTo', ...mark.outline.slice(1).map(() => 'lineTo'), 'closePath']);
    assert.deepEqual(hull[0].path.slice(0, -1).map(({ local: point }) => point), mark.outline.map((point) => [...point]));
    assert.equal(hull[0].globalAlpha, 1);
    const cabins = local.filter(({ op }) => op === 'fillRect');
    assert.deepEqual(cabins.map(({ rect }) => rect), mark.cabins.map((rect) => [...rect]), `${type} cabins`);
    assert.ok(cabins.every(({ fillStyle, globalAlpha }) => fillStyle === '#303834' && globalAlpha === 1), type);
    const strokes = local.filter(({ op }) => op === 'stroke');
    if (mark.mast) {
      assert.equal(strokes.length, 1, `${type} mast`);
      assert.equal(strokes[0].strokeStyle, '#d0c9ac');
      assert.equal(strokes[0].lineWidth, 1.2);
      assert.deepEqual(strokes[0].path.map(({ op, local: point }) => [op, ...point]),
        [['moveTo', 0, -5], ['lineTo', 0, 10], ['moveTo', -6, -2], ['lineTo', 6, -2]]);
      // The mast spar stays inside the trawler silhouette (x −7…8).
      assert.ok(strokes[0].path.every(({ local: [x] }) => x >= -7 && x <= 8));
    } else {
      assert.equal(strokes.length, 0, `${type} has no mast`);
    }
  }
});

test('wrecked hulls are dark with a strike line; running lights only for honest, afloat, lit vessels', () => {
  const wreck = vessel('coaster', { status: 'wrecked' });
  const local = inHullFrame(draw(wreck), wreck.ships[0]);
  const hull = local.filter(({ op, fillStyle }) => op === 'fill' && fillStyle === '#444941');
  assert.equal(hull.length, 1);
  const strike = local.filter(({ op, strokeStyle }) => op === 'stroke' && strokeStyle === '#060a0b');
  assert.equal(strike.length, 1);
  assert.equal(strike[0].lineWidth, 3);
  assert.deepEqual(strike[0].path.map(({ op, local: point }) => [op, ...point]), [['moveTo', -8, 0], ['lineTo', 7, 6]]);

  const lights = (state) => inHullFrame(draw(state), state.ships[0])
    .filter(({ op, fillStyle }) => op === 'fill' && ['#cf4842', '#62ac86'].includes(fillStyle))
    .map(({ fillStyle, path }) => [fillStyle, path[0].local[0], path[0].local[1], path[0].local[2]]);
  const pair = [['#cf4842', -6, -4, 1.25], ['#62ac86', 6, -4, 1.25]];
  const far = { x: 0, y: -(fogReach(createState(108).fog) / 2 + 40) };
  assert.deepEqual(lights(vessel('trawler')), pair, 'lit honest vessel');
  assert.deepEqual(lights(vessel('coaster', { ...far })), pair, 'lit beyond running-light range');
  assert.deepEqual(lights(vessel('trawler', { lit: false, x: 30, y: -60 })), pair, 'unlit but close');
  assert.deepEqual(lights(vessel('trawler', { lit: false, ...far })), [], 'unlit and far');
  assert.deepEqual(lights(vessel('speedboat', { smuggler: true })), [], 'smuggler runs dark even when lit');
  assert.deepEqual(lights(vessel('lifeboat', { distress: true })), [], 'distress boat');
  assert.deepEqual(lights(vessel('coaster', { status: 'wrecked' })), [], 'wreck');
  assert.deepEqual(lights(vessel('coaster', { status: 'lost' })), [], 'lost');
});

test('unknown hull types fail loudly instead of drawing a stand-in silhouette', () => {
  for (const type of ['submarine', '__proto__', 'toString', undefined]) {
    const state = vessel('trawler');
    state.ships[0].type = type;
    assert.throws(() => draw(state), RangeError, String(type));
  }
  // An unseen hull of an unknown type is never drawn, so it cannot throw.
  const hidden = vessel('trawler', { lit: false, x: 0, y: -400 });
  hidden.ships[0].type = 'submarine';
  assert.doesNotThrow(() => draw(hidden));
});

test('a reply signal is drawn as a halo and core disc at the vessel', () => {
  const state = vessel('trawler', { reply: { startedAt: 0, repeatSeconds: 0, flashes: [{ on: 0, off: 10_000 }] } });
  state.time = 1;
  const ship = state.ships[0];
  const discs = draw(state).filter(({ op, path }) => op === 'fill' && path[0]?.op === 'arc'
    && Math.abs(path[0].local[0] - ship.x) < 1e-9 && Math.abs(path[0].local[1] - ship.y) < 1e-9);
  assert.deepEqual(discs.map(({ fillStyle, path }) => [fillStyle, path[0].local[2]]),
    [['rgba(255,240,201,0.18)', 7], ['#fff0c9', 3]]);
  close(discs[1].path[0].at.x, 640 + ship.x * 0.86, 'signal x');
});
