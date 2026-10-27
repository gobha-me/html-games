import test from 'node:test';
import assert from 'node:assert/strict';
import { bootMain } from './main-harness.mjs';
import { KEYS, CONTROL_LABELS } from '../js/keys.js';
import { NIGHT_SECONDS, bearingTo } from '../js/sim.js';
import { MORSE } from '../js/morse.js';
import { RECORD_KEY } from '../js/record.js';
import { LOG_KEY, LOG_VERSION, LOG_NOTES } from '../js/log.js';

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
  app.recording.clear();
  run(app, 30, 0); // Title screen frames never sample, consume warm-up, or redraw.
  assert.equal(app.clock.reads, 0, 'title frames never read performance.now()');
  assert.equal(app.recording.ops.length, 0, 'title frames do not advance or redraw');
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
    assert.throws(() => app.keeper.resetFrameTiming({ warmupFrames }), {
      name: 'RangeError',
      message: /Warm-up frames must be a nonnegative safe integer/,
    }, String(warmupFrames));
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
  // Pause and resume between two frames: no paused frame resets the anchor,
  // so the mode change itself must, or the 3 s gap becomes a "frame".
  const quick = app.keeper.frameTiming.samples;
  app.keydown('KeyP'); app.keyup('KeyP'); app.keydown('KeyP'); app.keyup('KeyP');
  assert.equal(app.keeper.mode, 'play');
  t = run(app, 1, t + 3000);
  assert.deepEqual(app.keeper.frameTiming.samples, quick, 'first frame after a mode change is only an anchor');
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
  // Restarting the watch from dawn is a mode change too; the frame that crosses into dawn is not sampled.
  while (app.keeper.state.time < NIGHT_SECONDS - 0.05) app.keeper.advance(10);
  const preDawnCount = app.keeper.frameTiming.samples.length;
  t = run(app, 1, t);
  assert.equal(app.keeper.mode, 'dawn');
  assert.equal(app.keeper.frameTiming.samples.length, preDawnCount, 'frame transitioning to dawn is not sampled');
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
  assert.deepEqual(app.media.queries, ['(prefers-reduced-motion: reduce)']);
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
  assert.equal(app.$('morse-symbols').textContent, '—');
  assert.equal(app.$('morse-text').textContent, 'Key K to signal');
  assert.equal(app.$('morse-delivery').textContent, 'Directed to the vessel in the beam');
  assert.equal(app.$('lamp-state').classList.contains('sounding'), false);
  assert.equal(app.$('horn-state').classList.contains('sounding'), false);
  // Key a dash while holding K: live preview updates before keyup, then sends with no vessel in beam.
  app.keydown('KeyK');
  app.keeper.advance(0.4);
  assert.equal(app.$('lamp-state').classList.contains('sounding'), true);
  assert.equal(app.$('morse-symbols').textContent, '−');
  assert.equal(app.$('morse-text').textContent, 'T');
  assert.equal(app.$('morse-delivery').textContent, 'Keying…');
  app.keyup('KeyK');
  app.keeper.advance(2.5);
  assert.equal(app.$('lamp-state').classList.contains('sounding'), false);
  assert.equal(app.$('morse-symbols').textContent, '−');
  assert.equal(app.$('morse-text').textContent, 'T');
  assert.equal(app.$('morse-delivery').textContent, 'Sent · no vessel in beam');
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
  assert.equal(app.$('lens-state').textContent, 'Lens turning clockwise');
  app.keydown('Space');
  app.keeper.advance(0.01);
  assert.equal(app.$('lens-state').textContent, 'Lens held');
  app.keyup('Space');
  app.keeper.advance(0.01);
  assert.equal(app.$('lens-state').textContent, 'Lens turning clockwise');

  // Sweep until the trawler is in the beam, hold, and send a signal to a vessel in the beam.
  const fresh = await bootMain();
  fresh.$('start').click();
  assert.equal(fresh.$('clock').textContent, '18:00');
  assert.equal(fresh.$('bearing').textContent, '285° · 12.0 s / revolution');
  assert.equal(fresh.$('trust-state').textContent, 'Skipper trust · 100%');
  while (Math.abs(fresh.keeper.state.beam - bearingTo(fresh.keeper.state.trawler)) > 2) {
    fresh.keeper.advance(0.05);
  }
  fresh.keydown('Space');
  fresh.keydown('KeyK'); fresh.keeper.advance(0.1); fresh.keyup('KeyK'); fresh.keeper.advance(2.5);
  assert.equal(fresh.$('morse-delivery').textContent, 'Sent · vessel in beam');
  fresh.keyup('Space');

  // Clock and bearing pad single-digit hours, minutes and bearings with leading zeros.
  const clockApp = await bootMain();
  clockApp.$('start').click();
  clockApp.keeper.advance(2.6); // beam moves from 285° past 360° to 003°
  assert.equal(clockApp.$('bearing').textContent, '003° · 12.0 s / revolution');
  clockApp.keeper.advance(91.3 - 2.6); // t = 91.3 s -> 00:05
  assert.equal(clockApp.$('clock').textContent, '00:05');
});

test('all three controls lists and the footer hint are generated from the shared key table', async () => {
  const app = await bootMain();
  for (const id of ['title-controls', 'controls-list', 'watch-controls-list']) {
    assert.deepEqual(app.$(id).children.map((item) => item.textContent), LABELS, id);
    assert.ok(app.$(id).children.every((item) => item.tagName === 'LI'), id);
  }
  assert.equal(app.$('controls-hint').textContent,
    ['slow', 'fast', 'hold', 'horn', 'lamp', 'log', 'pause'].map((action) => CONTROL_LABELS[action]).join('    /    '));
  assert.ok(app.$('log-note').children.every((item) => item.tagName === 'OPTION'));
  assert.deepEqual(app.$('log-note').children.map((item) => item.value), [...LOG_NOTES]);
  assert.deepEqual(app.$('log-note').children.map((item) => item.textContent), ['No note', ...LOG_NOTES.slice(1)]);
  const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'];
  assert.ok(app.$('morse-alphabet').children.every((item) => item.tagName === 'SPAN'));
  assert.deepEqual(app.$('morse-alphabet').children.map((item) => item.textContent),
    letters.map((letter) => `${letter} ${MORSE[letter]}`));
  assert.equal(app.$('schedule-error').hidden, true);
  assert.equal(app.$('schedule-error').textContent, '');
  assert.equal(app.$('start').disabled, false);
});

test('seed query parsing, startup storage, log modal rendering and audio/mute/reference/wpm controls', async () => {
  for (const [search, expectedSeed] of [
    ['?e2e=1', 108],
    ['?e2e=1&seed=0', 0],
    ['?e2e=1&seed=4294967295', 0xffffffff],
    ['?e2e=1&seed=-1', 108],
    ['?e2e=1&seed=4294967296', 108],
    ['?e2e=1&seed=1.5', 108],
    ['?e2e=1&seed=abc', 108],
  ]) {
    const app = await bootMain({ search });
    assert.equal(app.keeper.seed, expectedSeed, search);
    assert.equal(app.keeper.state.seed, expectedSeed, search);
    assert.equal(app.$('previous-record').hidden, true, search);
  }

  // Saved previous record and valid saved log on startup.
  const savedLog = {
    version: LOG_VERSION,
    entries: [
      { seed: 108, night: 1, time: 0, bearing: 5.8, what: { id: 'trawler', type: 'trawler' }, note: '' },
      { seed: 108, night: 1, time: 91.25, bearing: 120, what: { id: 'ship-1', type: 'coaster' }, note: 'running dark' },
    ],
  };
  const withStorage = await bootMain({
    initialStorage: {
      [RECORD_KEY]: JSON.stringify({ version: 2, seed: 108, safe: 4, wrecked: 1 }),
      [LOG_KEY]: JSON.stringify(savedLog),
    },
  });
  assert.equal(withStorage.$('previous-record').hidden, false);
  assert.equal(withStorage.$('previous-record').textContent, 'Last watch: 4 safe · 1 wrecked');
  withStorage.$('log-note').value = 'running dark';
  withStorage.keydown('KeyL');
  assert.equal(withStorage.$('log-note').value, '', 'opening log resets note selection');
  assert.equal(withStorage.$('log-status').textContent, 'Entries are kept in this browser.');
  assert.equal(withStorage.$('log-stamp').textContent, 'Night 1 · 18:00 · 285°');
  assert.ok(withStorage.$('log-entries').children.every((item) => item.tagName === 'LI'));
  assert.deepEqual(withStorage.$('log-entries').children.map((item) => item.textContent), [
    'Night 1 · 18:00 · 005° · Trawler',
    'Night 1 · 00:05 · 120° · Coaster · running dark',
  ]);
  withStorage.keydown('KeyL');

  // Reveal a vessel, check option tag and sighting label, and verify submit outside log mode is ignored.
  withStorage.$('start').click();
  while (!withStorage.keeper.state.trawler.everSeen) withStorage.keeper.advance(0.05);
  withStorage.keydown('KeyL');
  assert.equal(withStorage.$('log-what').children[0].tagName, 'OPTION');
  assert.equal(withStorage.$('log-what').children[0].textContent, 'Trawler · sighting 1');
  withStorage.keydown('KeyL');
  assert.equal(withStorage.keeper.mode, 'play');
  withStorage.$('log-form').dispatchEvent({ type: 'submit', preventDefault() {} });
  assert.equal(withStorage.$('log-entries').children.length, 2, 'submit outside log mode is ignored');

  // WPM select change, Morse reference toggle, and horn audio + mute toggle.
  withStorage.$('incoming-wpm').value = '12';
  withStorage.$('incoming-wpm').dispatchEvent({ type: 'change' });
  assert.equal(withStorage.keeper.state.settings.incomingWpm, 12);
  withStorage.$('start').click();
  assert.equal(withStorage.keeper.state.settings.incomingWpm, 12);

  assert.equal(withStorage.$('morse-reference').hidden, true);
  withStorage.$('show-reference').checked = true;
  withStorage.$('show-reference').dispatchEvent({ type: 'change' });
  assert.equal(withStorage.$('morse-reference').hidden, false);
  withStorage.$('show-reference').checked = false;
  withStorage.$('show-reference').dispatchEvent({ type: 'change' });
  assert.equal(withStorage.$('morse-reference').hidden, true);

  assert.ok(withStorage.audioOps.targets.every((entry) => entry.target === 0), 'silent horn never sets non-zero gain');
  withStorage.keydown('KeyH');
  withStorage.keeper.advance(0.1);
  assert.equal(withStorage.$('horn-state').classList.contains('sounding'), true);
  assert.equal(withStorage.audioOps.targets.at(-1).target, 0.08);
  withStorage.$('mute').click();
  assert.equal(withStorage.$('mute').getAttribute('aria-pressed'), 'true');
  assert.equal(withStorage.$('mute').textContent, 'Unmute horn');
  assert.equal(withStorage.audioOps.targets.at(-1).target, 0);
  withStorage.$('mute').click();
  assert.equal(withStorage.$('mute').getAttribute('aria-pressed'), 'false');
  assert.equal(withStorage.$('mute').textContent, 'Mute horn');
  assert.equal(withStorage.audioOps.targets.at(-1).target, 0.08);
  withStorage.keydown('KeyP');
  assert.equal(withStorage.audioOps.targets.at(-1).target, 0, 'pausing silences horn gain');
});

test('mode panels, focus management, watch-controls fade/dismissal, suspend and dawn summaries', async () => {
  const app = await bootMain();
  const panelHidden = () => ['start', 'pause', 'help', 'dawn'].map((p) => app.$(`${p}-panel`).hidden);
  assert.deepEqual(panelHidden(), [false, true, true, true]);
  assert.equal(app.doc.activeElement, app.$('start'));
  assert.deepEqual(app.$('start').lastFocusOptions, { preventScroll: true });

  // Space and P on the title screen do not preventDefault or start play; pointerdown/keydown on title do not dismiss watch controls.
  assert.equal(app.keydown('Space').defaultPrevented, false);
  app.keydown('KeyP');
  assert.equal(app.keeper.mode, 'start');
  app.win.dispatchEvent({ type: 'pointerdown' });
  app.keydown('KeyZ');
  app.win.dispatchEvent({ type: 'blur' });
  assert.equal(app.keeper.mode, 'start');

  // Help button and close-help button round-trip with focus and panel visibility.
  app.$('help').click();
  assert.equal(app.keeper.mode, 'help');
  assert.deepEqual(panelHidden(), [true, true, false, true]);
  assert.equal(app.doc.activeElement, app.$('close-help'));
  assert.deepEqual(app.$('close-help').lastFocusOptions, { preventScroll: true });
  app.$('close-help').click();
  assert.equal(app.keeper.mode, 'start');
  assert.deepEqual(panelHidden(), [false, true, true, true]);

  // Entering play via #resume without calling start() still shows watch-controls and blurs activeElement (even if already null).
  app.$('resume').click();
  assert.equal(app.keeper.mode, 'play');
  assert.deepEqual(panelHidden(), [true, true, true, true]);
  assert.equal(app.doc.activeElement, null);
  app.$('resume').click(); // activeElement is already null here
  assert.equal(app.$('watch-controls').classList.contains('is-faded'), false);
  assert.equal(app.$('watch-controls').getAttribute('aria-hidden'), 'false');

  // Pointerdown in play dismisses watch-controls; start() restores them; t = 8 fades them; keydown in play dismisses them.
  app.win.dispatchEvent({ type: 'pointerdown' });
  assert.equal(app.$('watch-controls').classList.contains('is-faded'), true);
  assert.equal(app.$('watch-controls').getAttribute('aria-hidden'), 'true');
  app.$('start').click();
  assert.equal(app.$('watch-controls').classList.contains('is-faded'), false);
  app.keeper.advance(7.9);
  assert.equal(app.$('watch-controls').classList.contains('is-faded'), false);
  app.keeper.advance(0.1);
  assert.equal(app.$('watch-controls').classList.contains('is-faded'), true);
  app.$('start').click();
  assert.equal(app.$('watch-controls').classList.contains('is-faded'), false);
  app.keydown('KeyZ');
  assert.equal(app.$('watch-controls').classList.contains('is-faded'), true);

  // visibilitychange when hidden=false does not suspend; hidden=true and blur in play pause and focus #resume.
  app.setHidden(false);
  assert.equal(app.keeper.mode, 'play');
  app.setHidden(true);
  assert.equal(app.keeper.mode, 'pause');
  assert.deepEqual(panelHidden(), [true, false, true, true]);
  assert.equal(app.doc.activeElement, app.$('resume'));
  assert.deepEqual(app.$('resume').lastFocusOptions, { preventScroll: true });
  assert.equal(app.$('lens-state').textContent, 'Lens at rest');
  app.$('resume').click();
  assert.equal(app.keeper.mode, 'play');
  app.win.dispatchEvent({ type: 'blur' });
  assert.equal(app.keeper.mode, 'pause');

  // Dawn summaries across seeds/inputs, idempotence of finishNight, and storage error handling.
  const seed3 = await bootMain({ search: '?e2e=1&seed=3' });
  seed3.$('resume').click(); // enters play without start(), testing initial recorded = false
  seed3.keeper.advance(NIGHT_SECONDS);
  assert.equal(seed3.keeper.mode, 'dawn');
  assert.equal(seed3.doc.activeElement, seed3.$('restart'));
  assert.deepEqual(seed3.$('restart').lastFocusOptions, { preventScroll: true });
  assert.equal(seed3.$('summary').textContent, '1 ship passed safely. 1 ship wrecked. 2 passed unseen.');
  assert.equal(seed3.$('record-status').textContent, '1 vessel lost at the Teeth. The light kept turning.');
  seed3.keydown('KeyP');
  assert.equal(seed3.keeper.mode, 'dawn', 'P at dawn does not resume play');
  // Re-entering play after dawn without start() does not re-record dawn.
  seed3.$('resume').click();
  seed3.keeper.advance(0.1);
  assert.equal(seed3.keeper.mode, 'play', 'recorded guard prevents finishNight from re-running before restart');

  const seed2Fast = await bootMain({ search: '?e2e=1&seed=2' });
  seed2Fast.$('start').click();
  seed2Fast.keydown('KeyD');
  seed2Fast.keeper.advance(NIGHT_SECONDS);
  assert.equal(seed2Fast.$('summary').textContent, '3 ships passed safely. 1 ship wrecked.');
  assert.equal(seed2Fast.$('record-status').textContent, '1 vessel lost at the Teeth. The light kept turning.');

  const calmBrokenStorage = await bootMain({ setItemError: new Error('QuotaExceededError') });
  calmBrokenStorage.$('start').click();
  calmBrokenStorage.keydown('Space');
  calmBrokenStorage.keeper.advance(NIGHT_SECONDS);
  assert.equal(calmBrokenStorage.$('summary').textContent, '0 ships passed safely. 0 ships wrecked. 4 passed unseen.');
  assert.equal(calmBrokenStorage.$('record-status').textContent,
    'The watch is over. The light kept turning. This browser could not keep the morning record.');
});
