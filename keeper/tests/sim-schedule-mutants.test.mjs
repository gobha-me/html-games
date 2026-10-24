import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, step, planSpawns, planHazards, passesBetween, validateSchedule,
  spawnRangeFor, wrapBearing, clampSpeed, fogReach,
} from '../js/sim.js';
import { PHYSICS_DT } from '../js/physics.js';

const params = { night: 1, fogReach: 1000 };
const approach = { id: 'test', spawnTime: 0, bearing: 0, speed: 1,
  responseSeconds: 0, turnRadius: 0, pnrRange: 0, spawnRange: 60 };

test('seed, night, period and schedule validation retain their specific diagnostics', () => {
  for (const seed of [-1, 1.5, 0x100000000, NaN, null]) {
    assert.throws(() => planHazards(seed), { name: 'RangeError', message: 'Seed must be a uint32' });
    assert.throws(() => planSpawns(seed), { name: 'RangeError', message: 'Seed must be a uint32' });
    assert.throws(() => createState(seed), { name: 'TypeError', message: 'Seed must be a uint32' });
  }
  for (const night of [0, 6, 1.5, NaN]) {
    assert.throws(() => planHazards(108, { night }), { name: 'RangeError', message: 'Invalid night' });
    assert.throws(() => validateSchedule([], { ...params, night }), { name: 'RangeError', message: 'Invalid night' });
  }
  for (const period of [0, -1, Infinity]) {
    assert.throws(() => passesBetween({ bearing: 0, tStart: 0, tEnd: 1, period }), {
      name: 'RangeError', message: 'Period must be finite and positive',
    });
  }
  assert.throws(() => passesBetween({ bearing: 0, tStart: 2, tEnd: 1 }), {
    name: 'RangeError', message: 'Sweep window and bearings must be finite and ordered',
  });
  assert.throws(() => spawnRangeFor({ ...approach, passes: 0 }), {
    name: 'RangeError', message: 'Invalid radial approach budget',
  });
  assert.throws(() => validateSchedule([], { ...params, fogReach: 0 }), {
    name: 'RangeError', message: 'Invalid night visibility',
  });
  assert.throws(() => validateSchedule({}, params), { name: 'TypeError', message: 'Schedule must be an array' });
  assert.throws(() => wrapBearing(NaN), { name: 'TypeError', message: 'Bearing must be finite' });
  assert.throws(() => clampSpeed(NaN), { name: 'TypeError', message: 'Speed must be finite' });
  assert.throws(() => fogReach(NaN), { name: 'TypeError', message: 'Fog must be finite' });
});

test('a crossing rounded into the adjacent cycle is counted only when it actually happens', () => {
  // 3 degrees crosses at 0.1 s, but time / 12 - 3 / 360 rounds to zero
  // one representable instant BEFORE it. This exercises the corrective branch.
  assert.equal(passesBetween({ bearing: 3, tStart: -0.9, tEnd: 0.09999999999999999 }), 0);
  assert.equal(passesBetween({ bearing: 3, tStart: -0.9, tEnd: 0.1 }), 1);
  assert.equal(passesBetween({ bearing: 3, tStart: 0.1, tEnd: 12.1 }), 1);
});

test('zero-speed and one-sided overflow cannot become valid visibility windows', () => {
  const invalid = { ok: false, violations: [{ index: 0, reason: 'invalid-ship', passes: 0, required: 4 }] };
  assert.deepEqual(validateSchedule([{ ...approach, speed: 0 }], params), invalid);
  // firstVisible is 0, pnrTime overflows. Accepting just one finite endpoint
  // would incorrectly call passesBetween with an infinite closing endpoint.
  assert.deepEqual(validateSchedule([{ ...approach, speed: Number.MIN_VALUE }], params), invalid);
  assert.deepEqual(validateSchedule([{ ...approach, speed: 1 }], params), { ok: true, violations: [] });
});

test('four-sector and jittered hazards pin the seeded chart coordinates and both radius bands', () => {
  const expected = [
    [108, 3, { kind: 'reef', x: 60.438370597676865, y: 187.781147852781, radius: 7.9817083813250065 }],
    [108, 5, { kind: 'shoal', x: -58.8409498506442, y: -182.81798457562311, radius: 30.6895296163857 }],
    [123456789, 3, { kind: 'reef', x: -102.09652412642446, y: 134.79413277098604, radius: 9.56688868906349 }],
  ];
  for (const [seed, index, rock] of expected) assert.deepEqual(planHazards(seed)[index], rock);

  assert.deepEqual(planHazards(108).slice(0, 3), [
    { kind: 'reef', x: 210, y: -255, radius: 24 },
    { kind: 'reef', x: 244, y: -238, radius: 18 },
    { kind: 'reef', x: 274, y: -219, radius: 14 },
  ]);
});

test('night-five seeded traffic pins type selection, berth release, gap jitter and radial budget', () => {
  // Seed 0 admits late threatening trawler traffic, after outward coasters
  // release their berths. Night 5 reaches the random trawler/coaster choice.
  assert.deepEqual(planSpawns(0, { night: 5 }), [
    { id: 'ship-1', type: 'coaster', spawnTime: 26.8328156741336, bearing: 107.91700327186845,
      speed: 3, threatening: false, responseSeconds: 2.5, turnRadius: 0, pnrRange: 0,
      spawnRange: 464.8, exitTime: 71.9328156741336 },
    { id: 'ship-2', type: 'coaster', spawnTime: 66.12433345373294, bearing: 281.1618372926023,
      speed: 3, threatening: false, responseSeconds: 2.5, turnRadius: 0, pnrRange: 0,
      spawnRange: 464.8, exitTime: 111.22433345373294 },
    { id: 'ship-3', type: 'coaster', spawnTime: 90.17064780376165, bearing: 165.87831267504953,
      speed: 3, threatening: false, responseSeconds: 2.5, turnRadius: 0, pnrRange: 0,
      spawnRange: 464.8, exitTime: 135.27064780376165 },
    { id: 'ship-4', type: 'trawler', spawnTime: 119.75408408087802, bearing: 38.06507184573212,
      speed: 1.1, threatening: true, responseSeconds: 2.5, turnRadius: 31.228013536607612,
      pnrRange: 381.6042053828156, spawnRange: 455.18221891942324, exitTime: 180 },
  ]);
});

test('arrival preserves default hull, callsign spelling and inward/outward destinations', () => {
  const state = createState(108);
  state.ships = [];
  state.hazards = [];
  state.schedule = [
    { id: 'trawler', bearing: 0, spawnRange: 400, spawnTime: PHYSICS_DT },
    { id: 'ship-10', type: 'coaster', bearing: 0, spawnRange: 400, spawnTime: PHYSICS_DT, threatening: false },
    { id: 'ship-2', type: 'trawler', bearing: 0, spawnRange: 400, spawnTime: PHYSICS_DT, threatening: true },
  ];
  const next = step(state, { hold: true });
  assert.equal(next.ships.length, 3);
  assert.deepEqual(next.ships.map(({ id, type, callsign, heading, x, y, destination, response }) =>
    ({ id, type, callsign, heading, x, y, destination, response })), [
    { id: 'trawler', type: 'trawler', callsign: 'T108', heading: 180, x: 0, y: -400,
      destination: { x: -0, y: 1200 }, response: 'none' },
    { id: 'ship-10', type: 'coaster', callsign: 'S10', heading: 0, x: 0, y: -400,
      destination: { x: 0, y: -2000 }, response: 'none' },
    { id: 'ship-2', type: 'trawler', callsign: 'S2', heading: 180, x: 0, y: -400,
      destination: { x: -0, y: 1200 }, response: 'none' },
  ]);
  assert.deepEqual(state.ships, []);
});

test('a fresh watch pins seed-dependent fog, empty history and incoming speed', () => {
  const state = createState(108);
  assert.equal(state.fog, 0.08 + (1193672923 / 0x100000000) * 0.04);
  assert.deepEqual(state.ignoredBlasts, []);
  assert.deepEqual(state.settings, { incomingWpm: 8 });
  assert.equal(state.trawler.callsign, 'T108');
  assert.equal(state.trawler.response, 'none');
});

test('the final traffic attempt bisects the widest free berth instead of using a rejected random bearing', () => {
  // This seed exhausts the seven random attempts while two berths overlap.
  const schedule = planSpawns(3428989683, { night: 5 });
  assert.deepEqual(schedule.map(({ spawnTime, bearing, type, threatening }) =>
    ({ spawnTime, bearing, type, threatening })), [
    { spawnTime: 30.12373617477715, bearing: 164.50320381997153, type: 'coaster', threatening: false },
    { spawnTime: 69.17677695561837, bearing: 331.81535814283416, type: 'coaster', threatening: false },
    { spawnTime: 104.14240934873011, bearing: 253.75022547785193, type: 'trawler', threatening: true },
  ]);
});

test('fallback traffic keeps the first widest berth when the final gap is narrower', () => {
  const schedule = planSpawns(147926629, { night: 5 });
  assert.deepEqual(schedule.map(({ spawnTime, bearing }) => ({ spawnTime, bearing })), [
    { spawnTime: 30.72208535671234, bearing: 304.4919065888971 },
    { spawnTime: 74.67382068560065, bearing: 214.04193421266973 },
    { spawnTime: 101.82168750752481, bearing: 33.20158061943948 },
  ]);
});

test('two reserved threats block a third threat even after a rotating berth is released', () => {
  // The opener and ship-3 remain reserved until dawn. At 117.78 s an
  // eligible third threat is rejected, and the available berth takes a coaster.
  const schedule = planSpawns(4203543597, { night: 5 });
  assert.deepEqual(schedule.map(({ id, type, threatening, spawnTime }) => ({ id, type, threatening, spawnTime })), [
    { id: 'ship-1', type: 'coaster', threatening: false, spawnTime: 33.115482084453106 },
    { id: 'ship-2', type: 'coaster', threatening: false, spawnTime: 61.12896935614066 },
    { id: 'ship-3', type: 'trawler', threatening: true, spawnTime: 91.90008578833462 },
    { id: 'ship-4', type: 'coaster', threatening: false, spawnTime: 117.78083916890017 },
  ]);
});
