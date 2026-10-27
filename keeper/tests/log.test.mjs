import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  LOG_KEY, LOG_VERSION, LOG_NOTES, LOG_TYPES,
  revealedThings, assembleEntry, parseLog,
} from '../js/log.js';
import { KEYS, CONTROL_LABELS, actionFor, heldInput } from '../js/keys.js';
import { RECORD_KEY, parseRecord } from '../js/record.js';
import {
  createState, step, bearingTo, isLit, specialtyApproach, installSpecialty, NIGHT_SECONDS,
} from '../js/sim.js';

const HOLD = Object.freeze({ hold: true });
const TICK = 1 / 60;
const gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

function revealTrawler(state = createState(108)) {
  let current = state;
  while (!current.trawler.everSeen && current.time < 30) {
    current = step(current, {}, 0.05);
  }
  assert.equal(current.trawler.everSeen, true, 'precondition: beam revealed the trawler');
  return current;
}

function openBearing(state, avoid = []) {
  const trawler = bearingTo(state.trawler);
  for (let bearing = 0; bearing < 360; bearing += 5) {
    if (gap(bearing, trawler) > 40 && avoid.every((other) => gap(bearing, other) > 40)
      && state.hazards.every((rock) => gap(bearing, bearingTo(rock)) > 25)) return bearing;
  }
  assert.fail('no open bearing');
}

test('log and keys modules import and execute in Node without browser globals or Math.random', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    for (const name of ['Date', 'window', 'document', 'localStorage', 'performance', 'navigator']) {
      Object.defineProperty(globalThis, name, {
        get() { throw new Error(name + ' accessed in pure module'); },
        configurable: true,
      });
    }
    Math.random = () => { throw new Error('Math.random called in pure module'); };
    const log = await import(${JSON.stringify(new URL('../js/log.js', import.meta.url).href)});
    const keys = await import(${JSON.stringify(new URL('../js/keys.js', import.meta.url).href)});
    const state = {
      seed: 108,
      nightParams: { night: 1 },
      time: 12.5,
      beam: 45,
      ships: [{ id: 'trawler', type: 'trawler', everSeen: true }],
    };
    const things = log.revealedThings(state);
    if (things.length !== 1) throw new Error('unexpected revealedThings length');
    const entry = log.assembleEntry(state, 'trawler', 'running dark');
    const parsed = log.parseLog(JSON.stringify({ version: log.LOG_VERSION, entries: [entry] }));
    if (!parsed || parsed.entries.length !== 1) throw new Error('round-trip failed');
    if (keys.actionFor('KeyL') !== 'log') throw new Error('KeyL not bound to log');
  `], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('key table includes unique KeyL binding for log and excludes modal toggles from held gameplay input', () => {
  assert.equal(Object.isFrozen(KEYS), true);
  assert.equal(Object.isFrozen(CONTROL_LABELS), true);
  assert.deepEqual(KEYS.log, ['KeyL']);
  assert.equal(CONTROL_LABELS.log, 'L · keeper’s log');
  assert.deepEqual(Object.keys(CONTROL_LABELS), Object.keys(KEYS));

  const allCodes = Object.values(KEYS).flat();
  assert.equal(new Set(allCodes).size, allCodes.length, 'every physical key code has at most one action owner');
  for (const [action, codes] of Object.entries(KEYS)) {
    assert.ok(codes.length >= 1, `${action} has at least one key code`);
    assert.equal(typeof CONTROL_LABELS[action], 'string');
    assert.ok(CONTROL_LABELS[action].length > 0);
    for (const code of codes) {
      assert.equal(actionFor(code), action);
    }
  }
  for (const unbound of ['KeyZ', 'KeyQ', 'Enter', 'Tab', '', undefined, null]) {
    assert.equal(actionFor(unbound), undefined);
  }

  const pressed = new Set(['KeyL', 'Escape', 'KeyP', 'Slash']);
  assert.deepEqual(heldInput(pressed), {
    slow: false, fast: false, hold: false, horn: false, lamp: false,
  });
  assert.equal('log' in heldInput(pressed), false);
});

test('log schema constants are frozen and independent from the dawn record key', () => {
  assert.equal(LOG_KEY, 'keeper.log.v1');
  assert.notEqual(LOG_KEY, RECORD_KEY);
  assert.equal(LOG_VERSION, 1);
  assert.equal(Object.isFrozen(LOG_NOTES), true);
  assert.equal(Object.isFrozen(LOG_TYPES), true);
  assert.deepEqual(LOG_NOTES, ['', 'running dark', 'signalled SOS', 'no name visible', 'same boat as before']);
  assert.deepEqual(LOG_TYPES, {
    trawler: 'Trawler',
    coaster: 'Coaster',
    speedboat: 'Launch',
    lifeboat: 'Lifeboat',
  });
});

test('cannot log unseen objects: only vessels revealed this watch are eligible, with no hidden fields leaked', () => {
  let state = createState(108);
  const darkBearing = openBearing(state);
  state = installSpecialty(state, specialtyApproach({
    id: 'dark-launch', type: 'speedboat', smuggler: true, bearing: darkBearing, spawnRange: 300,
  }));
  const sosBearing = openBearing(state, [darkBearing]);
  state = installSpecialty(state, specialtyApproach({
    id: 'sos-boat', type: 'lifeboat', bearing: sosBearing, spawnRange: 260,
  }));

  // Before the beam touches any hull, nothing is revealed or loggable.
  assert.deepEqual(revealedThings(state), []);
  for (const candidate of ['trawler', 'dark-launch', 'sos-boat', ...state.schedule.map((s) => s.id)]) {
    assert.equal(assembleEntry(state, candidate), null, `unseen ${candidate} must not be loggable`);
  }

  // Aiming the beam at an empty bearing still reveals nothing.
  state.beam = openBearing(state, [darkBearing, sosBearing]);
  state = step(state, HOLD, 2);
  assert.deepEqual(revealedThings(state), []);
  assert.equal(assembleEntry(state, 'trawler'), null);

  // Reveal the trawler only; other hulls remain unseen and unloggable.
  state.beam = bearingTo(state.trawler);
  state = step(state, HOLD, TICK);
  assert.equal(state.trawler.everSeen, true);
  const firstReveal = revealedThings(state);
  assert.deepEqual(firstReveal, [{ id: 'trawler', type: 'trawler' }]);
  assert.deepEqual(Object.keys(firstReveal[0]), ['id', 'type']);
  assert.notEqual(firstReveal[0], state.trawler);
  assert.equal(assembleEntry(state, 'dark-launch'), null);
  assert.equal(assembleEntry(state, 'sos-boat'), null);

  // Reveal the smuggler launch and distress lifeboat; verify all 4 hull types work when everSeen.
  state.beam = bearingTo(state.ships.find((s) => s.id === 'dark-launch'));
  state = step(state, HOLD, TICK);
  state.beam = bearingTo(state.ships.find((s) => s.id === 'sos-boat'));
  state = step(state, HOLD, TICK);

  const coasterSchedule = state.schedule.find((s) => s.type === 'coaster');
  assert.ok(coasterSchedule, 'seed 108 schedules a coaster');
  state = step(state, HOLD, coasterSchedule.spawnTime - state.time + TICK);
  const coaster = state.ships.find((s) => s.id === coasterSchedule.id);
  assert.equal(coaster.everSeen, false);
  assert.equal(assembleEntry(state, coaster.id), null, 'arrived but unlit coaster cannot be logged');

  state.beam = bearingTo(coaster);
  state = step(state, HOLD, TICK);
  assert.equal(state.ships.find((s) => s.id === coaster.id).everSeen, true);

  const revealed = revealedThings(state);
  assert.deepEqual(revealed, [
    { id: 'trawler', type: 'trawler' },
    { id: 'dark-launch', type: 'speedboat' },
    { id: 'sos-boat', type: 'lifeboat' },
    { id: coaster.id, type: 'coaster' },
  ]);
  for (const item of revealed) {
    assert.deepEqual(Object.keys(item), ['id', 'type'], 'no callsign, position, smuggler or distress flags exposed');
    const entry = assembleEntry(state, item.id, 'running dark');
    assert.notEqual(entry, null);
    assert.deepEqual(entry.what, item);
  }
});

test('entry records current beam bearing rather than unseen live ship bearing, and departed/wrecked/lost sightings stay eligible this watch', () => {
  let state = revealTrawler(createState(108));
  // Swing the beam away and let the trawler sail out of the cone until its afterimage expires.
  state.beam = (bearingTo(state.trawler) + 120) % 360;
  state = step(state, HOLD, 4);
  assert.equal(isLit(state, state.trawler), false);
  assert.equal(state.trawler.afterimage, 0);
  const liveShipBearing = bearingTo(state.trawler);
  assert.ok(gap(state.beam, liveShipBearing) > 60);

  const entry = assembleEntry(state, 'trawler', 'no name visible');
  assert.notEqual(entry, null);
  assert.equal(entry.bearing, state.beam, 'uses current beam bearing');
  assert.notEqual(entry.bearing, liveShipBearing, 'never leaks unseen vessel live bearing');
  assert.equal(entry.time, state.time);

  // Terminal statuses (safe, wrecked, lost) remain eligible if everSeen === true, but never if everSeen === false.
  for (const status of ['safe', 'wrecked', 'lost']) {
    const seenTerminal = structuredClone(state);
    seenTerminal.trawler.status = status;
    seenTerminal.ships[0].status = status;
    assert.deepEqual(revealedThings(seenTerminal), [{ id: 'trawler', type: 'trawler' }]);
    assert.notEqual(assembleEntry(seenTerminal, 'trawler'), null, `everSeen ${status} vessel stays loggable`);

    const unseenTerminal = structuredClone(seenTerminal);
    unseenTerminal.trawler.everSeen = false;
    unseenTerminal.ships[0].everSeen = false;
    assert.deepEqual(revealedThings(unseenTerminal), []);
    assert.equal(assembleEntry(unseenTerminal, 'trawler'), null, `unseen ${status} vessel is rejected`);
  }

  // Replaying the watch resets eligibility even when previous log history exists.
  const savedHistory = parseLog(JSON.stringify({ version: LOG_VERSION, entries: [entry] }));
  assert.equal(savedHistory.entries.length, 1);
  const replayState = createState(108);
  assert.deepEqual(revealedThings(replayState), []);
  assert.equal(assembleEntry(replayState, 'trawler'), null);
});

test('revealedThings and assembleEntry handle adversarial state shapes, id lengths, hull types and numeric bounds without mutating inputs', () => {
  for (const badState of [
    null, undefined, false, 0, 'state', [],
    {}, { ships: null }, { ships: 'ships' }, { ships: 123 }, { ships: {} },
    { trawler: null }, { trawler: { id: 'trawler', type: 'trawler', everSeen: false } },
    { trawler: { id: 'trawler', type: 'trawler', everSeen: 1 } },
    { trawler: { id: 'trawler', type: 'trawler', everSeen: 'true' } },
  ]) {
    assert.deepEqual(revealedThings(badState), []);
    assert.equal(assembleEntry(badState, 'trawler'), null);
  }

  // Legacy single-trawler fallback works only when ships is absent and trawler.everSeen === true.
  const legacySeen = {
    seed: 108, nightParams: { night: 1 }, time: 10, beam: 90,
    trawler: { id: 'trawler', type: 'trawler', everSeen: true, secret: true },
  };
  assert.deepEqual(revealedThings(legacySeen), [{ id: 'trawler', type: 'trawler' }]);
  assert.deepEqual(assembleEntry(legacySeen, 'trawler'), {
    seed: 108, night: 1, time: 10, bearing: 90,
    what: { id: 'trawler', type: 'trawler' }, note: '',
  });
  // When ships is an array, state.trawler is not consulted as a fallback.
  assert.deepEqual(revealedThings({ ...legacySeen, ships: [] }), []);

  const boundaryId80 = 'v'.repeat(80);
  const baseState = {
    seed: 0,
    nightParams: { night: 5 },
    time: NIGHT_SECONDS,
    beam: 359.9999,
    ships: [
      null,
      undefined,
      'invalid',
      { id: 'a', type: 'trawler', everSeen: true },
      { id: boundaryId80, type: 'lifeboat', everSeen: true },
      { id: 'v'.repeat(81), type: 'trawler', everSeen: true },
      { id: '', type: 'trawler', everSeen: true },
      { id: 123, type: 'trawler', everSeen: true },
      { id: ['a'], type: 'trawler', everSeen: true },
      { id: 'arr-type', type: ['trawler'], everSeen: true },
      { id: 'proto-1', type: 'toString', everSeen: true },
      { id: 'proto-2', type: '__proto__', everSeen: true },
      { id: 'proto-3', type: 'constructor', everSeen: true },
      { id: 'proto-4', type: 'valueOf', everSeen: true },
      { id: 'bad-type', type: 'Trawler', everSeen: true },
      { id: 'bad-type-2', type: 'launch', everSeen: true },
      { id: 'not-bool', type: 'coaster', everSeen: 1 },
      { id: 'unseen', type: 'coaster', everSeen: false },
    ],
  };
  const snapshot = structuredClone(baseState);
  assert.deepEqual(revealedThings(baseState), [
    { id: 'a', type: 'trawler' },
    { id: boundaryId80, type: 'lifeboat' },
  ]);
  assert.deepEqual(baseState, snapshot, 'revealedThings never mutates state');

  for (const note of LOG_NOTES) {
    const assembled = assembleEntry(baseState, boundaryId80, note);
    assert.deepEqual(assembled, {
      seed: 0,
      night: 5,
      time: NIGHT_SECONDS,
      bearing: 359.9999,
      what: { id: boundaryId80, type: 'lifeboat' },
      note,
    });
  }
  assert.deepEqual(baseState, snapshot, 'assembleEntry never mutates state');

  // Invalid note presets or forged whatIds are rejected.
  for (const badNote of [
    'custom note', 'Running dark', ' running dark', 'running dark ', 'signalled sos',
    null, false, true, 0, 1, ['running dark'], { note: '' },
  ]) {
    assert.equal(assembleEntry(baseState, 'a', badNote), null, `bad note ${JSON.stringify(badNote)}`);
  }
  for (const badWhat of ['unseen', 'v'.repeat(81), 'proto-1', 'bad-type', '', null, undefined, 123, {}]) {
    assert.equal(assembleEntry(baseState, badWhat), null);
  }

  // Exact numeric boundaries on state metadata in assembleEntry.
  for (const validPatch of [
    { seed: 0 },
    { seed: 0xffffffff },
    { nightParams: { night: 1 } },
    { nightParams: { night: 2 } },
    { nightParams: { night: 3 } },
    { nightParams: { night: 4 } },
    { nightParams: { night: 5 } },
    { time: 0 },
    { time: -0 },
    { time: NIGHT_SECONDS },
    { beam: 0 },
    { beam: -0 },
    { beam: 359.999999999 },
  ]) {
    assert.notEqual(assembleEntry({ ...baseState, ...validPatch }, 'a'), null, JSON.stringify(validPatch));
  }

  for (const invalidPatch of [
    { seed: -1 },
    { seed: 0x100000000 },
    { seed: 1.5 },
    { seed: NaN },
    { seed: Infinity },
    { seed: '108' },
    { seed: null },
    { nightParams: null },
    { nightParams: {} },
    { nightParams: { night: 0 } },
    { nightParams: { night: 6 } },
    { nightParams: { night: -1 } },
    { nightParams: { night: 1.5 } },
    { nightParams: { night: '1' } },
    { time: -1e-9 },
    { time: NIGHT_SECONDS + 1e-9 },
    { time: NaN },
    { time: Infinity },
    { time: -Infinity },
    { time: '10' },
    { beam: -1e-9 },
    { beam: -0.1 },
    { beam: 360 },
    { beam: 360.001 },
    { beam: NaN },
    { beam: Infinity },
    { beam: -Infinity },
    { beam: '90' },
  ]) {
    assert.equal(assembleEntry({ ...baseState, ...invalidPatch }, 'a'), null, JSON.stringify(invalidPatch));
  }
});

test('parseLog round-trips valid documents, strips unknown properties and rejects corrupt, old-version or partially invalid logs', () => {
  assert.deepEqual(parseLog(JSON.stringify({ version: 1, entries: [] })), { version: 1, entries: [] });

  const validEntries = [
    { seed: 0, night: 1, time: 0, bearing: 0, what: { id: 'trawler', type: 'trawler' }, note: '' },
    { seed: 108, night: 2, time: 45.5, bearing: 123.45, what: { id: 'ship-1', type: 'coaster' }, note: 'no name visible' },
    { seed: 4242, night: 3, time: 120, bearing: 270, what: { id: 'dark-1', type: 'speedboat' }, note: 'running dark' },
    { seed: 99999, night: 4, time: 179.9, bearing: 359.9, what: { id: 'sos-1', type: 'lifeboat' }, note: 'signalled SOS' },
    { seed: 0xffffffff, night: 5, time: NIGHT_SECONDS, bearing: 180, what: { id: 'v'.repeat(80), type: 'speedboat' }, note: 'same boat as before' },
  ];
  const roundTrip = parseLog(JSON.stringify({ version: LOG_VERSION, entries: validEntries }));
  assert.deepEqual(roundTrip, { version: LOG_VERSION, entries: validEntries });

  // Unknown properties at document, entry and what levels are discarded.
  const polluted = {
    version: 1,
    extraRoot: 'discard',
    entries: [{
      ...validEntries[0],
      extraEntry: 'discard',
      what: { ...validEntries[0].what, callsign: 'SKR', smuggler: true, x: 10, y: -20 },
    }],
  };
  const cleaned = parseLog(JSON.stringify(polluted));
  assert.deepEqual(cleaned, { version: 1, entries: [validEntries[0]] });
  assert.deepEqual(Object.keys(cleaned), ['version', 'entries']);
  assert.deepEqual(Object.keys(cleaned.entries[0]), ['seed', 'night', 'time', 'bearing', 'what', 'note']);
  assert.deepEqual(Object.keys(cleaned.entries[0].what), ['id', 'type']);

  // Corrupt JSON, non-objects, wrong versions and non-array entries return null without throwing.
  for (const raw of [
    '', '{', '{"version":1,"entries":[', 'undefined', 'NaN',
    'null', 'true', 'false', '0', '123', '"log"', '[]',
    null, undefined, 123, {}, [],
    JSON.stringify({ version: 0, entries: [] }),
    JSON.stringify({ version: 2, entries: [] }),
    JSON.stringify({ version: -1, entries: [] }),
    JSON.stringify({ version: 1.5, entries: [] }),
    JSON.stringify({ version: '1', entries: [] }),
    JSON.stringify({ entries: [] }),
    JSON.stringify({ version: 1 }),
    JSON.stringify({ version: 1, entries: null }),
    JSON.stringify({ version: 1, entries: {} }),
    JSON.stringify({ version: 1, entries: '[]' }),
  ]) {
    assert.equal(parseLog(raw), null, `expected null for ${String(raw)}`);
  }

  // Any single bad entry rejects the entire document rather than keeping partial history.
  const baseEntry = validEntries[1];
  for (const badEntry of [
    null,
    undefined,
    'entry',
    123,
    [],
    { ...baseEntry, seed: -1 },
    { ...baseEntry, seed: 0x100000000 },
    { ...baseEntry, seed: 108.5 },
    { ...baseEntry, seed: '108' },
    { ...baseEntry, seed: null },
    { ...baseEntry, night: 0 },
    { ...baseEntry, night: 6 },
    { ...baseEntry, night: -1 },
    { ...baseEntry, night: 1.5 },
    { ...baseEntry, night: '2' },
    { ...baseEntry, night: null },
    { ...baseEntry, time: -0.001 },
    { ...baseEntry, time: NIGHT_SECONDS + 0.001 },
    { ...baseEntry, time: NaN },
    { ...baseEntry, time: Infinity },
    { ...baseEntry, time: '45.5' },
    { ...baseEntry, time: null },
    { ...baseEntry, bearing: -0.001 },
    { ...baseEntry, bearing: 360 },
    { ...baseEntry, bearing: 720 },
    { ...baseEntry, bearing: NaN },
    { ...baseEntry, bearing: Infinity },
    { ...baseEntry, bearing: '123' },
    { ...baseEntry, bearing: null },
    { ...baseEntry, what: null },
    { ...baseEntry, what: 'coaster' },
    { ...baseEntry, what: { id: '', type: 'coaster' } },
    { ...baseEntry, what: { id: 'a'.repeat(81), type: 'coaster' } },
    { ...baseEntry, what: { id: 123, type: 'coaster' } },
    { ...baseEntry, what: { id: ['ship-1'], type: 'coaster' } },
    { ...baseEntry, what: { id: 'ship-1', type: ['coaster'] } },
    { ...baseEntry, what: { id: 'ship-1', type: 'Coaster' } },
    { ...baseEntry, what: { id: 'ship-1', type: 'launch' } },
    { ...baseEntry, what: { id: 'ship-1', type: 'toString' } },
    { ...baseEntry, what: { id: 'ship-1', type: '__proto__' } },
    { ...baseEntry, what: { id: 'ship-1', type: null } },
    { ...baseEntry, note: 'forged note' },
    { ...baseEntry, note: 'Running dark' },
    { ...baseEntry, note: ' running dark' },
    { ...baseEntry, note: null },
    { ...baseEntry, note: false },
    { ...baseEntry, note: 0 },
  ]) {
    const doc = JSON.stringify({ version: 1, entries: [validEntries[0], badEntry, validEntries[2]] });
    assert.equal(parseLog(doc), null, `document with bad entry ${JSON.stringify(badEntry)} must be rejected`);
  }
});

// Minimal DOM/Storage harness to exercise the real js/main.js controller and hooks without mocking Keeper modules.
let bootSequence = 0;
async function bootMain({
  seed = 108,
  initialStorage = {},
  getItemError = null,
  setItemError = null,
  reducedMotion = false,
} = {}) {
  const listeners = new Map();
  const docListeners = new Map();
  const elements = new Map();
  let activeElement = null;
  let canvasRect = { width: 1280, height: 720 };

  function makeClassList() {
    const set = new Set();
    return {
      add: (...names) => names.forEach((n) => set.add(n)),
      remove: (...names) => names.forEach((n) => set.delete(n)),
      toggle: (name, force) => {
        const next = force === undefined ? !set.has(name) : Boolean(force);
        if (next) set.add(name); else set.delete(name);
        return next;
      },
      contains: (name) => set.has(name),
    };
  }

  function makeCanvasContext() {
    return {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      font: '',
      textAlign: '',
      setTransform() {},
      fillRect() {},
      strokeRect() {},
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      quadraticCurveTo() {},
      arc() {},
      ellipse() {},
      closePath() {},
      clip() {},
      fill() {},
      stroke() {},
      fillText() {},
      setLineDash() {},
      createRadialGradient() { return { addColorStop() {} }; },
    };
  }

  function makeElement(id, tag = 'div') {
    const elListeners = new Map();
    const attrs = new Map();
    const el = {
      id,
      tagName: tag.toUpperCase(),
      textContent: '',
      value: '',
      hidden: false,
      disabled: false,
      checked: false,
      open: false,
      scrollLeft: 0,
      scrollWidth: 0,
      width: 1280,
      height: 720,
      children: [],
      classList: makeClassList(),
      appendChild(child) {
        this.children.push(child);
        if (this.tagName === 'SELECT' && this.children.length === 1 && this.value === '') {
          this.value = child.value ?? '';
        }
        return child;
      },
      replaceChildren(...next) {
        this.children = [...next];
        if (this.tagName === 'SELECT') {
          this.value = this.children[0]?.value ?? '';
        }
      },
      setAttribute(name, val) { attrs.set(name, String(val)); },
      getAttribute(name) { return attrs.get(name) ?? null; },
      addEventListener(type, fn) {
        if (!elListeners.has(type)) elListeners.set(type, []);
        elListeners.get(type).push(fn);
      },
      dispatchEvent(event) {
        for (const fn of elListeners.get(event.type) ?? []) fn(event);
        return !event.defaultPrevented;
      },
      click() {
        this.dispatchEvent({ type: 'click', preventDefault() {} });
      },
      focus() { activeElement = this; },
      blur() { if (activeElement === this) activeElement = null; },
      showModal() { this.open = true; },
      close() { this.open = false; },
      getContext() { return makeCanvasContext(); },
      getBoundingClientRect() { return { ...canvasRect }; },
    };
    return el;
  }

  const ids = [
    ['sea', 'canvas'], ['night-label', 'span'], ['clock', 'time'], ['bearing', 'p'],
    ['lens-state', 'span'], ['horn-state', 'span'], ['trust-state', 'span'],
    ['lamp-state', 'span'], ['morse-symbols', 'output'], ['morse-text', 'output'], ['morse-delivery', 'span'],
    ['start-panel', 'div'], ['title-controls', 'ul'], ['schedule-error', 'p'],
    ['resume-saved', 'button'], ['start', 'button'], ['save-status', 'p'], ['previous-record', 'p'],
    ['pause-panel', 'div'], ['pause-save-status', 'p'], ['resume', 'button'],
    ['help-panel', 'div'], ['controls-list', 'ul'], ['incoming-wpm', 'select'], ['show-reference', 'input'], ['close-help', 'button'],
    ['dawn-panel', 'div'], ['morning-label', 'p'], ['dawn-title', 'h2'], ['summary', 'p'],
    ['record-status', 'p'], ['dawn-save-status', 'p'], ['next-night', 'button'], ['restart', 'button'], ['new-run', 'button'],
    ['log-panel', 'dialog'], ['log-title', 'h2'], ['log-guidance', 'p'], ['log-form', 'form'],
    ['log-stamp', 'p'], ['log-what', 'select'], ['log-empty', 'p'], ['log-note', 'select'],
    ['add-log-entry', 'button'], ['log-status', 'p'], ['log-no-entries', 'p'], ['log-entries', 'ol'], ['close-log', 'button'],
    ['watch-controls', 'aside'], ['watch-controls-list', 'ul'],
    ['morse-reference', 'aside'], ['morse-alphabet', 'div'],
    ['controls-hint', 'p'], ['help', 'button'], ['mute', 'button'],
  ];
  for (const [id, tag] of ids) elements.set(id, makeElement(id, tag));
  elements.get('incoming-wpm').value = '8';
  elements.get('resume-saved').hidden = true;
  elements.get('save-status').hidden = true;
  elements.get('previous-record').hidden = true;
  elements.get('pause-panel').hidden = true;
  elements.get('pause-save-status').hidden = true;
  elements.get('help-panel').hidden = true;
  elements.get('dawn-panel').hidden = true;
  elements.get('dawn-save-status').hidden = true;
  elements.get('next-night').hidden = true;
  elements.get('new-run').hidden = true;
  elements.get('log-empty').hidden = true;
  elements.get('morse-reference').hidden = true;

  const store = new Map(Object.entries(initialStorage));
  const storageConfig = { getItemError, setItemError, removeItemError: null };
  const localStorageMock = {
    getItem(key) {
      if (storageConfig.getItemError) throw storageConfig.getItemError;
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, val) {
      if (storageConfig.setItemError) throw storageConfig.setItemError;
      store.set(key, String(val));
    },
    removeItem(key) {
      if (storageConfig.removeItemError) throw storageConfig.removeItemError;
      store.delete(key);
    },
  };

  const doc = {
    hidden: false,
    get activeElement() { return activeElement; },
    getElementById(id) { return elements.get(id) ?? null; },
    createElement(tag) { return makeElement('', tag); },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
    dispatchEvent(event) {
      for (const fn of docListeners.get(event.type) ?? []) fn(event);
    },
  };

  const win = {
    devicePixelRatio: 1,
    location: { search: `?e2e=1&seed=${seed}` },
    matchMedia: () => ({ matches: reducedMotion }),
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatchEvent(event) {
      for (const fn of listeners.get(event.type) ?? []) fn(event);
      return !event.defaultPrevented;
    },
  };

  Object.defineProperty(globalThis, 'window', { value: win, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { webdriver: true }, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'requestAnimationFrame', { value: () => 1, configurable: true, writable: true });

  const mainUrl = new URL(`../js/main.js?boot=${++bootSequence}`, import.meta.url);
  await import(mainUrl.href);

  function keydown(code, opts = {}) {
    let defaultPrevented = false;
    const event = {
      type: 'keydown',
      code,
      repeat: Boolean(opts.repeat),
      ctrlKey: Boolean(opts.ctrlKey),
      metaKey: Boolean(opts.metaKey),
      altKey: Boolean(opts.altKey),
      preventDefault() { defaultPrevented = true; },
      get defaultPrevented() { return defaultPrevented; },
    };
    win.dispatchEvent(event);
    return event;
  }
  function keyup(code) {
    win.dispatchEvent({ type: 'keyup', code });
  }
  function submitLog() {
    let defaultPrevented = false;
    elements.get('log-form').dispatchEvent({
      type: 'submit',
      preventDefault() { defaultPrevented = true; },
      get defaultPrevented() { return defaultPrevented; },
    });
    return defaultPrevented;
  }
  function setViewport(width, height, dpr = 1) {
    canvasRect = { width, height };
    win.devicePixelRatio = dpr;
    win.dispatchEvent({ type: 'resize' });
  }

  return {
    win, doc, elements, store, storageConfig,
    $: (id) => elements.get(id),
    keeper: win.__keeper,
    keydown, keyup, submitLog, setViewport,
  };
}

test('main.js recovers gracefully from corrupt, old-version, and inaccessible localStorage on startup', async () => {
  for (const badRaw of [
    '{corrupt json',
    JSON.stringify({ version: 0, entries: [] }),
    JSON.stringify({ version: 2, entries: [] }),
    JSON.stringify({ version: 1, entries: [{ seed: 108, night: 9, time: 0, bearing: 0, what: { id: 'trawler', type: 'trawler' }, note: '' }] }),
  ]) {
    const app = await bootMain({ initialStorage: { [LOG_KEY]: badRaw } });
    app.keydown('KeyL');
    assert.equal(app.keeper.mode, 'log');
    assert.equal(app.$('log-panel').open, true);
    assert.equal(app.$('log-entries').children.length, 0);
    assert.equal(app.$('log-no-entries').hidden, false);
    assert.equal(app.$('log-status').textContent, 'The saved log could not be read. A fresh page is ready.');
    assert.equal(app. doc.activeElement, app.$('log-title'), 'empty sighting watch focuses log-title');
  }

  const blocked = await bootMain({ getItemError: new Error('SecurityError: storage disabled') });
  blocked.keydown('KeyL');
  assert.equal(blocked.keeper.mode, 'log');
  assert.equal(blocked.$('log-entries').children.length, 0);
  assert.equal(blocked.$('log-status').textContent, 'This browser cannot keep the log. Entries remain for this visit.');
});

test('main.js retains entries in memory on storage quota failure and persists full history on later retry', async () => {
  const app = await bootMain({ setItemError: new Error('QuotaExceededError') });
  app.$('start').click();
  assert.equal(app.keeper.mode, 'play');

  // Sweep until the opening trawler is revealed.
  while (!app.keeper.state.trawler.everSeen && app.keeper.state.time < 30) {
    app.keeper.advance(0.05);
  }
  assert.equal(app.keeper.state.trawler.everSeen, true);

  app.keydown('KeyL');
  assert.equal(app.keeper.mode, 'log');
  assert.equal(app.$('log-what').disabled, false);
  assert.equal(app.$('add-log-entry').disabled, false);
  assert.equal(app.$('log-empty').hidden, true);
  assert.equal(app.doc.activeElement, app.$('log-what'), 'available sighting focuses log-what');
  assert.deepEqual(app.$('log-note').children.map((o) => o.value), [...LOG_NOTES]);

  app.$('log-note').value = 'running dark';
  app.submitLog();
  assert.equal(app.$('log-status').textContent, 'Entry added for this visit. This browser could not save the log.');
  assert.equal(app.$('log-entries').children.length, 1);
  assert.match(app.$('log-entries').children[0].textContent, /Night 1 · \d{2}:\d{2} · \d{3}° · Trawler · running dark/);
  assert.equal(app.$('log-no-entries').hidden, true);
  assert.equal(app.$('log-note').value, '');
  assert.equal(app.store.has(LOG_KEY), false, 'failed write did not touch storage');

  // Close log, reveal a second vessel, then allow storage writes to succeed and verify full in-memory retry.
  app.keydown('KeyL');
  assert.equal(app.keeper.mode, 'play');
  while (revealedThings(app.keeper.state).length < 2 && app.keeper.state.time < 90) {
    app.keeper.advance(0.1);
  }
  const things = revealedThings(app.keeper.state);
  assert.ok(things.length >= 2, 'second vessel revealed');

  app.keydown('KeyL');
  assert.equal(app.$('log-what').children.length, things.length);
  app.storageConfig.setItemError = null;
  app.$('log-what').value = things[1].id;
  app.$('log-note').value = 'no name visible';
  app.submitLog();

  assert.equal(app.$('log-status').textContent, 'Entry saved in this browser.');
  assert.equal(app.$('log-entries').children.length, 2);
  const persisted = parseLog(app.store.get(LOG_KEY));
  assert.notEqual(persisted, null);
  assert.equal(persisted.entries.length, 2, 'later successful save writes the entire in-memory log');
  assert.equal(persisted.entries[0].what.id, 'trawler');
  assert.equal(persisted.entries[0].note, 'running dark');
  assert.equal(persisted.entries[1].what.id, things[1].id);
  assert.equal(persisted.entries[1].note, 'no name visible');
});

test('L opens and closes across all modes, freezes sim, cancels horn/lamp/Morse, and requires fresh presses after close', async () => {
  const app = await bootMain();

  // Title screen: L opens and Esc returns to start without starting the watch.
  assert.equal(app.keeper.mode, 'start');
  app.keydown('KeyL');
  assert.equal(app.keeper.mode, 'log');
  app.keydown('Escape');
  assert.equal(app.keeper.mode, 'start');

  // Start watch, then test pause -> log -> pause and help -> log -> help return modes.
  app.$('start').click();
  assert.equal(app.keeper.mode, 'play');
  app.keydown('KeyP');
  assert.equal(app.keeper.mode, 'pause');
  app.keydown('KeyL');
  assert.equal(app.keeper.mode, 'log');
  app.keydown('KeyP');
  assert.equal(app.keeper.mode, 'pause', 'closing log with P from pause returns to pause, never play');
  app.keydown('KeyP');
  assert.equal(app.keeper.mode, 'play');

  app.keydown('Slash');
  assert.equal(app.keeper.mode, 'help');
  app.keydown('KeyL');
  assert.equal(app.keeper.mode, 'log');
  app.$('close-log').click();
  assert.equal(app.keeper.mode, 'help', 'closing log from help returns to help');
  app.keydown('Escape');
  assert.equal(app.keeper.mode, 'play');

  // Hold Space (hold), ArrowRight (fast), KeyH (horn), and KeyK (lamp) simultaneously during play.
  app.keydown('Space');
  app.keydown('ArrowRight');
  app.keydown('KeyH');
  app.keydown('KeyK');
  app.keeper.advance(0.1);
  assert.equal(app.keeper.state.horn, true);
  assert.equal(app.keeper.state.lamp, true);
  assert.equal(app.$('horn-state').textContent, 'Horn sounding');
  assert.equal(app.$('lamp-state').textContent, '● Lamp open');
  assert.equal(app.keeper.state.blasts.length, 1);

  // Modifiers with KeyL or key repeat must not toggle log.
  app.keydown('KeyL', { ctrlKey: true });
  assert.equal(app.keeper.mode, 'play');
  app.keydown('KeyL', { repeat: true });
  assert.equal(app.keeper.mode, 'play');

  // Open log while horn, lamp, hold and fast are still held down.
  app.keydown('KeyL');
  assert.equal(app.keeper.mode, 'log');
  const frozen = app.keeper.state;
  assert.equal(frozen.horn, false, 'opening log silences horn');
  assert.equal(frozen.lamp, false, 'opening log shutters lamp');
  assert.deepEqual(frozen.morse.events, [], 'opening log clears unfinished Morse events');
  assert.equal(frozen.morse.down, null);
  assert.equal(frozen.morse.lastMessage, null);
  assert.equal(app.$('horn-state').textContent, 'Horn silent');
  assert.equal(app.$('lamp-state').textContent, '○ Lamp shuttered');
  assert.equal(app.$('lens-state').textContent, 'Lens at rest');

  // Autorepeat L/Esc/P while open does not close the log.
  for (const code of ['KeyL', 'Escape', 'KeyP']) {
    app.keydown(code, { repeat: true });
    assert.equal(app.keeper.mode, 'log');
  }

  // Gameplay keys pressed while log is open are ignored; native form keys (Space, ArrowDown) are not preventDefaulted.
  const spaceInModal = app.keydown('Space');
  assert.equal(spaceInModal.defaultPrevented, false, 'Space inside modal is left to native form controls');
  for (const code of ['KeyH', 'KeyK', 'KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Slash']) {
    app.keydown(code);
  }
  app.keeper.advance(10);
  assert.deepEqual(app.keeper.state, frozen, 'simulation is completely frozen while log is open');
  assert.equal(app.keeper.mode, 'log');

  // Resize and blur/visibilitychange while log is open keep mode === 'log' and do not corrupt state.
  app.setViewport(1600, 900, 2);
  assert.equal(app.$('sea').width, 3200);
  assert.equal(app.$('sea').height, 1800);
  assert.equal(app.keeper.mode, 'log');
  assert.equal(app.$('log-panel').open, true);
  app.win.dispatchEvent({ type: 'blur' });
  app.doc.hidden = true;
  app.doc.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(app.keeper.mode, 'log');

  // Close log via dialog cancel event; previously held keys must NOT resume without fresh keydown.
  app.$('log-panel').dispatchEvent({ type: 'cancel', preventDefault() {} });
  assert.equal(app.keeper.mode, 'play');
  assert.equal(app.$('log-panel').open, false);

  const beforeAdvance = app.keeper.state;
  app.keeper.advance(1.5);
  const afterAdvance = app.keeper.state;
  assert.equal(afterAdvance.horn, false, 'held H before log does not sound after closing');
  assert.equal(afterAdvance.lamp, false, 'held K before log does not open lamp after closing');
  assert.equal(afterAdvance.morse.lastMessage, null, 'cancelled Morse never sends after closing');
  assert.equal(afterAdvance.blasts.length, 1, 'no new horn blast without a fresh press');
  assert.notEqual(afterAdvance.beam, beforeAdvance.beam, 'held Space before log does not hold lens after closing');

  // Fresh key presses after closing work again.
  app.keyup('KeyH');
  app.keydown('KeyH');
  app.keeper.advance(0.1);
  assert.equal(app.keeper.state.horn, true);
  assert.equal(app.keeper.state.blasts.length, 2);
});

test('unhappy form submissions reject forged vessels/notes, and dawn record + watch restart preserve log history', async () => {
  const app = await bootMain();
  app.$('start').click();

  // Open log when no ships have been revealed yet; forge a submit event with an unseen id.
  app.keydown('KeyL');
  assert.equal(app.$('log-what').disabled, true);
  assert.equal(app.$('add-log-entry').disabled, true);
  assert.equal(app.$('log-empty').hidden, false);
  app.$('log-what').value = 'trawler';
  app.submitLog();
  assert.equal(app.$('log-entries').children.length, 0);
  assert.equal(app.$('log-status').textContent, 'Choose a vessel revealed during this watch and a note from the list.');

  // Reveal trawler, then forge an invalid note value on submit.
  app.keydown('KeyL');
  while (!app.keeper.state.trawler.everSeen && app.keeper.state.time < 30) {
    app.keeper.advance(0.05);
  }
  app.keydown('KeyL');
  assert.equal(app.$('log-what').disabled, false);
  app.$('log-what').value = 'trawler';
  app.$('log-note').value = 'not an allowed note';
  app.submitLog();
  assert.equal(app.$('log-entries').children.length, 0);
  assert.equal(app.$('log-status').textContent, 'Choose a vessel revealed during this watch and a note from the list.');

  // Valid submission succeeds.
  app.$('log-note').value = 'same boat as before';
  app.submitLog();
  assert.equal(app.$('log-entries').children.length, 1);
  assert.equal(app.$('log-status').textContent, 'Entry saved in this browser.');

  // Advance to dawn: dawn record is written separately, and opening log from dawn returns to dawn.
  app.keydown('KeyL');
  app.keeper.advance(NIGHT_SECONDS);
  assert.equal(app.keeper.mode, 'dawn');
  assert.notEqual(parseRecord(app.store.get(RECORD_KEY)), null);
  assert.equal(parseLog(app.store.get(LOG_KEY)).entries.length, 1);

  app.keydown('KeyL');
  assert.equal(app.keeper.mode, 'log');
  app.keydown('KeyL');
  assert.equal(app.keeper.mode, 'dawn', 'closing log from dawn returns to dawn');

  // Restarting the watch resets current-watch sightings while preserving saved log history.
  app.$('restart').click();
  assert.equal(app.keeper.mode, 'play');
  assert.equal(app.keeper.state.time, 0);
  assert.deepEqual(revealedThings(app.keeper.state), []);
  app.keydown('KeyL');
  assert.equal(app.$('log-what').disabled, true, 'restarted watch has no revealed vessels yet');
  assert.equal(app.$('log-entries').children.length, 1, 'saved log history survives watch restart');
});
