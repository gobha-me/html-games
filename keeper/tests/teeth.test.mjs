import test from 'node:test';
import assert from 'node:assert/strict';
import { CLEAR_MARGIN, TEETH, createState, fogReach, planHazards, planSpawns,
  step, validateSchedule } from '../js/sim.js';

// Independent chart coordinates: never derive the expected landmark from the export.
const LANDMARK = [
  { kind: 'reef', x: 210, y: -255, radius: 24 },
  { kind: 'reef', x: 244, y: -238, radius: 18 },
  { kind: 'reef', x: 274, y: -219, radius: 14 },
];
const edgeSeeds = [...new Set([0, 1, 108, 0x55555555, 0xaaaaaaaa, 0xffffffff,
  ...Array.from({ length: 32 }, (_, bit) => [2 ** bit - 1, 2 ** bit, 2 ** bit + 1]).flat()])];

function checkChart(seed, night) {
  const hazards = planHazards(seed, { night }), label = `${seed}/${night}`;
  assert.deepEqual(hazards.slice(0, 3), LANDMARK, label);
  const seeded = hazards.slice(3);
  assert.ok(seeded.length >= 3 && seeded.length <= 7, label);
  assert.ok(seeded.filter((rock) => rock.radius <= 10).length >= 2, label);
  const quadrants = new Set();
  for (const rock of hazards) {
    assert.deepEqual(Object.keys(rock).sort(), ['kind', 'radius', 'x', 'y'], label);
    assert.ok(['reef', 'shoal', 'wreck'].includes(rock.kind), label);
    assert.ok([rock.x, rock.y, rock.radius].every(Number.isFinite), label);
    assert.ok(rock.radius >= 6 && rock.radius <= 34, label);
    const range = Math.hypot(rock.x, rock.y);
    assert.ok(range <= 430 && range - rock.radius >= 90, label);
    quadrants.add(`${rock.x >= 0}/${rock.y >= 0}`);
  }
  assert.ok(quadrants.size >= 3, label);
  for (const [index, rock] of seeded.entries()) {
    for (const tooth of LANDMARK) {
      assert.ok(Math.hypot(rock.x - tooth.x, rock.y - tooth.y)
        - rock.radius - tooth.radius >= CLEAR_MARGIN, `${label}: Teeth clearance`);
    }
    for (const other of seeded.slice(index + 1)) {
      assert.ok(Math.hypot(rock.x - other.x, rock.y - other.y)
        > rock.radius + other.radius, `${label}: seeded overlap`);
    }
  }
  return hazards;
}

test('TEETH is the deeply frozen three-disc landmark, excluding the isolated rock', () => {
  assert.deepEqual(TEETH, LANDMARK);
  assert.ok(Object.isFrozen(TEETH));
  for (const rock of TEETH) {
    assert.ok(Object.isFrozen(rock));
    for (const key of ['kind', 'x', 'y', 'radius']) {
      assert.throws(() => { rock[key] = null; }, TypeError);
    }
    assert.throws(() => { delete rock.x; }, TypeError);
  }
  assert.throws(() => { TEETH.push({ kind: 'reef', x: -125, y: -100, radius: 12 }); }, TypeError);
  assert.throws(() => { TEETH.reverse(); }, TypeError);
  assert.throws(() => { TEETH[0] = {}; }, TypeError);
  assert.deepEqual(TEETH, LANDMARK);
});

test('boundary seeds and scattered uint32 seeds preserve the landmark and every geometry bound on all nights', () => {
  const seeds = [...edgeSeeds,
    ...Array.from({ length: 2048 }, (_, index) => Math.imul(index, 2654435761) >>> 0)];
  const counts = new Set(), layouts = new Set();
  for (const seed of seeds) for (let night = 1; night <= 5; night++) {
    const hazards = checkChart(seed, night);
    counts.add(hazards.length);
    if (seed === 108) layouts.add(JSON.stringify(hazards.slice(3)));
  }
  assert.deepEqual([...counts].sort((a, b) => a - b), [6, 7, 8, 9, 10]);
  assert.equal(layouts.size, 5, 'the seeded remainder changes with the night');
});

test('cardinal phase boundaries retain three quadrants even with the smallest seeded counts', () => {
  // Invert two LCG draws to force exact/near-cardinal phases on every night.
  const previous = (bits) => Math.imul((bits - 1013904223) >>> 0, 4276115653) >>> 0;
  for (let night = 1; night <= 5; night++) {
    for (const bits of [0, 1, 0x3fffffff, 0x40000000, 0x40000001,
      0x7fffffff, 0x80000000, 0x80000001, 0xbfffffff, 0xc0000000, 0xc0000001, 0xffffffff]) {
      const seed = (previous(previous(bits)) ^ Math.imul(night, 0x9e3779b9)) >>> 0;
      checkChart(seed, night);
    }
  }
});

test('calls, states and interleaved seed/night plans share no mutable hazard objects', () => {
  for (const seed of edgeSeeds) {
    const expected = planHazards(seed), copy = planHazards(seed);
    const state = createState(seed);
    assert.deepEqual(state.hazards, expected);
    assert.deepEqual(state.hazards.slice(0, 3), LANDMARK);
    planHazards((seed ^ 0x7fffffff) >>> 0, { night: 5 });
    assert.deepEqual(planHazards(seed), expected);
    for (const [index, rock] of copy.entries()) {
      assert.notStrictEqual(rock, expected[index]);
      assert.notStrictEqual(state.hazards[index], expected[index]);
      if (index < 3) assert.notStrictEqual(rock, TEETH[index]);
      rock.x = 10000;
    }
    state.hazards[0].radius = 1;
    copy.reverse();
    assert.deepEqual(planHazards(seed), expected);
    assert.deepEqual(createState(seed).hazards, expected);
  }
  assert.deepEqual(planHazards(-0), planHazards(0));
  assert.deepEqual(planHazards(108, {}), planHazards(108, { night: undefined }));
});

test('bad seed/night values throw RangeError without numeric coercion', () => {
  const nonNumbers = [null, true, false, '1', 1n, Symbol('seed'), {}, [], Object(1)];
  for (const seed of [undefined, ...nonNumbers, -1, 0.5, Number.MIN_VALUE,
    0x100000000, Number.MAX_SAFE_INTEGER, NaN, Infinity, -Infinity]) {
    assert.throws(() => planHazards(seed), RangeError);
  }
  for (const night of [...nonNumbers, -1, -0, 0, 0.999999, 1.000001, 5.000001, 6,
    NaN, Infinity, -Infinity]) {
    for (const seed of [0, 0xffffffff]) assert.throws(() => planHazards(seed, { night }), RangeError);
  }
});

test('seeds 0..499 retain fair schedules for all five nights with the Teeth installed', () => {
  for (let seed = 0; seed < 500; seed++) {
    const state = createState(seed);
    assert.deepEqual(state.hazards.slice(0, 3), LANDMARK);
    assert.deepEqual(validateSchedule(state.schedule, state.nightParams), { ok: true, violations: [] });
    assert.ok(state.schedule[0].spawnRange <= state.nightParams.fogReach, `${seed}: visible opener`);
    for (let night = 1; night <= 5; night++) {
      const plan = planSpawns(seed, { night });
      assert.ok(plan.length > 0, `${seed}/${night}: nonempty schedule`);
      assert.deepEqual(validateSchedule(plan, { night, fogReach: fogReach(0.16), phase0: 285 }),
        { ok: true, violations: [] }, `${seed}/${night}`);
    }
  }
});

test('the live collision field uses the Teeth in south-positive canvas coordinates', () => {
  for (const tooth of LANDMARK) for (const mirror of [false, true]) {
    const state = createState(108);
    state.schedule = [];
    Object.assign(state.trawler, { x: tooth.x, y: mirror ? -tooth.y : tooth.y });
    const next = step(state, {}, 0.05);
    assert.equal(next.trawler.status, mirror ? 'underway' : 'wrecked');
    assert.equal(state.trawler.status, 'underway', 'the prior frame stays unchanged');
    assert.deepEqual(next.hazards.slice(0, 3), LANDMARK);
  }
});
