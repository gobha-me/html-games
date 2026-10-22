import test from 'node:test';
import assert from 'node:assert/strict';
import { SPAWN, NIGHT_SECONDS, NIGHT_PASSES, BUDGET_PERIOD_SECONDS, ROCKS,
  planSpawns, createState, step, validateSchedule, summary } from '../js/sim.js';
import { PHYSICS_DT, HULLS, createVessel, threatensReef, pointOfNoReturn, stepVessel } from '../js/physics.js';

const seeds = [...new Set([0, 1, 108, 0xffffffff,
  ...Array.from({ length: 500 }, (_, i) => Math.imul(i, 2654435761) >>> 0)])].slice(0, 500);
const reefs = ROCKS.map((rock) => ({ ...rock, y: -rock.y, radius: rock.radius + 8 }));
const reach = 464.8;
const close = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
let samples;
const watches = () => samples ??= seeds.map((seed) => createState(seed));
const overlap = (a, b) => a.spawnTime <= b.exitTime && b.spawnTime <= a.exitTime;
const gap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
function vessel(entry) {
  const angle = entry.bearing * Math.PI / 180;
  return createVessel(entry.type, { id: entry.id, x: Math.sin(angle) * entry.spawnRange,
    y: Math.cos(angle) * entry.spawnRange, heading: entry.bearing + (entry.threatening ? 180 : 0), speed: entry.speed });
}

test('SPAWN exposes exactly the frozen pacing contract', () => {
  assert.ok(Object.isFrozen(SPAWN));
  assert.deepEqual(SPAWN, { firstMin: 24, firstMax: 36, intervalStart: 40, intervalEnd: 18,
    jitter: 0.25, maxActive: 3, lastSpawn: 120, minBearingGap: 20, threatShare: 0.6 });
  assert.throws(() => { SPAWN.maxActive = 99; }, TypeError);
});

test('every accepted spawn across 500 seeds has bounded timing, complete fields and unique ordered ids', () => {
  let extras = 0;
  for (const state of watches()) {
    const schedule = state.schedule.slice(1);
    assert.ok(schedule.length > 0, `seed ${state.seed}: missing first extra`);
    assert.ok(schedule[0].spawnTime >= SPAWN.firstMin && schedule[0].spawnTime <= SPAWN.firstMax);
    assert.deepEqual(schedule.map((ship) => ship.id), schedule.map((_, i) => `ship-${i + 1}`));
    assert.equal(new Set(state.schedule.map((ship) => ship.id)).size, state.schedule.length);
    for (const [index, ship] of schedule.entries()) {
      extras++;
      assert.ok(['trawler', 'coaster'].includes(ship.type));
      assert.equal(typeof ship.threatening, 'boolean');
      for (const key of ['spawnTime', 'bearing', 'speed', 'responseSeconds', 'turnRadius', 'pnrRange', 'spawnRange', 'exitTime']) {
        assert.ok(Number.isFinite(ship[key]), `${state.seed}/${ship.id}: ${key}`);
      }
      assert.ok(ship.spawnTime <= SPAWN.lastSpawn && ship.exitTime > ship.spawnTime);
      assert.ok(ship.bearing >= 0 && ship.bearing < 360 && ship.speed > 0);
      if (index > 0) {
        const previous = schedule[index - 1];
        const base = SPAWN.intervalStart + (SPAWN.intervalEnd - SPAWN.intervalStart) * previous.spawnTime / NIGHT_SECONDS;
        const elapsed = ship.spawnTime - previous.spawnTime;
        assert.ok(elapsed >= base * (1 - SPAWN.jitter) && elapsed <= base * (1 + SPAWN.jitter), `${state.seed}: gap ${elapsed}`);
      }
    }
  }
  assert.ok(extras >= 1000, 'exercise multiple arrivals per watch');
  assert.ok(watches().some((state) => state.schedule.length > SPAWN.maxActive), 'exercise reused capacity');
});

test('every spawn across 500 seeds independently gets its full worst-fog budget, including arbitrary beam phases', () => {
  for (const state of watches()) {
    assert.deepEqual(validateSchedule(state.schedule, state.nightParams), { ok: true, violations: [] });
    for (const ship of state.schedule) {
      const firstVisible = ship.spawnTime + Math.max(0, ship.spawnRange - reach) / ship.speed;
      const pnr = ship.spawnTime + (ship.spawnRange - ship.pnrRange - ship.turnRadius) / ship.speed - ship.responseSeconds;
      assert.ok(pnr > firstVisible, `${state.seed}/${ship.id}: already doomed`);
      for (const phase of [0, 17, 180, 285, ship.bearing + 0.000001]) {
        // Enumerate crossings independently of passesBetween / validateSchedule.
        const offset = ((ship.bearing - phase) % 360 + 360) % 360 / 360;
        let count = 0;
        for (let cycle = 0; cycle < 100; cycle++) {
          const crossing = (cycle + offset) * BUDGET_PERIOD_SECONDS;
          if (crossing > firstVisible && crossing <= pnr) count++;
        }
        assert.ok(count >= NIGHT_PASSES[0], `${state.seed}/${ship.id}: only ${count} passes at ${phase}`);
      }
    }
  }
});

test('every night preserves fair physical PONR for both hulls rather than merely declaring a later deadline', () => {
  const types = new Set();
  for (let night = 1; night <= NIGHT_PASSES.length; night++) for (const seed of seeds.slice(0, 24)) {
    const schedule = planSpawns(seed, { night });
    assert.ok(schedule.length > 0);
    assert.ok(validateSchedule(schedule, { night, fogReach: reach }).ok);
    for (const ship of schedule.filter((entry) => entry.threatening)) {
      types.add(ship.type);
      const pose = vessel(ship);
      assert.ok(threatensReef(pose, reefs, Number.MAX_VALUE));
      const lead = pointOfNoReturn(pose, reefs);
      close(ship.responseSeconds + ship.turnRadius / ship.speed, lead);
      assert.ok(ship.spawnRange <= reach);
      assert.ok((ship.spawnRange - ship.pnrRange) / ship.speed - lead >= NIGHT_PASSES[night - 1] * BUDGET_PERIOD_SECONDS);
    }
  }
  assert.deepEqual([...types].sort(), ['coaster', 'trawler']);
});

test('inclusive active windows never exceed the cap and every overlapping bearing respects the circular gap', () => {
  let wraps = 0, full = 0;
  for (const { schedule, seed } of watches()) {
    assert.equal(schedule[0].spawnTime, 0);
    assert.ok(schedule[0].exitTime > 0);
    // The active set changes only at endpoints; count BOTH ends inclusively.
    for (const time of schedule.flatMap((ship) => [ship.spawnTime, ship.exitTime])) {
      const active = schedule.filter((ship) => ship.spawnTime <= time && time <= ship.exitTime);
      assert.ok(active.length <= SPAWN.maxActive, `${seed}: ${active.length} active at ${time}`);
      if (active.length === SPAWN.maxActive) full++;
    }
    for (let i = 0; i < schedule.length; i++) for (let j = i + 1; j < schedule.length; j++) {
      if (!overlap(schedule[i], schedule[j])) continue;
      const a = schedule[i].bearing, b = schedule[j].bearing;
      if (Math.abs(a - b) > 180) wraps++;
      assert.ok(gap(a, b) >= SPAWN.minBearingGap, `${seed}: overlapping bearings ${a}, ${b}`);
    }
  }
  assert.ok(full > 0 && wraps > 0, 'exercise full capacity and north-wrap separation');
});

test('planning and input replay are deterministic, isolated from caller mutations and interleaved seeds', () => {
  assert.deepEqual(planSpawns(108), planSpawns(108, { night: 1 }));
  assert.notDeepEqual(planSpawns(0), planSpawns(0xffffffff));
  for (const seed of seeds.slice(0, 24)) {
    const original = planSpawns(seed), copy = structuredClone(original);
    planSpawns((seed + 1) >>> 0, { night: 5 });
    assert.deepEqual(planSpawns(seed), copy);
    original[0].spawnTime = -1;
    assert.deepEqual(planSpawns(seed), copy);
    const replay = () => {
      let state = createState(seed);
      for (let i = 0; i < 6; i++) state = step(state, { horn: i % 2 === 0, fast: i === 2, hold: i === 3 }, 30);
      return state;
    };
    assert.deepEqual(replay(), replay());
  }
});

test('ships first appear underway at their scheduled tick, never earlier, and are not duplicated', () => {
  for (const seed of seeds.slice(0, 16)) {
    let state = createState(seed);
    assert.deepEqual(state.ships.map((ship) => ship.id), ['trawler']);
    assert.deepEqual(state.schedule.slice(1), planSpawns(seed));
    for (const entry of state.schedule.slice(1)) {
      state = step(state, {}, entry.spawnTime - state.time - 0.00001);
      const before = structuredClone(state);
      assert.ok(state.time < entry.spawnTime);
      assert.equal(state.ships.some((ship) => ship.id === entry.id), false);
      assert.deepEqual(step(state, {}, 0), state);
      state = step(state, {}, 0.00002);
      const ship = state.ships.find((candidate) => candidate.id === entry.id);
      assert.ok(state.time >= entry.spawnTime);
      assert.ok(ship, `${seed}/${entry.id}: missed arrival`);
      assert.equal(ship.status, 'underway');
      const expectedRange = entry.spawnRange + (entry.threatening ? -1 : 1) * entry.speed * (state.time - entry.spawnTime);
      close(Math.hypot(ship.x, ship.y), expectedRange);
      assert.equal(before.ships.some((candidate) => candidate.id === entry.id), false, 'previous fleet remains untouched');
      state = step(state, {}, PHYSICS_DT);
      assert.equal(state.ships.filter((candidate) => candidate.id === entry.id).length, 1);
      assert.equal(state.trawler, state.ships[0]);
    }
    const dawn = step(state, {}, NIGHT_SECONDS - state.time);
    assert.deepEqual(dawn.ships.map((ship) => ship.id), state.schedule.map((ship) => ship.id));
  }
});

test('long frame hitches include every arrival and match fine-step poses without retroactive travel', () => {
  const initial = createState(3668339987), prior = structuredClone(initial);
  const hitch = step(initial, {}, NIGHT_SECONDS);
  let fine = initial;
  for (let second = 0; second < NIGHT_SECONDS; second++) fine = step(fine, {}, 1);
  assert.deepEqual(initial, prior);
  assert.deepEqual(hitch.ships.map((ship) => [ship.id, ship.status]), fine.ships.map((ship) => [ship.id, ship.status]));
  assert.ok(hitch.ships.length > SPAWN.maxActive);
  for (const [i, ship] of hitch.ships.entries()) {
    close(ship.x, fine.ships[i].x);
    close(ship.y, fine.ships[i].y);
  }
  assert.deepEqual(summary(hitch), { safe: hitch.ships.filter((ship) => ship.everSeen && ship.status === 'safe').length,
    wrecked: hitch.ships.filter((ship) => ship.everSeen && ship.status === 'wrecked').length,
    unseen: hitch.ships.filter((ship) => !ship.everSeen).length });
});

test('non-threatening spawns across all 500 seeds are on permanently reef-clear courses, even beyond dawn', () => {
  let checked = 0;
  for (const state of watches()) for (const ship of state.schedule.filter((entry) => entry.threatening === false)) {
    const pose = vessel(ship);
    assert.equal(threatensReef(pose, reefs, Number.MAX_VALUE), false, `${state.seed}/${ship.id}`);
    const future = stepVessel(pose, {}, 2 * NIGHT_SECONDS);
    assert.equal(threatensReef(future, reefs, Number.MAX_VALUE), false);
    assert.ok(Math.hypot(future.x, future.y) > Math.hypot(pose.x, pose.y));
    checked++;
  }
  assert.ok(checked > 100);
  for (const seed of seeds.slice(0, 16)) {
    const dawn = step(createState(seed), {}, NIGHT_SECONDS);
    for (const ship of dawn.ships.filter((entry) => entry.threatening === false)) {
      assert.notEqual(ship.status, 'wrecked');
      assert.equal(ship.wreckedAt, null);
      assert.equal(ship.warnedAt, null);
    }
  }
});

test('held horn never retroactively warns an arrival; a new press warns and rescues it with the shared physics', () => {
  let state = step(createState(108), { horn: true }, 30);
  const ship = state.ships.find((entry) => entry.id === 'ship-1');
  assert.equal(ship.threatening, true);
  assert.equal(ship.warnedAt, null);
  assert.equal(ship.lastHorn, undefined);
  state = step(state, {}, PHYSICS_DT);
  const heading = state.ships[1].heading;
  state = step(state, { horn: true }, PHYSICS_DT);
  assert.equal(state.ships[1].lastHorn.response, 'turn-away');
  assert.equal(state.ships[1].warnedAt, state.time);
  assert.equal(state.ships[1].heading, heading, 'crew delay precedes the turn');
  assert.ok(state.ships[1].reactAt > state.time);
  const dawn = step(state, {}, NIGHT_SECONDS - state.time);
  assert.equal(dawn.ships[1].status, 'safe');
  assert.equal(dawn.ships[1].wreckedAt, null);
});

test('live underway cap holds with and without repeated rescue attempts', () => {
  for (const seed of seeds.slice(0, 12)) for (const rescue of [false, true]) {
    let state = createState(seed);
    for (let second = 0; second < NIGHT_SECONDS; second++) {
      state = step(state, { horn: rescue && second % 16 === 0 }, 1);
      assert.ok(state.ships.filter((ship) => ship.status === 'underway').length <= SPAWN.maxActive);
    }
  }
});

test('the opening trawler retains its original physical approach and unwarned collision time', () => {
  const { trawler } = createState(108);
  close(trawler.x, 292.765443702302);
  close(trawler.y, -358.3221111447294);
  close(trawler.heading, 219.25038348331805);
  close(trawler.spawnRange, 462.71626334225766);
  assert.equal(trawler.speed, HULLS.trawler.cruiseSpeed);
  const dawn = step(createState(108), {}, NIGHT_SECONDS);
  close(dawn.trawler.wreckedAt, 91.28333333332942);
  assert.equal(dawn.trawler.status, 'wrecked');
});

test('planner rejects invalid uint32 seeds and nights rather than coercing or weakening fairness', () => {
  for (const seed of [undefined, null, false, true, '', '108', -1, 1.5, 0x100000000,
    NaN, Infinity, -Infinity, {}, [], 1n, Symbol('seed')]) assert.throws(() => planSpawns(seed), RangeError);
  for (const night of [0, 6, -1, 1.5, null, false, '1', NaN, Infinity, {}, [], 1n]) {
    assert.throws(() => planSpawns(108, { night }), RangeError);
  }
  for (const seed of [0, 0xffffffff]) assert.ok(planSpawns(seed).length > 0);
});
