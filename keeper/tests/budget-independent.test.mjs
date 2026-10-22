import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUDGET_PERIOD_SECONDS, NIGHT_PASSES, FAST_SHIP_SPEED,
  passesBetween, spawnRangeFor, validateSchedule,
  perception, fogReach,
} from '../js/sim.js';

// Radial inbound ship. Reaction distance = speed * response + turn radius.
// Point-of-no-return range = 100 + 10 * 2 + 20 = 140.
// spawnRange 620 → (620 - 140) / 10 = 48 s = 4 default sweeps when already inside the fog.
function ship(overrides = {}) {
  return {
    id: 'boat', spawnTime: 0, bearing: 0, speed: 10,
    responseSeconds: 2, turnRadius: 20, pnrRange: 100, spawnRange: 620,
    ...overrides,
  };
}

const night = (overrides = {}) => ({ night: 1, fogReach: 10000, ...overrides });
const QUOTA = [4, 4, 3, 3, 2];

test('budget constants are the locked 12 s period and the five night quotas', () => {
  assert.equal(BUDGET_PERIOD_SECONDS, 12);
  assert.deepEqual([...NIGHT_PASSES], QUOTA);
  assert.equal(NIGHT_PASSES.length, 5);
  assert.equal(Object.isFrozen(NIGHT_PASSES), true);
  assert.throws(() => { NIGHT_PASSES[0] = 9; }, TypeError);
  assert.deepEqual([...NIGHT_PASSES], QUOTA);
  assert.equal(
    passesBetween({ bearing: 0, tStart: 0, tEnd: 48 }),
    passesBetween({ bearing: 0, tStart: 0, tEnd: 48, period: 12, phase0: 0 }),
  );
});

test('centre-line crossings use (tStart, tEnd], clockwise phase, and wrapped bearings', () => {
  // Beam at phase0 at t = 0, clockwise. Bearing 0 is crossed at t = 12, 24, 36, … (t = 0 is the opening instant).
  assert.equal(passesBetween({ bearing: 0, tStart: 0, tEnd: 48 }), 4); // 12, 24, 36, 48
  assert.equal(passesBetween({ bearing: 0, tStart: 0, tEnd: 12 }), 1); // closing instant counts
  assert.equal(passesBetween({ bearing: 0, tStart: 0, tEnd: 11.5 }), 0); // opening instant does not
  assert.equal(passesBetween({ bearing: 0, tStart: 12, tEnd: 12 }), 0);
  assert.equal(passesBetween({ bearing: 0, tStart: 0, tEnd: 0 }), 0);
  assert.equal(passesBetween({ bearing: 0, tStart: -5, tEnd: -5 }), 0);
  assert.equal(passesBetween({ bearing: 0, tStart: -12, tEnd: 0 }), 1); // the crossing at t = 0
  assert.equal(passesBetween({ bearing: 0, tStart: 0, tEnd: 120 }), 10); // 12 … 120, ten crossings
  // 90° ahead of a beam at north: first hit is at 3 s, then every 12 s.
  assert.equal(passesBetween({ bearing: 90, tStart: 0, tEnd: 12 }), 1); // t = 3
  assert.equal(passesBetween({ bearing: 90, tStart: 3, tEnd: 15 }), 1); // t = 3 excluded, t = 15 included
  assert.equal(passesBetween({ bearing: 90, tStart: 3, tEnd: 3 }), 0);
  assert.equal(passesBetween({ bearing: -90, tStart: 0, tEnd: 12 }), 1); // 270° clockwise, hit at 9 s
  assert.equal(passesBetween({ bearing: 450, tStart: 0, tEnd: 12 }), 1); // 450° ≡ 90°
  assert.equal(passesBetween({ bearing: 360, tStart: 0, tEnd: 24, phase0: 720 }), 2);
  // Beam at 350°, target 10°: 20° of travel = 20/360 * 12 = 2/3 s, inside a 1 s window.
  assert.equal(passesBetween({ bearing: 10, tStart: 0, tEnd: 1, phase0: 350 }), 1);
  // Beam at 10°, target 350°: 340° still to go, about 11.3 s, outside a 1 s window.
  assert.equal(passesBetween({ bearing: 350, tStart: 0, tEnd: 1, phase0: 10 }), 0);
});

test('a ship that appears as the beam leaves it loses the fractional sweep', () => {
  // Window (0, 42] is 3.5 revolutions.
  // Bearing aligned with phase0: a crossing sits on t = 0 and is excluded. Hits at 12, 24, 36. Count 3.
  assert.equal(passesBetween({ bearing: 0, tStart: 0, tEnd: 42, phase0: 0 }), 3);
  // Same target, beam 90° behind it (phase 270° or -90°). Hits at 3, 15, 27, 39. Count 4.
  assert.equal(passesBetween({ bearing: 0, tStart: 0, tEnd: 42, phase0: 270 }), 4);
  assert.equal(passesBetween({ bearing: 0, tStart: 0, tEnd: 42, phase0: -90 }), 4);
  // 42 s of travel at 10 m/s from PNR range 140 → spawn range 560. Both ships share that range.
  const behind = ship({ id: 'behind', bearing: 0, spawnRange: 560 });
  const ahead = ship({ id: 'ahead', bearing: 90, spawnRange: 560 });
  const params = night({ phase0: 0 });
  assert.deepEqual(validateSchedule([behind, ahead], params), {
    ok: false,
    violations: [{ index: 0, reason: 'insufficient-passes', passes: 3, required: 4 }],
  });
  assert.equal(validateSchedule([ahead], params).ok, true);
  assert.equal(validateSchedule([behind], params).violations[0].passes, 3);
});

test('non-finite periods, reversed windows and non-numeric sweep inputs throw', () => {
  // An omitted period is the 12 s default. A provided non-positive or non-finite period is an error.
  for (const period of [0, -0, -12, NaN, Infinity, -Infinity, '12', null]) {
    assert.throws(() => passesBetween({ bearing: 0, tStart: 0, tEnd: 12, period }), RangeError);
    assert.throws(() => spawnRangeFor({ ...ship(), passes: 4, period }), RangeError);
    assert.throws(() => validateSchedule([], night({ period })), RangeError);
  }
  assert.throws(() => passesBetween({ bearing: 0, tStart: 2, tEnd: 1 }), RangeError);
  assert.throws(() => passesBetween({ bearing: 0, tStart: -1, tEnd: -2 }), RangeError);
  for (const key of ['bearing', 'tStart', 'tEnd', 'phase0']) {
    for (const value of [NaN, Infinity, -Infinity, '0', null]) {
      assert.throws(() => passesBetween({ bearing: 0, tStart: 0, tEnd: 12, [key]: value }), RangeError);
    }
  }
});

test('spawn range is derived backwards, including a very fast boat', () => {
  // Minimum range = pnrRange + speed * responseSeconds + turnRadius + speed * (passes + 1) * period.
  assert.equal(spawnRangeFor({ speed: 10, responseSeconds: 2, turnRadius: 20, passes: 4, pnrRange: 100 }), 740);
  // 140 + 10 * 5 * 12 = 740. Travel from that range to PNR is 60 s = 5 periods.
  assert.equal(spawnRangeFor({ speed: 10, responseSeconds: 2, turnRadius: 20, passes: 4, period: 6, pnrRange: 100 }), 440);
  assert.equal(spawnRangeFor({ speed: 10, responseSeconds: 2, turnRadius: 20, passes: 4, period: 30, pnrRange: 100 }), 1640);
  assert.equal(spawnRangeFor({ speed: 4, responseSeconds: 0, turnRadius: 0, passes: 1, pnrRange: 0 }), 96);
  // Fast boat: reaction distance 1000 * 3 + 700 = 3700, plus pnr 200 → 3900.
  // Five periods (4 + worst-case) at 1000 m/s → 60_000 m. Spawn range 63_900.
  const fast = { speed: 1000, responseSeconds: 3, turnRadius: 700, passes: 4, pnrRange: 200 };
  assert.equal(spawnRangeFor(fast), 63900);
  assert.equal(spawnRangeFor({ ...fast, period: 6 }), 33900);
  assert.equal(spawnRangeFor({ ...ship(), passes: 4 }), spawnRangeFor({ speed: 10, responseSeconds: 2, turnRadius: 20, passes: 4, pnrRange: 100, period: 12 }));

  const fastShip = ship({ ...fast, id: 'fast', spawnRange: 63900 });
  // Fog reaches the spawn, so the whole 60 s leg is visible. Any phase sees 5 crossings ≥ 4.
  assert.equal(passesBetween({ bearing: 0, tStart: 0, tEnd: 60, phase0: 0 }), 5);
  assert.deepEqual(validateSchedule([fastShip], night({ fogReach: 63900, phase0: 0 })), { ok: true, violations: [] });
  assert.equal(validateSchedule([fastShip], night({ fogReach: 63900, phase0: 270 })).ok, true);
  // Fog ends at the PNR range. The ship is invisible until the window has already closed.
  assert.deepEqual(validateSchedule([fastShip], night({ fogReach: 3900 })), {
    ok: false, violations: [{ index: 0, reason: 'insufficient-passes', passes: 0, required: 4 }],
  });
  // Fog shorter than the PNR range: the point of no return is still outside the fog.
  assert.deepEqual(validateSchedule([fastShip], night({ fogReach: 2000 })), {
    ok: false, violations: [{ index: 0, reason: 'pnr-before-visible', passes: 0, required: 4 }],
  });
  // Visible leg of the fast boat cut down to the last 11.1 s: only the closing crossing at t = 60 remains.
  // firstVisible = (63900 - 15000) / 1000 = 48.9, pnrTime = 60.
  assert.deepEqual(validateSchedule([fastShip], night({ fogReach: 15000 })), {
    ok: false, violations: [{ index: 0, reason: 'insufficient-passes', passes: 1, required: 4 }],
  });
});

test('spawn budget rejects non-positive speed and non-integer passes', () => {
  for (const speed of [0, -0, -1, NaN, Infinity, -Infinity, '10', null, undefined]) {
    assert.throws(() => spawnRangeFor({ ...ship(), speed, passes: 4 }), RangeError);
  }
  for (const passes of [0, -1, 1.5, 4.5, NaN, Infinity, '4', null, undefined]) {
    assert.throws(() => spawnRangeFor({ ...ship(), passes }), RangeError);
  }
  for (const key of ['responseSeconds', 'turnRadius', 'pnrRange']) {
    for (const value of [-1, NaN, Infinity, undefined]) {
      assert.throws(() => spawnRangeFor({ ...ship(), passes: 4, [key]: value }), RangeError);
    }
  }
});

test('spawnRangeFor output validates, and a hair under an exact N-pass leg fails', () => {
  for (let index = 0; index < QUOTA.length; index++) {
    const required = QUOTA[index];
    const params = night({ night: index + 1, phase0: 0 });
    // Exactly N periods from PNR range 140 at 10 m/s. Closing crossing lands on pnrTime.
    const exact = 140 + 10 * required * 12;
    // Formula range keeps one extra period for the sweep that falls on the opening instant.
    const derived = spawnRangeFor({ speed: 10, responseSeconds: 2, turnRadius: 20, passes: required, pnrRange: 100 });
    assert.equal(derived, exact + 10 * 12);
    assert.equal((derived - 140) / 10, (required + 1) * 12);
    assert.ok((derived - 1.25 - 140) / 10 < (required + 1) * 12);
    assert.equal(validateSchedule([ship({ spawnRange: derived })], { ...params, fogReach: derived }).ok, true);
    // The extra period is slack: 1.25 m under the formula (0.125 s) still leaves N crossings.
    assert.equal(validateSchedule([ship({ spawnRange: derived - 1.25 })], params).ok, true);
    assert.equal(validateSchedule([ship({ spawnRange: exact })], params).ok, true);
    // 1.25 m under the exact leg moves pnrTime to N * 12 - 0.125 s, so the closing crossing drops.
    assert.deepEqual(validateSchedule([ship({ spawnRange: exact - 1.25 })], params), {
      ok: false,
      violations: [{ index: 0, reason: 'insufficient-passes', passes: required - 1, required }],
    });
  }
});

test('exactly N passes is valid on every night and N - 1 is not', () => {
  for (let index = 0; index < QUOTA.length; index++) {
    const required = QUOTA[index];
    const params = night({ night: index + 1 });
    const exact = 140 + 10 * required * 12;
    const fewer = 140 + 10 * (required - 1) * 12;
    assert.equal(NIGHT_PASSES[index], required);
    assert.equal(validateSchedule([ship({ spawnRange: exact })], params).ok, true);
    assert.deepEqual(validateSchedule([ship({ spawnRange: fewer })], params), {
      ok: false,
      violations: [{ index: 0, reason: 'insufficient-passes', passes: required - 1, required }],
    });
  }
  // Night 5 quota is 2. Three sweeps is legal. One sweep is not. Night 3 quota is 3, so two sweeps fail there.
  assert.equal(validateSchedule([ship({ spawnRange: 140 + 360 })], night({ night: 5 })).ok, true);
  assert.equal(validateSchedule([ship({ spawnRange: 140 + 240 })], night({ night: 3 })).violations[0].required, 3);
  assert.equal(validateSchedule([ship({ spawnRange: 140 + 240 })], night({ night: 3 })).violations[0].passes, 2);
});

test('concurrent ships are judged independently and the schedule is not mutated', () => {
  const fleet = [
    ship({ id: 'a' }),
    ship({ id: 'b', bearing: 180 }),
    ship({ id: 'c', spawnRange: 500 }),
  ];
  const snapshot = structuredClone(fleet);
  // a and b each receive four crossings in 48 s. c receives three in 36 s. Nothing is shared or pooled.
  assert.deepEqual(validateSchedule(fleet, night()), {
    ok: false,
    violations: [{ index: 2, reason: 'insufficient-passes', passes: 3, required: 4 }],
  });
  assert.deepEqual(fleet, snapshot);
  assert.equal(validateSchedule(fleet.slice(0, 2), night()).ok, true);
  assert.equal(validateSchedule([fleet[2]], night()).violations[0].passes, 3);

  const mixed = [
    ship({ id: 'bad', speed: NaN }),
    ship({ id: 'ok', bearing: -90 }),
    ship({ id: 'late', spawnRange: 100 }),
    ship({ id: 'short', spawnRange: 500 }),
  ];
  assert.deepEqual(validateSchedule(mixed, night()), {
    ok: false,
    violations: [
      { index: 0, reason: 'invalid-ship', passes: 0, required: 4 },
      { index: 2, reason: 'pnr-before-visible', passes: 0, required: 4 },
      { index: 3, reason: 'insufficient-passes', passes: 3, required: 4 },
    ],
  });
  // Same id on two hulls is still two judgements.
  assert.equal(validateSchedule([ship({ id: 'same' }), ship({ id: 'same' })], night()).ok, true);
  assert.equal(validateSchedule([ship({ id: 0 })], night()).ok, true);
});

test('spawn inside the fog, spawn outside it, and a point of no return before visibility', () => {
  // Already inside a long fog: the clock starts at spawnTime. 48 s → crossings at 12, 24, 36, 48.
  assert.equal(validateSchedule([ship({ spawnRange: 620 })], night({ fogReach: 5000 })).ok, true);
  // Spawn range equal to fog reach is inside. Same 48 s leg.
  assert.equal(validateSchedule([ship({ spawnRange: 620 })], night({ fogReach: 620 })).ok, true);
  // Delayed spawn. Window (12, 60] still holds four crossings: 24, 36, 48, 60.
  assert.equal(validateSchedule([ship({ spawnTime: 12 })], night()).ok, true);
  assert.equal(passesBetween({ bearing: 0, tStart: 12, tEnd: 60 }), 4);

  // Inside, but only 6 s remain before PNR. (0, 6] contains no crossing.
  assert.deepEqual(validateSchedule([ship({ spawnRange: 200 })], night({ fogReach: 10000 })), {
    ok: false, violations: [{ index: 0, reason: 'insufficient-passes', passes: 0, required: 4 }],
  });
  // Spawned already closer than PNR range 140. pnrTime = (100 - 140) / 10 = -4, before t = 0.
  assert.deepEqual(validateSchedule([ship({ spawnRange: 100 })], night({ fogReach: 1000 })), {
    ok: false, violations: [{ index: 0, reason: 'pnr-before-visible', passes: 0, required: 4 }],
  });

  // Metres outside the fog do not extend the warning. Fog reach 500 leaves a 36 s visible leg
  // (PNR at 140, speed 10). Crossings in a 36 s window: 3, under the night-1 quota.
  // firstVisible = (2000 - 500) / 10 = 150, pnrTime = (2000 - 140) / 10 = 186.
  assert.deepEqual(validateSchedule([ship({ spawnRange: 2000 })], night({ fogReach: 500 })), {
    ok: false, violations: [{ index: 0, reason: 'insufficient-passes', passes: 3, required: 4 }],
  });
  // Fog reach 620 with a distant spawn: visible leg is exactly 48 s, which is enough.
  assert.equal(validateSchedule([ship({ spawnRange: 2000 })], night({ fogReach: 620 })).ok, true);

  // PNR range sits outside the fog. firstVisible = 64, pnrTime = 60.
  assert.deepEqual(validateSchedule([ship({ spawnRange: 740 })], night({ fogReach: 100 })), {
    ok: false, violations: [{ index: 0, reason: 'pnr-before-visible', passes: 0, required: 4 }],
  });
  // Fog reaches exactly the PNR range. The window is empty and the reason is the pass count.
  assert.deepEqual(validateSchedule([ship({ spawnRange: 740 })], night({ fogReach: 140 })), {
    ok: false, violations: [{ index: 0, reason: 'insufficient-passes', passes: 0, required: 4 }],
  });
});

test('bad hulls are violations and a bad night throws', () => {
  const params = night();
  for (const key of ['id', 'spawnTime', 'bearing', 'speed', 'responseSeconds', 'turnRadius', 'pnrRange', 'spawnRange']) {
    const missing = ship();
    delete missing[key];
    assert.equal(validateSchedule([missing], params).violations[0].reason, 'invalid-ship', key);
  }
  for (const key of ['spawnTime', 'bearing', 'speed', 'responseSeconds', 'turnRadius', 'pnrRange', 'spawnRange']) {
    for (const value of [NaN, Infinity, -Infinity, '1', null]) {
      assert.equal(validateSchedule([ship({ [key]: value })], params).violations[0].reason, 'invalid-ship');
    }
  }
  for (const key of ['speed', 'spawnTime', 'responseSeconds', 'turnRadius', 'pnrRange', 'spawnRange']) {
    assert.equal(validateSchedule([ship({ [key]: -1 })], params).violations[0].reason, 'invalid-ship');
  }
  assert.equal(validateSchedule([ship({ speed: 0 })], params).violations[0].reason, 'invalid-ship');
  assert.equal(validateSchedule([ship({ id: '' })], params).violations[0].reason, 'invalid-ship');
  assert.equal(validateSchedule([ship({ bearing: -90 })], params).ok, true);
  assert.equal(validateSchedule([null], params).violations[0].reason, 'invalid-ship');
  const sparse = [ship({ speed: 0 }), ship()];
  delete sparse[1];
  assert.deepEqual(validateSchedule(sparse, params).violations.map((item) => item.index), [0, 1]);
  assert.equal(validateSchedule([
    ship({ speed: Number.MIN_VALUE, spawnRange: Number.MAX_VALUE }),
  ], params).violations[0].reason, 'invalid-ship');

  assert.deepEqual(validateSchedule([], params), { ok: true, violations: [] });
  for (const index of [1, 2, 3, 4, 5]) assert.equal(validateSchedule([], night({ night: index })).ok, true);
  for (const badNight of [0, 6, -1, 1.5, NaN, Infinity, '1', undefined]) {
    assert.throws(() => validateSchedule([ship()], night({ night: badNight })), RangeError);
  }
  for (const reach of [0, -1, NaN, Infinity, undefined]) {
    assert.throws(() => validateSchedule([], night({ fogReach: reach })), RangeError);
  }
  assert.throws(() => validateSchedule([], night({ phase0: NaN })), RangeError);
  assert.throws(() => validateSchedule([], night({ phase0: Infinity })), RangeError);
  assert.throws(() => validateSchedule(null, params), Error);
  assert.throws(() => validateSchedule({}, params), Error);
});

test('a faster period adds passes; a slow period and a held beam are outside the guarantee', () => {
  // 48 s leg. Default 12 s period → 4 crossings. Fast 6 s period → 8. Slow 30 s period → 1 (the hit at t = 30).
  assert.equal(passesBetween({ bearing: 0, tStart: 0, tEnd: 48, period: 12 }), 4);
  assert.equal(passesBetween({ bearing: 0, tStart: 0, tEnd: 48, period: 6 }), 8);
  assert.equal(passesBetween({ bearing: 0, tStart: 0, tEnd: 48, period: 30 }), 1);
  assert.equal(validateSchedule([ship()], night()).ok, true);
  assert.equal(validateSchedule([ship()], night({ period: 6 })).ok, true);
  assert.deepEqual(validateSchedule([ship()], night({ period: 30 })), {
    ok: false, violations: [{ index: 0, reason: 'insufficient-passes', passes: 1, required: 4 }],
  });
  // 36 s leg fails the night-1 quota at 12 s (3 crossings) and passes it at 6 s (6 crossings).
  assert.equal(validateSchedule([ship({ spawnRange: 500 })], night()).violations[0].passes, 3);
  assert.equal(validateSchedule([ship({ spawnRange: 500 })], night({ period: 6 })).ok, true);

  // Period changes at t = 18. Up to then, period 12 and phase 0: one crossing, at t = 12.
  // The beam is then on bearing 180. The next call keeps that bearing with its own period.
  const first = passesBetween({ bearing: 0, tStart: 0, tEnd: 18, period: 12, phase0: 0 });
  assert.equal(first, 1);
  // Fast remainder, phase0 180 so the beam is still on 180 at t = 18. Hits at 21 and 27.
  const accelerated = passesBetween({ bearing: 0, tStart: 18, tEnd: 30, period: 6, phase0: 180 });
  assert.equal(accelerated, 2);
  // Same remainder had the period stayed 12 s: one hit, at t = 24.
  assert.equal(passesBetween({ bearing: 0, tStart: 18, tEnd: 30, period: 12, phase0: 0 }), 1);
  // Slow remainder, phase0 324 so the beam is on 180 at t = 18 under a 30 s period. No hit before t = 30.
  const slowed = passesBetween({ bearing: 0, tStart: 18, tEnd: 30, period: 30, phase0: 324 });
  assert.equal(slowed, 0);
  assert.equal(first + accelerated, 3);
  assert.equal(first + slowed, 1);
  // Clutching the lens for the remainder adds no crossing. Uninterrupted rotation over the same clock would.
  assert.equal(first + 0, 1);
  assert.equal(passesBetween({ bearing: 0, tStart: 0, tEnd: 30, period: 12 }), 2);
});

test('a fast ship exposes an engine cue before the hull is visible', () => {
  assert.equal(Number.isFinite(FAST_SHIP_SPEED), true);
  assert.ok(FAST_SHIP_SPEED > 0);
  const state = {
    beam: 180,
    fog: 0,
    trawler: {
      x: 0, y: -100, heading: 180, status: 'underway',
      speed: FAST_SHIP_SPEED, afterimage: 0, lastSeen: null,
    },
  };
  // North, range 100, inside fog reach 500. The beam is south, so the hull is unlit.
  let seen = perception(state);
  assert.equal(seen.lit, false);
  assert.equal(seen.hull, null);
  assert.ok(seen.engineCue);
  assert.equal(seen.engineCue.bearing, 0);
  assert.equal(Number.isFinite(seen.engineCue.intensity) && seen.engineCue.intensity > 0, true);

  state.trawler.x = 100;
  state.trawler.y = 0;
  state.beam = 0;
  seen = perception(state);
  assert.equal(seen.lit, false);
  assert.equal(seen.engineCue.bearing, 90);

  state.trawler.y = -(fogReach(0) + 10);
  state.trawler.x = 0;
  state.beam = 0;
  seen = perception(state);
  assert.equal(seen.lit, false);
  assert.equal(seen.hull, null);
  assert.equal(seen.engineCue.bearing, 0);
  assert.ok(seen.engineCue.intensity > 0);

  const below = FAST_SHIP_SPEED > 1 ? FAST_SHIP_SPEED - 1 : FAST_SHIP_SPEED / 2;
  state.trawler.speed = below;
  assert.equal(perception(state).engineCue ?? null, null);
  state.trawler.speed = 0;
  assert.equal(perception(state).engineCue ?? null, null);
});
