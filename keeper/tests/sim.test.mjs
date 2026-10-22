import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, wrapBearing, clampSpeed, fogReach, isLit, perception, bearingTo, summary, NIGHT_SECONDS, SPEED, AFTERIMAGE_SECONDS } from '../js/sim.js';
import { KEYS, actionFor, heldInput } from '../js/keys.js';
import { parseRecord } from '../js/record.js';

function aim(state) { return { ...state, beam: bearingTo(state.trawler) }; }

test('beam wraps at north, stays clockwise, and clamps at 30s / 6s per revolution', () => {
  assert.equal(wrapBearing(360), 0);
  assert.equal(wrapBearing(-1), 359);
  assert.equal(wrapBearing(1081), 1);
  let s = createState(); s.beam = 359;
  const next = step(s, {}, 0.1);
  assert.ok(Math.abs(next.beam - 2) < 1e-8);
  assert.equal(s.beam, 359, 'step cannot mutate the prior frame');
  s = step(s, { slow: true }, 10);
  assert.equal(s.speed, SPEED.slow);
  const before = s.beam;
  s = step(s, { slow: true }, 0.5);
  assert.ok(Math.abs(wrapBearing(s.beam - before) - 6) < 1e-7);
  s = step(s, { fast: true }, 10);
  assert.equal(s.speed, SPEED.fast);
  assert.equal(clampSpeed(-999), SPEED.slow);
  assert.equal(clampSpeed(999), SPEED.fast);
});

test('hold freezes bearing while time, speed changes and the ship keep moving; overlapping steering cancels', () => {
  const s = createState();
  const next = step(s, { hold: true, fast: true, slow: true, horn: true }, 3);
  assert.equal(next.beam, s.beam);
  assert.equal(next.speed, SPEED.default);
  assert.ok(next.trawler.x > s.trawler.x);
  assert.equal(next.time > 2.99, true);
  assert.equal(step(s, { hold: true, fast: true }, 3).speed, SPEED.fast);
});

test('exact cone edge, north wrap and fog horizon are inclusive, outside is invisible', () => {
  const s = createState(); s.beam = 0;
  const at = (angle, radius) => ({ x: Math.sin(angle * Math.PI / 180) * radius, y: -Math.cos(angle * Math.PI / 180) * radius });
  assert.equal(isLit(s, at(7, 200)), true);
  assert.equal(isLit(s, at(353, 200)), true);
  assert.equal(isLit(s, at(7.001, 200)), false);
  assert.equal(isLit(s, at(0, fogReach(s.fog))), true);
  assert.equal(isLit(s, at(0, fogReach(s.fog) + 0.001)), false);
  assert.equal(fogReach(-1), 500);
  assert.equal(fogReach(2), 280);
});

test('unseen hulls are absent; afterimage preserves last observed pose and fades out at 1.5s', () => {
  let s = createState(); s.beam = 180;
  assert.equal(perception(s).hull, null);
  assert.equal(perception(s).opacity, 0);
  s = step(aim(s), { hold: true }, 0.1);
  assert.equal(perception(s).lit, true);
  assert.equal(s.trawler.afterimage, AFTERIMAGE_SECONDS);
  const observed = s.trawler.lastSeen;
  s.beam = 180;
  s = step(s, { hold: true }, 0.75);
  assert.deepEqual(perception(s).hull, observed);
  assert.ok(perception(s).opacity > 0 && perception(s).opacity < 0.16);
  assert.notEqual(s.trawler.x, observed.x);
  s = step(s, { hold: true }, 0.751);
  assert.equal(perception(s).hull, null);
});

test('running light points obey half reach and disappear on a wreck', () => {
  const s = createState(); s.beam = 180;
  assert.equal(perception(s).runningLights, false);
  s.trawler.x = 0; s.trawler.y = -fogReach(s.fog) / 2;
  assert.equal(perception(s).runningLights, true);
  assert.equal(perception(s).hull, null);
  s.trawler.y -= 0.001;
  assert.equal(perception(s).runningLights, false);
  s.trawler.y = -100; s.trawler.status = 'wrecked';
  assert.equal(perception(s).runningLights, false);
});

test('unwarned trawler wrecks at 60–90s; no mid-night game over; dawn at three minutes', () => {
  const s = step(createState(), {}, 90);
  assert.equal(s.trawler.status, 'wrecked');
  assert.ok(s.trawler.wreckedAt > 60 && s.trawler.wreckedAt < 90);
  assert.equal(s.phase, 'night');
  const dawn = step(s, {}, 90);
  assert.equal(dawn.time, NIGHT_SECONDS);
  assert.equal(dawn.phase, 'dawn');
  assert.deepEqual(summary(dawn), { safe: 0, wrecked: 1 });
  assert.deepEqual(step(dawn, { horn: true, fast: true }, 3), dawn);
});

test('default sweep reveals the moving trawler at least twice before danger across seeds', () => {
  for (const seed of [0, 1, 108, 997, 0xffffffff]) {
    let s = createState(seed), sightings = 0, wasLit = false;
    while (s.time < 60) {
      s = step(s, {}, 1 / 20);
      const lit = isLit(s);
      if (lit && !wasLit) sightings++;
      wasLit = lit;
    }
    assert.ok(sightings >= 2, `seed ${seed}: only ${sightings} sightings`);
  }
});

test('a held horn warns when illuminated, turns away and passes safely', () => {
  let s = step(createState(), {}, 24);
  s = step(aim(s), { hold: true, horn: true }, 0.2);
  assert.notEqual(s.trawler.warnedAt, null);
  assert.equal(s.trawler.heading, 90, 'reaction takes two seconds');
  s = step(s, {}, 155.8);
  assert.equal(s.phase, 'dawn');
  assert.equal(s.trawler.status, 'safe');
  assert.deepEqual(summary(s), { safe: 1, wrecked: 0 });
  assert.equal(s.trawler.heading, 0);
});

test('warning on the collision boundary is too late, even when lit and held', () => {
  let s = step(createState(), {}, 72.5);
  s = step(aim(s), { hold: true, horn: true }, 0.1);
  assert.notEqual(s.trawler.warnedAt, null);
  s = step(s, { horn: true }, 20);
  assert.equal(s.trawler.status, 'wrecked');
});

test('unlit + far horn has no effect; an afterimage is not a valid warning target', () => {
  let s = createState(); s.beam = 180;
  s = step(s, { hold: true, horn: true }, 3);
  assert.equal(s.trawler.warnedAt, null);
  s = step(aim(s), { hold: true }, 0.1);
  s.beam = 180;
  s = step(s, { hold: true, horn: true }, 0.1);
  assert.equal(s.trawler.warnedAt, null);
  assert.ok(s.trawler.afterimage > 0);
});

test('near vessel hears off-beam horn; fourth blast in 20 seconds is ignored', () => {
  let s = createState(); s.beam = 180; s.trawler.x = 0; s.trawler.y = -100;
  assert.notEqual(step(s, { hold: true, horn: true }, 0.1).trawler.warnedAt, null);
  s = createState(); s.beam = 180;
  for (let i = 0; i < 3; i++) {
    s = step(s, { hold: true, horn: true }, 0.1);
    s = step(s, { hold: true }, 0.1);
  }
  s = step(aim(s), { hold: true, horn: true }, 0.1);
  assert.equal(s.trawler.warnedAt, null);
  assert.ok(s.ignoreUntil > s.time);
  s = step(s, { hold: true, horn: true }, 21);
  assert.equal(s.blasts.length, 0, 'held horn is one blast, not one per frame');
  s = step(aim(s), { hold: true, horn: true }, 0.1);
  assert.notEqual(s.trawler.warnedAt, null);
});

test('deterministic seed/input replay and long-frame collision cannot tunnel through reef', () => {
  const replay = (seed) => {
    let s = createState(seed);
    for (let i = 0; i < 60; i++) s = step(s, { fast: i % 5 === 0, hold: i % 9 === 0, slow: i % 4 === 0 }, 3);
    return s;
  };
  assert.deepEqual(replay(24), replay(24));
  assert.notDeepEqual(replay(24).trawler.y, replay(25).trawler.y);
  assert.equal(step(createState(), {}, 180).trawler.status, 'wrecked');
});

test('reject invalid inputs rather than poisoning state; zero dt leaves it unchanged', () => {
  for (const value of [NaN, Infinity, -Infinity, '30', null]) {
    assert.throws(() => wrapBearing(value), TypeError);
    assert.throws(() => clampSpeed(value), TypeError);
    assert.throws(() => fogReach(value), TypeError);
  }
  for (const seed of [-1, 0x100000000, NaN, 1.2, '108', null]) assert.throws(() => createState(seed), TypeError);
  for (const dt of [-1, NaN, Infinity, 181, '1']) assert.throws(() => step(createState(), {}, dt), RangeError);
  for (const input of [null, [], 'horn', { horn: 1 }, { hold: 'false' }, { fast: NaN }, { slow: null }]) {
    assert.throws(() => step(createState(), input, 1), TypeError);
  }
  assert.deepEqual(step(createState(), {}, 0), createState());
});

test('shared key table never duplicates a physical binding; simultaneous aliases release independently', () => {
  const bindings = Object.values(KEYS).flat();
  assert.equal(new Set(bindings).size, bindings.length);
  for (const [action, codes] of Object.entries(KEYS)) for (const code of codes) assert.equal(actionFor(code), action);
  assert.equal(actionFor('KeyZ'), undefined);
  const pressed = new Set(['KeyA', 'ArrowLeft', 'KeyH', 'Space']); pressed.delete('KeyA');
  assert.deepEqual(heldInput(pressed), { slow: true, fast: false, horn: true, hold: true });
});

test('corrupt, old, oversized and impossible dawn records are rejected', () => {
  for (const raw of ['{', '', 'null', '[]', '{"version":2}', '{"version":1,"seed":-1,"safe":1,"wrecked":0}',
    '{"version":1,"seed":4294967296,"safe":1,"wrecked":0}', '{"version":1,"seed":108,"safe":1,"wrecked":1}',
    '{"version":1,"seed":108,"safe":"1","wrecked":0}']) assert.equal(parseRecord(raw), null);
  assert.deepEqual(parseRecord('{"version":1,"seed":108,"safe":1,"wrecked":0}'), { version: 1, seed: 108, safe: 1, wrecked: 0 });
});
