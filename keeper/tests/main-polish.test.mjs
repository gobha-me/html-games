import test from 'node:test';
import assert from 'node:assert/strict';
import { bootMain } from './main-harness.mjs';
import { KEYS, CONTROL_LABELS } from '../js/keys.js';

const LABELS = Object.keys(KEYS).map((action) => CONTROL_LABELS[action]);
const FRAME = 1000 / 60;

// Drive `count` consecutive frames from `start` at a steady 60 Hz.
function run(app, count, start, { workMs = 2 } = {}) {
  let t = start;
  for (let i = 0; i < count; i++) { app.frame(t, { workMs }); t += FRAME; }
  return t;
}
// Fog bank centres the renderer draws in the beam (radius-0 gradients).
function fogCentres(app) {
  return app.recording.ops.filter((op) => op.op === 'createRadialGradient'
    && op.gradient.args[2] === 0 && op.gradient.args[5] >= 24 && op.gradient.args[5] <= 88).map((op) => op.gradient.args.slice(0, 2));
}

test('frame timing hook: capacity, default warm-up, detached snapshots, and nothing sampled outside play', async () => {
  const app = await bootMain();
  const initial = app.keeper.frameTiming;
  assert.deepEqual(initial, { capacity: 600, warmupRemaining: 120, samples: [] });
  run(app, 30, 0); // Title screen frames never sample or consume warm-up.
  assert.deepEqual(app.keeper.frameTiming, { capacity: 600, warmupRemaining: 120, samples: [] });
  app.$('start').click();
  let t = run(app, 120, 1000);
  assert.equal(app.keeper.frameTiming.warmupRemaining, 0, 'one warm-up frame consumed per play frame');
  assert.deepEqual(app.keeper.frameTiming.samples, [], 'warm-up frames are excluded, including the interval anchor');
  t = run(app, 1, t);
  assert.deepEqual(app.keeper.frameTiming.samples, [], 'the first post-warm-up frame is only an anchor');
  app.frame(t, { workMs: 3.5 });
  const { samples } = app.keeper.frameTiming;
  assert.equal(samples.length, 1);
  assert.equal(samples[0].timestamp, t);
  assert.ok(Math.abs(samples[0].intervalMs - FRAME) < 1e-9);
  assert.equal(samples[0].workMs, 3.5);
  assert.deepEqual(Object.keys(samples[0]), ['timestamp', 'intervalMs', 'workMs']);
  // Snapshots are copies: callers cannot rewrite the record.
  samples[0].intervalMs = 999; samples.push({ timestamp: 0, intervalMs: 0, workMs: 0 });
  const again = app.keeper.frameTiming;
  assert.equal(again.samples.length, 1);
  assert.ok(Math.abs(again.samples[0].intervalMs - FRAME) < 1e-9);
  assert.notStrictEqual(again.samples, app.keeper.frameTiming.samples);
  assert.notStrictEqual(again.samples[0], app.keeper.frameTiming.samples[0]);
  assert.throws(() => { app.keeper.frameTiming = null; }, TypeError);
  assert.throws(() => { app.keeper.resetFrameTiming = () => {}; }, TypeError);
});

test('resetFrameTiming clears samples, applies the requested warm-up and rejects invalid counts', async () => {
  const app = await bootMain();
  app.$('start').click();
  app.keeper.resetFrameTiming({ warmupFrames: 0 });
  let t = run(app, 6, 0);
  assert.equal(app.keeper.frameTiming.samples.length, 5, 'zero warm-up: only the anchor frame is excluded');
  app.keeper.resetFrameTiming({ warmupFrames: 3 });
  assert.deepEqual(app.keeper.frameTiming, { capacity: 600, warmupRemaining: 3, samples: [] });
  t = run(app, 3, t);
  assert.equal(app.keeper.frameTiming.warmupRemaining, 0);
  assert.equal(app.keeper.frameTiming.samples.length, 0);
  t = run(app, 4, t);
  assert.equal(app.keeper.frameTiming.samples.length, 3);
  app.keeper.resetFrameTiming();
  assert.equal(app.keeper.frameTiming.warmupRemaining, 120, 'default warm-up');
  app.keeper.resetFrameTiming({});
  assert.equal(app.keeper.frameTiming.warmupRemaining, 120, 'default warm-up for an empty options object');
  app.keeper.resetFrameTiming({ warmupFrames: Number.MAX_SAFE_INTEGER });
  assert.equal(app.keeper.frameTiming.warmupRemaining, Number.MAX_SAFE_INTEGER);
  app.keeper.resetFrameTiming({ warmupFrames: 2 });
  run(app, 5, t);
  const before = app.keeper.frameTiming;
  for (const warmupFrames of [-1, -0.5, 1.5, NaN, Infinity, -Infinity, 2 ** 53, '10', null, true, 10n, [5], { valueOf: () => 5 }]) {
    assert.throws(() => app.keeper.resetFrameTiming({ warmupFrames }), RangeError, String(warmupFrames));
    assert.deepEqual(app.keeper.frameTiming, before, `rejected ${String(warmupFrames)} leaves timing untouched`);
  }
  const state = app.keeper.state;
  app.keeper.resetFrameTiming({ warmupFrames: 0 });
  assert.deepEqual(app.keeper.state, state, 'reset never touches the simulation');
  assert.equal(app.keeper.mode, 'play');
});

test('capacity keeps the newest 600 samples and drops the oldest first', async () => {
  const app = await bootMain();
  app.$('start').click();
  app.keeper.resetFrameTiming({ warmupFrames: 0 });
  const t = run(app, 1, 0);
  run(app, 700, t);
  const { samples } = app.keeper.frameTiming;
  assert.equal(samples.length, 600);
  assert.ok(Math.abs(samples.at(-1).timestamp - (t + 699 * FRAME)) < 1e-6);
  assert.ok(Math.abs(samples[0].timestamp - (t + 100 * FRAME)) < 1e-6);
  for (let i = 1; i < samples.length; i++) assert.ok(samples[i].timestamp > samples[i - 1].timestamp);
});

test('pause, help, log, hidden tabs and mode changes never record the gap as a frame interval', async () => {
  const app = await bootMain();
  app.$('start').click();
  app.keeper.resetFrameTiming({ warmupFrames: 0 });
  let t = run(app, 4, 0);
  assert.equal(app.keeper.frameTiming.samples.length, 3);
  for (const [open, close] of [['KeyP', 'KeyP'], ['Slash', 'Slash'], ['KeyL', 'KeyL']]) {
    app.keydown(open); app.keyup(open);
    assert.notEqual(app.keeper.mode, 'play');
    const before = app.keeper.frameTiming.samples;
    t = run(app, 20, t + 5000);
    assert.deepEqual(app.keeper.frameTiming.samples, before, `${open}: no samples while not playing`);
    app.keydown(close); app.keyup(close);
    assert.equal(app.keeper.mode, 'play');
    t = run(app, 3, t + 3000);
    const added = app.keeper.frameTiming.samples.slice(before.length);
    assert.equal(added.length, 2, `${open}: first frame after resuming is only an anchor`);
    assert.ok(added.every(({ intervalMs }) => Math.abs(intervalMs - FRAME) < 1e-9), `${open}: no pause gap`);
  }
  // A hidden document pauses the watch; frames that still arrive while hidden never sample.
  const before = app.keeper.frameTiming.samples;
  app.doc.hidden = true;
  t = run(app, 1, t);
  assert.equal(app.keeper.mode, 'play', 'precondition: hidden but not yet suspended');
  assert.deepEqual(app.keeper.frameTiming.samples, before);
  app.doc.hidden = false;
  t = run(app, 1, t + 4000);
  assert.deepEqual(app.keeper.frameTiming.samples, before, 'the frame after a hidden one is a fresh anchor');
  t = run(app, 1, t);
  assert.equal(app.keeper.frameTiming.samples.length, before.length + 1);
  assert.ok(Math.abs(app.keeper.frameTiming.samples.at(-1).intervalMs - FRAME) < 1e-9);
  // Restarting the watch from dawn is a mode change too.
  while (app.keeper.mode === 'play') app.keeper.advance(60);
  assert.equal(app.keeper.mode, 'dawn');
  const atDawn = app.keeper.frameTiming.samples;
  t = run(app, 10, t + 1000);
  assert.deepEqual(app.keeper.frameTiming.samples, atDawn);
  app.$('restart').click();
  run(app, 2, t + 9000);
  const restarted = app.keeper.frameTiming.samples.slice(atDawn.length);
  assert.equal(restarted.length, 1);
  assert.ok(Math.abs(restarted[0].intervalMs - FRAME) < 1e-9);
});

test('long frames are recorded raw while the simulation step stays clamped to 0.1 s', async () => {
  const app = await bootMain();
  app.$('start').click();
  app.keeper.resetFrameTiming({ warmupFrames: 0 });
  app.frame(0);
  const before = app.keeper.state.time;
  app.frame(250, { workMs: 12 });
  const sample = app.keeper.frameTiming.samples.at(-1);
  assert.equal(sample.intervalMs, 250);
  assert.equal(sample.workMs, 12);
  assert.ok(Math.abs(app.keeper.state.time - before - 0.1) < 1e-9, 'simulation clamp');
  app.frame(260);
  assert.ok(Math.abs(app.keeper.state.time - before - 0.11) < 1e-9);
  // The first frame after a mode change advances nothing.
  app.keydown('KeyP'); app.keyup('KeyP'); app.keydown('KeyP'); app.keyup('KeyP');
  const resumed = app.keeper.state.time;
  app.frame(9000);
  assert.equal(app.keeper.state.time, resumed);
});

test('normal visits get no hook and no sampling, yet frames keep running', async () => {
  for (const options of [{ webdriver: false }, { search: '?seed=3' }, { search: '?e2e=0' }, { search: '?e2e=true' }]) {
    const app = await bootMain(options);
    assert.equal('__keeper' in app.win, false, JSON.stringify(options));
    app.$('start').click();
    let calls = 0;
    const now = globalThis.performance.now;
    globalThis.performance.now = () => { calls++; return 0; };
    try { run(app, 5, 0); } finally { globalThis.performance.now = now; }
    assert.equal(calls, 0, 'ordinary play never reads work durations');
    assert.equal(app.frames.length, 6, 'each frame requests its successor');
  }
});

test('a motion preference change repaints immediately, in every mode, without ticking the watch', async () => {
  const app = await bootMain({ reducedMotion: false });
  assert.equal(app.media.listeners.length, 1, 'main subscribes to preference changes');
  app.$('start').click();
  app.keeper.advance(9.5);
  app.keydown('KeyP'); app.keyup('KeyP');
  const frozen = app.keeper.state;
  for (const reduced of [true, false, true]) {
    app.recording.clear();
    app.setMotion(reduced);
    const centres = fogCentres(app);
    assert.equal(centres.length, 32, 'the whole scene was redrawn');
    // At drift 0 the first bank sits at (sin 0, cos 0) × 470 = (0, 470).
    const first = centres[0];
    if (reduced) assert.deepEqual(first, [0, 470]);
    else assert.notDeepEqual(first, [0, 470]);
    assert.deepEqual(app.keeper.state, frozen);
    assert.equal(app.keeper.mode, 'pause');
  }
  // Ordinary draws after the change keep honouring the new preference.
  app.recording.clear();
  app.keydown('Slash'); app.keyup('Slash');
  assert.deepEqual(fogCentres(app)[0], [0, 470]);
  app.setMotion(false);
  app.recording.clear();
  app.keydown('Slash'); app.keyup('Slash');
  assert.notDeepEqual(fogCentres(app)[0], [0, 470]);
  // Title screen too.
  const title = await bootMain({ reducedMotion: true });
  title.recording.clear();
  title.setMotion(false);
  assert.equal(fogCentres(title).length, 32);
});

test('HUD text is written only when it changes; only Morse outputs scroll to their newest text', async () => {
  const app = await bootMain();
  app.$('start').click();
  const ids = ['clock', 'bearing', 'lens-state', 'horn-state', 'trust-state', 'lamp-state', 'morse-symbols', 'morse-text', 'morse-delivery'];
  const writes = () => Object.fromEntries(ids.map((id) => [id, app.$(id).textWrites]));
  const settled = writes();
  app.keydown('KeyP'); app.keyup('KeyP'); app.keydown('KeyP'); app.keyup('KeyP');
  app.keeper.advance(0);
  assert.deepEqual(writes(), { ...settled, 'lens-state': settled['lens-state'] + 2 },
    'redraws with identical text cause no writes (only lens at rest → turning changed)');
  app.$('morse-symbols').scrollLeft = 0;
  app.$('morse-text').scrollLeft = 0;
  app.keeper.advance(0);
  assert.equal(app.$('morse-symbols').scrollLeft, 0, 'unchanged Morse text is not re-scrolled');
  assert.equal(app.$('morse-text').scrollLeft, 0);
  // Key a dot with the lamp: the live strip changes and scrolls to its end.
  app.keydown('KeyK'); app.keeper.advance(0.1); app.keyup('KeyK'); app.keeper.advance(0.05);
  assert.equal(app.$('morse-symbols').textContent, '·');
  assert.equal(app.$('morse-symbols').scrollLeft, app.$('morse-symbols').scrollWidth);
  assert.ok(app.$('morse-symbols').scrollLeft > 0);
  assert.equal(app.$('morse-text').textContent, 'E');
  assert.equal(app.$('morse-text').scrollLeft, app.$('morse-text').scrollWidth);
  assert.equal(app.$('morse-delivery').textContent, 'Keying…');
  for (const id of ['clock', 'bearing', 'lens-state', 'horn-state', 'trust-state', 'lamp-state', 'morse-delivery']) {
    assert.equal(app.$(id).scrollLeft, 0, `${id} never scrolls`);
  }
  assert.match(app.$('bearing').textContent, /^\d{3}° · 12\.0 s \/ revolution$/);
  assert.equal(app.$('clock').textContent, '18:00');
  assert.equal(app.$('trust-state').textContent, 'Skipper trust · 100%');
  assert.equal(app.$('lens-state').textContent, 'Lens turning clockwise');
  app.keydown('Space');
  app.keeper.advance(0.01);
  assert.equal(app.$('lens-state').textContent, 'Lens held');
});

test('all three controls lists and the footer hint are generated from the shared key table', async () => {
  const app = await bootMain();
  for (const id of ['title-controls', 'controls-list', 'watch-controls-list']) {
    assert.deepEqual(app.$(id).children.map((item) => item.textContent), LABELS, id);
    assert.ok(app.$(id).children.every((item) => item.tagName === 'LI'), id);
  }
  assert.equal(app.$('controls-hint').textContent,
    ['slow', 'fast', 'hold', 'horn', 'lamp', 'log', 'pause'].map((action) => CONTROL_LABELS[action]).join('    /    '));
});
