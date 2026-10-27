import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NIGHT_SECONDS,
  FOG_CURVES,
  SPAWN,
  TRAFFIC,
  TEETH,
  SPEED,
  fogAt,
  fogReach,
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
import { HULLS } from '../js/physics.js';
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

test('three-phase traffic arc shapes early/mid clear coasters and late threatening arrivals within maxThreats', () => {
  let earlyMidCoasters = 0;
  let lateThreatsNight1 = 0;
  let lateCoasterThreats = 0;
  let lateTrawlerThreats = 0;

  for (let seed = 0; seed < 40; seed += 1) {
    for (const night of [1, 3, 5]) {
      const fullSchedule = createState(seed, { night }).schedule;
      for (const ship of fullSchedule.slice(1)) {
        if (ship.spawnTime <= TRAFFIC.lateAfter) {
          assert.equal(ship.threatening, false, `seed ${seed} night ${night}: no extra threats at/before ${TRAFFIC.lateAfter}`);
          assert.equal(ship.type, 'coaster');
          earlyMidCoasters += 1;
        } else if (ship.threatening) {
          if (night === 1) {
            assert.equal(ship.type, 'trawler', '4-pass nights only admit trawlers as threats');
            lateThreatsNight1 += 1;
          } else if (ship.type === 'coaster') {
            lateCoasterThreats += 1;
          } else if (ship.type === 'trawler') {
            lateTrawlerThreats += 1;
          }
        }
      }
      for (const entry of fullSchedule) {
        const overlappingThreats = fullSchedule.filter(
          (other) => other.spawnTime <= entry.spawnTime && other.exitTime >= entry.spawnTime && other.threatening,
        );
        assert.ok(overlappingThreats.length <= TRAFFIC.maxThreats);
      }
    }
  }
  assert.ok(earlyMidCoasters > 100);
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

  const preSnap = step({ ...base, time: NIGHT_SECONDS - 2e-7 }, { horn: true, lamp: true, hold: true }, 1e-7);
  assert.equal(preSnap.phase, 'night');
  assert.ok(NIGHT_SECONDS - preSnap.time > 1e-8);
  assert.equal(preSnap.horn, true);
  assert.equal(preSnap.lamp, true);

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
      current = nextNight(dawn);
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
      focus() { activeElement = this; },
      blur() { if (activeElement === this) activeElement = null; },
      showModal() { this.open = true; },
      close() { this.open = false; },
      getContext() { return makeCanvasContext(); },
      getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; },
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
    location: { search: `?e2e=1&seed=${seed}` },
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
    get rafCallback() { return rafCallback; },
    keeper: win.__keeper,
    keydown(code, opts = {}) {
      const event = {
        code,
        key: opts.key ?? code,
        repeat: Boolean(opts.repeat),
        ctrlKey: Boolean(opts.ctrlKey),
        metaKey: Boolean(opts.metaKey),
        altKey: Boolean(opts.altKey),
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
      };
      win.dispatchEvent({ type: 'keydown', ...event });
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

  // 6. Storage write and read errors and non-webdriver mode.
  const quotaErr = Object.assign(new Error('Quota full'), { name: 'QuotaExceededError', code: 22 });
  const quotaBoot = await bootMain({ seed: 'bad-seed', setItemError: quotaErr });
  assert.equal(quotaBoot.keeper.seed, 108);
  quotaBoot.elements.get('start').click();
  assert.equal(
    quotaBoot.elements.get('save-status').textContent,
    'This browser cannot save your watch. Keep this page open to continue.',
  );

  const readErrBoot = await bootMain({ webdriver: false, getItemError: new Error('Blocked') });
  assert.equal(readErrBoot.keeper, undefined);
  assert.equal(
    readErrBoot.elements.get('save-status').textContent,
    'This browser cannot save your watch. Keep this page open to continue.',
  );
});
