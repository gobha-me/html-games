import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLEAR_MARGIN,
  NIGHT_SECONDS,
  SPAWN,
  TEETH,
  createState,
  isLit,
  perception,
  planHazards,
  planSpawns,
  step,
  summary,
  validateSchedule,
} from '../js/sim.js';

const KINDS = new Set(['reef', 'shoal', 'wreck']);
const QUIET = { slow: false, fast: false, hold: false, horn: false };
const HORN = { slow: false, fast: false, hold: false, horn: true };
const MS = 0.001;

function advance(state, input, seconds) {
  const result = step(state, { ...input }, seconds);
  if (result && typeof result === 'object' && Array.isArray(result.ships)) return result;
  return state;
}

function shipLabel(spawn) {
  return [spawn.type, spawn.shipType, spawn.kind, spawn.role, spawn.name, spawn.class]
    .filter((part) => (part ?? null) !== null)
    .join(' ')
    .toLowerCase();
}

function isTrawler(spawn) {
  if (spawn.trawler === true || spawn.isTrawler === true) return true;
  return shipLabel(spawn).includes('trawler');
}

function looksLikeSpawn(node) {
  if (typeof node.spawnTime !== 'number' || !Number.isFinite(node.spawnTime)) return false;
  return ['type', 'shipType', 'kind', 'role', 'name', 'class', 'heading', 'x', 'trawler', 'isTrawler']
    .some((key) => (node[key] ?? null) !== null);
}

function collectSpawns(root) {
  const timed = [];
  const seen = new WeakSet();
  const walk = (node, depth) => {
    if ((node === null || node === undefined) || typeof node !== 'object' || depth > 8 || seen.has(node)) return;
    seen.add(node);
    if (typeof node.spawnTime === 'number' && Number.isFinite(node.spawnTime)) timed.push(node);
    const kids = Array.isArray(node) ? node : Object.values(node);
    for (const kid of kids) walk(kid, depth + 1);
  };
  walk(root, 0);
  const marked = timed.filter(looksLikeSpawn);
  return marked.length >= 2 ? marked : timed;
}

function assertHazards(hazards, label) {
  assert.ok(Array.isArray(hazards), label);
  assert.ok(hazards.length >= 6 && hazards.length <= 10, `${label} count ${hazards.length}`);
  assert.deepEqual(hazards.slice(0, TEETH.length), TEETH, label);
  let small = 0;
  const quadrants = new Set();
  for (const hazard of hazards) {
    assert.ok(KINDS.has(hazard.kind), `${label} kind ${hazard.kind}`);
    assert.ok(Number.isFinite(hazard.x) && Number.isFinite(hazard.y), label);
    assert.ok(Number.isFinite(hazard.radius), `${label} radius`);
    assert.ok(hazard.radius >= 6 - 1e-9 && hazard.radius <= 34 + 1e-9, `${label} r ${hazard.radius}`);
    if (hazard.radius <= 10) small += 1;
    const centre = Math.hypot(hazard.x, hazard.y);
    assert.ok(centre <= 430 + 1e-6, `${label} centre ${centre}`);
    assert.ok(centre - hazard.radius >= 90 - 1e-6, `${label} edge ${centre - hazard.radius}`);
    const sx = Math.sign(hazard.x);
    const sy = Math.sign(hazard.y);
    if (sx !== 0 && sy !== 0) quadrants.add(`${sx},${sy}`);
  }
  assert.ok(small >= 2, `${label} small ${small}`);
  assert.ok(quadrants.size >= 3, `${label} quadrants ${[...quadrants].join(' ')}`);
  for (let i = 0; i < hazards.length; i += 1) {
    for (let j = i + 1; j < hazards.length; j += 1) {
      if (j < TEETH.length) continue; // The fixed reef band intentionally overlaps.
      const a = hazards[i];
      const b = hazards[j];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const margin = i < TEETH.length ? CLEAR_MARGIN : 0;
      assert.ok(dist + 1e-6 >= a.radius + b.radius + margin, `${label} overlap ${dist}`);
    }
  }
}

function assertGaps(seed, night = 1) {
  const maxGap = 2 * SPAWN.intervalStart * (1 + SPAWN.jitter);
  const spawns = collectSpawns(planSpawns(seed, { night }));
  assert.ok(spawns.length >= 2, `seed ${seed} spawn count ${spawns.length}`);
  const times = spawns.map((spawn) => spawn.spawnTime).sort((a, b) => a - b);
  for (const time of times) assert.ok(Number.isFinite(time), `seed ${seed} spawnTime`);
  for (let i = 1; i < times.length; i += 1) {
    const gap = times[i] - times[i - 1];
    assert.ok(gap <= maxGap + 1e-6, `seed ${seed} gap ${gap}`);
  }
  assert.ok(times.some((time) => time > 80), `seed ${seed} spawnTime > 80`);
  const trawlerTimes = spawns.filter(isTrawler).map((spawn) => spawn.spawnTime);
  const extraTimes = spawns.filter((spawn) => !isTrawler(spawn)).map((spawn) => spawn.spawnTime);
  const firstTrawler = trawlerTimes.length ? Math.min(...trawlerTimes) : times[0];
  const firstExtra = extraTimes.length ? Math.min(...extraTimes) : times[1];
  assert.ok(Math.abs(firstExtra - firstTrawler) <= maxGap + 1e-6, `seed ${seed} trawler-extra`);
}

function expectedSummary(state) {
  const tally = { safe: 0, wrecked: 0, unseen: 0 };
  for (const ship of state.ships) {
    if (!ship.everSeen) tally.unseen += 1;
    else if (ship.status === 'safe') tally.safe += 1;
    else if (ship.status === 'wrecked') tally.wrecked += 1;
  }
  return tally;
}

function ship(partial) {
  return {
    id: 1,
    type: 'trawler',
    status: 'underway',
    x: 10,
    y: 20,
    heading: 0,
    everSeen: false,
    destination: { x: 0, y: 900 },
    ...partial,
  };
}

function observe(state, memory, afterTick) {
  assert.deepEqual(summary(state), expectedSummary(state));
  for (const vessel of state.ships) {
    assert.ok((vessel.id ?? null) !== null);
    assert.equal(typeof vessel.type, 'string');
    assert.ok(vessel.status === 'underway' || vessel.status === 'safe' || vessel.status === 'wrecked');
    assert.ok(Number.isFinite(vessel.x) && Number.isFinite(vessel.y) && Number.isFinite(vessel.heading));
    assert.equal(typeof vessel.everSeen, 'boolean');
    const dest = Math.hypot(vessel.destination.x, vessel.destination.y);
    assert.ok(dest > 600, `destination ${dest}`);
    const here = Math.hypot(vessel.x, vessel.y);
    const prior = memory.dist.get(vessel.id);
    if (prior !== undefined && prior <= 600 && here > 600) assert.equal(vessel.status, 'safe');
    if (vessel.status === 'safe') assert.ok(here > 600, `safe at ${here}`);
    if (memory.seen.get(vessel.id) === true) assert.equal(vessel.everSeen, true);
    if (vessel.everSeen) memory.seen.set(vessel.id, true);
    memory.dist.set(vessel.id, here);
    const view = perception(state, vessel);
    assert.equal(typeof view.lit, 'boolean');
    assert.equal(typeof view.runningLights, 'boolean');
    assert.equal(typeof isLit(state, vessel), 'boolean');
    if (afterTick && (isLit(state, vessel) || view.runningLights)) assert.equal(vessel.everSeen, true);
    memory.ships += 1;
  }
}

test('constants match the dawn, clearance, and spawn bounds', () => {
  assert.equal(CLEAR_MARGIN, 20);
  assert.equal(NIGHT_SECONDS, 180);
  const maxGap = 2 * SPAWN.intervalStart * (1 + SPAWN.jitter);
  assert.ok(Math.abs(maxGap - 100) < 1e-9, `max gap ${maxGap}`);
  assert.ok(Number.isFinite(SPAWN.lastSpawn) && SPAWN.lastSpawn > 80);
});

test('planHazards defaults, edges, determinism, and createState night 1', () => {
  const edges = [0, 1, 108, 2 ** 31, 2 ** 32 - 1];
  for (const seed of edges) {
    const omitted = planHazards(seed);
    const empty = planHazards(seed, {});
    const night1 = planHazards(seed, { night: 1 });
    const night1Float = planHazards(seed, { night: 1.0 });
    const undef = planHazards(seed, { night: undefined });
    assert.deepEqual(omitted, night1);
    assert.deepEqual(empty, night1);
    assert.deepEqual(night1Float, night1);
    assert.deepEqual(undef, night1);
    assert.deepEqual(planHazards(seed, { night: 2, extra: true }), planHazards(seed, { night: 2 }));
    for (const night of [1, 2, 3, 4, 5]) {
      const first = planHazards(seed, { night });
      assert.deepEqual(first, planHazards(seed, { night }));
      assertHazards(first, `${seed} night ${night}`);
    }
    assert.deepEqual(createState(seed).hazards, night1);
  }
  assert.deepEqual(createState().hazards, planHazards(108, { night: 1 }));
  assert.deepEqual(createState(undefined).hazards, createState(108).hazards);
  assert.deepEqual(planHazards(-0), planHazards(0));
  const snap = structuredClone(planHazards(123, { night: 4 }));
  const mutable = planHazards(123, { night: 4 });
  try {
    mutable[0].x = 123456.25;
    mutable.push({ kind: 'reef', x: 1, y: 1, radius: 6 });
  } catch {
    // A frozen result cannot alias the next call.
  }
  assert.deepEqual(planHazards(123, { night: 4 }), snap);
  const state = createState(123);
  const wired = structuredClone(planHazards(123, { night: 1 }));
  assert.deepEqual(state.hazards, wired);
  try {
    state.hazards[0].radius = 1;
  } catch {
    // Frozen hazards stay private to this state.
  }
  assert.deepEqual(createState(123).hazards, wired);
});

test('invalid seed and night throw the named errors', () => {
  const badSeeds = [-1, -(2 ** 32), 2 ** 32, 2 ** 32 + 1, 1.5, -0.1, NaN, Infinity, -Infinity, null, '1', true, false, {}, []];
  for (const seed of badSeeds) {
    assert.throws(() => planHazards(seed, { night: 1 }), RangeError, `planHazards seed ${seed}`);
    assert.throws(() => createState(seed), TypeError, `createState seed ${seed}`);
  }
  assert.throws(() => planHazards(undefined), RangeError);
  const badNights = [0, 6, -1, 1.5, 0.999, 5.0001, 5.5, NaN, Infinity, -Infinity, null, '1', true, false, -0];
  for (const night of badNights) {
    assert.throws(() => planHazards(1, { night }), RangeError, `night ${String(night)}`);
    assert.throws(() => planHazards(0, { night }), RangeError);
    assert.throws(() => planHazards(2 ** 32 - 1, { night }), RangeError);
  }
  assert.throws(() => planHazards(-1, { night: 0 }), RangeError);
  assert.throws(() => planHazards(1.5, { night: 9 }), RangeError);
});

test('every seed 0..499 keeps hazard layout, fair schedule, and a late spawn', () => {
  const layouts = new Set();
  let nightMoved = false;
  for (let seed = 0; seed <= 499; seed += 1) {
    const night1 = planHazards(seed, { night: 1 });
    assert.deepEqual(night1, planHazards(seed, { night: 1 }));
    assertHazards(night1, `seed ${seed}`);
    layouts.add(JSON.stringify(night1));
    const state = createState(seed);
    assert.deepEqual(state.hazards, night1);
    assert.ok((state.schedule ?? null) !== null, `seed ${seed} schedule`);
    assert.deepEqual(planSpawns(seed, { night: 1 }), planSpawns(seed, { night: 1 }));
    assertGaps(seed, 1);
    // Arbiter fix: validateSchedule requires its night options (state.nightParams) and returns {ok}.
    assert.ok(validateSchedule(state.schedule, state.nightParams).ok, `seed ${seed} schedule`);
    if (seed % 37 === 0) {
      for (const night of [2, 3, 4, 5]) {
        const other = planHazards(seed, { night });
        assert.deepEqual(other, planHazards(seed, { night }));
        assertHazards(other, `seed ${seed} night ${night}`);
        if (JSON.stringify(other) !== JSON.stringify(night1)) {
          nightMoved = true;
          assert.notDeepEqual(state.hazards, other);
        }
      }
    }
  }
  assert.ok(layouts.size >= 400, `unique layouts ${layouts.size}`);
  assert.equal(nightMoved, true);
});

test('summary counts only seen saves and wrecks; unseen is any status', () => {
  const state = createState(108);
  state.ships = [
    ship({ id: 1, status: 'safe', everSeen: false, x: 0, y: 800 }),
    ship({ id: 2, status: 'safe', everSeen: true, x: 0, y: 0 }),
    ship({ id: 3, status: 'wrecked', everSeen: false }),
    ship({ id: 4, status: 'wrecked', everSeen: true }),
    ship({ id: 5, status: 'underway', everSeen: false }),
    ship({ id: 6, status: 'underway', everSeen: true }),
  ];
  assert.deepEqual(summary(state), { safe: 1, wrecked: 1, unseen: 3 });
  state.ships[0].everSeen = true;
  assert.deepEqual(summary(state), { safe: 2, wrecked: 1, unseen: 2 });
  state.ships[1].status = 'wrecked';
  assert.deepEqual(summary(state), { safe: 1, wrecked: 2, unseen: 2 });
  state.ships = Array.from({ length: 4 }, (_, id) => ship({ id, status: 'safe', everSeen: false, x: 700, y: 1 }));
  assert.deepEqual(summary(state), { safe: 0, wrecked: 0, unseen: 4 });
  state.ships = [ship({ status: 'wrecked', everSeen: false })];
  assert.deepEqual(summary(state), { safe: 0, wrecked: 0, unseen: 1 });
  state.ships = [];
  assert.deepEqual(summary(state), { safe: 0, wrecked: 0, unseen: 0 });
  const fresh = createState(108);
  const before = structuredClone(fresh.ships);
  summary(fresh);
  assert.deepEqual(fresh.ships, before);
});

test('step stays deterministic at 1 ms and at the 180 s edge', () => {
  for (const seconds of [MS, 1]) {
    assert.deepEqual(
      advance(createState(21), HORN, seconds),
      advance(createState(21), HORN, seconds),
    );
  }
  const under = advance(createState(21), QUIET, 180 - MS);
  assert.deepEqual(summary(under), expectedSummary(under));
  assert.deepEqual(
    advance(createState(21), HORN, 180),
    advance(createState(21), HORN, 180),
  );
  assert.throws(() => step(createState(4), { ...QUIET }, 180 + MS));
  const inputs = [
    { slow: true, fast: false, hold: false, horn: false },
    { slow: false, fast: true, hold: false, horn: false },
    { slow: false, fast: false, hold: true, horn: false },
    { slow: true, fast: true, hold: true, horn: true },
    QUIET,
  ];
  for (const input of inputs) {
    assert.deepEqual(
      advance(createState(11), input, 5),
      advance(createState(11), input, 5),
    );
  }
});

test('ships keep destination, everSeen, and the outward safe line', () => {
  for (const seed of [0, 108]) {
    for (const input of [QUIET, HORN]) {
      let state = createState(seed);
      for (const vessel of state.ships) assert.equal(vessel.everSeen, false);
      const memory = { seen: new Map(), dist: new Map(), ships: 0 };
      observe(state, memory, false);
      for (let i = 0; i < 6; i += 1) {
        state = advance(state, input, 30);
        observe(state, memory, true);
      }
      assert.ok(memory.ships > 0, `seed ${seed} produced no ships`);
      assert.deepEqual(state.hazards, planHazards(seed, { night: 1 }));
    }
  }
});

test('everSeen sticks after a ship is no longer in the light', () => {
  let state = createState(108);
  for (let t = 0; t < NIGHT_SECONDS && state.ships.length === 0; t += 15) state = advance(state, QUIET, 15);
  assert.ok(state.ships.length > 0);
  const id = state.ships[0].id;
  state.ships[0].everSeen = true;
  state.ships[0].x = 2500;
  state.ships[0].y = -2500;
  state = advance(state, QUIET, 0.5);
  const found = state.ships.find((vessel) => vessel.id === id);
  assert.ok(found);
  assert.equal(found.everSeen, true);
  assert.deepEqual(summary(state), expectedSummary(state));
});
