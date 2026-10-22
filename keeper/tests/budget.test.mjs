import test from 'node:test';
import assert from 'node:assert/strict';
import { BUDGET_PERIOD_SECONDS, NIGHT_PASSES, passesBetween, spawnRangeFor, validateSchedule } from '../js/sim.js';

const params = { night: 1, fogReach: 1000 };
// PNR at t=48; north is crossed at 12, 24, 36, 48 (opening t=0 excluded).
const ship = (overrides = {}) => ({ id: 'boat', spawnTime: 0, bearing: 0, speed: 10,
  responseSeconds: 2, turnRadius: 20, pnrRange: 100, spawnRange: 620, ...overrides });

test('immutable default budget and (start,end] crossings, clockwise phase, wraps and zero windows', () => {
  assert.equal(BUDGET_PERIOD_SECONDS, 12);
  assert.deepEqual(NIGHT_PASSES, [4, 4, 3, 3, 2]);
  assert.ok(Object.isFrozen(NIGHT_PASSES));
  for (const [bearing, tStart, tEnd, expected, phase0 = 0] of [
    [0, 0, 48, 4], [0, 12, 48, 3], [0, 0, 48 - 1e-9, 3], [90, 3, 3, 0],
    [90, 0, 3, 1], [-270, 0, 3, 1, 720], [10, 0, 1, 1, 350], [350, 0, 1, 0, 10], [0, -12, 0, 1],
  ]) assert.equal(passesBetween({ bearing, tStart, tEnd, phase0 }), expected);
});

test('analytic counts agree with enumeration across phases, windows and periods', () => {
  for (const period of [0.5, 6, 12, 30]) for (const bearing of [0, 0.001, 90, 359.999]) {
    for (const phase0 of [0, 17, 180, 359]) for (const tStart of [0, 0.2, 12, 37.7]) {
      const tEnd = tStart + 59.3, offset = ((bearing - phase0 + 360) % 360) / 360;
      let expected = 0;
      for (let k = 0; k < 250; k++) {
        const time = (k + offset) * period;
        if (time > tStart && time <= tEnd) expected++;
      }
      assert.equal(passesBetween({ bearing, tStart, tEnd, period, phase0 }), expected);
    }
  }
});

test('fractional-bearing exact endpoints stay inclusive without rounding future crossings in', () => {
  for (const bearing of [1, 17, 123, 231, 359]) for (const phase0 of [0, 17, 180, 359]) {
    for (const period of [0.5, 6, 12, 30]) for (let cycle = 1; cycle < 20; cycle++) {
      const offset = ((bearing - phase0 + 360) % 360) / 360;
      const tEnd = (cycle + offset) * period;
      const expected = cycle + (offset === 0 ? 0 : 1);
      assert.equal(passesBetween({ bearing, phase0, period, tStart: 0, tEnd }), expected);
      assert.equal(passesBetween({ bearing, phase0, period, tStart: 0, tEnd: tEnd - 1e-9 }), expected - 1);
      assert.equal(passesBetween({ bearing, phase0, period, tStart: tEnd, tEnd: tEnd + period / 2 }), 0);
    }
  }
});

test('invalid periods, reversed windows and non-finite sweep values throw', () => {
  for (const period of [0, -12, NaN, Infinity, -Infinity, '12', null]) {
    assert.throws(() => passesBetween({ bearing: 0, tStart: 0, tEnd: 12, period }), RangeError);
    assert.throws(() => spawnRangeFor({ ...ship(), passes: 4, period }), RangeError);
    assert.throws(() => validateSchedule([], { ...params, period }), RangeError);
  }
  assert.throws(() => passesBetween({ bearing: 0, tStart: 2, tEnd: 1 }), RangeError);
  for (const key of ['bearing', 'tStart', 'tEnd', 'phase0']) for (const value of [NaN, Infinity, '0', null]) {
    assert.throws(() => passesBetween({ bearing: 0, tStart: 0, tEnd: 12, [key]: value }), RangeError);
  }
});

test('backwards derivation handles very fast boats and worst-case phase; offscreen distance buys no passes', () => {
  const approach = { speed: 1000, responseSeconds: 3, turnRadius: 700, pnrRange: 200, passes: 4 };
  const spawnRange = spawnRangeFor(approach);
  assert.equal(spawnRange, 63900);
  assert.equal((spawnRange - 200 - 3000 - 700) / 1000, 60);
  const fastBoat = ship({ ...approach, spawnRange });
  assert.deepEqual(validateSchedule([fastBoat], { ...params, fogReach: spawnRange, phase0: 0.001 }), { ok: true, violations: [] });
  assert.equal(validateSchedule([fastBoat], { ...params, fogReach: 10000 }).violations[0].reason, 'insufficient-passes');
  assert.equal(spawnRangeFor({ ...approach, period: 6 }), 33900);
  for (const speed of [0, -1, NaN, Infinity, '10']) assert.throws(() => spawnRangeFor({ ...ship(), speed, passes: 4 }), RangeError);
  for (const passes of [0, -1, 1.5, NaN, Infinity, '4']) assert.throws(() => spawnRangeFor({ ...ship(), passes }), RangeError);
  for (const key of ['responseSeconds', 'turnRadius', 'pnrRange']) for (const value of [-1, NaN, Infinity, undefined]) {
    assert.throws(() => spawnRangeFor({ ...ship(), passes: 4, [key]: value }), RangeError);
  }
});

test('exactly N passes passes and N-1 fails on every night; concurrency shares no budget', () => {
  for (let night = 1; night <= 5; night++) {
    const required = NIGHT_PASSES[night - 1], spawnRange = 140 + 10 * required * 12;
    assert.equal(validateSchedule([ship({ spawnRange })], { ...params, night }).ok, true);
    assert.deepEqual(validateSchedule([ship({ spawnRange: spawnRange - 0.01 })], { ...params, night }), {
      ok: false, violations: [{ index: 0, reason: 'insufficient-passes', passes: required - 1, required }],
    });
  }
  const schedule = [ship(), ship({ id: 'second' }), ship({ id: 'third', spawnRange: 500 })];
  const before = structuredClone(schedule);
  assert.deepEqual(validateSchedule(schedule, params), {
    ok: false, violations: [{ index: 2, reason: 'insufficient-passes', passes: 3, required: 4 }],
  });
  assert.deepEqual(schedule, before);
  assert.equal(validateSchedule(schedule.slice(0, 2), params).ok, true);
});

test('fog entry handles inside spawns, delayed spawns, and PNR before/at visibility', () => {
  assert.equal(validateSchedule([ship()], params).ok, true);
  assert.equal(validateSchedule([ship({ spawnTime: 12 })], params).ok, true);
  assert.equal(validateSchedule([ship({ spawnRange: 1000 })], { ...params, fogReach: 620 }).ok, true);
  assert.deepEqual(validateSchedule([ship({ spawnRange: 1000 })], { ...params, fogReach: 139 }), {
    ok: false, violations: [{ index: 0, reason: 'pnr-before-visible', passes: 0, required: 4 }],
  });
  assert.equal(validateSchedule([ship({ spawnRange: 139 })], params).violations[0].reason, 'pnr-before-visible');
  assert.equal(validateSchedule([ship({ spawnRange: 140 })], params).violations[0].reason, 'insufficient-passes');
});

test('missing fields, malformed ships and sparse entries reject independently', () => {
  for (const key of Object.keys(ship())) {
    const missing = ship(); delete missing[key];
    assert.equal(validateSchedule([missing], params).violations[0].reason, 'invalid-ship', key);
  }
  for (const key of Object.keys(ship()).filter((key) => key !== 'id')) for (const value of [NaN, Infinity, '1', null]) {
    assert.equal(validateSchedule([ship({ [key]: value })], params).violations[0].reason, 'invalid-ship');
  }
  for (const key of ['speed', 'spawnTime', 'responseSeconds', 'turnRadius', 'pnrRange', 'spawnRange']) {
    assert.equal(validateSchedule([ship({ [key]: -1 })], params).violations[0].reason, 'invalid-ship');
  }
  assert.equal(validateSchedule([ship({ speed: 0 })], params).violations[0].reason, 'invalid-ship');
  assert.equal(validateSchedule([ship({ id: 0 })], params).ok, true);
  const schedule = [null, undefined, ship({ id: '' }), ship()]; delete schedule[1];
  assert.deepEqual(validateSchedule(schedule, params).violations.map((v) => v.index), [0, 1, 2]);
  assert.equal(validateSchedule([ship({ speed: Number.MIN_VALUE, spawnRange: Number.MAX_VALUE })], params).violations[0].reason, 'invalid-ship');
  for (const night of [0, 6, -1, 1.5, NaN, Infinity, '1', undefined]) assert.throws(() => validateSchedule([], { ...params, night }), RangeError);
  for (const fogReach of [0, -1, NaN, Infinity]) assert.throws(() => validateSchedule([], { ...params, fogReach }), RangeError);
  assert.throws(() => validateSchedule([], { ...params, phase0: NaN }), RangeError);
  assert.throws(() => validateSchedule(null, params), TypeError);
  assert.deepEqual(validateSchedule([], params), { ok: true, violations: [] });
});

test('mid-window acceleration adds passes; slow and held beams are outside the default guarantee', () => {
  assert.equal(validateSchedule([ship()], params).ok, true);
  assert.equal(validateSchedule([ship()], { ...params, period: 6 }).ok, true);
  assert.equal(validateSchedule([ship()], { ...params, period: 30 }).ok, false);
  // Carry phase at t=18 into a new, locally timed constant-period segment.
  const first = passesBetween({ bearing: 0, tStart: 0, tEnd: 18 });
  const accelerated = passesBetween({ bearing: 0, tStart: 0, tEnd: 30, period: 6, phase0: 180 });
  assert.equal(first + accelerated, 6);
  const slowed = passesBetween({ bearing: 0, tStart: 0, tEnd: 30, period: 30, phase0: 180 });
  assert.equal(first + slowed, 2);
  assert.equal(first + 0, 1, 'holding for the remainder adds no sweeps');
  assert.equal(validateSchedule([ship()], params).ok, true, 'choices do not rewrite the design budget');
});
