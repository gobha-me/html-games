import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, wrapBearing, clampSpeed, fogReach, isLit, perception, bearingTo, summary, validateSchedule, NIGHT_SECONDS, SPEED, AFTERIMAGE_SECONDS, FAST_SHIP_SPEED } from '../js/sim.js';
import { HULLS, PHYSICS_DT, createVessel, pointOfNoReturn, hornRange } from '../js/physics.js';
import { ROCKS } from '../js/sim.js';
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
  assert.ok(next.trawler.x < s.trawler.x);
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

test('unwarned trawler wrecks at 60–100s; no mid-night game over; dawn at three minutes', () => {
  const s = step(createState(), {}, 100);
  assert.equal(s.trawler.status, 'wrecked');
  assert.ok(s.trawler.wreckedAt > 60 && s.trawler.wreckedAt < 100);
  assert.equal(s.phase, 'night');
  const dawn = step(s, {}, 80);
  assert.equal(dawn.time, NIGHT_SECONDS);
  assert.equal(dawn.phase, 'dawn');
  assert.deepEqual(summary({ ships: [dawn.trawler] }), { safe: 0, wrecked: 1, unseen: 0 });
  assert.deepEqual(step(dawn, { horn: true, fast: true }, 3), dawn);
});

test('live radial approach and worst-fog schedule deliver at least four sightings before PNR across seeds', () => {
  for (const seed of [0, 1, 108, 997, 0xffffffff]) {
    let s = createState(seed), sightings = 0, wasLit = false;
    assert.deepEqual(validateSchedule(s.schedule, s.nightParams), { ok: true, violations: [] });
    const original = s;
    while (s.time < 60) {
      s = step(s, {}, 1 / 20);
      const lit = isLit(s);
      if (lit && !wasLit) sightings++;
      wasLit = lit;
    }
    assert.ok(sightings >= 4, `seed ${seed}: only ${sightings} sightings`);
    assert.ok(Math.abs(Math.hypot(s.trawler.x, s.trawler.y) - (original.trawler.spawnRange - s.time * original.trawler.speed)) < 1e-6);
  }
});

test('a horn warns with seeded crew delay, turns smoothly and passes safely', () => {
  let s = step(createState(), {}, 24);
  const heading = s.trawler.heading;
  s = step(aim(s), { hold: true, horn: true }, 0.2);
  assert.notEqual(s.trawler.warnedAt, null);
  assert.equal(s.trawler.heading, heading, 'crew delay precedes rudder movement');
  s = step(s, {}, 155.8);
  assert.equal(s.phase, 'dawn');
  assert.equal(s.trawler.status, 'safe');
  assert.deepEqual(summary({ ships: [s.trawler] }), { safe: 1, wrecked: 0, unseen: 0 });
  assert.ok(Math.abs(((s.trawler.heading - s.trawler.targetHeading + 540) % 360) - 180) < 0.1);
});

test('warning on the collision boundary is too late, even when lit and held', () => {
  const collisionTime = step(createState(), {}, 180).trawler.wreckedAt;
  let s = step(createState(), {}, collisionTime - 0.2);
  s = step(aim(s), { hold: true, horn: true }, 0.1);
  assert.notEqual(s.trawler.warnedAt, null);
  s = step(s, { horn: true }, 20);
  assert.equal(s.trawler.status, 'wrecked');
});

test('warning at the budgeted PNR turns clear and counts safe by dawn, while safe vessels keep moving', () => {
  for (const seed of [0, 108, 997, 0xffffffff]) {
    let s = step(createState(seed), {}, 60);
    s = step(aim(s), { hold: true, horn: true }, 0.1);
    s = step(s, {}, 59.9);
    assert.equal(s.trawler.status, 'safe');
    const y = s.trawler.y;
    s = step(s, {}, 60);
    assert.ok(s.trawler.y < y);
    assert.deepEqual(summary({ ships: [s.trawler] }), { safe: 1, wrecked: 0, unseen: 0 });
  }
});

test('fast ships expose only a deterministic engine bearing and intensity before fog visibility', () => {
  const s = createState();
  assert.equal(perception(s).engineCue, null);
  s.trawler.speed = FAST_SHIP_SPEED;
  s.trawler.x = 0; s.trawler.y = -fogReach(s.fog) * 2;
  s.beam = 0;
  const distant = perception(s);
  assert.equal(distant.hull, null);
  assert.equal(distant.runningLights, false);
  assert.deepEqual(distant.engineCue, { bearing: 0, intensity: 1 / 3 });
  assert.deepEqual(perception(s), distant);
  s.trawler.y = -fogReach(s.fog) * 1.5;
  assert.ok(perception(s).engineCue.intensity > distant.engineCue.intensity);
  s.trawler.speed = FAST_SHIP_SPEED - 0.001;
  assert.equal(perception(s).engineCue, null);
  s.trawler.speed = FAST_SHIP_SPEED + 10;
  s.trawler.status = 'wrecked';
  assert.equal(perception(s).engineCue, null);
  s.trawler.status = 'safe';
  assert.equal(perception(s).engineCue, null);
  s.trawler.status = 'underway'; s.trawler.y = -200;
  assert.equal(perception(s).lit, true);
  assert.equal(perception(s).engineCue, null);
});

test('unlit vessels hear a broadcast; an afterimage neither enables nor blocks it', () => {
  let s = createState(); s.beam = 180;
  s = step(s, { hold: true, horn: true }, 0.1);
  assert.notEqual(s.trawler.warnedAt, null);
  assert.equal(perception(s).lit, false);
  assert.equal(s.trawler.lastHorn.response, 'turn-away');
  let ghost = step(aim(createState()), { hold: true }, 0.1);
  ghost.beam = 180;
  ghost = step(ghost, { hold: true, horn: true }, 0.1);
  assert.notEqual(ghost.trawler.warnedAt, null);
  assert.ok(ghost.trawler.afterimage > 0);
  const far = createState();
  far.trawler.x *= 2; far.trawler.y *= 2;
  assert.equal(step(far, { horn: true }, 0.1).trawler.warnedAt, null);
});

test('useful held horn is one broadcast and low trust can ignore danger', () => {
  let honest = createState();
  honest = step(honest, { horn: true }, 0.1);
  assert.equal(honest.trust, 1);
  const warnedAt = honest.trawler.warnedAt;
  honest = step(honest, { horn: true }, 25);
  assert.equal(honest.trawler.warnedAt, warnedAt);
  assert.equal(honest.blasts.length, 0, 'held horn is one blast, not one per frame');
  const s = createState();
  s.trust = 0;
  const low = step(s, { horn: true }, PHYSICS_DT);
  assert.equal(low.trawler.lastHorn.response, 'ignore');
  assert.equal(low.trawler.warnedAt, null);
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


test('live PONR and spawn budget derive from the physics, including maximum crew delay', () => {
  const reefs = ROCKS.map((r) => ({ x: r.x, y: -r.y, radius: r.radius + 8 }));
  for (const seed of [0, 108, 997, 0xffffffff]) {
    let state = createState(seed);
    const approach = state.schedule[0];
    const lead = pointOfNoReturn({ ...state.trawler, y: -state.trawler.y }, reefs);
    assert.ok(Math.abs(approach.responseSeconds + approach.turnRadius / approach.speed - lead) < 1e-8);
    const pnrTime = (approach.spawnRange - approach.pnrRange) / approach.speed - lead;
    assert.ok(Math.abs(pnrTime - 60) < 1e-8);
    state = step(state, {}, pnrTime);
    state = step(state, { horn: true }, PHYSICS_DT);
    state.trawler.reactAt = state.trawler.warnedAt + HULLS.trawler.reactionSeconds[1];
    let minimumClearance = Infinity;
    while (state.time < 179.99) {
      state = step(state, {}, 0.1);
      for (const rock of reefs) minimumClearance = Math.min(minimumClearance,
        Math.hypot(state.trawler.x - rock.x, -state.trawler.y - rock.y) - rock.radius);
    }
    assert.ok(minimumClearance > 0, `seed ${seed}: clearance ${minimumClearance}`);
    assert.equal(state.trawler.status, 'safe');
  }
});

test('broadcast and physics handle multiple ships independently; safe, distant, dark and wrecked ships', () => {
  let state = createState(120);
  const extra = (type, options) => ({ ...structuredClone(state.trawler),
    ...createVessel(type, options), afterimage: 0, lastSeen: null });
  const threatened = extra('coaster', { id: 'coaster', x: state.trawler.x, y: state.trawler.y, heading: state.trawler.heading });
  const safe = extra('lifeboat', { id: 'safe', x: -100, y: -150, heading: 180 });
  const far = extra('speedboat', { id: 'far', x: 0, y: -hornRange(state.fog) - 5, heading: 0 });
  const dark = extra('speedboat', { id: 'dark', x: 40, y: -100, heading: 0, smuggler: true });
  const wrecked = { ...extra('trawler', { id: 'wrecked', x: 0, y: 0, heading: 0 }), status: 'wrecked' };
  state.ships.push(threatened, safe, far, dark, wrecked);
  const prior = structuredClone(state);
  state.beam = 180;
  state = step(state, { horn: true, hold: true }, 0.1);
  assert.equal(state.trawler, state.ships[0], 'legacy handle aliases the fleet vessel');
  assert.deepEqual(state.ships.slice(0, 4).map((s) => s.lastHorn.response), ['turn-away', 'turn-away', 'hold', 'none']);
  assert.ok(['ignore', 'veer'].includes(state.ships[4].lastHorn.response));
  assert.equal(perception(state, state.ships[4]).runningLights, false);
  assert.equal(state.ships[5].warnedAt, null);
  state = step(state, {}, 10);
  assert.notEqual(state.ships[0].heading, prior.ships[0].heading);
  assert.notEqual(state.ships[1].heading, prior.ships[1].heading);
  assert.equal(state.ships[2].heading, prior.ships[2].heading);
  assert.equal(state.ships[3].heading, prior.ships[3].heading);
  assert.equal(state.ships[5].x, prior.ships[5].x);
  assert.equal(summary(state).wrecked, 1);
  assert.equal(prior.ships[0].warnedAt, null, 'prior fleet remains untouched');
});

test('dark launch captains deterministically ignore or veer toward water away from the light', () => {
  for (const [seed, expected] of [[0, 'veer'], [2, 'ignore']]) {
    let state = createState(seed);
    state.trawler.smuggler = true;
    const originalHeading = state.trawler.heading;
    state = step(state, { horn: true }, 0.1);
    assert.equal(state.trawler.lastHorn.response, expected);
    if (expected === 'veer') {
      const radial = bearingTo(state.trawler);
      const error = ((state.trawler.targetHeading - radial + 540) % 360) - 180;
      assert.ok(Math.abs(error) <= 30.01, 'escape course points away from the lighthouse');
      state = step(state, {}, 15);
      assert.notEqual(state.trawler.heading, originalHeading);
    } else {
      state = step(state, {}, 15);
      assert.equal(state.trawler.heading, originalHeading);
    }
  }
});
