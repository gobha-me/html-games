import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, hornRings, ROCKS, NIGHT_SECONDS } from '../js/sim.js';
import { createVessel, broadcastHorn, threatensReef, hornRange,
  THREAT_HORIZON_SECONDS, PHYSICS_DT as DT, HULLS } from '../js/physics.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);
const blast = (state) => step(state, { horn: true }, DT);
const emptySea = () => ({ ...createState(), ships: [] });
const reefs = ROCKS.map((rock) => ({ x: rock.x, y: -rock.y, radius: rock.radius + 8 }));
const physical = (ship) => ({ ...ship, y: -ship.y });

test('createVessel rejects each missing/undefined position and heading for every hull', () => {
  for (const type of Object.keys(HULLS)) {
    assert.throws(() => createVessel(type), RangeError);
    assert.throws(() => createVessel(type, {}), RangeError);
    for (const key of ['x', 'y', 'heading']) {
      const options = { x: 0, y: 0, heading: 0 };
      delete options[key];
      assert.throws(() => createVessel(type, options), RangeError, `${type}: missing ${key}`);
      options[key] = undefined;
      assert.throws(() => createVessel(type, options), RangeError, `${type}: undefined ${key}`);
    }
    const ship = createVessel(type, { x: 0, y: 0, heading: 0 });
    assert.equal(ship.speed, HULLS[type].cruiseSpeed);
    assert.equal(ship.id, type);
    assert.equal(ship.smuggler, false);
  }
});

test('10 km reef is not endangered; exactly 120 seconds is, just beyond is not', () => {
  assert.equal(THREAT_HORIZON_SECONDS, 120);
  const ship = createVessel('trawler', { x: 0, y: 0, heading: 0, speed: 1 });
  const options = { origin: { x: 0, y: 0 }, fogDensity: 0, time: 0, seed: 108, trust: 1 };
  for (const [entry, response] of [[10000, 'hold'], [120, 'turn-away'], [120.000001, 'hold']]) {
    const rocks = [{ x: 0, y: entry + 2, radius: 2 }];
    assert.equal(threatensReef(ship, rocks, 120), entry <= 120);
    const heard = broadcastHorn([ship], { ...options, rocks })[0];
    assert.equal(heard.heard, true);
    assert.equal(heard.response, response);
  }
  let state = createState();
  const ratio = 550 / Math.hypot(state.trawler.x, state.trawler.y);
  state.trawler.x *= ratio; state.trawler.y *= ratio;
  assert.equal(threatensReef(physical(state.trawler), reefs, 120), false);
  assert.equal(threatensReef(physical(state.trawler), reefs, 10000), true);
  state = blast(state);
  assert.equal(state.trawler.lastHorn.response, 'hold');
  assert.equal(state.trawler.warnedAt, null);
  assert.equal(state.trust, 0.75, 'distant projected impact is a false alarm');
});

test('third blast is accepted, fourth is spam even with an endangered listener', () => {
  let state = createState();
  assert.equal(state.hornIgnoredUntil, 0);
  for (let index = 1; index <= 3; index++) {
    state = blast(state);
    assert.equal(state.blasts.length, index);
    assert.equal(state.hornIgnoredUntil, 0);
    assert.equal(state.trust, 1);
    assert.equal(state.trawler.lastHorn.reactAt > state.time, true);
    assert.equal(hornRings(state).at(-1).ignored, false);
    state = step(state, {}, DT);
  }
  const listener = { ...state.trawler, id: 'new-listener', warnedAt: null, reactAt: null,
    targetHeading: null, response: 'none' };
  delete listener.lastHorn;
  state.ships.push(listener);
  const before = structuredClone(state);
  state = blast(state);
  close(state.hornIgnoredUntil, state.time + 30);
  assert.equal(state.trust, 0.75);
  assert.deepEqual(state.trawler.lastHorn, before.trawler.lastHorn);
  assert.equal(state.ships[1].warnedAt, null);
  assert.equal(state.ships[1].reactAt, null);
  assert.equal(state.ships[1].heading, listener.heading);
  assert.equal(state.ships[1].lastHorn, undefined);
  assert.equal(hornRings(state).at(-1).ignored, true);
  assert.equal(before.blasts.length, 3, 'step preserves prior history');
});

test('strict 20-second window excludes the exact edge, includes immediately newer blasts', () => {
  for (const [time, spam] of [[20 - 1e-6, true], [20, false], [20 + 1e-6, false]]) {
    const state = createState();
    state.time = time - DT;
    state.blasts = [0, 5, 10];
    const next = blast(state);
    close(next.time, time);
    assert.equal(next.hornIgnoredUntil > 0, spam);
    assert.equal(next.trust, spam ? 0.75 : 1);
    assert.equal(next.blasts.includes(0), spam);
  }
});

test('blasts inside ignore window lose trust, give no response, and never extend the deadline', () => {
  let state = createState();
  state.blasts = [0, 0.001, 0.002]; state.time = 1;
  state = blast(state);
  const deadline = state.hornIgnoredUntil;
  for (const time of [2, 3, 4, deadline - 1e-6]) {
    state.time = time - DT; state.horn = false;
    const trust = state.trust;
    state = blast(state);
    assert.equal(state.hornIgnoredUntil, deadline);
    assert.equal(state.trawler.warnedAt, null);
    assert.equal(state.trawler.reactAt, null);
    assert.equal(state.trawler.lastHorn, undefined);
    close(state.trust, Math.max(0, Math.min(1, trust + 0.01 * DT) - 0.25));
    assert.equal(hornRings(state).at(-1).ignored, true);
  }
  // Restore trust to isolate hearing at the exact ignore-window expiry.
  state.time = deadline - DT; state.horn = false; state.trust = 1;
  state = blast(state);
  assert.equal(state.hornIgnoredUntil, deadline);
  assert.notEqual(state.trawler.warnedAt, null);
  assert.equal(state.trust, 1);
  assert.equal(hornRings(state).at(-1).ignored, false);
});

test('trust loses 0.25 per false alarm, floors at zero, recovers continuously and caps at one', () => {
  let state = emptySea();
  assert.equal(state.trust, 1);
  state = blast(state);
  assert.equal(state.trust, 0.75);
  const once = state;
  state = step(state, { horn: true, hold: true }, 10);
  close(state.trust, 0.85);
  assert.equal(state.blasts.length, 1, 'holding horn never repeats the penalty');
  assert.equal(once.trust, 0.75);
  for (let index = 0; index < 6; index++) {
    state = step(state, {}, DT); state = blast(state);
    assert.ok(state.trust >= 0 && state.trust <= 1);
  }
  assert.equal(state.trust, 0);
  state = step(state, {}, 10);
  close(state.trust, 0.1);
  state = step(state, { horn: true }, 120);
  assert.equal(state.trust, 1, 'recovery continues while held and while ignored');
  assert.ok(state.time < NIGHT_SECONDS);
  state = step(state, {}, NIGHT_SECONDS - state.time);
  assert.equal(state.phase, 'dawn'); assert.equal(state.trust, 1);
  const dawn = structuredClone(state); dawn.trust = 0.4;
  assert.equal(step(dawn, { horn: true }, 10).trust, 0.4, 'no recovery or blasts after night');
});

test('useful warnings preserve trust, but unheard endangered ships cannot justify a blast', () => {
  const state = createState(); state.trust = 0.5;
  close(blast(state).trust, 0.5 + 0.01 * DT);
  state.trawler.x *= 2; state.trawler.y *= 2; state.trawler.speed = 20;
  assert.equal(threatensReef(physical(state.trawler), reefs, 120), true);
  assert.ok(Math.hypot(state.trawler.x, state.trawler.y) > hornRange(state.fog));
  const unheard = blast(state);
  assert.equal(unheard.trawler.lastHorn.heard, false);
  close(unheard.trust, 0.25 + 0.01 * DT);
});

test('lower trust delays reaction and lowers turn-away probability deterministically', () => {
  const ship = createVessel('trawler', { x: 0, y: 0, heading: 0 });
  const options = { origin: { x: 0, y: 0 }, fogDensity: 0, time: 0,
    rocks: [{ x: 0, y: 100, radius: 2 }] };
  let followed = 0;
  for (let seed = 0; seed < 100; seed++) {
    const response = (trust) => broadcastHorn([ship], { ...options, seed, trust })[0];
    const high = response(1), low = response(0.5), zero = response(0);
    assert.equal(high.response, 'turn-away'); assert.equal(zero.response, 'ignore');
    assert.ok(low.reactAt >= high.reactAt && zero.reactAt >= low.reactAt);
    assert.deepEqual(response(0.5), low);
    followed += Number(low.response === 'turn-away');
  }
  assert.ok(followed > 0 && followed < 100);
});

test('holding horn across entry into range never warns a new listener until repress', () => {
  let state = createState();
  const ratio = 680 / Math.hypot(state.trawler.x, state.trawler.y);
  state.trawler.x *= ratio; state.trawler.y *= ratio;
  state.trawler.type = 'coaster'; state.trawler.speed = 5;
  state = blast(state);
  assert.equal(state.trawler.lastHorn.heard, false);
  state = step(state, { horn: true }, 10);
  assert.ok(Math.hypot(state.trawler.x, state.trawler.y) < hornRange(state.fog));
  assert.equal(state.trawler.lastHorn.heard, false);
  assert.equal(state.trawler.warnedAt, null); assert.equal(state.blasts.length, 1);
  state = step(state, {}, DT);
  state.trust = 1; // Isolate hearing from the independent probabilistic trust response.
  state = blast(state);
  assert.equal(state.trawler.lastHorn.heard, true);
  assert.notEqual(state.trawler.warnedAt, null); assert.equal(state.blasts.length, 2);
});

test('rings use current fog, exclude negative ages and the exact two-second endpoint', () => {
  const state = emptySea(); state.time = 10; state.fog = 1;
  state.blasts = [8, 8.000001, 9, 10, 10.000001]; state.ignoredBlasts = [9];
  const prior = structuredClone(state), rings = hornRings(state);
  assert.equal(rings.length, 3);
  close(rings[0].radius, 350 * 1.999999 / 2); close(rings[0].alpha, 1 - 1.999999 / 2);
  assert.deepEqual(rings[1], { radius: 175, alpha: 0.5, ignored: true });
  assert.deepEqual(rings[2], { radius: 0, alpha: 1, ignored: false });
  state.fog = 0; assert.equal(hornRings(state)[1].radius, 350);
  assert.deepEqual({ ...state, fog: 1 }, prior, 'ring lookup is pure');
  const emitted = blast(emptySea());
  assert.equal(hornRings(emitted).length, 1);
  assert.deepEqual(hornRings(step(emitted, { horn: true }, 2.1)), []);
});

test('nonboolean controls including explicit undefined throw without mutating state', () => {
  const state = createState(), prior = structuredClone(state);
  for (const key of ['horn', 'hold', 'slow', 'fast']) {
    for (const value of [undefined, null, 0, 1, 'false', {}, []]) {
      assert.throws(() => step(state, { [key]: value }), TypeError);
    }
  }
  assert.deepEqual(state, prior);
  assert.deepEqual(step(state, { horn: true }, 0), prior);
});
