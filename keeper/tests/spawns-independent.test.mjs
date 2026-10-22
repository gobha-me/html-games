import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NIGHT_SECONDS,
  BUDGET_PERIOD_SECONDS,
  NIGHT_PASSES,
  SPAWN,
  planSpawns,
  planHazards,
  bearingTo,
  createState,
  step,
  validateSchedule,
} from '../js/sim.js';

const MAX_SEED = 2 ** 32 - 1;
const FOG_REACH = 464.8;
const GAP_EPS = 1e-6;
const BEARING_EPS = 1e-6;

const unwarned = () => ({});

function findShip(state, id) {
  assert.ok(Array.isArray(state.ships));
  return state.ships.find((ship) => ship.id === id);
}

function scheduleOpts(night) {
  return {
    night,
    fogReach: FOG_REACH,
    period: BUDGET_PERIOD_SECONDS,
    phase0: 0,
  };
}

/** Envelope of a linear ramp between the interval tunables, times jitter. */
function gapEnvelope() {
  const low = Math.min(SPAWN.intervalStart, SPAWN.intervalEnd);
  const high = Math.max(SPAWN.intervalStart, SPAWN.intervalEnd);
  return {
    min: low * (1 - SPAWN.jitter),
    max: 2 * high * (1 + SPAWN.jitter),
  };
}

function circularDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function overlaps(a, b) {
  return a.spawnTime <= b.exitTime && b.spawnTime <= a.exitTime;
}

function maxConcurrent(windows) {
  const events = [];
  for (const w of windows) {
    events.push([w.spawnTime, 1]);
    events.push([w.exitTime, -1]);
  }
  events.sort((p, q) => p[0] - q[0] || q[1] - p[1]);
  let cur = 0;
  let max = 0;
  for (const [, delta] of events) {
    cur += delta;
    if (cur > max) max = cur;
  }
  return max;
}

function assertEntry(entry, seen) {
  assert.equal(typeof entry.id, 'string');
  assert.match(entry.id, /^ship-[1-9]\d*$/);
  assert.equal(seen.has(entry.id), false);
  seen.add(entry.id);
  assert.ok(entry.type === 'trawler' || entry.type === 'coaster');
  for (const key of ['spawnTime', 'bearing', 'speed', 'responseSeconds', 'turnRadius', 'pnrRange', 'spawnRange', 'exitTime']) {
    assert.equal(typeof entry[key], 'number', key);
    assert.ok(Number.isFinite(entry[key]), key);
  }
  assert.equal(typeof entry.threatening, 'boolean');
  assert.ok(entry.spawnTime <= SPAWN.lastSpawn);
  assert.ok(entry.exitTime > entry.spawnTime);
}

function assertPlan(plan, trawler, seed, night) {
  const where = `seed ${seed} night ${night}`;
  assert.ok(Array.isArray(plan), where);
  const seen = new Set();
  for (const entry of plan) {
    assertEntry(entry, seen);
    assert.notEqual(entry.id, trawler.id, where);
  }
  if (plan.length > 0) {
    assert.ok(plan[0].spawnTime >= SPAWN.firstMin, where);
    assert.ok(plan[0].spawnTime <= SPAWN.firstMax, where);
  }
  const { min, max } = gapEnvelope();
  for (let i = 1; i < plan.length; i++) {
    const gap = plan[i].spawnTime - plan[i - 1].spawnTime;
    assert.ok(gap >= min - GAP_EPS, `${where} gap ${gap} < ${min}`);
    assert.ok(gap <= max + GAP_EPS, `${where} gap ${gap} > ${max}`);
  }
  const windows = [
    {
      id: trawler.id,
      bearing: trawler.bearing,
      spawnTime: trawler.spawnTime,
      exitTime: trawler.exitTime,
    },
    ...plan,
  ];
  assert.ok(maxConcurrent(windows) <= SPAWN.maxActive, where);
  for (let i = 0; i < windows.length; i++) {
    for (let j = i + 1; j < windows.length; j++) {
      if (!overlaps(windows[i], windows[j])) continue;
      const diff = circularDiff(windows[i].bearing, windows[j].bearing);
      assert.ok(diff >= SPAWN.minBearingGap - BEARING_EPS, `${where} bearings ${windows[i].id} ${windows[j].id} differ by ${diff}`);
    }
  }
  for (const entry of plan) {
    if (!entry.threatening) continue;
    const verdict = validateSchedule([entry], scheduleOpts(night));
    assert.equal(verdict.ok, true, `${where} ${entry.id}`);
  }
}

function assertTrawler(trawler) {
  assert.equal(trawler.id, 'trawler');
  assert.equal(trawler.spawnTime, 0);
  assert.equal(typeof trawler.exitTime, 'number');
  assert.ok(Number.isFinite(trawler.exitTime));
  assert.ok(trawler.exitTime > trawler.spawnTime);
  assert.equal(typeof trawler.bearing, 'number');
  assert.ok(Number.isFinite(trawler.bearing));
}

function checkSeed(seed) {
  const state = createState(seed);
  assert.ok(Array.isArray(state.schedule));
  assert.ok(Array.isArray(state.ships));
  const trawler = state.schedule[0];
  assertTrawler(trawler);
  const ids = state.schedule.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);

  for (let night = 1; night <= NIGHT_PASSES.length; night++) {
    const plan = planSpawns(seed, { night });
    assert.deepEqual(plan, planSpawns(seed, { night }));
    const hazards = planHazards(seed, { night });
    const outermost = hazards.reduce((a, b) => Math.hypot(a.x, a.y) + a.radius > Math.hypot(b.x, b.y) + b.radius ? a : b);
    const random = ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000;
    const nightOpener = { ...trawler, bearing: (bearingTo(outermost) + random - 0.5 + 360) % 360 };
    assertPlan(plan, nightOpener, seed, night);
    if (night !== 1) continue;
    assert.equal(state.schedule.length, plan.length + 1);
    assert.deepEqual(state.schedule.slice(1), plan);
    assert.deepEqual(plan, planSpawns(seed));
    assert.deepEqual(plan, planSpawns(seed, {}));
    assert.deepEqual(plan, planSpawns(seed, { night: undefined }));
    const verdict = validateSchedule(state.schedule, scheduleOpts(1));
    assert.equal(verdict.ok, true, `schedule seed ${seed}`);
    for (const entry of plan) {
      assert.equal(findShip(state, entry.id), undefined);
    }
  }
  return state;
}

test('exported night constants match the spec', () => {
  assert.equal(NIGHT_SECONDS, 180);
  assert.equal(BUDGET_PERIOD_SECONDS, 12);
  assert.deepEqual([...NIGHT_PASSES], [4, 4, 3, 3, 2]);
});

test('SPAWN is a frozen object of the stated tunables', () => {
  assert.equal(Object.isFrozen(SPAWN), true);
  assert.equal(SPAWN.firstMin, 24);
  assert.equal(SPAWN.firstMax, 36);
  assert.equal(SPAWN.intervalStart, 40);
  assert.equal(SPAWN.intervalEnd, 18);
  assert.equal(SPAWN.jitter, 0.25);
  assert.equal(SPAWN.maxActive, 3);
  assert.equal(SPAWN.lastSpawn, 120);
  assert.equal(SPAWN.minBearingGap, 20);
  assert.equal(SPAWN.threatShare, 0.6);
  assert.throws(() => {
    SPAWN.firstMin = 0;
  }, TypeError);
  assert.equal(SPAWN.firstMin, 24);
});

test('planSpawns and createState reject seeds outside the integer range', () => {
  const bad = [
    -1,
    -0.1,
    0.5,
    1.5,
    MAX_SEED + 1,
    MAX_SEED + 0.5,
    NaN,
    Infinity,
    -Infinity,
    Number.MIN_VALUE,
    null,
    true,
    false,
    '1',
    '0',
    '',
    1n,
    [],
    {},
  ];
  for (const seed of bad) {
    assert.throws(() => planSpawns(seed), RangeError, `planSpawns ${String(seed)}`);
    // Arbiter fix: createState has always thrown TypeError for bad seeds (pre-#109 contract); spec only fixed RangeError for planSpawns.
    assert.throws(() => createState(seed), TypeError, `createState ${String(seed)}`);
  }
  // seed is required on planSpawns; createState(seed=108) treats undefined as the default.
  assert.throws(() => planSpawns(), RangeError);
  assert.throws(() => planSpawns(undefined), RangeError);
  assert.deepEqual(createState(undefined), createState(108));
});

test('planSpawns rejects an invalid night', () => {
  const badNights = [0, -0, -1, 1.5, NIGHT_PASSES.length + 1, NaN, Infinity, -Infinity, null, '1', true, false, 1n];
  for (const night of badNights) {
    assert.throws(() => planSpawns(1, { night }), RangeError, `night ${String(night)}`);
  }
  assert.throws(() => planSpawns(-1, { night: 0 }), RangeError);
  assert.throws(() => planSpawns(NaN, { night: NaN }), RangeError);
});

test('edge seeds are accepted and deterministic, including -0', () => {
  for (const seed of [0, 1, 108, 2 ** 31 - 1, 2 ** 31, MAX_SEED]) {
    assert.deepEqual(planSpawns(seed), planSpawns(seed));
    assert.deepEqual(createState(seed), createState(seed));
  }
  assert.deepEqual(planSpawns(-0), planSpawns(0));
  assert.deepEqual(createState(-0), createState(0));
  assert.deepEqual(createState(), createState(108));
  assert.deepEqual(createState().schedule.slice(1), planSpawns(108));
});

test('planning is deterministic across intervening calls', () => {
  const a = planSpawns(4, { night: 2 });
  planSpawns(9, { night: NIGHT_PASSES.length });
  step(createState(4), unwarned(), 30);
  assert.deepEqual(planSpawns(4, { night: 2 }), a);
  assert.deepEqual(planSpawns(4), planSpawns(4, { night: 1 }));
});

test('many seeds honour spawn bounds, fairness, validation, and schedule wiring', () => {
  for (let seed = 0; seed < 200; seed++) checkSeed(seed);
  for (const seed of [2 ** 31 - 1, 2 ** 31, MAX_SEED, 999983]) checkSeed(seed);
});

test('a planned ship is underway at its spawnTime and absent earlier', () => {
  for (let seed = 0; seed < 200; seed++) {
    const plan = planSpawns(seed);
    const initial = createState(seed);
    const liveIds = initial.ships.map((ship) => ship.id);
    assert.equal(new Set(liveIds).size, liveIds.length);
    for (const entry of plan) {
      assert.equal(findShip(initial, entry.id), undefined, `seed ${seed} ${entry.id} present at start`);
      const before = entry.spawnTime - 1;
      assert.ok(before >= 0);
      const early = step(createState(seed), unwarned(), before);
      assert.equal(findShip(early, entry.id), undefined, `seed ${seed} ${entry.id} present at ${before}`);
      const at = step(createState(seed), unwarned(), entry.spawnTime);
      const ship = findShip(at, entry.id);
      assert.ok(ship, `seed ${seed} ${entry.id} missing at spawn`);
      assert.equal(ship.id, entry.id);
      assert.equal(ship.type, entry.type);
      assert.equal(ship.status, 'underway');
      assert.equal(typeof ship.x, 'number');
      assert.equal(typeof ship.y, 'number');
      assert.ok(Number.isFinite(ship.x) && Number.isFinite(ship.y));
      const ids = at.ships.map((item) => item.id);
      assert.equal(new Set(ids).size, ids.length);
      for (const other of plan) {
        if (other.spawnTime > entry.spawnTime) {
          assert.equal(findShip(at, other.id), undefined, `seed ${seed} ${other.id} early`);
        }
      }
    }
  }
});

test('unwarned non-threatening spawns never wreck', () => {
  for (let seed = 0; seed < 200; seed++) {
    const plan = planSpawns(seed);
    const calm = new Set(plan.filter((entry) => !entry.threatening).map((entry) => entry.id));
    const observe = (state, at) => {
      assert.ok(Array.isArray(state.ships));
      const ids = state.ships.map((ship) => ship.id);
      assert.equal(new Set(ids).size, ids.length, `seed ${seed} t ${at}`);
      let underway = 0;
      for (const ship of state.ships) {
        assert.ok(
          ship.status === 'underway' || ship.status === 'safe' || ship.status === 'wrecked',
          `seed ${seed} ${ship.id} status ${ship.status}`,
        );
        if (ship.status === 'underway') underway += 1;
        if (calm.has(ship.id)) {
          assert.notEqual(ship.status, 'wrecked', `seed ${seed} t ${at} ${ship.id}`);
        }
      }
      assert.ok(underway <= SPAWN.maxActive, `seed ${seed} t ${at} underway ${underway}`);
    };

    let state = createState(seed);
    let t = 0;
    while (t < NIGHT_SECONDS) {
      const dt = Math.min(BUDGET_PERIOD_SECONDS, NIGHT_SECONDS - t);
      state = step(state, unwarned(), dt);
      assert.ok(state && Array.isArray(state.ships));
      t += dt;
      observe(state, t);
    }
    observe(step(createState(seed), unwarned(), NIGHT_SECONDS), NIGHT_SECONDS);

    for (const entry of plan) {
      if (entry.threatening) continue;
      const mid = Math.min((entry.spawnTime + entry.exitTime) / 2, NIGHT_SECONDS);
      assert.ok(mid >= entry.spawnTime);
      observe(step(createState(seed), unwarned(), mid), mid);
    }
  }
});

test('step of one full night is deterministic', () => {
  for (const seed of [0, 1, 108, 199, MAX_SEED]) {
    const a = step(createState(seed), unwarned(), NIGHT_SECONDS);
    const b = step(createState(seed), unwarned(), NIGHT_SECONDS);
    assert.deepEqual(a, b);
    assert.ok(Array.isArray(a.ships));
  }
});
