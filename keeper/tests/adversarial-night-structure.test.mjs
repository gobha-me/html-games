import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NIGHT_SECONDS,
  SMUGGLER_FLEE_SECONDS,
  SMUGGLER_LIT_THROTTLE,
  LIFEBOAT_LOST_SECONDS,
  LIFEBOAT_DRIFT_THROTTLE,
  COASTER_ASK_SECONDS,
  AFTERIMAGE_SECONDS,
  CONE_DEGREES,
  BUDGET_PERIOD_SECONDS,
  NIGHT_PASSES,
  CLEAR_MARGIN,
  NAVIGATION,
  FAST_SHIP_SPEED,
  FOG_CURVES,
  SPAWN,
  TRAFFIC,
  TEETH,
  SPEED,
  HAZARD,
  fogAt,
  fogReach,
  wrapBearing,
  clampSpeed,
  passesBetween,
  spawnRangeFor,
  validateSchedule,
  isLit,
  perception,
  resetLamp,
  hornRings,
  planHazards,
  planSpawns,
  createState,
  step,
  summary,
  nextNight,
  restartNight,
  bearingTo,
  specialtyApproach,
  installSpecialty,
} from '../js/sim.js';
import { HULLS, hornRange } from '../js/physics.js';
import { SAVE_KEY, SAVE_VERSION, MAX_SAVE_BYTES, serializeSave, parseSave } from '../js/save.js';
import { RECORD_KEY, parseRecord } from '../js/record.js';
import { LOG_KEY } from '../js/log.js';

const DT = 1 / 60;

// Admits every scheduled ship up to targetTime using single-tick steps at each
// spawn boundary rather than 32,400 substeps, keeping states 100% save-valid in <1 ms.
function fastForwardTo(initial, targetTime) {
  let s = structuredClone(initial);
  for (const entry of s.schedule.slice(1)) {
    if (entry.spawnTime <= targetTime && !s.ships.some((ship) => ship.id === entry.id)) {
      s.time = entry.spawnTime - DT;
      s = step(s, { hold: true }, DT);
    }
  }
  if (s.time < targetTime) {
    s.time = Math.max(s.time, targetTime - DT);
    s = step(s, { hold: true }, targetTime - s.time);
  }
  return s;
}

test('save.js and record.js are pure modules with no Date, Math.random, DOM, or storage access', () => {
  const realDate = globalThis.Date;
  const realRandom = Math.random;
  const realWindow = globalThis.window;
  const realDocument = globalThis.document;
  const realStorage = globalThis.localStorage;
  try {
    globalThis.Date = new Proxy(function ForbiddenDate() {}, {
      construct() { throw new Error('Date constructor forbidden'); },
      apply() { throw new Error('Date call forbidden'); },
      get() { throw new Error('Date static forbidden'); },
    });
    Math.random = () => { throw new Error('Math.random forbidden'); };
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      get() { throw new Error('window forbidden'); },
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      get() { throw new Error('document forbidden'); },
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() { throw new Error('localStorage forbidden'); },
    });

    const state = step(createState(108), { horn: true }, DT);
    const rawSave = serializeSave(state);
    const loaded = parseSave(rawSave);
    assert.equal(loaded.seed, 108);
    assert.equal(loaded.trawler, loaded.ships[0]);

    const v3 = JSON.stringify({
      version: 3, seed: 108, night: 2, safe: 4, wrecked: 1, unseen: 2, lost: 0, logged: 3, cumulativeWrecks: 2, relieved: false,
    });
    assert.deepEqual(parseRecord(v3), {
      version: 3, seed: 108, night: 2, safe: 4, wrecked: 1, unseen: 2, lost: 0, logged: 3, cumulativeWrecks: 2, relieved: false,
    });
  } finally {
    globalThis.Date = realDate;
    Math.random = realRandom;
    Object.defineProperty(globalThis, 'window', { value: realWindow, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'document', { value: realDocument, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'localStorage', { value: realStorage, configurable: true, writable: true });
  }
});

test('NIGHT_SECONDS, SPAWN, TRAFFIC, and FOG_CURVES match the #113 contract and are frozen', () => {
  assert.equal(NIGHT_SECONDS, 540);
  assert.deepEqual(SPAWN, {
    firstMin: 24,
    firstMax: 36,
    intervalStart: 50,
    intervalEnd: 24,
    jitter: 0.25,
    maxActive: 3,
    lastSpawn: 480,
    minBearingGap: 20,
    threatShare: 0.6,
  });
  assert.equal(Object.isFrozen(SPAWN), true);
  assert.deepEqual(TRAFFIC, {
    attempts: 8,
    lateAfter: 360,
    maxThreats: 2,
    bearingJitter: 3,
    openingJitter: 0.5,
  });
  assert.equal(Object.isFrozen(TRAFFIC), true);
  assert.deepEqual(FOG_CURVES, [
    { start: 0.08, end: 0.12 },
    { start: 0.09, end: 0.13 },
    { start: 0.10, end: 0.14 },
    { start: 0.11, end: 0.15 },
    { start: 0.12, end: 0.16 },
  ]);
  assert.equal(Object.isFrozen(FOG_CURVES), true);
  for (const curve of FOG_CURVES) assert.equal(Object.isFrozen(curve), true);
  assert.deepEqual(TEETH, [
    { kind: 'reef', x: 210, y: -255, radius: 24 },
    { kind: 'reef', x: 244, y: -238, radius: 18 },
    { kind: 'reef', x: 274, y: -219, radius: 14 },
  ]);
});

test('fogAt is bounded, monotonic across time and nights, clamps outside [0, 540], and rejects bad inputs', () => {
  for (let night = 1; night <= 5; night += 1) {
    const { start, end } = FOG_CURVES[night - 1];
    assert.equal(fogAt(night, -500), start);
    assert.equal(fogAt(night, -0.0001), start);
    assert.equal(fogAt(night, 0), start);
    assert.equal(fogAt(night, -0), start);
    assert.ok(Math.abs(fogAt(night, NIGHT_SECONDS / 2) - (start + (end - start) * 0.5)) < 1e-12);
    assert.equal(fogAt(night, NIGHT_SECONDS), end);
    assert.equal(fogAt(night, NIGHT_SECONDS + 0.0001), end);
    assert.equal(fogAt(night, NIGHT_SECONDS * 10), end);

    const quarter = fogAt(night, NIGHT_SECONDS * 0.25);
    assert.ok(Math.abs(quarter - (start + (end - start) * 0.15625)) < 1e-12);
    assert.ok(quarter < start + (end - start) * 0.25);

    const threeQuarter = fogAt(night, NIGHT_SECONDS * 0.75);
    assert.ok(Math.abs(threeQuarter - (start + (end - start) * 0.84375)) < 1e-12);
    assert.ok(threeQuarter > start + (end - start) * 0.75);

    let prev = start;
    for (let t = 1; t <= NIGHT_SECONDS; t += 3) {
      const cur = fogAt(night, t);
      assert.ok(cur > prev, `night ${night} t=${t}: ${cur} not > ${prev}`);
      assert.ok(cur >= start && cur <= end);
      prev = cur;
    }
  }

  for (const t of [0, 60, 180, 270, 360, 540]) {
    for (let night = 1; night < 5; night += 1) {
      assert.ok(fogAt(night + 1, t) > fogAt(night, t), `t=${t}: night ${night + 1} <= night ${night}`);
    }
  }

  for (const badNight of [undefined, 0, -0, 6, -1, 1.5, NaN, Infinity, -Infinity, null, '1', true, false, {}, []]) {
    assert.throws(() => fogAt(badNight, 0), { name: 'RangeError', message: 'Invalid night' });
  }
  for (const badTime of [undefined, NaN, Infinity, -Infinity, null, '0', true, false, {}, []]) {
    assert.throws(() => fogAt(1, badTime), { name: 'TypeError', message: 'Time must be finite' });
  }
});

test('three-phase traffic arc shapes early/mid clear coasters, guarantees post-360 arrival across seeds 0..499 on nights 1..5, and caps threats', () => {
  let earlyMidCoasters = 0;
  let lateThreatsNight1 = 0;
  let lateCoasterThreats = 0;
  let lateTrawlerThreats = 0;

  for (let seed = 0; seed <= 499; seed += 1) {
    for (let night = 1; night <= 5; night += 1) {
      const spawns = planSpawns(seed, { night });
      assert.ok(
        spawns.some((ship) => ship.spawnTime > TRAFFIC.lateAfter),
        `seed ${seed} night ${night}: missing arrival after TRAFFIC.lateAfter (${TRAFFIC.lateAfter}s)`,
      );
      for (const ship of spawns) {
        if (ship.spawnTime <= TRAFFIC.lateAfter) {
          assert.equal(ship.threatening, false, `seed ${seed} night ${night}: no extra threats at/before ${TRAFFIC.lateAfter}`);
          assert.equal(ship.type, 'coaster');
          earlyMidCoasters += 1;
        } else if (ship.threatening) {
          if (night <= 2) {
            assert.equal(ship.type, 'trawler', '4-pass nights only admit trawlers as threats');
            if (night === 1) lateThreatsNight1 += 1;
          } else if (ship.type === 'coaster') {
            lateCoasterThreats += 1;
          } else if (ship.type === 'trawler') {
            lateTrawlerThreats += 1;
          }
        }
      }
      const fullSchedule = [{ spawnTime: 0, exitTime: NIGHT_SECONDS, threatening: true }, ...spawns];
      for (const entry of fullSchedule) {
        const overlappingThreats = fullSchedule.filter(
          (other) => other.spawnTime <= entry.spawnTime && other.exitTime >= entry.spawnTime && other.threatening,
        );
        assert.ok(overlappingThreats.length <= TRAFFIC.maxThreats);
      }
    }
  }
  assert.ok(earlyMidCoasters > 1000);
  assert.ok(lateThreatsNight1 > 0);
  assert.ok(lateCoasterThreats > 0 && lateTrawlerThreats > 0);
});

test('createState initializes nightParams, run, settings, and fog for nights 1..5', () => {
  for (let night = 1; night <= 5; night += 1) {
    const state = createState(108, { night });
    assert.deepEqual(state.nightParams, {
      night,
      fogReach: fogReach(0.16),
      phase0: 285,
    });
    assert.deepEqual(state.run, { mornings: [] });
    assert.deepEqual(state.settings, { incomingWpm: 8 });
    assert.equal(state.fog, FOG_CURVES[night - 1].start);
  }
  for (const badNight of [0, -0, 6, -1, 1.5, '2', null]) {
    assert.throws(() => createState(108, { night: badNight }), { name: 'RangeError', message: 'Invalid night' });
  }
  assert.equal(createState(0).seed, 0);
  assert.equal(Object.is(createState(-0).seed, +0), true);
  assert.equal(createState(0xffffffff).seed, 0xffffffff);
  for (const badSeed of [-1, 0x100000000, 1.5, '108', null, NaN]) {
    assert.throws(() => createState(badSeed), { name: 'TypeError', message: 'Seed must be a uint32' });
  }
});

test('exact dawn transition at 540 s, 1e-8 snap tolerance, and post-dawn immutability', () => {
  const base = { ...createState(108), schedule: [] };

  for (const badDt of [-0.01, NIGHT_SECONDS + 0.01, NaN, Infinity, '1']) {
    assert.throws(() => step(base, {}, badDt), {
      name: 'RangeError',
      message: `Step must be between 0 and ${NIGHT_SECONDS} seconds`,
    });
  }
  for (const badInput of [null, 'bad', 123, true, []]) {
    assert.throws(() => step(base, badInput, DT), {
      name: 'TypeError',
      message: 'Input must be an action object',
    });
  }
  for (const key of ['slow', 'fast', 'hold', 'horn', 'lamp']) {
    assert.throws(() => step(base, { [key]: 1 }, DT), {
      name: 'TypeError',
      message: `Invalid ${key}`,
    });
  }

  // Blast window pruning at 20 s and multi-tick duration clamping at NIGHT_SECONDS.
  const pruned = step({ ...base, time: 20 - DT, blasts: [0, 5] }, { hold: true }, DT);
  assert.deepEqual(pruned.blasts, [5]);
  const clamped = step({ ...base, time: NIGHT_SECONDS - 1 }, { hold: true }, 10);
  assert.equal(clamped.time, NIGHT_SECONDS);
  assert.equal(clamped.phase, 'dawn');
  const alreadyDawn = step({ ...base, time: 100, phase: 'dawn' }, { fast: true }, 10);
  assert.equal(alreadyDawn.time, 100);
  assert.deepEqual(summary({ ships: [] }), {
    night: 1, safe: 0, wrecked: 0, unseen: 0, lost: 0, logged: 0, cumulativeWrecks: 0, relieved: false,
  });
  assert.deepEqual(summary({ ships: [], run: {}, nightParams: {} }), {
    night: 1, safe: 0, wrecked: 0, unseen: 0, lost: 0, logged: 0, cumulativeWrecks: 0, relieved: false,
  });

  const preSnap = step({ ...base, time: NIGHT_SECONDS - 2e-7 }, { horn: true, lamp: true, hold: true }, 1e-7);
  assert.equal(preSnap.phase, 'night');
  assert.ok(NIGHT_SECONDS - preSnap.time > 1e-8);
  assert.equal(preSnap.horn, true);
  assert.equal(preSnap.lamp, true);

  // Zero-duration step just outside vs inside 1e-8 isolates post-loop snap from tick().
  const zeroOutside = step(
    { ...base, time: NIGHT_SECONDS - (1e-8 + 1e-12), horn: true, lamp: true, fog: 0 },
    {},
    0,
  );
  assert.equal(zeroOutside.phase, 'night');
  assert.equal(zeroOutside.horn, true);
  assert.equal(zeroOutside.lamp, true);
  assert.equal(zeroOutside.fog, 0);

  const zeroInside = step(
    { ...base, time: NIGHT_SECONDS - 5e-9, horn: true, lamp: true, fog: 0 },
    {},
    0,
  );
  assert.equal(zeroInside.time, NIGHT_SECONDS);
  assert.equal(zeroInside.phase, 'dawn');
  assert.equal(zeroInside.horn, false);
  assert.equal(zeroInside.lamp, false);
  assert.equal(zeroInside.fog, FOG_CURVES[0].end);

  const snapped = step({ ...base, time: NIGHT_SECONDS - 1e-5 }, { horn: true, lamp: true, hold: true }, 1e-5 - 5e-9);
  assert.equal(snapped.time, NIGHT_SECONDS);
  assert.equal(snapped.phase, 'dawn');
  assert.equal(snapped.horn, false);
  assert.equal(snapped.lamp, false);
  assert.equal(snapped.fog, FOG_CURVES[0].end);

  const afterDawn = step(snapped, { horn: true, lamp: true, fast: true }, 10);
  assert.deepEqual(afterDawn, snapped);
});

test('third-wreck relief vs second wreck, mid-night continuation past 3rd and 4th wrecks, and loss exclusion', () => {
  const base = createState(108, { night: 2 });
  base.run.mornings = [
    { night: 1, safe: 3, wrecked: 1, unseen: 1, lost: 2, logged: 0, cumulativeWrecks: 1, relieved: false },
  ];
  const template = structuredClone(base.trawler);

  const twoWreckState = {
    ...structuredClone(base),
    ships: [
      { ...template, id: 'seen-wreck-1', everSeen: true, status: 'wrecked', wreckedAt: 40 },
      { ...template, id: 'unseen-wreck', everSeen: false, status: 'wrecked', wreckedAt: 50 },
      { ...template, id: 'seen-lost-1', everSeen: true, status: 'lost', lostAt: 60, wreckedAt: null },
      { ...template, id: 'seen-lost-2', everSeen: true, status: 'lost', lostAt: 70, wreckedAt: null },
      { ...template, id: 'seen-safe', everSeen: true, status: 'safe', wreckedAt: null },
    ],
  };
  assert.deepEqual(summary(twoWreckState), {
    night: 2,
    safe: 1,
    wrecked: 1,
    unseen: 1,
    lost: 2,
    logged: 0,
    cumulativeWrecks: 2,
    relieved: false,
  });

  const midNight = {
    ...structuredClone(twoWreckState),
    schedule: [],
    time: 200,
    phase: 'night',
  };
  midNight.ships.push(
    { ...template, id: 'seen-wreck-2', everSeen: true, status: 'wrecked', wreckedAt: 180 },
    { ...template, id: 'seen-wreck-3', everSeen: true, status: 'wrecked', wreckedAt: 195 },
  );
  assert.equal(summary(midNight).cumulativeWrecks, 4);
  assert.equal(summary(midNight).relieved, true);

  const afterMidStep = step(midNight, { hold: true }, 1);
  assert.equal(afterMidStep.phase, 'night');
  assert.ok(Math.abs(afterMidStep.time - 201) < 1e-9);

  const atDawn = step({ ...afterMidStep, time: NIGHT_SECONDS - 1 }, { hold: true }, 1);
  assert.equal(atDawn.phase, 'dawn');
  assert.equal(atDawn.time, NIGHT_SECONDS);
  assert.deepEqual(summary(atDawn), {
    night: 2,
    safe: 1,
    wrecked: 3,
    unseen: 1,
    lost: 2,
    logged: 0,
    cumulativeWrecks: 4,
    relieved: true,
  });

  assert.throws(() => nextNight(atDawn), {
    name: 'RangeError',
    message: 'Cannot take the next watch',
  });
});

test('five-night progression via nextNight and same-night retry via restartNight', () => {
  assert.throws(() => nextNight(createState(108)), {
    name: 'RangeError',
    message: 'Cannot take the next watch',
  });

  let current = createState(108);
  current.settings.incomingWpm = 5;
  for (let night = 1; night <= 5; night += 1) {
    assert.equal(current.nightParams.night, night);
    assert.equal(current.run.mornings.length, night - 1);
    assert.equal(current.settings.incomingWpm, 5);

    const calmDawn = {
      ...current,
      schedule: [current.schedule[0]],
      ships: [{ ...current.trawler, everSeen: true, status: 'safe', x: 0, y: 700, heading: 180 }],
      time: NIGHT_SECONDS - 1,
    };
    const dawn = step(calmDawn, { hold: true }, 1);
    assert.equal(dawn.phase, 'dawn');
    const s = summary(dawn);
    assert.equal(s.night, night);
    assert.equal(s.safe, 1);
    assert.equal(s.wrecked, 0);
    assert.equal(s.cumulativeWrecks, 0);
    assert.equal(s.relieved, false);

    if (night < 5) {
      const next = nextNight(dawn);
      dawn.run.mornings.push({ night: 99, wrecked: 99 });
      dawn.settings.incomingWpm = 12;
      assert.equal(next.run.mornings.length, night);
      assert.equal(next.settings.incomingWpm, 5);
      current = next;
    } else {
      assert.throws(() => nextNight(dawn), {
        name: 'RangeError',
        message: 'Cannot take the next watch',
      });
    }
  }

  const priorMornings = [
    { night: 1, safe: 4, wrecked: 1, unseen: 2, lost: 0, logged: 0, cumulativeWrecks: 1, relieved: false },
    { night: 2, safe: 3, wrecked: 1, unseen: 3, lost: 0, logged: 0, cumulativeWrecks: 2, relieved: false },
  ];
  const night3 = createState(108, { night: 3 });
  night3.run.mornings = structuredClone(priorMornings);
  night3.settings.incomingWpm = 5;
  const wreckedNight3 = {
    ...structuredClone(night3),
    time: NIGHT_SECONDS,
    phase: 'dawn',
    beam: 42,
    speed: 48,
    trust: 0.5,
    blasts: [10, 20],
    ships: [{ ...night3.trawler, everSeen: true, status: 'wrecked', wreckedAt: 110 }],
  };
  assert.equal(summary(wreckedNight3).cumulativeWrecks, 3);
  assert.equal(summary(wreckedNight3).relieved, true);

  const retried = restartNight(wreckedNight3);
  wreckedNight3.run.mornings[0].wrecked = 99;
  wreckedNight3.settings.incomingWpm = 12;
  assert.equal(retried.seed, 108);
  assert.equal(retried.nightParams.night, 3);
  assert.equal(retried.settings.incomingWpm, 5);
  assert.equal(retried.time, 0);
  assert.equal(retried.phase, 'night');
  assert.equal(retried.beam, 285);
  assert.equal(retried.speed, SPEED.default);
  assert.equal(retried.trust, 1);
  assert.deepEqual(retried.blasts, []);
  assert.deepEqual(retried.run.mornings, priorMornings);
  assert.deepEqual(retried.hazards, planHazards(108, { night: 3 }));
  assert.deepEqual(retried.schedule.slice(1), planSpawns(108, { night: 3 }));
  assert.equal(summary(retried).cumulativeWrecks, 2);
  assert.equal(summary(retried).relieved, false);
});

test('serializeSave and parseSave round-trip complex mid-watch and dawn states and preserve next-step equality', () => {
  assert.equal(SAVE_KEY, 'keeper.save.v1');
  assert.equal(SAVE_VERSION, 1);
  assert.equal(MAX_SAVE_BYTES, 1_000_000);

  let live = createState(108, { night: 2 });
  live.run.mornings = [
    { night: 1, safe: 5, wrecked: 1, unseen: 2, lost: 0, logged: 1, cumulativeWrecks: 1, relieved: false },
  ];
  live.settings.incomingWpm = 5;
  const distressApproach = specialtyApproach({
    id: 'sos-1',
    type: 'lifeboat',
    bearing: 110,
    spawnTime: 0.2,
    spawnRange: 260,
  });
  live = installSpecialty(live, distressApproach);
  live = step(live, { horn: true, fast: true }, 0.3);
  live.beam = bearingTo(live.trawler);
  live = step(live, { lamp: true, hold: true }, 0.12);
  live = step(live, { hold: true }, 0.12);
  live = step(live, { lamp: true, hold: true }, 0.36);
  live.ships[0].rudder = -0;
  live.morse.lastMessage = {
    symbols: '.-.',
    text: 'R',
    time: 0.5,
    recipient: 'trawler',
  };

  const raw = serializeSave(live);
  assert.equal(typeof raw, 'string');
  assert.ok(raw.length <= MAX_SAVE_BYTES);
  assert.equal(Object.hasOwn(JSON.parse(raw).state, 'trawler'), false, 'trawler alias is omitted on disk');
  assert.ok(raw.includes('"$number":"-0"'));

  // Exact MAX_SAVE_BYTES boundary is accepted; MAX_SAVE_BYTES + 1 is rejected.
  const exactMax = raw + ' '.repeat(MAX_SAVE_BYTES - raw.length);
  assert.equal(exactMax.length, MAX_SAVE_BYTES);
  const restored = parseSave(exactMax);
  assert.notEqual(restored, null);
  assert.equal(restored.trawler, restored.ships[0]);
  assert.equal(Object.is(restored.ships[0].rudder, -0), true);
  assert.deepEqual(restored, live);

  const nextOriginal = step(live, { horn: false, lamp: true, slow: true, hold: false }, 0.2);
  const nextRestored = step(restored, { horn: false, lamp: true, slow: true, hold: false }, 0.2);
  assert.deepEqual(nextRestored, nextOriginal);

  const dawnState = fastForwardTo(createState(108), NIGHT_SECONDS);
  const restoredDawn = parseSave(serializeSave(dawnState));
  assert.deepEqual(restoredDawn, dawnState);
});

test('live watch integrated with real step calls to checkpoint equals uninterrupted run (fast mutation guard)', () => {
  // Short integrated watch (0 -> 2 -> 4 s) for <5 ms mutation feedback;
  // full 0 -> 270 -> 540 s dawn proof across nights 1, 3, and 5 is in zz-resume-uninterrupted.test.mjs.
  let s = createState(108, { night: 3 });
  s = step(s, { fast: true }, 1.9);
  s = step(s, { lamp: true, hold: true }, 0.1);
  assert.ok(Math.abs(s.time - 2) < 1e-9);
  const resumed = parseSave(serializeSave(s));
  assert.deepEqual(resumed, s);
  assert.deepEqual(summary(resumed), summary(s));
  const contOrig = step(step(s, { lamp: false, hold: true }, 0.2), { slow: true }, 1.8);
  const contRes = step(step(resumed, { lamp: false, hold: true }, 0.2), { slow: true }, 1.8);
  assert.deepEqual(contRes, contOrig);
  assert.deepEqual(summary(contRes), summary(contOrig));
});

test('parseSave and serializeSave reject corrupt, oversized, prototype-polluted, or out-of-range payloads', () => {
  const valid = createState(108, { night: 2 });
  valid.run.mornings = [
    { night: 1, safe: 3, wrecked: 1, unseen: 2, lost: 0, logged: 0, cumulativeWrecks: 1, relieved: false },
  ];
  const baseObj = () => JSON.parse(serializeSave(valid));

  for (const badRaw of [null, undefined, 123, true, {}, [], '', '{bad json', 'null', '[]', '123', '"str"']) {
    assert.equal(parseSave(badRaw), null);
  }
  const validRaw = serializeSave(valid);
  assert.equal(parseSave(new String(validRaw)), null);
  assert.equal(parseSave(validRaw + ' '.repeat(MAX_SAVE_BYTES - validRaw.length + 1)), null);

  assert.equal(parseSave(JSON.stringify({ version: 2, state: baseObj().state })), null);
  assert.equal(parseSave(JSON.stringify({ version: 1 })), null);
  assert.equal(parseSave(JSON.stringify({ version: 1, state: baseObj().state, extra: 1 })), null);
  assert.equal(parseSave(JSON.stringify({ version: 1, state: null })), null);
  assert.equal(parseSave(JSON.stringify({ version: 1, state: [] })), null);

  const withTrawler = baseObj();
  withTrawler.state.trawler = withTrawler.state.ships[0];
  assert.equal(parseSave(JSON.stringify(withTrawler)), null);

  const extraEncodedKey = baseObj();
  extraEncodedKey.state.beam = { $number: '-0', extra: 1 };
  assert.equal(parseSave(JSON.stringify(extraEncodedKey)), null);

  // Forbidden keys and depth > 24 inside lastMessage (where keysMatch is not called, isolating finiteTree).
  const msgWithProto = JSON.stringify(baseObj()).replace(
    '"lastMessage":null',
    '"lastMessage":{"text":"K","symbols":"-.-","time":0,"recipient":null,"__proto__":{"polluted":1}}',
  );
  assert.equal(parseSave(msgWithProto), null);

  const msgWithConstructor = baseObj();
  msgWithConstructor.state.morse.lastMessage = { text: 'K', symbols: '-.-', time: 0, recipient: null, constructor: {} };
  assert.equal(parseSave(JSON.stringify(msgWithConstructor)), null);

  const msgWithPrototype = baseObj();
  msgWithPrototype.state.morse.lastMessage = { text: 'K', symbols: '-.-', time: 0, recipient: null, prototype: {} };
  assert.equal(parseSave(JSON.stringify(msgWithPrototype)), null);

  // Depth 24 from state root is accepted; depth 25 is rejected by finiteTree.
  function makeNested(levels) {
    let root = { leaf: 1 };
    for (let i = 0; i < levels; i += 1) root = { child: root };
    return root;
  }
  const depth24 = baseObj();
  depth24.state.morse.lastMessage = { text: 'K', symbols: '-.-', time: 0, recipient: null, nested: makeNested(20) };
  assert.notEqual(parseSave(JSON.stringify(depth24)), null);

  const depth25 = baseObj();
  depth25.state.morse.lastMessage = { text: 'K', symbols: '-.-', time: 0, recipient: null, nested: makeNested(21) };
  assert.equal(parseSave(JSON.stringify(depth25)), null);

  function assertRejected(mutator, label) {
    const payload = baseObj();
    mutator(payload.state);
    assert.equal(parseSave(JSON.stringify(payload)), null, label);
  }

  function assertAccepted(mutator, label) {
    const payload = baseObj();
    mutator(payload.state);
    assert.notEqual(parseSave(JSON.stringify(payload)), null, label);
  }

  // Boundary acceptances on validState / validShip / validHistory / morse.
  assertAccepted((s) => { s.beam = 0; }, 'beam = 0');
  assertAccepted((s) => { s.speed = SPEED.slow; }, 'speed = slow');
  assertAccepted((s) => { s.speed = SPEED.fast; }, 'speed = fast');
  assertAccepted((s) => { s.trust = 0; }, 'trust = 0');
  assertAccepted((s) => { s.trust = 1; }, 'trust = 1');
  assertAccepted((s) => { s.hornIgnoredUntil = 0; }, 'hornIgnoredUntil = 0');
  assertAccepted((s) => { s.hornIgnoredUntil = NIGHT_SECONDS + 30; }, 'hornIgnoredUntil = max');
  assertAccepted((s) => { s.settings.incomingWpm = 5; }, 'incomingWpm = 5');
  assertAccepted((s) => { s.run.mornings = []; }, 'empty mornings allowed on night 2');
  assertAccepted((s) => {
    s.run.mornings[0].safe = 100;
    s.run.mornings[0].lost = 100;
  }, 'morning counts at 100');
  assertAccepted((s) => {
    s.morse.threshold = 150;
    s.morse.lastMessage = { symbols: '.', text: 'E', time: 0, recipient: null };
  }, 'morse threshold = 150 and null recipient');
  assertAccepted((s) => {
    s.morse.threshold = 400;
    s.morse.text = 'A'.repeat(10_000);
  }, 'morse threshold = 400 and text length = 10_000');
  assertAccepted((s) => {
    while (s.schedule.length < 100) {
      s.schedule.push(specialtyApproach({ id: `spec-${s.schedule.length}`, bearing: 40, spawnTime: 500, spawnRange: 300 }));
    }
  }, 'schedule length = 100');
  assertAccepted((s) => {
    s.ships[0].x = -1e6;
    s.ships[0].y = 1e6;
    s.ships[0].destination = { x: 1e6, y: -1e6 };
    s.ships[0].speed = 0;
    s.ships[0].rudder = -HULLS.trawler.maxRudderDeg;
    s.ships[0].yawRate = -360;
    s.ships[0].afterimage = 1.5;
    s.ships[0].lastSeen = { x: 0, y: 0, heading: 0, status: 'underway' };
    s.ships[0].litSeconds = NIGHT_SECONDS;
    s.ships[0].unlitSeconds = NIGHT_SECONDS;
    s.ships[0].litSecondsError = -1e-6;
    s.ships[0].unlitSecondsError = 1e-6;
    s.ships[0].warnedAt = 0;
    s.ships[0].reactAt = NIGHT_SECONDS + 120;
    s.ships[0].targetHeading = 0;
    s.ships[0].turnSign = -1;
    s.ships[0].navigation = { phase: 'blocked', heading: 0, course: 0, sign: 0, obstacles: [0, s.hazards.length - 1] };
    s.ships[0].lastHorn = { id: 'trawler', heard: false, response: 'ignore', reactAt: NIGHT_SECONDS + 120 };
    s.ships[0].reply = { startedAt: 0, flashes: [{ on: 0, off: 100 }, { on: 200, off: 1e6 }] };
  }, 'ship boundary values');

  assertRejected((s) => { delete s.seed; }, 'missing seed');
  assertRejected((s) => { s.extraField = 1; }, 'extra state field');
  assertRejected((s) => { s.seed = -1; }, 'negative seed');
  assertRejected((s) => { s.seed = 0x100000000; }, 'seed > uint32');
  assertRejected((s) => { s.nightParams.night = 0; }, 'night 0');
  assertRejected((s) => { s.nightParams.night = 6; }, 'night 6');
  assertRejected((s) => { s.nightParams.fogReach = 123; }, 'mismatched fogReach');
  assertRejected((s) => { s.nightParams.phase0 = 0; }, 'mismatched phase0');
  assertRejected((s) => { s.run.mornings = 'not-array'; }, 'non-array mornings');
  assertRejected((s) => { s.run.mornings = [null]; }, 'null morning entry');
  assertRejected((s) => { s.run.mornings = [s.run.mornings[0], s.run.mornings[0]]; }, 'mornings length >= night');
  assertRejected((s) => { s.run.mornings[0].night = 2; }, 'wrong morning night');
  assertRejected((s) => { s.run.mornings[0].safe = -1; }, 'morning count < 0');
  assertRejected((s) => { s.run.mornings[0].safe = 101; }, 'morning count > 100');
  assertRejected((s) => { s.run.mornings[0].lost = -1; }, 'negative morning lost');
  assertRejected((s) => { s.run.mornings[0].lost = 101; }, 'morning lost > 100');
  assertRejected((s) => { s.run.mornings[0].cumulativeWrecks = 5; }, 'inconsistent morning cumulativeWrecks');
  assertRejected((s) => { s.run.mornings[0].relieved = true; }, 'inconsistent morning relieved');
  assertRejected((s) => {
    s.run.mornings[0].wrecked = 3;
    s.run.mornings[0].cumulativeWrecks = 3;
    s.run.mornings[0].relieved = true;
  }, 'cannot continue run after 3 cumulative wrecks');
  assertRejected((s) => { s.settings.incomingWpm = 10; }, 'invalid incomingWpm');
  assertRejected((s) => { s.time = -0.01; }, 'negative time');
  assertRejected((s) => { s.time = NIGHT_SECONDS + 0.01; }, 'time > NIGHT_SECONDS');
  assertRejected((s) => { s.phase = 'pause'; }, 'invalid phase');
  assertRejected((s) => { s.phase = 'dawn'; }, 'dawn before NIGHT_SECONDS');
  assertRejected((s) => {
    s.time = NIGHT_SECONDS;
    s.fog = fogAt(2, NIGHT_SECONDS);
    s.phase = 'night';
  }, 'night phase at NIGHT_SECONDS');
  assertRejected((s) => { s.beam = 360; }, 'beam === 360');
  assertRejected((s) => { s.beam = -1; }, 'beam < 0');
  assertRejected((s) => { s.speed = SPEED.slow - 0.1; }, 'speed < slow');
  assertRejected((s) => { s.speed = SPEED.fast + 0.1; }, 'speed > fast');
  assertRejected((s) => { s.fog = 0.25; }, 'fog mismatch');
  assertRejected((s) => { s.horn = 1; }, 'non-boolean horn');
  assertRejected((s) => { s.lamp = 'false'; }, 'non-boolean lamp');
  assertRejected((s) => { s.trust = 1.01; }, 'trust > 1');
  assertRejected((s) => { s.trust = -0.01; }, 'trust < 0');
  assertRejected((s) => { s.hornIgnoredUntil = -1; }, 'hornIgnoredUntil < 0');
  assertRejected((s) => { s.hornIgnoredUntil = NIGHT_SECONDS + 30.1; }, 'hornIgnoredUntil > max');
  assertRejected((s) => { s.blasts = 'not-array'; }, 'non-array blasts');
  assertRejected((s) => { s.blasts = [1]; }, 'blast after state.time');
  assertRejected((s) => {
    s.time = 10;
    s.fog = fogAt(2, 10);
    s.blasts = [5, 3];
  }, 'unordered blasts');
  assertRejected((s) => { s.ignoredBlasts = [-0.1]; }, 'negative ignoredBlast');
  assertRejected((s) => { s.morse.down = 0; s.lamp = false; }, 'morse.down set when lamp is false');
  assertRejected((s) => { s.morse.down = null; s.lamp = true; }, 'lamp true when morse.down is null');
  assertRejected((s) => { s.morse.down = -1; s.lamp = true; }, 'morse.down < 0');
  assertRejected((s) => { s.morse.down = 1000; s.lamp = true; }, 'morse.down > state.time * 1000');
  assertRejected((s) => { s.morse.threshold = 149.9; }, 'morse.threshold < 150');
  assertRejected((s) => { s.morse.threshold = 400.1; }, 'morse.threshold > 400');
  assertRejected((s) => { s.morse.unit = 0; }, 'morse.unit <= 0');
  assertRejected((s) => { s.morse.unit = NIGHT_SECONDS * 1000 + 1; }, 'morse.unit > max');
  assertRejected((s) => { s.morse.text = 'A'.repeat(10_001); }, 'morse.text > 10_000');
  assertRejected((s) => { s.morse.events = 'not-array'; }, 'morse.events not array');
  assertRejected((s) => { s.morse.events = [{ down: 100, up: 50 }]; }, 'malformed morse event');
  assertRejected((s) => { s.morse.events = [{ down: 0, up: 1000 }]; }, 'morse event after state.time');
  assertRejected((s) => {
    s.morse.lastMessage = { symbols: '.-', text: 'A', time: 5, recipient: null };
  }, 'lastMessage.time > state.time');
  assertRejected((s) => {
    s.morse.lastMessage = { symbols: '.-', text: 'A', time: -1, recipient: null };
  }, 'lastMessage.time < 0');
  assertRejected((s) => {
    s.morse.lastMessage = { symbols: '.-', text: 'A', time: 0, recipient: 'ghost-ship' };
  }, 'lastMessage.recipient not in ships');
  assertRejected((s) => { s.hazards[0].radius += 1; }, 'tampered hazard radius');
  assertRejected((s) => { s.schedule[1].id = 'ship-999'; }, 'tampered generated schedule entry');
  assertRejected((s) => {
    s.schedule.push(specialtyApproach({ id: 'ship-1', bearing: 40, spawnTime: 100, spawnRange: 300 }));
  }, 'duplicate schedule id matching generated entry');
  assertRejected((s) => {
    while (s.schedule.length < 101) {
      s.schedule.push(specialtyApproach({ id: `spec-${s.schedule.length}`, bearing: 40, spawnTime: 500, spawnRange: 300 }));
    }
  }, 'schedule length > 100');
  assertRejected((s) => {
    s.schedule.push({
      ...specialtyApproach({ id: 'tampered-spec', bearing: 40, spawnTime: 100, spawnRange: 300 }),
      turnRadius: 99,
    });
  }, 'tampered extra specialty approach');
  assertRejected((s) => { s.ships = []; }, 'empty ships array');
  assertRejected((s) => { s.ships[0].id = 'wrong-id'; }, 'ship id mismatch with schedule');
  assertRejected((s) => { s.ships[0].type = 'unknown'; }, 'unknown hull type');
  assertRejected((s) => { s.ships[0].bearing += 1; }, 'ship.bearing != approach.bearing');
  assertRejected((s) => { s.ships[0].smuggler = true; }, 'ship.smuggler != approach.smuggler');
  assertRejected((s) => { s.ships[0].x = 1e6 + 1; }, 'ship.x out of bounds');
  assertRejected((s) => { s.ships[0].destination.y = -1e6 - 1; }, 'ship.destination out of bounds');
  assertRejected((s) => { s.ships[0].heading = 360; }, 'ship.heading === 360');
  assertRejected((s) => { s.ships[0].speed = -0.1; }, 'ship.speed < 0');
  assertRejected((s) => { s.ships[0].speed = HULLS.trawler.cruiseSpeed + 0.1; }, 'ship.speed > cruiseSpeed');
  assertRejected((s) => { s.ships[0].rudder = HULLS.trawler.maxRudderDeg + 0.1; }, 'ship.rudder > maxRudderDeg');
  assertRejected((s) => { s.ships[0].yawRate = 360.1; }, 'ship.yawRate > 360');
  assertRejected((s) => { s.ships[0].status = 'sunk'; }, 'invalid ship.status');
  assertRejected((s) => { s.ships[0].everSeen = 1; }, 'non-boolean ship.everSeen');
  assertRejected((s) => { s.ships[0].afterimage = 1.51; }, 'ship.afterimage > 1.5');
  assertRejected((s) => { s.ships[0].callsign = 123; }, 'non-string ship.callsign');
  assertRejected((s) => { s.ships[0].response = 'bad'; }, 'invalid ship.response');
  assertRejected((s) => { s.ships[0].turnSign = 2; }, 'invalid ship.turnSign');
  assertRejected((s) => { s.ships[0].targetHeading = 360; }, 'invalid ship.targetHeading');
  assertRejected((s) => { s.ships[0].litSeconds = NIGHT_SECONDS + 1; }, 'ship.litSeconds > NIGHT_SECONDS');
  assertRejected((s) => { s.ships[0].litSecondsError = 2e-6; }, 'ship.litSecondsError > 1e-6');
  assertRejected((s) => { s.ships[0].askedLight = 'no'; }, 'non-boolean ship.askedLight');
  assertRejected((s) => { s.ships[0].warnedAt = 1; }, 'ship.warnedAt > state.time');
  assertRejected((s) => { s.ships[0].reactAt = NIGHT_SECONDS + 121; }, 'ship.reactAt > max');
  assertRejected((s) => { s.ships[0].status = 'wrecked'; s.ships[0].wreckedAt = null; }, 'wrecked without wreckedAt');
  assertRejected((s) => { s.ships[0].status = 'underway'; s.ships[0].wreckedAt = 0; }, 'underway with wreckedAt');
  assertRejected((s) => { s.ships[0].status = 'lost'; s.ships[0].lostAt = 0; }, 'non-distress ship cannot be lost');
  assertRejected((s) => { s.ships[0].status = 'underway'; s.ships[0].lostAt = 0; }, 'underway with lostAt');
  assertRejected((s) => { s.ships[0].response = 'flee'; }, 'non-smuggler ship cannot flee');
  assertRejected((s) => {
    s.ships[0].lastSeen = { x: 0, y: 0, heading: 0, status: 'invalid' };
  }, 'invalid lastSeen.status');
  assertRejected((s) => {
    s.ships[0].navigation = { phase: 'out', heading: 90, course: 90, sign: 2, obstacles: [0] };
  }, 'invalid navigation sign');
  assertRejected((s) => {
    s.ships[0].navigation = { phase: 'out', heading: 90, course: 90, sign: 1, obstacles: [99] };
  }, 'navigation obstacle out of range');
  assertRejected((s) => {
    s.ships[0].navigation = { phase: 'out', heading: 90, course: 90, sign: 1, obstacles: [-1] };
  }, 'negative navigation obstacle');
  assertRejected((s) => {
    s.ships[0].lastHorn = { id: 'wrong', heard: true, response: 'hold', reactAt: null };
  }, 'lastHorn.id != ship.id');
  assertRejected((s) => {
    s.ships[0].lastHorn = { id: 'trawler', heard: 'yes', response: 'hold', reactAt: null };
  }, 'non-boolean lastHorn.heard');
  assertRejected((s) => {
    s.ships[0].lastHorn = { id: 'trawler', heard: true, response: 'invalid', reactAt: null };
  }, 'invalid lastHorn response');
  assertRejected((s) => {
    s.ships[0].lastHorn = { id: 'trawler', heard: true, response: 'hold', reactAt: NIGHT_SECONDS + 121 };
  }, 'lastHorn.reactAt > max');
  assertRejected((s) => {
    s.ships[0].reply = { startedAt: 1, flashes: [] };
  }, 'reply.startedAt > state.time');
  assertRejected((s) => {
    s.ships[0].reply = { startedAt: 0, flashes: [{ on: 100, off: 100 }] };
  }, 'reply flash off === on');
  assertRejected((s) => {
    s.ships[0].reply = { startedAt: 0, flashes: [{ on: 0, off: 100 }, { on: 100, off: 200 }] };
  }, 'reply flash on <= previous off');
  assertRejected((s) => {
    s.ships[0].reply = { startedAt: 0, flashes: [{ on: 0, off: 100 }], repeatSeconds: 1 };
  }, 'non-distress ship cannot have repeatSeconds');

  // Additional fine-grained boundary acceptances and rejections for save.js helpers and invariants.
  assertAccepted((s) => {
    const stepped = step(valid, { hold: true }, valid.schedule[1].spawnTime);
    Object.assign(s, JSON.parse(serializeSave(stepped)).state);
  }, 'extra ship without passes key accepted');
  assertAccepted((s) => { delete s.run.mornings[0].lost; }, 'optional lost omitted on morning');
  assertAccepted((s) => {
    s.time = 10;
    s.fog = fogAt(2, 10);
    s.blasts = [0, 5, 5, 10];
    s.ignoredBlasts = [0, 2, 2, 10];
    s.morse.events = [{ down: 0, up: 100 }, { down: 200, up: 10_000 }];
    s.morse.symbols = 'A'.repeat(10_000);
    s.morse.lastMessage = { symbols: 'A'.repeat(10_000), text: 'B'.repeat(10_000), time: 10, recipient: 'trawler' };
  }, 'ordered equal-timestamp blasts, morse events at time boundary, 10_000-char symbols');
  assertAccepted((s) => {
    s.ships[0].rudder = HULLS.trawler.maxRudderDeg;
    s.ships[0].yawRate = 360;
    s.ships[0].afterimage = 0;
    s.ships[0].litSecondsError = 1e-6;
    s.ships[0].unlitSecondsError = -1e-6;
    s.ships[0].callsign = 'C'.repeat(10_000);
    s.ships[0].turnSign = 1;
    s.ships[0].navigation = { phase: 'out', heading: 180, course: 90, sign: 1, obstacles: [0] };
    s.ships[0].lastSeen = { x: -1e6, y: 1e6, heading: 359.9, status: 'safe' };
    s.ships[0].lastHorn = { id: 'trawler', heard: true, response: 'turn-away', reactAt: 0 };
    s.ships[0].reply = {
      startedAt: 0,
      flashes: Array.from({ length: 1000 }, (_, i) => ({ on: i * 2, off: i * 2 + 1 })),
    };
  }, 'ship upper bounds, 1000 flashes, out navigation');
  assertAccepted((s) => {
    const lb = specialtyApproach({ id: 'lb-save', type: 'lifeboat', bearing: 90, spawnTime: 0, spawnRange: 250 });
    const sm = specialtyApproach({ id: 'sm-save', type: 'speedboat', smuggler: true, bearing: 140, spawnTime: 0, spawnRange: 300 });
    const withSpec = installSpecialty(installSpecialty(createState(108, { night: 2 }), lb), sm);
    s.schedule = withSpec.schedule;
    s.ships = withSpec.ships;
    s.ships[1].status = 'lost';
    s.ships[1].lostAt = 0;
    s.ships[1].reply = { startedAt: 0, flashes: [{ on: 0, off: 100 }], repeatSeconds: 0.101 };
    s.ships[2].response = 'flee';
  }, 'distress lost ship with valid repeatSeconds and smuggler with flee response');

  assertRejected((s) => { s.hazards = null; }, 'null hazards');
  assertRejected((s) => { s.hazards = { 0: s.hazards[0] }; }, 'non-array hazards object');
  assertRejected((s) => {
    s.nightParams = { night: 2, fogReach: s.nightParams.fogReach, extra: 285 };
  }, 'nightParams same key count but wrong key');
  assertRejected((s) => { s.run = null; }, 'null run');
  assertRejected((s) => { s.run = []; }, 'array run');
  assertRejected((s) => { s.run = { mornings: s.run.mornings, extra: 1 }; }, 'extra key on run');
  assertRejected((s) => { s.settings = null; }, 'null settings');
  assertRejected((s) => { s.settings = { incomingWpm: 8, extra: 1 }; }, 'extra key on settings');
  assertRejected((s) => { s.run.mornings[0].safe = 1.5; }, 'non-integer morning safe');
  assertRejected((s) => { s.run.mornings[0].lost = 1.5; }, 'non-integer morning lost');
  assertRejected((s) => { s.ignoredBlasts = 'not-array'; }, 'non-array ignoredBlasts');
  assertRejected((s) => { s.ignoredBlasts = [1]; }, 'ignoredBlast after state.time');
  assertRejected((s) => {
    s.time = 10;
    s.fog = fogAt(2, 10);
    s.ignoredBlasts = [5, 3];
  }, 'unordered ignoredBlasts');
  assertRejected((s) => { s.morse = null; }, 'null morse');
  assertRejected((s) => { s.morse.extra = 1; }, 'extra key on morse');
  assertRejected((s) => { s.morse.symbols = 123; }, 'non-string morse.symbols');
  assertRejected((s) => { s.morse.symbols = 'A'.repeat(10_001); }, 'morse.symbols > 10_000');
  assertRejected((s) => { s.morse.lastMessage = []; }, 'array lastMessage');
  assertRejected((s) => {
    s.morse.lastMessage = { symbols: 123, text: 'A', time: 0, recipient: null };
  }, 'non-string lastMessage.symbols');
  assertRejected((s) => {
    s.morse.lastMessage = { symbols: '.-', text: 123, time: 0, recipient: null };
  }, 'non-string lastMessage.text');
  assertRejected((s) => { s.ships = 'not-array'; }, 'non-array ships');
  assertRejected((s) => {
    const firstExtra = s.schedule[1];
    s.time = firstExtra.spawnTime;
    s.fog = fogAt(2, s.time);
    s.ships = [s.ships[0], structuredClone(s.ships[0])];
  }, 'duplicate ship IDs when arrived.length === 2');
  assertRejected((s) => { s.ships[0].extraShipKey = 1; }, 'extra key on ship');
  assertRejected((s) => { delete s.ships[0].callsign; }, 'missing required key on ship');
  assertRejected((s) => { s.ships[0].x = -1e6 - 1; }, 'ship.x < -1e6');
  assertRejected((s) => { s.ships[0].y = -1e6 - 1; }, 'ship.y < -1e6');
  assertRejected((s) => { s.ships[0].y = 1e6 + 1; }, 'ship.y > 1e6');
  assertRejected((s) => { s.ships[0].destination = null; }, 'null ship.destination');
  assertRejected((s) => { s.ships[0].destination.x = 1e6 + 1; }, 'ship.destination.x > 1e6');
  assertRejected((s) => { s.ships[0].destination.x = -1e6 - 1; }, 'ship.destination.x < -1e6');
  assertRejected((s) => { s.ships[0].destination.y = 1e6 + 1; }, 'ship.destination.y > 1e6');
  assertRejected((s) => { s.ships[0].heading = -0.01; }, 'ship.heading < 0');
  assertRejected((s) => { s.ships[0].rudder = -HULLS.trawler.maxRudderDeg - 0.1; }, 'ship.rudder < -maxRudderDeg');
  assertRejected((s) => { s.ships[0].yawRate = -360.1; }, 'ship.yawRate < -360');
  assertRejected((s) => { s.ships[0].afterimage = -0.01; }, 'ship.afterimage < 0');
  assertRejected((s) => { s.ships[0].callsign = 'A'.repeat(10_001); }, 'ship.callsign > 10_000');
  assertRejected((s) => { s.ships[0].targetHeading = -0.01; }, 'ship.targetHeading < 0');
  assertRejected((s) => { s.ships[0].litSeconds = -0.01; }, 'ship.litSeconds < 0');
  assertRejected((s) => { s.ships[0].unlitSeconds = -0.01; }, 'ship.unlitSeconds < 0');
  assertRejected((s) => { s.ships[0].unlitSeconds = NIGHT_SECONDS + 1; }, 'ship.unlitSeconds > NIGHT_SECONDS');
  assertRejected((s) => { s.ships[0].litSecondsError = -2e-6; }, 'ship.litSecondsError < -1e-6');
  assertRejected((s) => { s.ships[0].unlitSecondsError = -2e-6; }, 'ship.unlitSecondsError < -1e-6');
  assertRejected((s) => { s.ships[0].unlitSecondsError = 2e-6; }, 'ship.unlitSecondsError > 1e-6');
  assertRejected((s) => { s.ships[0].warnedAt = -0.01; }, 'ship.warnedAt < 0');
  assertRejected((s) => { s.ships[0].reactAt = -0.01; }, 'ship.reactAt < 0');
  assertRejected((s) => { s.ships[0].lastSeen = []; }, 'array ship.lastSeen');
  assertRejected((s) => { s.ships[0].lastSeen = { x: 1e6 + 1, y: 0, heading: 0, status: 'underway' }; }, 'lastSeen.x > 1e6');
  assertRejected((s) => { s.ships[0].lastSeen = { x: 0, y: 0, heading: 360, status: 'underway' }; }, 'lastSeen.heading === 360');
  assertRejected((s) => { s.ships[0].reply = []; }, 'array ship.reply');
  assertRejected((s) => { s.ships[0].reply = { startedAt: -0.01, flashes: [] }; }, 'reply.startedAt < 0');
  assertRejected((s) => { s.ships[0].reply = { startedAt: 0, flashes: 'not-array' }; }, 'non-array reply.flashes');
  assertRejected((s) => {
    s.ships[0].reply = {
      startedAt: 0,
      flashes: Array.from({ length: 1001 }, (_, i) => ({ on: i * 2, off: i * 2 + 1 })),
    };
  }, 'reply.flashes.length > 1000');
  assertRejected((s) => { s.ships[0].reply = { startedAt: 0, flashes: [null] }; }, 'null flash in reply.flashes');
  assertRejected((s) => { s.ships[0].reply = { startedAt: 0, flashes: [{ on: -1, off: 10 }] }; }, 'flash.on < 0');
  assertRejected((s) => { s.ships[0].reply = { startedAt: 0, flashes: [{ on: 0, off: 1e6 + 1 }] }; }, 'flash.off > 1e6');
  assertRejected((s) => {
    const lb = specialtyApproach({ id: 'lb-save', type: 'lifeboat', bearing: 90, spawnTime: 0, spawnRange: 250 });
    const withSpec = installSpecialty(createState(108, { night: 2 }), lb);
    s.schedule = withSpec.schedule;
    s.ships = withSpec.ships;
    s.ships[1].reply = { startedAt: 0, flashes: [{ on: 0, off: 100 }], repeatSeconds: 0.1 };
  }, 'distress repeatSeconds * 1000 <= last flash.off');
  assertRejected((s) => {
    const lb = specialtyApproach({ id: 'lb-save', type: 'lifeboat', bearing: 90, spawnTime: 0, spawnRange: 250 });
    const withSpec = installSpecialty(createState(108, { night: 2 }), lb);
    s.schedule = withSpec.schedule;
    s.ships = withSpec.ships;
    s.ships[1].reply = { startedAt: 0, flashes: [{ on: 0, off: 100 }], repeatSeconds: 1e6 + 1 };
  }, 'distress repeatSeconds > 1e6');
  assertRejected((s) => { s.ships[0].navigation = []; }, 'array ship.navigation');
  assertRejected((s) => {
    s.ships[0].navigation = { phase: 'bad', heading: 90, course: 90, sign: 1, obstacles: [0] };
  }, 'invalid navigation.phase');
  assertRejected((s) => {
    s.ships[0].navigation = { phase: 'out', heading: 360, course: 90, sign: 1, obstacles: [0] };
  }, 'navigation.heading === 360');
  assertRejected((s) => {
    s.ships[0].navigation = { phase: 'out', heading: 90, course: 360, sign: 1, obstacles: [0] };
  }, 'navigation.course === 360');
  assertRejected((s) => {
    s.ships[0].navigation = { phase: 'out', heading: 90, course: 90, sign: 1, obstacles: 'not-array' };
  }, 'non-array navigation.obstacles');
  assertRejected((s) => {
    s.ships[0].navigation = { phase: 'out', heading: 90, course: 90, sign: 1, obstacles: [0.5] };
  }, 'non-integer navigation obstacle');
  assertRejected((s) => { s.ships[0].lastHorn = null; }, 'null ship.lastHorn (when property exists)');
  assertRejected((s) => {
    s.ships[0].lastHorn = { id: 'trawler', heard: true, response: 'hold', reactAt: -0.01 };
  }, 'lastHorn.reactAt < 0');

  const badFinite = structuredClone(valid);
  badFinite.beam = Number.NaN;
  assert.throws(() => serializeSave(badFinite), { name: 'TypeError', message: 'Non-finite save value' });
});

test('parseRecord validates schema 3 (with and without lost) and preserves legacy schema 1 & 2 reads', () => {
  assert.equal(RECORD_KEY, 'keeper.record.v1');
  assert.deepEqual(
    parseRecord(JSON.stringify({ version: 1, seed: 0, safe: 1, wrecked: 0 })),
    { version: 1, seed: 0, safe: 1, wrecked: 0 },
  );
  assert.deepEqual(
    parseRecord(JSON.stringify({ version: 1, seed: 0xffffffff, safe: 0, wrecked: 1 })),
    { version: 1, seed: 0xffffffff, safe: 0, wrecked: 1 },
  );
  assert.equal(parseRecord(JSON.stringify({ version: 1, seed: 108, safe: 2, wrecked: 0 })), null);
  assert.equal(parseRecord(JSON.stringify({ version: 1, seed: 108, safe: 0, wrecked: 0 })), null);

  assert.deepEqual(
    parseRecord(JSON.stringify({ version: 2, seed: 108, safe: 0, wrecked: 0 })),
    { version: 2, seed: 108, safe: 0, wrecked: 0 },
  );
  assert.deepEqual(
    parseRecord(JSON.stringify({ version: 2, seed: 108, safe: 5, wrecked: 2 })),
    { version: 2, seed: 108, safe: 5, wrecked: 2 },
  );
  assert.equal(parseRecord(JSON.stringify({ version: 2, seed: -1, safe: 2, wrecked: 1 })), null);
  assert.equal(parseRecord(JSON.stringify({ version: 2, seed: 0x100000000, safe: 2, wrecked: 1 })), null);
  assert.equal(parseRecord(JSON.stringify({ version: 2, seed: 108, safe: -1, wrecked: 1 })), null);
  assert.equal(parseRecord(JSON.stringify({ version: 2, seed: 108, safe: 1, wrecked: -1 })), null);
  assert.equal(parseRecord(JSON.stringify({ version: 2, seed: 108, safe: Number.MAX_SAFE_INTEGER, wrecked: 1 })), null);

  const v3WithLost = {
    version: 3,
    seed: 0xffffffff,
    night: 5,
    safe: 12,
    wrecked: 2,
    unseen: 4,
    lost: 1,
    logged: 3,
    cumulativeWrecks: 3,
    relieved: true,
  };
  assert.deepEqual(parseRecord(JSON.stringify(v3WithLost)), v3WithLost);

  const v3WithoutLost = { ...v3WithLost };
  delete v3WithoutLost.lost;
  assert.deepEqual(parseRecord(JSON.stringify(v3WithoutLost)), { ...v3WithLost, lost: 0 });

  const v3Night1 = {
    version: 3, seed: 0, night: 1, safe: 0, wrecked: 2, unseen: 0, lost: 0, logged: 0, cumulativeWrecks: 2, relieved: false,
  };
  assert.deepEqual(parseRecord(JSON.stringify(v3Night1)), v3Night1);

  for (const requiredKey of ['version', 'seed', 'night', 'safe', 'wrecked', 'unseen', 'logged', 'cumulativeWrecks', 'relieved']) {
    const copy = { ...v3WithLost };
    delete copy[requiredKey];
    assert.equal(parseRecord(JSON.stringify(copy)), null, `missing ${requiredKey}`);
  }
  assert.equal(parseRecord(JSON.stringify({ ...v3WithLost, version: 0 })), null);
  assert.equal(parseRecord(JSON.stringify({ ...v3WithLost, version: 4 })), null);
  assert.equal(parseRecord(JSON.stringify({ ...v3WithLost, night: 0 })), null);
  assert.equal(parseRecord(JSON.stringify({ ...v3WithLost, night: 6 })), null);
  assert.equal(parseRecord(JSON.stringify({ ...v3WithLost, night: 1.5 })), null);
  assert.equal(parseRecord(JSON.stringify({ ...v3WithLost, unseen: -1 })), null);
  assert.equal(parseRecord(JSON.stringify({ ...v3WithLost, logged: -1 })), null);
  assert.equal(parseRecord(JSON.stringify({ ...v3WithLost, cumulativeWrecks: -1 })), null);
  assert.equal(parseRecord(JSON.stringify({ ...v3WithLost, lost: -1 })), null);
  assert.equal(parseRecord(JSON.stringify({ ...v3WithLost, lost: 1.5 })), null);
  assert.equal(parseRecord(JSON.stringify({ ...v3WithLost, wrecked: 3, cumulativeWrecks: 2, relieved: false })), null);
  assert.equal(parseRecord(JSON.stringify({ ...v3WithLost, wrecked: 1, cumulativeWrecks: 2, relieved: true })), null);
  assert.equal(parseRecord(JSON.stringify({ ...v3WithLost, wrecked: 2, cumulativeWrecks: 3, relieved: false })), null);
  assert.equal(parseRecord(JSON.stringify({ ...v3WithLost, relieved: 1 })), null);
  assert.equal(parseRecord('{bad json'), null);
  assert.equal(parseRecord('null'), null);
});

let bootSeq = 0;
async function bootMain({
  seed = '108',
  search = null,
  webdriver = true,
  initialStorage = {},
  getItemError = null,
  setItemError = null,
  removeItemError = null,
} = {}) {
  const elements = new Map();
  const listeners = new Map();
  const docListeners = new Map();
  let activeElement = null;
  let rafCallback = null;
  let canvasRect = { left: 0, top: 0, width: 1280, height: 720 };

  function makeClassList() {
    const set = new Set();
    return {
      add: (...names) => names.forEach((n) => set.add(n)),
      remove: (...names) => names.forEach((n) => set.delete(n)),
      toggle: (name, force) => {
        const next = force === undefined ? !set.has(name) : Boolean(force);
        if (next) set.add(name);
        else set.delete(name);
        return next;
      },
      contains: (name) => set.has(name),
    };
  }

  function makeCanvasContext() {
    return {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      font: '',
      textAlign: '',
      setTransform() {},
      fillRect() {},
      strokeRect() {},
      clearRect() {},
      save() {},
      restore() {},
      scale() {},
      translate() {},
      rotate() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      quadraticCurveTo() {},
      arc() {},
      ellipse() {},
      closePath() {},
      clip() {},
      fill() {},
      stroke() {},
      fillText() {},
      setLineDash() {},
      createRadialGradient() { return { addColorStop() {} }; },
    };
  }

  function makeElement(id, tag = 'div') {
    const elListeners = new Map();
    const attrs = new Map();
    const el = {
      id,
      tagName: tag.toUpperCase(),
      textContent: '',
      value: '',
      hidden: false,
      disabled: false,
      checked: false,
      open: false,
      scrollLeft: 0,
      scrollWidth: 42,
      width: 1280,
      height: 720,
      dataset: {},
      style: {},
      children: [],
      classList: makeClassList(),
      appendChild(child) {
        this.children.push(child);
        if (this.tagName === 'SELECT' && this.children.length === 1 && this.value === '') {
          this.value = child.value ?? '';
        }
        return child;
      },
      replaceChildren(...next) {
        this.children = [...next];
        if (this.tagName === 'SELECT') {
          this.value = this.children[0]?.value ?? '';
        }
      },
      setAttribute(name, val) { attrs.set(name, String(val)); },
      getAttribute(name) { return attrs.get(name) ?? null; },
      addEventListener(type, fn) {
        if (!elListeners.has(type)) elListeners.set(type, []);
        elListeners.get(type).push(fn);
      },
      dispatchEvent(event) {
        for (const fn of elListeners.get(event.type) ?? []) fn(event);
        return !event.defaultPrevented;
      },
      click() { this.dispatchEvent({ type: 'click', preventDefault() {} }); },
      lastFocusOpts: null,
      closeCalls: 0,
      focus(opts) { this.lastFocusOpts = opts; activeElement = this; },
      blur() { if (activeElement === this) activeElement = null; },
      showModal() { this.open = true; },
      close() { this.open = false; this.closeCalls += 1; },
      getContext() { return makeCanvasContext(); },
      getBoundingClientRect() { return { ...canvasRect }; },
    };
    return el;
  }

  const ids = [
    ['sea', 'canvas'], ['night-label', 'span'], ['clock', 'time'], ['bearing', 'p'],
    ['lens-state', 'span'], ['horn-state', 'span'], ['trust-state', 'span'],
    ['lamp-state', 'span'], ['morse-symbols', 'output'], ['morse-text', 'output'], ['morse-delivery', 'span'],
    ['start-panel', 'div'], ['title-controls', 'ul'], ['schedule-error', 'p'],
    ['resume-saved', 'button'], ['start', 'button'], ['save-status', 'p'], ['previous-record', 'p'],
    ['pause-panel', 'div'], ['pause-save-status', 'p'], ['resume', 'button'],
    ['help-panel', 'div'], ['controls-list', 'ul'], ['incoming-wpm', 'select'], ['show-reference', 'input'], ['close-help', 'button'],
    ['dawn-panel', 'div'], ['morning-label', 'p'], ['dawn-title', 'h2'], ['summary', 'p'],
    ['record-status', 'p'], ['dawn-save-status', 'p'], ['next-night', 'button'], ['restart', 'button'], ['new-run', 'button'],
    ['log-panel', 'dialog'], ['log-title', 'h2'], ['log-guidance', 'p'], ['log-form', 'form'],
    ['log-stamp', 'p'], ['log-what', 'select'], ['log-empty', 'p'], ['log-note', 'select'],
    ['add-log-entry', 'button'], ['log-status', 'p'], ['log-no-entries', 'p'], ['log-entries', 'ol'], ['close-log', 'button'],
    ['watch-controls', 'aside'], ['watch-controls-list', 'ul'],
    ['morse-reference', 'aside'], ['morse-alphabet', 'div'],
    ['controls-hint', 'p'], ['help', 'button'], ['mute', 'button'],
  ];
  for (const [id, tag] of ids) elements.set(id, makeElement(id, tag));
  elements.get('incoming-wpm').value = '8';
  elements.get('start').textContent = 'Take the watch →';
  elements.get('restart').textContent = 'Restart this night →';
  for (const hiddenId of [
    'resume-saved', 'previous-record', 'pause-panel',
    'help-panel', 'dawn-panel', 'next-night', 'new-run', 'log-empty', 'morse-reference',
  ]) {
    elements.get(hiddenId).hidden = true;
  }

  const store = new Map(Object.entries(initialStorage));
  const storageConfig = { getItemError, setItemError, removeItemError };
  const localStorageMock = {
    getItem(key) {
      if (storageConfig.getItemError) throw storageConfig.getItemError;
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, val) {
      if (storageConfig.setItemError) throw storageConfig.setItemError;
      store.set(key, String(val));
    },
    removeItem(key) {
      if (storageConfig.removeItemError) throw storageConfig.removeItemError;
      store.delete(key);
    },
  };

  const doc = {
    hidden: false,
    get activeElement() { return activeElement; },
    getElementById(id) { return elements.get(id) ?? null; },
    createElement(tag) { return makeElement('', tag); },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
    dispatchEvent(event) {
      for (const fn of docListeners.get(event.type) ?? []) fn(event);
    },
  };

  const win = {
    devicePixelRatio: 1,
    location: { search: search ?? `?e2e=1&seed=${seed}` },
    matchMedia: () => ({ matches: false }),
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatchEvent(event) {
      for (const fn of listeners.get(event.type) ?? []) fn(event);
      return !event.defaultPrevented;
    },
  };

  Object.defineProperty(globalThis, 'window', { value: win, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { webdriver }, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    value: (cb) => { rafCallback = cb; return 1; },
    configurable: true,
    writable: true,
  });

  const mainUrl = new URL(`../js/main.js?adv=${++bootSeq}`, import.meta.url);
  await import(mainUrl.href);

  return {
    elements,
    store,
    storageConfig,
    win,
    doc,
    setCanvasRect(rect) { canvasRect = { left: 0, top: 0, ...rect }; },
    get rafCallback() { return rafCallback; },
    keeper: win.__keeper,
    keydown(code, opts = {}) {
      const event = {
        type: 'keydown',
        code,
        key: opts.key ?? code,
        repeat: Boolean(opts.repeat),
        ctrlKey: Boolean(opts.ctrlKey),
        metaKey: Boolean(opts.metaKey),
        altKey: Boolean(opts.altKey),
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
      };
      win.dispatchEvent(event);
      return event;
    },
    keyup(code, opts = {}) {
      const event = { code, key: opts.key ?? code, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      win.dispatchEvent({ type: 'keyup', ...event });
    },
  };
}

test('main.js: save/resume lifecycle, 1s checkpoint throttling, mid-keying preservation, five-night completion, relief, and log coexistence', async () => {
  // 1. Corrupt save and corrupt log at boot are handled; legacy v2 record is rendered.
  const corruptBoot = await bootMain({
    initialStorage: {
      [SAVE_KEY]: '{not valid json',
      [LOG_KEY]: '{bad log',
      [RECORD_KEY]: JSON.stringify({ version: 2, seed: 108, safe: 2, wrecked: 1 }),
    },
  });
  assert.equal(corruptBoot.store.has(SAVE_KEY), false);
  assert.equal(corruptBoot.elements.get('save-status').textContent, 'The saved watch could not be read. Take a fresh watch.');
  assert.equal(corruptBoot.elements.get('previous-record').textContent, 'Last watch: 2 safe · 1 wrecked');
  assert.equal(corruptBoot.elements.get('resume-saved').hidden, true);
  assert.equal(corruptBoot.elements.get('title-controls').children.length, 8);
  assert.equal(corruptBoot.elements.get('morse-alphabet').children.length, 36);

  // 2. Start watch: persists immediately, throttles auto-checkpoints to 1s, persists on keyup/WPM/pagehide.
  corruptBoot.elements.get('start').click();
  assert.equal(corruptBoot.keeper.mode, 'play');
  assert.equal(corruptBoot.elements.get('night-label').textContent, 'Night 01 / First watch');
  assert.equal(corruptBoot.elements.get('watch-controls').getAttribute('aria-hidden'), 'false');
  const firstSave = corruptBoot.store.get(SAVE_KEY);
  assert.ok(firstSave);

  corruptBoot.keeper.advance(0.5);
  assert.equal(corruptBoot.store.get(SAVE_KEY), firstSave, 'checkpoint throttled within 1s');
  corruptBoot.keeper.advance(0.6);
  const afterOneSec = corruptBoot.store.get(SAVE_KEY);
  assert.notEqual(afterOneSec, firstSave, 'checkpoint written once >= 1s elapsed');

  // Keyup forces immediate persistence even < 1s after last checkpoint.
  corruptBoot.keydown('KeyK');
  assert.equal(corruptBoot.elements.get('watch-controls').getAttribute('aria-hidden'), 'true');
  corruptBoot.keeper.advance(0.1);
  const beforeKeyupSave = corruptBoot.store.get(SAVE_KEY);
  corruptBoot.keyup('KeyK');
  assert.notEqual(corruptBoot.store.get(SAVE_KEY), beforeKeyupSave);

  // Changing incoming WPM to 5 updates settings and forces immediate save.
  corruptBoot.elements.get('incoming-wpm').value = '5';
  corruptBoot.elements.get('incoming-wpm').dispatchEvent({ type: 'change' });
  assert.equal(parseSave(corruptBoot.store.get(SAVE_KEY)).settings.incomingWpm, 5);

  // Toggle help, reference card, mute, pause, blur, visibilitychange, and RAF frame stepping.
  corruptBoot.elements.get('help').click();
  assert.equal(corruptBoot.keeper.mode, 'help');
  corruptBoot.elements.get('show-reference').checked = true;
  corruptBoot.elements.get('show-reference').dispatchEvent({ type: 'change' });
  assert.equal(corruptBoot.elements.get('morse-reference').hidden, false);
  corruptBoot.elements.get('close-help').click();
  assert.equal(corruptBoot.keeper.mode, 'play');

  corruptBoot.elements.get('mute').click();
  assert.equal(corruptBoot.elements.get('mute').getAttribute('aria-pressed'), 'true');
  assert.equal(corruptBoot.elements.get('mute').textContent, 'Unmute horn');
  corruptBoot.elements.get('mute').click();
  assert.equal(corruptBoot.elements.get('mute').getAttribute('aria-pressed'), 'false');
  assert.equal(corruptBoot.elements.get('mute').textContent, 'Mute horn');

  corruptBoot.doc.hidden = true;
  corruptBoot.doc.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(corruptBoot.keeper.mode, 'pause');
  corruptBoot.elements.get('resume').click();
  assert.equal(corruptBoot.keeper.mode, 'play');

  const timeBeforeRaf = corruptBoot.keeper.state.time;
  corruptBoot.rafCallback(1000);
  corruptBoot.rafCallback(1050);
  assert.ok(corruptBoot.keeper.state.time > timeBeforeRaf);

  // Hold signal lamp mid-character and trigger pagehide so the mid-keying state is saved.
  corruptBoot.keydown('KeyK');
  corruptBoot.keeper.advance(0.05);
  corruptBoot.win.dispatchEvent({ type: 'pagehide' });
  const midKeySave = corruptBoot.store.get(SAVE_KEY);
  assert.notEqual(parseSave(midKeySave).morse.down, null);

  // 3. Boot with a mid-watch state at t = 270.1 s (with seen trawler + active keying) and verify Resume + KeyL + Dawn!
  let stateAt270 = fastForwardTo(createState(108), 270.1);
  stateAt270.settings.incomingWpm = 5;
  stateAt270.ships[0].everSeen = true;
  stateAt270.ships[0].status = 'wrecked';
  stateAt270.ships[0].wreckedAt = 115;
  stateAt270.ships.at(-1).everSeen = true;
  stateAt270.ships.at(-1).status = 'wrecked';
  stateAt270.ships.at(-1).wreckedAt = 250;
  stateAt270.lamp = true;
  stateAt270.morse.down = 270000;

  const resumeBoot = await bootMain({
    initialStorage: {
      [SAVE_KEY]: serializeSave(stateAt270),
    },
  });
  assert.equal(resumeBoot.elements.get('resume-saved').hidden, false);
  assert.equal(resumeBoot.elements.get('resume-saved').textContent, 'Resume night 1 →');
  assert.equal(resumeBoot.elements.get('start').textContent, 'Start a new run →');
  resumeBoot.elements.get('resume-saved').click();
  assert.equal(resumeBoot.keeper.mode, 'play');
  assert.equal(resumeBoot.elements.get('incoming-wpm').value, '5');
  assert.equal(resumeBoot.keeper.state.morse.down, 270000, 'resume-saved preserves active morse keying');

  // Open Keeper's Log at t = 270.1 s (00:00), record an entry with a note, then close via Escape.
  resumeBoot.keydown('KeyL');
  assert.equal(resumeBoot.keeper.mode, 'log');
  assert.match(resumeBoot.elements.get('log-stamp').textContent, /^Night 1 · 00:00 · /);
  resumeBoot.elements.get('log-note').value = 'running dark';
  resumeBoot.elements.get('log-form').dispatchEvent({ type: 'submit', preventDefault() {} });
  assert.equal(resumeBoot.elements.get('log-entries').children.length, 1);
  assert.match(resumeBoot.elements.get('log-entries').children[0].textContent, /running dark/);
  resumeBoot.keydown('Escape');
  assert.equal(resumeBoot.keeper.mode, 'play');

  // Boot at Night 1 near-dawn (539.9 s) with 2 wrecks, step 0.2 s to reach dawn, and advance to Night 2.
  const night1NearDawn = fastForwardTo(createState(108), NIGHT_SECONDS - 0.1);
  night1NearDawn.ships[0].everSeen = true;
  night1NearDawn.ships[0].status = 'wrecked';
  night1NearDawn.ships[0].wreckedAt = 115;
  night1NearDawn.ships[1].everSeen = true;
  night1NearDawn.ships[1].status = 'wrecked';
  night1NearDawn.ships[1].wreckedAt = 200;
  night1NearDawn.ships[2].everSeen = true;
  night1NearDawn.ships[2].status = 'safe';

  const dawn1Boot = await bootMain({
    initialStorage: {
      [SAVE_KEY]: serializeSave(night1NearDawn),
    },
  });
  dawn1Boot.elements.get('resume-saved').click();
  dawn1Boot.keeper.advance(0.2);
  assert.equal(dawn1Boot.keeper.mode, 'dawn');
  assert.equal(dawn1Boot.elements.get('morning-label').textContent, '06:00 · Night 1 · Morning record');
  assert.equal(dawn1Boot.elements.get('dawn-title').textContent, 'The watch is over.');
  assert.match(dawn1Boot.elements.get('summary').textContent, /1 ship passed safely\. 2 ships wrecked\./);
  assert.match(dawn1Boot.elements.get('summary').textContent, /2 wrecks across the run\./);
  assert.equal(dawn1Boot.elements.get('next-night').hidden, false);
  assert.equal(dawn1Boot.elements.get('next-night').textContent, 'Take night 2 →');
  const savedRecord = parseRecord(dawn1Boot.store.get(RECORD_KEY));
  assert.equal(savedRecord.version, 3);
  assert.equal(savedRecord.cumulativeWrecks, 2);

  dawn1Boot.elements.get('next-night').click();
  assert.equal(dawn1Boot.keeper.mode, 'play');
  assert.equal(dawn1Boot.elements.get('night-label').textContent, 'Night 02 / The watch');
  assert.equal(dawn1Boot.keeper.state.nightParams.night, 2);

  // 4. Night 2 near-dawn with 3rd cumulative wreck -> Relieved of duty at dawn, and Restart this night preserves 2 prior wrecks!
  const night2NearDawn = fastForwardTo(createState(108, { night: 2 }), NIGHT_SECONDS - 0.1);
  night2NearDawn.run.mornings = [
    { night: 1, safe: 1, wrecked: 2, unseen: 10, lost: 0, logged: 0, cumulativeWrecks: 2, relieved: false },
  ];
  night2NearDawn.ships[0].everSeen = true;
  night2NearDawn.ships[0].status = 'wrecked';
  night2NearDawn.ships[0].wreckedAt = 120;

  const reliefBoot = await bootMain({
    initialStorage: {
      [SAVE_KEY]: serializeSave(night2NearDawn),
    },
  });
  reliefBoot.elements.get('resume-saved').click();
  reliefBoot.keeper.advance(0.2);
  assert.equal(reliefBoot.keeper.mode, 'dawn');
  assert.equal(reliefBoot.elements.get('dawn-title').textContent, 'Relieved of duty');
  assert.equal(reliefBoot.elements.get('next-night').hidden, true);
  assert.equal(reliefBoot.elements.get('new-run').hidden, true);
  assert.match(reliefBoot.elements.get('record-status').textContent, /The Board has relieved you after three observed wrecks/);

  reliefBoot.elements.get('restart').click();
  assert.equal(reliefBoot.keeper.mode, 'play');
  assert.equal(reliefBoot.keeper.state.nightParams.night, 2);
  assert.equal(reliefBoot.keeper.state.time, 0);
  assert.equal(summary(reliefBoot.keeper.state).cumulativeWrecks, 2);
  assert.equal(summary(reliefBoot.keeper.state).relieved, false);

  // 5. Booting from a saved Night 5 dawn state shows Five nights at the light and New Run resets to Night 1.
  let night5Dawn = createState(108, { night: 5 });
  night5Dawn.run.mornings = [
    { night: 1, safe: 5, wrecked: 0, unseen: 2, lost: 0, logged: 0, cumulativeWrecks: 0, relieved: false },
    { night: 2, safe: 5, wrecked: 0, unseen: 2, lost: 0, logged: 0, cumulativeWrecks: 0, relieved: false },
    { night: 3, safe: 5, wrecked: 1, unseen: 2, lost: 0, logged: 0, cumulativeWrecks: 1, relieved: false },
    { night: 4, safe: 5, wrecked: 0, unseen: 2, lost: 0, logged: 0, cumulativeWrecks: 1, relieved: false },
  ];
  night5Dawn = installSpecialty(night5Dawn, specialtyApproach({
    id: 'lb-dawn',
    type: 'lifeboat',
    bearing: 90,
    spawnTime: 0,
    spawnRange: 250,
  }));
  night5Dawn = fastForwardTo(night5Dawn, NIGHT_SECONDS);
  night5Dawn.ships[0].everSeen = true;
  night5Dawn.ships[0].status = 'safe';
  night5Dawn.ships[1].everSeen = true;
  night5Dawn.ships[1].status = 'lost';
  night5Dawn.ships[1].lostAt = 30;
  night5Dawn.ships[1].reply = null;
  night5Dawn.ships[1].speed = 0;

  const night5Boot = await bootMain({
    initialStorage: {
      [SAVE_KEY]: serializeSave(night5Dawn),
      [RECORD_KEY]: JSON.stringify({
        version: 3, seed: 108, night: 5, safe: 5, wrecked: 0, unseen: 8, lost: 1, logged: 0, cumulativeWrecks: 1, relieved: false,
      }),
    },
  });
  assert.equal(night5Boot.elements.get('resume-saved').textContent, 'Review morning 5 →');
  assert.match(night5Boot.elements.get('previous-record').textContent, /Last morning · night 5: 5 safe · 0 wrecked · 1 wrecks this run/);
  night5Boot.storageConfig.setItemError = new Error('Record write blocked');
  night5Boot.elements.get('resume-saved').click();
  assert.equal(night5Boot.keeper.mode, 'dawn');
  assert.equal(night5Boot.elements.get('dawn-title').textContent, 'Five nights at the light.');
  assert.match(night5Boot.elements.get('summary').textContent, /1 lost in distress\./);
  assert.match(night5Boot.elements.get('record-status').textContent, /Your five watches are complete\./);
  assert.match(night5Boot.elements.get('record-status').textContent, /This browser could not keep the morning record\./);
  assert.equal(night5Boot.elements.get('next-night').hidden, true);
  assert.equal(night5Boot.elements.get('new-run').hidden, false);

  night5Boot.storageConfig.setItemError = null;
  night5Boot.elements.get('new-run').click();
  assert.equal(night5Boot.keeper.mode, 'play');
  assert.equal(night5Boot.keeper.state.nightParams.night, 1);
  assert.equal(night5Boot.keeper.state.run.mornings.length, 0);

  // 6. Storage write and read errors, seed query boundaries, HUD/mode/focus/log/schedule edge cases.
  const quotaErr = Object.assign(new Error('Quota full'), { name: 'QuotaExceededError', code: 22 });
  const quotaBoot = await bootMain({ seed: 'bad-seed', setItemError: quotaErr });
  assert.equal(quotaBoot.keeper.seed, 108);
  assert.equal(quotaBoot.elements.get('previous-record').hidden, true);
  assert.equal(quotaBoot.elements.get('previous-record').textContent, '');
  assert.equal(quotaBoot.elements.get('save-status').textContent, '');
  assert.equal(quotaBoot.elements.get('pause-save-status').textContent, '');
  assert.equal(quotaBoot.elements.get('dawn-save-status').textContent, '');
  assert.equal(quotaBoot.doc.activeElement, quotaBoot.elements.get('start'));
  assert.deepEqual(quotaBoot.elements.get('start').lastFocusOpts, { preventScroll: true });
  assert.equal(quotaBoot.elements.get('watch-controls').classList.contains('is-faded'), true);
  assert.equal(quotaBoot.elements.get('watch-controls').getAttribute('aria-hidden'), 'true');
  assert.equal(quotaBoot.elements.get('clock').textContent, '18:00');
  assert.equal(quotaBoot.elements.get('bearing').textContent, '285° · 12.0 s / revolution');
  assert.equal(quotaBoot.elements.get('lens-state').textContent, 'Lens at rest');
  assert.equal(quotaBoot.elements.get('horn-state').textContent, 'Horn silent');
  assert.equal(quotaBoot.elements.get('horn-state').classList.contains('sounding'), false);
  assert.equal(quotaBoot.elements.get('trust-state').textContent, 'Skipper trust · 100%');
  assert.equal(quotaBoot.elements.get('lamp-state').textContent, '○ Lamp shuttered');
  assert.equal(quotaBoot.elements.get('lamp-state').classList.contains('sounding'), false);
  assert.equal(quotaBoot.elements.get('morse-symbols').textContent, '—');
  assert.equal(quotaBoot.elements.get('morse-text').textContent, 'Key K to signal');
  assert.equal(quotaBoot.elements.get('morse-delivery').textContent, 'Directed to the vessel in the beam');
  assert.equal(quotaBoot.elements.get('morse-symbols').scrollLeft, 42);
  assert.equal(quotaBoot.elements.get('morse-text').scrollLeft, 42);
  assert.equal(quotaBoot.elements.get('morse-alphabet').children[0].textContent, 'A .-');
  assert.equal(quotaBoot.elements.get('morse-alphabet').children.at(-1).textContent, '9 ----.');
  assert.equal(quotaBoot.elements.get('log-note').children[0].value, '');
  assert.equal(quotaBoot.elements.get('log-note').children[0].textContent, 'No note');
  assert.deepEqual(
    quotaBoot.elements.get('controls-list').children.map((c) => c.textContent),
    quotaBoot.elements.get('title-controls').children.map((c) => c.textContent),
  );
  assert.deepEqual(
    quotaBoot.elements.get('watch-controls-list').children.map((c) => c.textContent),
    quotaBoot.elements.get('title-controls').children.map((c) => c.textContent),
  );
  assert.match(quotaBoot.elements.get('controls-hint').textContent, /slow.*fast.*hold.*horn.*signal lamp.*keeper’s log.*pause/i);

  // Before activeRun is true, pagehide/keyup/WPM change do not call setItem, and start-mode pointerdown/RAF are no-ops.
  quotaBoot.win.dispatchEvent({ type: 'pagehide' });
  quotaBoot.keyup('KeyK');
  quotaBoot.elements.get('incoming-wpm').dispatchEvent({ type: 'change' });
  assert.equal(quotaBoot.elements.get('save-status').textContent, '');
  quotaBoot.win.dispatchEvent({ type: 'pointerdown' });
  quotaBoot.rafCallback(1000);
  quotaBoot.rafCallback(1050);
  assert.equal(quotaBoot.keeper.state.time, 0);
  assert.equal(quotaBoot.keydown('Space').defaultPrevented, false);
  assert.equal(quotaBoot.keydown('Escape').defaultPrevented, true);
  assert.equal(quotaBoot.keeper.mode, 'start');

  // Empty log modal from start screen focuses log-title and disables controls.
  quotaBoot.keydown('KeyL');
  assert.equal(quotaBoot.keeper.mode, 'log');
  assert.equal(quotaBoot.elements.get('log-panel').open, true);
  assert.equal(quotaBoot.elements.get('log-what').disabled, true);
  assert.equal(quotaBoot.elements.get('add-log-entry').disabled, true);
  assert.equal(quotaBoot.elements.get('log-empty').hidden, false);
  assert.equal(quotaBoot.elements.get('log-no-entries').hidden, false);
  assert.equal(quotaBoot.elements.get('log-status').textContent, 'Entries are kept in this browser.');
  assert.equal(quotaBoot.doc.activeElement, quotaBoot.elements.get('log-title'));

  // Invalid log submit in log mode sets validation message; KeyH ignored; repeat KeyL/Escape ignored; cancel closes.
  quotaBoot.elements.get('log-form').dispatchEvent({ type: 'submit', preventDefault() {} });
  assert.equal(
    quotaBoot.elements.get('log-status').textContent,
    'Choose a vessel revealed during this watch and a note from the list.',
  );
  assert.equal(quotaBoot.keydown('KeyH').defaultPrevented, false);
  assert.equal(quotaBoot.keeper.mode, 'log');
  assert.equal(quotaBoot.keydown('KeyL', { repeat: true }).defaultPrevented, true);
  assert.equal(quotaBoot.keeper.mode, 'log');
  assert.equal(quotaBoot.keydown('Escape', { repeat: true }).defaultPrevented, true);
  assert.equal(quotaBoot.keeper.mode, 'log');
  let cancelPrevented = false;
  quotaBoot.elements.get('log-panel').dispatchEvent({
    type: 'cancel',
    preventDefault() { cancelPrevented = true; },
  });
  assert.equal(cancelPrevented, true);
  assert.equal(quotaBoot.keeper.mode, 'start');
  assert.equal(quotaBoot.elements.get('log-panel').open, false);
  assert.equal(quotaBoot.elements.get('log-panel').closeCalls, 1);

  // Starting watch with quota error sets all three status elements and throttles retry for 1s.
  quotaBoot.elements.get('start').click();
  assert.equal(quotaBoot.doc.activeElement, null);
  for (const statusId of ['save-status', 'pause-save-status', 'dawn-save-status']) {
    assert.equal(
      quotaBoot.elements.get(statusId).textContent,
      'This browser cannot save your watch. Keep this page open to continue.',
    );
  }
  assert.equal(quotaBoot.elements.get('watch-controls').classList.contains('is-faded'), false);

  // 8s boundary for watch-controls fade, plus pointerdown dismissal after restart.
  quotaBoot.keeper.advance(7.99);
  assert.equal(quotaBoot.elements.get('watch-controls').classList.contains('is-faded'), false);
  quotaBoot.keeper.advance(0.01);
  assert.equal(quotaBoot.elements.get('watch-controls').classList.contains('is-faded'), true);

  // Live HUD updates: lens held, horn sounding, morse preview, no-vessel vs in-beam delivery.
  quotaBoot.storageConfig.setItemError = null;
  quotaBoot.keydown('Space');
  quotaBoot.keydown('KeyH');
  quotaBoot.keeper.advance(0.05);
  assert.equal(quotaBoot.elements.get('lens-state').textContent, 'Lens held');
  assert.equal(quotaBoot.elements.get('horn-state').textContent, 'Horn sounding');
  assert.equal(quotaBoot.elements.get('horn-state').classList.contains('sounding'), true);
  quotaBoot.keyup('KeyH');
  quotaBoot.keeper.advance(0.05);
  assert.equal(quotaBoot.elements.get('horn-state').textContent, 'Horn silent');
  assert.equal(quotaBoot.elements.get('horn-state').classList.contains('sounding'), false);

  // Morse preview: dot (.) + dash (-) -> '·−' / 'A', then 7u gap sends with no vessel in beam.
  quotaBoot.keydown('KeyK');
  quotaBoot.keeper.advance(0.1);
  assert.equal(quotaBoot.elements.get('lamp-state').textContent, '● Lamp open');
  assert.equal(quotaBoot.elements.get('lamp-state').classList.contains('sounding'), true);
  assert.equal(quotaBoot.elements.get('morse-delivery').textContent, 'Keying…');
  assert.equal(quotaBoot.elements.get('morse-symbols').textContent, '·');
  assert.equal(quotaBoot.elements.get('morse-text').textContent, 'E');
  quotaBoot.keyup('KeyK');
  quotaBoot.keeper.advance(0.12);
  assert.equal(quotaBoot.elements.get('lamp-state').textContent, '○ Lamp shuttered');
  assert.equal(quotaBoot.elements.get('lamp-state').classList.contains('sounding'), false);
  assert.equal(quotaBoot.elements.get('morse-delivery').textContent, 'Keying…');
  quotaBoot.keydown('KeyK');
  quotaBoot.keeper.advance(0.36);
  assert.equal(quotaBoot.elements.get('morse-symbols').textContent, '·−');
  assert.equal(quotaBoot.elements.get('morse-text').textContent, 'A');
  quotaBoot.keyup('KeyK');
  quotaBoot.keeper.advance(1.5);
  assert.equal(quotaBoot.elements.get('morse-symbols').textContent, '·−');
  assert.equal(quotaBoot.elements.get('morse-text').textContent, 'A');
  assert.equal(quotaBoot.elements.get('morse-delivery').textContent, 'Sent · no vessel in beam');
  quotaBoot.keyup('Space');

  // Modifier keys and repeat pause are ignored; visibilitychange when hidden=false does not pause; blur pauses.
  assert.equal(quotaBoot.keydown('KeyP', { ctrlKey: true }).defaultPrevented, false);
  assert.equal(quotaBoot.keydown('KeyP', { metaKey: true }).defaultPrevented, false);
  assert.equal(quotaBoot.keydown('KeyP', { altKey: true }).defaultPrevented, false);
  assert.equal(quotaBoot.keeper.mode, 'play');
  assert.equal(quotaBoot.keydown('KeyP', { repeat: true }).defaultPrevented, true);
  assert.equal(quotaBoot.keeper.mode, 'play');
  quotaBoot.doc.hidden = false;
  quotaBoot.doc.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(quotaBoot.keeper.mode, 'play');
  quotaBoot.win.dispatchEvent({ type: 'blur' });
  assert.equal(quotaBoot.keeper.mode, 'pause');
  assert.equal(quotaBoot.doc.activeElement, quotaBoot.elements.get('resume'));
  assert.equal(quotaBoot.elements.get('log-panel').closeCalls, 1, 'close() not called when log-panel was not open');

  // Escape in pause resumes play; slash opens help and Escape returns to play; RAF clamps dt at 0.1s.
  quotaBoot.keydown('Escape');
  assert.equal(quotaBoot.keeper.mode, 'play');
  quotaBoot.keydown('Slash');
  assert.equal(quotaBoot.keeper.mode, 'help');
  assert.equal(quotaBoot.doc.activeElement, quotaBoot.elements.get('close-help'));
  quotaBoot.keydown('Escape');
  assert.equal(quotaBoot.keeper.mode, 'play');

  const tBeforeClamp = quotaBoot.keeper.state.time;
  quotaBoot.rafCallback(5000);
  assert.equal(quotaBoot.keeper.state.time, tBeforeClamp);
  quotaBoot.rafCallback(6000);
  assert.ok(Math.abs(quotaBoot.keeper.state.time - (tBeforeClamp + 0.1)) < 1e-9, 'RAF clamps frame step at 0.1s');

  // Resize updates canvas size.
  quotaBoot.setCanvasRect({ width: 1600, height: 900 });
  quotaBoot.win.dispatchEvent({ type: 'resize' });
  assert.equal(quotaBoot.elements.get('sea').width, 1600);
  assert.equal(quotaBoot.elements.get('sea').height, 900);

  // checkSchedule failure branch in resumeSaved and beginNight (via temporary Object.prototype.period).
  try {
    Object.defineProperty(Object.prototype, 'period', {
      value: 1000,
      configurable: true,
      writable: true,
    });
    const invalidScheduleBoot = await bootMain({
      initialStorage: { [SAVE_KEY]: serializeSave(stateAt270) },
    });
    assert.equal(invalidScheduleBoot.elements.get('schedule-error').hidden, false);
    assert.equal(
      invalidScheduleBoot.elements.get('schedule-error').textContent,
      'Cannot start watch: invalid ship schedule (1: insufficient-passes, 1/4 passes).',
    );
    assert.equal(invalidScheduleBoot.elements.get('start').disabled, true);
    invalidScheduleBoot.elements.get('resume-saved').click();
    assert.equal(invalidScheduleBoot.keeper.mode, 'start');
    invalidScheduleBoot.elements.get('start').click();
    assert.equal(invalidScheduleBoot.keeper.mode, 'start');
  } finally {
    delete Object.prototype.period;
  }

  // Seed query parameter boundaries.
  const defaultSeedBoot = await bootMain({ search: '?e2e=1' });
  assert.equal(defaultSeedBoot.keeper.seed, 108);
  const zeroSeedBoot = await bootMain({ search: '?e2e=1&seed=0' });
  assert.equal(zeroSeedBoot.keeper.seed, 0);
  const maxSeedBoot = await bootMain({ search: '?e2e=1&seed=4294967295' });
  assert.equal(maxSeedBoot.keeper.seed, 0xffffffff);
  const negSeedBoot = await bootMain({ search: '?e2e=1&seed=-1' });
  assert.equal(negSeedBoot.keeper.seed, 108);
  const overSeedBoot = await bootMain({ search: '?e2e=1&seed=4294967296' });
  assert.equal(overSeedBoot.keeper.seed, 108);
  const noE2eBoot = await bootMain({ search: '?seed=42' });
  assert.equal(noE2eBoot.keeper, undefined);

  const readErrBoot = await bootMain({ webdriver: false, getItemError: new Error('Blocked') });
  assert.equal(readErrBoot.keeper, undefined);
  assert.equal(
    readErrBoot.elements.get('save-status').textContent,
    'This browser cannot save your watch. Keep this page open to continue.',
  );
  readErrBoot.keydown('KeyL');
  assert.equal(
    readErrBoot.elements.get('log-status').textContent,
    'This browser cannot keep the log. Entries remain for this visit.',
  );
});

test('sim.js whole-file fast unit guard: constants, budget, visibility, specialty, morse, horn, and navigation', () => {
  assert.equal(SMUGGLER_FLEE_SECONDS, 3);
  assert.equal(SMUGGLER_LIT_THROTTLE, 0.5);
  assert.equal(LIFEBOAT_LOST_SECONDS, 24);
  assert.equal(LIFEBOAT_DRIFT_THROTTLE, 0.15);
  assert.equal(COASTER_ASK_SECONDS, 1);
  assert.equal(AFTERIMAGE_SECONDS, 1.5);
  assert.equal(CONE_DEGREES, 14);
  assert.equal(BUDGET_PERIOD_SECONDS, 12);
  assert.deepEqual(NIGHT_PASSES, [4, 4, 3, 3, 2]);
  assert.equal( Object.isFrozen(NIGHT_PASSES), true);
  assert.equal(CLEAR_MARGIN, 20);
  assert.equal(FAST_SHIP_SPEED, 8);
  assert.deepEqual(NAVIGATION, {
    exitRange: 600,
    destinationLeg: 1600,
    maxOffset: 179,
    searchStep: 1,
    predictionSeconds: 2400,
    settleDegrees: 0.05,
    settleYaw: 0.01,
    helmGain: 1.5,
  });
  assert.equal(Object.isFrozen(NAVIGATION), true);
  assert.deepEqual(HAZARD, {
    minCount: 3,
    maxCount: 7,
    minRadius: 6,
    maxRadius: 34,
    smallMaxRadius: 10,
    smallCount: 2,
    minCentre: 160,
    maxCentre: 250,
    angleJitter: 4,
  });
  assert.equal(Object.isFrozen(HAZARD), true);

  // wrapBearing, clampSpeed, fogReach, bearingTo, isLit
  assert.equal(wrapBearing(0), 0);
  assert.equal(wrapBearing(360), 0);
  assert.equal(wrapBearing(-90), 270);
  assert.equal(wrapBearing(725), 5);
  assert.throws(() => wrapBearing(NaN), { name: 'TypeError', message: 'Bearing must be finite' });

  assert.equal(clampSpeed(5), SPEED.slow);
  assert.equal(clampSpeed(12), 12);
  assert.equal(clampSpeed(30), 30);
  assert.equal(clampSpeed(60), 60);
  assert.equal(clampSpeed(90), SPEED.fast);
  assert.throws(() => clampSpeed(Infinity), { name: 'TypeError', message: 'Speed must be finite' });

  assert.equal(fogReach(-1), 500);
  assert.equal(fogReach(0), 500);
  assert.equal(fogReach(0.5), 390);
  assert.equal(fogReach(1), 280);
  assert.equal(fogReach(2), 280);
  assert.throws(() => fogReach(NaN), { name: 'TypeError', message: 'Fog must be finite' });

  assert.equal(bearingTo({ x: 0, y: -100 }), 0);
  assert.equal(bearingTo({ x: 100, y: 0 }), 90);
  assert.equal(bearingTo({ x: 0, y: 100 }), 180);
  assert.equal(bearingTo({ x: -100, y: 0 }), 270);

  const litState = { beam: 0, fog: 0, trawler: { x: 0, y: -500 } };
  assert.equal(isLit(litState), true);
  assert.equal(isLit(litState, { x: 0, y: -500.01 }), false);
  const edgeRad = (CONE_DEGREES / 2) * (Math.PI / 180);
  assert.equal(isLit(litState, { x: Math.sin(edgeRad) * 400, y: -Math.cos(edgeRad) * 400 }), true);
  assert.equal(isLit(litState, { x: Math.sin(edgeRad + 0.001) * 400, y: -Math.cos(edgeRad + 0.001) * 400 }), false);

  // passesBetween, spawnRangeFor, validateSchedule
  assert.equal(passesBetween({ bearing: 0, tStart: 0, tEnd: 12, period: 12, phase0: 0 }), 1);
  assert.equal(passesBetween({ bearing: 0, tStart: 0, tEnd: 11.999, period: 12, phase0: 0 }), 0);
  assert.equal(passesBetween({ bearing: 180, tStart: 0, tEnd: 6, period: 12, phase0: 0 }), 1);
  assert.throws(() => passesBetween({ bearing: 0, tStart: 0, tEnd: 10, period: 0 }), {
    name: 'RangeError',
    message: 'Period must be finite and positive',
  });
  assert.throws(() => passesBetween({ bearing: 0, tStart: 10, tEnd: 5 }), {
    name: 'RangeError',
    message: 'Sweep window and bearings must be finite and ordered',
  });

  assert.equal(
    spawnRangeFor({ speed: 2, responseSeconds: 3, turnRadius: 10, passes: 4, period: 12, pnrRange: 100 }),
    100 + 6 + 10 + 2 * 5 * 12,
  );
  for (const bad of [
    { speed: 0, responseSeconds: 1, turnRadius: 1, passes: 1, pnrRange: 1 },
    { speed: 2, responseSeconds: -1, turnRadius: 1, passes: 1, pnrRange: 1 },
    { speed: 2, responseSeconds: 1, turnRadius: 1, passes: 0, pnrRange: 1 },
    { speed: 2, responseSeconds: 1, turnRadius: 1, passes: 1.5, pnrRange: 1 },
  ]) {
    assert.throws(() => spawnRangeFor(bad), { name: 'RangeError', message: 'Invalid radial approach budget' });
  }

  assert.throws(() => validateSchedule([], { night: 0, fogReach: 400 }), { name: 'RangeError', message: 'Invalid night' });
  assert.throws(() => validateSchedule([], { night: 1, fogReach: 0 }), {
    name: 'RangeError',
    message: 'Invalid night visibility',
  });
  assert.throws(() => validateSchedule('bad', { night: 1, fogReach: 400 }), {
    name: 'TypeError',
    message: 'Schedule must be an array',
  });
  const schedRes = validateSchedule(
    [
      null,
      { id: '', spawnTime: 0, bearing: 0, speed: 2, responseSeconds: 1, turnRadius: 1, pnrRange: 100, spawnRange: 200 },
      { id: 's1', spawnTime: 0, bearing: 0, speed: 2, responseSeconds: 10, turnRadius: 50, pnrRange: 200, spawnRange: 200 },
      { id: 's2', spawnTime: 0, bearing: 0, speed: 2, responseSeconds: 1, turnRadius: 1, pnrRange: 100, spawnRange: 120 },
    ],
    { night: 1, fogReach: 400, period: 12, phase0: 0 },
  );
  assert.equal(schedRes.ok, false);
  assert.deepEqual(
    schedRes.violations.map((v) => v.reason),
    ['invalid-ship', 'invalid-ship', 'pnr-before-visible', 'insufficient-passes'],
  );

  // specialtyApproach and installSpecialty
  const sb = specialtyApproach({ id: 'sb-1', bearing: -45, spawnTime: 10 });
  assert.equal(sb.type, 'speedboat');
  assert.equal(sb.smuggler, true);
  assert.equal(sb.distress, false);
  assert.equal(sb.bearing, 315);
  assert.equal(sb.speed, HULLS.speedboat.cruiseSpeed);

  const lb = specialtyApproach({ id: 7, type: 'lifeboat', smuggler: false, bearing: 90, spawnTime: 0, spawnRange: 250 });
  assert.equal(lb.type, 'lifeboat');
  assert.equal(lb.smuggler, false);
  assert.equal(lb.distress, true);
  assert.equal(lb.speed, HULLS.lifeboat.cruiseSpeed * LIFEBOAT_DRIFT_THROTTLE);

  for (const badSpec of [
    { id: 'x', type: 'trawler', bearing: 0 },
    { id: 'x', type: 'lifeboat', smuggler: true, bearing: 0 },
    { id: '', bearing: 0 },
    { id: 'x', bearing: NaN },
    { id: 'x', bearing: 0, spawnTime: -1 },
    { id: 'x', bearing: 0, spawnTime: NIGHT_SECONDS + 1 },
    { id: 'x', bearing: 0, spawnRange: 0 },
  ]) {
    assert.throws(() => specialtyApproach(badSpec), { name: 'RangeError', message: 'Invalid specialty approach' });
  }

  const base = { ...createState(108), schedule: [] };
  const withLbNow = installSpecialty(base, lb);
  assert.equal(withLbNow.ships.some((s) => s.id === 7), true);
  const withSbFuture = installSpecialty(base, sb);
  assert.equal(withSbFuture.ships.some((s) => s.id === 'sb-1'), false);
  assert.throws(() => installSpecialty(withLbNow, lb), {
    name: 'RangeError',
    message: 'Specialty must have a unique id and not arrive in the past',
  });
  assert.throws(() => installSpecialty({ ...base, time: 20 }, sb), {
    name: 'RangeError',
    message: 'Specialty must have a unique id and not arrive in the past',
  });

  // perception, resetLamp, hornRings
  const pLit = perception({ ...base, beam: bearingTo(base.trawler), fog: 0 });
  assert.equal(pLit.lit, true);
  assert.equal(pLit.opacity, 1);
  assert.deepEqual(pLit.hull, {
    x: base.trawler.x,
    y: base.trawler.y,
    heading: base.trawler.heading,
    status: 'underway',
  });
  assert.equal(pLit.engineCue, null);

  const fastShip = {
    ...base.trawler,
    x: 0,
    y: -200,
    speed: FAST_SHIP_SPEED,
    afterimage: 0.75,
    lastSeen: { x: 1, y: 2, heading: 3, status: 'underway' },
    reply: { startedAt: 1, repeatSeconds: 2, flashes: [{ on: 100, off: 300 }] },
  };
  const pUnlit = perception({ ...base, time: 3.15, beam: 180, fog: 0 }, fastShip);
  assert.equal(pUnlit.lit, false);
  assert.deepEqual(pUnlit.hull, fastShip.lastSeen);
  assert.ok(Math.abs(pUnlit.opacity - 0.15) < 1e-12);
  assert.equal(pUnlit.runningLights, true);
  assert.equal(pUnlit.signal, true);
  assert.equal(pUnlit.engineCue.bearing, 0);
  assert.ok(Math.abs(pUnlit.engineCue.intensity - 1 / (1 + 200 / 500)) < 1e-12);

  const lampDirty = {
    ...base,
    lamp: true,
    morse: { events: [{ down: 0, up: 100 }], down: 200, text: 'E', symbols: '.', unit: 150, lastMessage: { text: 'K' } },
  };
  const lampClean = resetLamp(lampDirty);
  assert.equal(lampClean.lamp, false);
  assert.deepEqual(lampClean.morse.events, []);
  assert.equal(lampClean.morse.down, null);
  assert.deepEqual(lampClean.morse.lastMessage, { text: 'K' });

  const ringState = { time: 10, fog: 0, blasts: [7.9, 8.5, 10, 10.1], ignoredBlasts: [8.5] };
  const rings = hornRings(ringState);
  assert.equal(rings.length, 2);
  assert.deepEqual(rings[0], { radius: hornRange(0) * 0.75, alpha: 0.25, ignored: true });
  assert.deepEqual(rings[1], { radius: 0, alpha: 1, ignored: false });

  // updateSpecialty: smuggler flee (>3s), coaster WHAT LIGHT (>=1s), lifeboat lost (>=24s) & rescue via 'K'
  const smugglerShip = { ...withLbNow.ships[0], id: 'smug', type: 'speedboat', smuggler: true, distress: false, x: 0, y: -200, speed: 8, reply: null };
  let smugState = { ...base, beam: 0, fog: 0, ships: [smugglerShip] };
  smugState = step(smugState, { hold: true }, 3);
  assert.equal(smugState.ships[0].response, 'none');
  smugState = step(smugState, { hold: true }, 0.04);
  assert.equal(smugState.ships[0].response, 'flee');

  const coasterShip = { ...base.trawler, id: 'coast', type: 'coaster', smuggler: false, distress: false, x: 0, y: -200, askedLight: false, reply: null };
  let coastState = { ...base, beam: 0, fog: 0, ships: [coasterShip] };
  coastState = step(coastState, { hold: true }, 1);
  assert.equal(coastState.ships[0].askedLight, true);
  assert.notEqual(coastState.ships[0].reply, null);

  const lifeboatShip = { ...withLbNow.ships.find((s) => s.id === 7), x: 0, y: -200 };
  let lbState = { ...base, beam: 180, fog: 0, ships: [lifeboatShip] };
  lbState = step(lbState, { hold: true }, 24);
  assert.equal(lbState.ships[0].status, 'lost');
  assert.equal(lbState.ships[0].speed, 0);
  assert.equal(lbState.ships[0].reply, null);

  // Morse 'R' (.-.) rescues lit lifeboat
  let rescueState = { ...base, beam: 0, fog: 0, ships: [{ ...lifeboatShip }] };
  rescueState = step(rescueState, { lamp: true, hold: true }, 0.12);
  rescueState = step(rescueState, { lamp: false, hold: true }, 0.12);
  rescueState = step(rescueState, { lamp: true, hold: true }, 0.36);
  rescueState = step(rescueState, { lamp: false, hold: true }, 0.12);
  rescueState = step(rescueState, { lamp: true, hold: true }, 0.12);
  rescueState = step(rescueState, { lamp: false, hold: true }, 1.2);
  assert.equal(rescueState.ships[0].status, 'safe');
  assert.equal(rescueState.ships[0].everSeen, true);

  // Horn spam (4th and 5th blasts within 20s) sets hornIgnoredUntil = time + 30, records ignoredBlasts, and clamps trust at 0
  let spamState = { ...base, ships: [] };
  for (let i = 0; i < 5; i += 1) {
    spamState = step(spamState, { horn: true, hold: true }, DT);
    if (i < 4) spamState = step(spamState, { horn: false, hold: true }, DT);
  }
  assert.equal(spamState.ignoredBlasts.length, 2);
  assert.ok(spamState.hornIgnoredUntil > 30);
  assert.equal(spamState.trust, 0);

  // Useful horn warning on endangered trawler preserves trust === 1 and sets turn-away;
  // step to reactAt with 1 close rock triggers chooseAvoidance (both 'out'/'resume' and 'blocked').
  let warnState = createState(108, { night: 1 });
  warnState = step(warnState, { horn: true, hold: true }, DT);
  assert.ok(warnState.trust >= 1 - 1e-9);
  assert.equal(warnState.trawler.warnedAt, DT);
  assert.equal(warnState.trawler.response, 'turn-away');
  assert.ok(warnState.trawler.reactAt > DT);

  // Fast blocked chooseAvoidance: ship 0.05 m from rock hits on tick 1 for all offsets (<2 ms).
  const rock0 = { kind: 'reef', x: 0, y: -150, radius: 10 };
  const blockedShip = {
    ...warnState.trawler,
    x: 0,
    y: -(150 + 10 + 8 + 20 + 0.01),
    heading: 180,
    speed: 3,
    warnedAt: 0,
    reactAt: 0,
    response: 'turn-away',
    navigation: null,
  };
  const blockedStepped = step({ ...base, hazards: [rock0], ships: [blockedShip] }, { hold: true }, DT);
  assert.equal(blockedStepped.ships[0].navigation.phase, 'blocked');
  assert.equal(blockedStepped.ships[0].navigation.sign, 0);

  // Fast clear chooseAvoidance + updateNavigation ('out' -> 'resume') + outward exitRange ('safe') + reef contact ('wrecked').
  const clearShip = {
    ...warnState.trawler,
    x: 33,
    y: -220,
    heading: 180,
    destination: { x: 33, y: 1400 },
    speed: 3,
    warnedAt: 0,
    reactAt: 0,
    response: 'turn-away',
    navigation: null,
  };
  let navState = step({ ...base, hazards: [rock0], ships: [clearShip] }, { hold: true }, DT);
  assert.equal(navState.ships[0].navigation.phase, 'out');
  assert.notEqual(navState.ships[0].navigation.sign, 0);
  // Once past the rock (y > -110), updateNavigation switches phase to 'resume'.
  navState.ships[0].y = -100;
  navState = step(navState, { hold: true }, DT);
  assert.equal(navState.ships[0].navigation.phase, 'resume');

  // Outward ship crossing NAVIGATION.exitRange (600 m) becomes 'safe'; inward ship at >600 m stays 'underway'.
  const outwardShip = { ...warnState.trawler, id: 'out-1', x: 0, y: -599.9, heading: 0, speed: 20, reactAt: null };
  const inwardFarShip = { ...warnState.trawler, id: 'in-1', x: 0, y: -605, heading: 180, speed: 2, reactAt: null };
  const contactShip = { ...warnState.trawler, id: 'wreck-1', x: 0, y: -167.9, heading: 180, speed: 10, reactAt: null };
  const contactLifeboat = { ...lifeboatShip, id: 'lb-contact', x: 0, y: -167.9, heading: 180, speed: 2 };
  const transitionState = step(
    { ...base, hazards: [rock0], ships: [outwardShip, inwardFarShip, contactShip, contactLifeboat] },
    { hold: true },
    0.1,
  );
  assert.equal(transitionState.ships[0].status, 'safe');
  assert.equal(transitionState.ships[1].status, 'underway');
  assert.equal(transitionState.ships[2].status, 'wrecked');
  assert.ok(transitionState.ships[2].wreckedAt > 0);
  assert.equal(transitionState.ships[3].status, 'underway');
  assert.equal(transitionState.ships[3].speed, 0);

  // Morse ROCKS (-.-. --- -.-. -.- ...) warns endangered lit trawler; WHAT/STEER prefix waits for second word.
  const endangeredShip = { ...warnState.trawler, warnedAt: null, reactAt: null, response: 'none' };
  let rocksState = {
    ...base,
    beam: bearingTo(endangeredShip),
    fog: 0,
    ships: [endangeredShip],
    trawler: endangeredShip,
  };
  rocksState.morse = {
    events: [{ down: 0, up: 100 }],
    down: null,
    text: 'ROCKS',
    symbols: '.-. --- -.-. -.- ...',
    unit: 100,
    lastMessage: null,
  };
  rocksState.time = 1;
  rocksState = step(rocksState, { lamp: false, hold: true }, DT);
  assert.equal(rocksState.ships[0].response, 'turn-away');
  assert.notEqual(rocksState.ships[0].warnedAt, null);
  assert.notEqual(rocksState.ships[0].reply, null);

  // Unfinished 'WHAT' and 'STEER' do not send at 7u gap.
  for (const prefix of ['WHAT', 'STEER']) {
    let prefixState = {
      ...base,
      time: 2,
      morse: {
        events: [{ down: 0, up: 100 }],
        down: null,
        text: prefix,
        symbols: '.',
        unit: 100,
        lastMessage: null,
      },
    };
    prefixState = step(prefixState, { lamp: false, hold: true }, DT);
    assert.equal(prefixState.morse.events.length, 1);
    assert.equal(prefixState.morse.lastMessage, null);
  }
});
