import test from 'node:test';
import assert from 'node:assert/strict';
import { step, perception, NIGHT_SECONDS, AFTERIMAGE_SECONDS } from '../js/sim.js';
import { createVessel, PHYSICS_DT } from '../js/physics.js';

function frame(overrides = {}) {
  return {
    seed: 108, time: 0, phase: 'night', beam: 0, speed: 30, fog: 0.08,
    horn: false, lamp: false, blasts: [], ignoredBlasts: [], hornIgnoredUntil: 0, trust: 1,
    morse: { events: [], down: null, text: '', symbols: '', unit: 125, threshold: 250, lastMessage: null },
    settings: { incomingWpm: 8 }, hazards: [], schedule: [], ships: [], ...overrides,
  };
}
function vessel(overrides = {}) {
  return {
    ...createVessel('trawler', { x: 0, y: -100, heading: 0 }),
    spawnTime: PHYSICS_DT, destination: { x: 0, y: -1700 }, navigation: null,
    callsign: 'T108', status: 'underway', warnedAt: null, wreckedAt: null, reactAt: null,
    targetHeading: null, turnSign: 0, response: 'none', afterimage: 0, lastSeen: null,
    everSeen: false, reply: null, ...overrides,
  };
}

test('step rejects invalid durations and action types with precise diagnostics', () => {
  for (const seconds of [-1, 180.001, NaN, Infinity, '1']) {
    assert.throws(() => step(frame(), {}, seconds), { name: 'RangeError', message: 'Step must be between 0 and 180 seconds' });
  }
  for (const input of [null, [], 'horn', 1]) {
    assert.throws(() => step(frame(), input), { name: 'TypeError', message: 'Input must be an action object' });
  }
  for (const key of ['slow', 'fast', 'hold', 'horn', 'lamp']) {
    for (const value of [0, 'true', null, undefined]) {
      assert.throws(() => step(frame(), { [key]: value }), { name: 'TypeError', message: `Invalid ${key}` });
    }
  }
});

test('zero and the exact minimum remaining interval do not tick; the next larger interval does', () => {
  const previous = frame();
  for (const seconds of [0, 0.999e-9, 1e-9]) assert.deepEqual(step(previous, {}, seconds), previous);
  assert.equal(step(previous, { hold: true }, 1.001e-9).time, 1.001e-9);
  assert.deepEqual(previous, frame());
});

test('dawn clamps a long requested frame and clears held horn and lamp, including an unticked final sliver', () => {
  const previous = frame({ time: 179.75 });
  const dawn = step(previous, { hold: true, horn: true, lamp: true }, 1);
  assert.equal(dawn.time, NIGHT_SECONDS);
  assert.equal(dawn.phase, 'dawn');
  assert.equal(dawn.horn, false);
  assert.equal(dawn.lamp, false);
  assert.equal(dawn.fog, 0.16);
  assert.deepEqual(previous, frame({ time: 179.75 }));
  assert.deepEqual(step(dawn, { fast: true, horn: true, lamp: true }, 1), dawn);
  const sliver = step(frame({ time: 180 - 5e-10, horn: true, lamp: true }), {}, 0);
  assert.equal(sliver.time, 180);
  assert.equal(sliver.phase, 'dawn');
  assert.equal(sliver.horn, false);
  assert.equal(sliver.lamp, false);
  const beforeTolerance = frame({ time: 180 - 2e-8, horn: true, lamp: true });
  assert.deepEqual(step(beforeTolerance, {}, 0), beforeTolerance);
  const short = frame({ time: 180 - 0.005 });
  assert.equal(step(short, {}, 1).beam, 30 * (180 - short.time));
  const stopped = frame({ phase: 'dawn', time: 10 });
  assert.deepEqual(step(stopped, { horn: true }, 1), stopped);
});

test('one tick scales steering by elapsed time and uses the updated night time for fog', () => {
  const previous = frame({ time: 90, trust: 0.5 });
  const next = step(previous, { fast: true, hold: true });
  assert.equal(next.speed, 30.4);
  assert.equal(next.beam, 0);
  assert.equal(next.time, 90 + PHYSICS_DT);
  assert.equal(next.fog, 0.08 + 0.08 * (90 + PHYSICS_DT) / 180);
  assert.equal(next.trust, 0.5 + 0.01 * PHYSICS_DT);
  assert.equal(step(previous, { slow: true, hold: true }).speed, 29.6);
});

test('ignored blasts expire exactly at two seconds, while younger blasts remain', () => {
  const now = 10 + PHYSICS_DT;
  const recent = now - 1.999, boundary = now - 2, old = now - 2.001;
  const next = step(frame({ time: 10, ignoredBlasts: [old, boundary, recent] }), { hold: true });
  assert.deepEqual(next.ignoredBlasts, [recent]);
});

test('wrecks do not integrate and safe hulls cannot be wrecked a second time', () => {
  const wreck = vessel({ status: 'wrecked', spawnTime: 0, rudder: 5, yawRate: 2 });
  const next = step(frame({ ships: [wreck] }), { hold: true });
  assert.deepEqual(next.ships[0], { ...wreck, everSeen: true, afterimage: 1.5,
    lastSeen: { x: 0, y: -100, heading: 0, status: 'wrecked' } });
  const safe = vessel({ status: 'safe' });
  const inReef = step(frame({ ships: [safe], hazards: [{ x: 0, y: -100, radius: 1 }] }), { hold: true });
  assert.equal(inReef.ships[0].status, 'safe');
  assert.equal(inReef.ships[0].wreckedAt, null);
});

test('reef contact includes the inflated hull boundary, but the next point outside clears it', () => {
  for (const [y, expected] of [[-90, 'wrecked'], [-89.999, 'underway']]) {
    const next = step(frame({ ships: [vessel({ y })], hazards: [{ x: 0, y: -100, radius: 2 }] }), { hold: true });
    assert.equal(next.ships[0].status, expected);
    assert.equal(next.ships[0].wreckedAt, expected === 'wrecked' ? PHYSICS_DT : null);
  }
});

test('safe credit needs a strictly outside position and strictly outward velocity projection', () => {
  for (const [x, y, heading, expected] of [
    [0, -600, 0, 'underway'], [0, -600.001, 0, 'safe'],
    [601, 0, 0, 'underway'], // exact tangent: zero outward projection
    [800, -100, 270, 'underway'],
    [800, 400, 30, 'safe'], [800, 600, 30, 'underway'],
  ]) {
    const next = step(frame({ ships: [vessel({ x, y, heading })] }), { hold: true });
    assert.equal(next.ships[0].status, expected, `${x}, ${y}, heading ${heading}`);
  }
});

test('a lit hull stores the exact observed pose and status in its afterimage', () => {
  const next = step(frame({ ships: [vessel({ status: 'wrecked', heading: 123 })] }), { hold: true });
  assert.deepEqual(next.ships[0].lastSeen, { x: 0, y: -100, heading: 123, status: 'wrecked' });
  assert.equal(next.ships[0].afterimage, AFTERIMAGE_SECONDS);
  assert.deepEqual(perception(next, next.ships[0]).hull, next.ships[0].lastSeen);
});

test('reaction begins at the deadline, never before it or for a null deadline', () => {
  for (const [reactAt, rudder] of [[null, 0], [PHYSICS_DT + 1e-6, 0], [PHYSICS_DT, 0.125]]) {
    const ship = vessel({ spawnTime: 0, reactAt, response: 'veer', targetHeading: 90, turnSign: 1 });
    const next = step(frame({ ships: [ship] }), { hold: true });
    assert.equal(next.ships[0].rudder, rudder);
    assert.equal(next.ships[0].navigation, null);
  }
});

test('horn listeners include safe vessels and exclude wrecks; an old warning is never overwritten', () => {
  const ships = [vessel({ id: 'safe', status: 'safe' }), vessel({ id: 'wreck', status: 'wrecked' }),
    vessel({ id: 'underway', warnedAt: -1, reactAt: 100, response: 'none' })];
  const next = step(frame({ ships }), { hold: true, horn: true });
  assert.equal(next.ships[0].lastHorn.id, 'safe');
  assert.equal(next.ships[0].lastHorn.heard, true);
  assert.equal(next.ships[0].lastHorn.response, 'hold');
  assert.equal(Object.hasOwn(next.ships[1], 'lastHorn'), false);
  assert.equal(next.ships[2].lastHorn.response, 'hold');
  assert.equal(next.ships[2].warnedAt, -1);
  assert.equal(next.ships[2].reactAt, 100);
  assert.equal(next.ships[2].response, 'none');
});

test('keying release at the same rounded edge discards a zero-length press', () => {
  const next = step(frame({ lamp: true, morse: {
    events: [], down: 0, text: '', symbols: '', unit: 125, threshold: 250, lastMessage: null,
  } }), { lamp: false });
  assert.deepEqual(next.morse.events, []);
  assert.equal(next.morse.down, null);
  assert.equal(next.morse.lastMessage, null);
});

test('a reply flash turns off at its exact millisecond endpoint', () => {
  const ship = vessel({ reply: { startedAt: 0, flashes: [{ on: 100, off: 200 }] } });
  for (const [time, signal] of [[0.099, false], [0.1, true], [0.199, true], [0.2, false]]) {
    assert.equal(perception(frame({ time }), ship).signal, signal);
  }
});


test('starting fresh keying resets stale decoding, but preserves the completed message', () => {
  const lastMessage = { text: 'WHO', recipient: null, time: 0 };
  const next = step(frame({ morse: { events: [], down: null, text: 'E', symbols: '.',
    unit: 200, threshold: 400, lastMessage } }), { lamp: true });
  assert.deepEqual(next.morse, { events: [], down: 0, text: '', symbols: '', unit: 125,
    threshold: 250, lastMessage });
});

test('a finished keyed letter is sent on the exact seven-unit tolerance boundary', () => {
  const previous = frame({ morse: { events: [{ down: 0, up: 1 }], down: null,
    text: 'E', symbols: '.', unit: 2, threshold: 150, lastMessage: null } });
  const seconds = 0.0149999999; // 15 ms minus 1e-7 ms: age == 7 * 2 - 1e-7
  assert.equal(step(previous, {}, seconds - 1e-8).morse.lastMessage, null);
  assert.deepEqual(step(previous, {}, seconds).morse.lastMessage,
    { text: 'E', symbols: '.', recipient: null, time: seconds });
});


test('the legacy single-vessel state still observes its trawler without a ships array', () => {
  const previous = frame({ trawler: vessel({ status: 'wrecked' }) });
  delete previous.ships;
  const next = step(previous, { hold: true });
  assert.equal(next.trawler.everSeen, true);
  assert.deepEqual(next.trawler.lastSeen, { x: 0, y: -100, heading: 0, status: 'wrecked' });
});

test('a repeated useful warning preserves the original deadline and response', () => {
  const ship = vessel({ warnedAt: -1, reactAt: 100, response: 'veer', targetHeading: 90, turnSign: 1 });
  const next = step(frame({ ships: [ship], hazards: [{ x: 0, y: -150, radius: 10 }] }), { horn: true, hold: true });
  assert.equal(next.ships[0].lastHorn.response, 'turn-away');
  assert.equal(next.ships[0].warnedAt, -1);
  assert.equal(next.ships[0].reactAt, 100);
  assert.equal(next.ships[0].response, 'veer');
  assert.equal(next.trust, 1);
});

test('a dark launch veers thirty degrees clockwise from its radial bearing', () => {
  const ship = vessel({ id: 'dark', smuggler: true });
  const next = step(frame({ seed: 5, ships: [ship] }), { hold: true, horn: true });
  assert.equal(next.ships[0].lastHorn.response, 'veer');
  assert.equal(next.ships[0].targetHeading, 30);
  assert.equal(next.ships[0].turnSign, 1);
  assert.equal(next.ships[0].warnedAt, PHYSICS_DT);
});

test('an honest fresh warning schedules avoidance without assigning the smuggler escape bearing', () => {
  const next = step(frame({ ships: [vessel()], hazards: [{ x: 0, y: -150, radius: 10 }] }), { horn: true, hold: true });
  assert.equal(next.ships[0].response, 'turn-away');
  assert.equal(next.ships[0].targetHeading, null);
  assert.equal(next.ships[0].turnSign, 0);
});
