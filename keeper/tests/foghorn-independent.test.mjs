import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  THREAT_HORIZON_SECONDS,
  broadcastHorn,
  createVessel,
  hornRange,
  threatensReef,
} from '../js/physics.js';
import { createState, hornRings, step } from '../js/sim.js';

const DT = 1 / 60;
const IDLE = Object.freeze({ slow: false, fast: false, hold: false, horn: false });
const HORN = Object.freeze({ slow: false, fast: false, hold: false, horn: true });
const FAR_ROCKS = Object.freeze([{ x: 0, y: 10200, radius: 50 }]);

const press = (s, sec = DT) => step(s, HORN, sec);
const release = (s, sec = DT) => step(s, IDLE, sec);
const honkOnce = (s, sec = DT) => release(press(s, sec), sec);
const lastBlast = (s) => s.blasts[s.blasts.length - 1];
function nHonk(s, n) {
  for (let i = 0; i < n; i++) s = honkOnce(s);
  return s;
}
function assertClose(actual, expected, eps = 1e-9) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= eps, `${actual} !== ${expected}`);
}
function vessel(id, extra = {}) {
  return createVessel('trawler', { x: 0, y: 0, heading: 0, speed: 5, id, ...extra });
}
// 10 km northbound track into a distant disc; impact ≫ 120 s at 5 m/s.
const farReefVessel = (id = 'far') => vessel(id, { y: 200 });

describe('createVessel: no silent defaults for x/y/heading', () => {
  test('omitted or undefined x, y, or heading throws RangeError', () => {
    assert.throws(() => createVessel('trawler', {}), RangeError);
    assert.throws(() => createVessel('trawler', { y: 0, heading: 0 }), RangeError);
    assert.throws(() => createVessel('trawler', { x: 0, heading: 0 }), RangeError);
    assert.throws(() => createVessel('trawler', { x: 0, y: 0 }), RangeError);
    assert.throws(() => createVessel('coaster', { x: undefined, y: 0, heading: 0 }), RangeError);
    assert.throws(() => createVessel('speedboat', { x: 0, y: undefined, heading: 0 }), RangeError);
    assert.throws(() => createVessel('lifeboat', { x: 0, y: 0, heading: undefined }), RangeError);
  });

  test('zero x/y/heading are valid; speed may be omitted', () => {
    createVessel('trawler', { x: 0, y: 0, heading: 0 });
    createVessel('trawler', { x: 0, y: 0, heading: 0, speed: 0 });
    for (const type of ['trawler', 'coaster', 'speedboat', 'lifeboat']) {
      createVessel(type, { x: 1, y: -2, heading: 90 });
    }
  });
});

describe('bounded threat horizon', () => {
  test('THREAT_HORIZON_SECONDS is 120; bad horizon throws', () => {
    assert.equal(THREAT_HORIZON_SECONDS, 120);
    const v = vessel('h');
    const rocks = [{ x: 0, y: 10, radius: 1 }];
    for (const h of [-1, -0.0001, NaN, Infinity, -Infinity]) {
      assert.throws(() => threatensReef(v, rocks, h), RangeError);
    }
  });

  test('inside a disc is a threat; far 10 km track is not (within 120 s) and broadcastHorn holds', () => {
    const inside = vessel('in', { speed: 0 });
    assert.equal(threatensReef(inside, [{ x: 0, y: 0, radius: 10 }], 0), true);

    const near = createVessel('speedboat', { x: 0, y: 0, heading: 0, speed: 10, id: 'near' });
    assert.equal(threatensReef(near, [{ x: 0, y: 100, radius: 10 }], THREAT_HORIZON_SECONDS), true);

    const far = farReefVessel('far-1');
    assert.equal(threatensReef(far, FAR_ROCKS, THREAT_HORIZON_SECONDS), false);
    assert.equal(threatensReef(far, FAR_ROCKS, 10_000), true);

    const [row] = broadcastHorn([far], {
      origin: { x: 0, y: 0 },
      fogDensity: 0,
      time: 0,
      seed: 108,
      trust: 1,
      rocks: FAR_ROCKS,
    });
    assert.equal(row.id, 'far-1');
    assert.equal(row.response, 'hold');
  });

  test('broadcastHorn rejects trust outside [0, 1]', () => {
    const v = vessel('t');
    const opts = { origin: { x: 0, y: 0 }, fogDensity: 0, time: 0, seed: 1, rocks: [] };
    assert.throws(() => broadcastHorn([v], { ...opts, trust: -0.01 }), RangeError);
    assert.throws(() => broadcastHorn([v], { ...opts, trust: 1.01 }), RangeError);
    assert.throws(() => broadcastHorn([v], { ...opts, trust: NaN }), RangeError);
  });
});

describe('sim horn edge, spam, ignore window', () => {
  test('createState starts at trust 1, empty blasts, hornIgnoredUntil 0', () => {
    const s = createState(108);
    assert.equal(s.trust, 1);
    assert.equal(s.hornIgnoredUntil, 0);
    assert.ok(Array.isArray(s.blasts) && s.blasts.length === 0);
    assert.ok(Array.isArray(s.ships));
  });

  test('step returns a new state; previous state is unchanged', () => {
    const prev = createState(108);
    const snap = { time: prev.time, trust: prev.trust, until: prev.hornIgnoredUntil, n: prev.blasts.length };
    const next = press(prev);
    assert.notEqual(next, prev);
    assert.equal(prev.time, snap.time);
    assert.equal(prev.trust, snap.trust);
    assert.equal(prev.hornIgnoredUntil, snap.until);
    assert.equal(prev.blasts.length, snap.n);
    assert.equal(next.blasts.length, snap.n + 1);
  });

  test('non-boolean input flags throw TypeError', () => {
    const s = createState(108);
    const base = { slow: false, fast: false, hold: false, horn: false };
    assert.throws(() => step(s, { ...base, horn: 1 }, DT), TypeError);
    assert.throws(() => step(s, { ...base, horn: 'true' }, DT), TypeError);
    assert.throws(() => step(s, { ...base, horn: null }, DT), TypeError);
    assert.throws(() => step(s, { ...base, slow: 0 }, DT), TypeError);
  });

  test('holding H is a single blast until release and repress', () => {
    let s = press(createState(108), 2);
    assert.equal(s.blasts.length, 1);
    s = press(s, 5);
    assert.equal(s.blasts.length, 1);
    s = press(s);
    assert.equal(s.blasts.length, 1);
    s = release(s);
    assert.equal(s.blasts.length, 1);
    s = press(s);
    assert.equal(s.blasts.length, 2);
  });

  test('3rd blast in 20 s is not spam; 4th is spam', () => {
    let s = nHonk(createState(108), 3);
    assert.equal(s.blasts.length, 3);
    assert.equal(s.hornIgnoredUntil, 0);
    s = press(s);
    assert.equal(s.blasts.length, 4);
    const t = lastBlast(s);
    assert.ok(t - s.blasts[0] < 20);
    assert.equal(s.hornIgnoredUntil, t + 30);
  });

  test('a blast exactly 20 s after the first of three is not spam', () => {
    let s = nHonk(createState(108), 3);
    const first = s.blasts[0];
    s = press(step(s, IDLE, first + 20 - s.time));
    assert.ok(lastBlast(s) - first >= 20);
    assert.equal(s.hornIgnoredUntil, 0);
  });

  test('4th blast just inside the 20 s window is spam', () => {
    let s = nHonk(createState(108), 3);
    const first = s.blasts[0];
    s = press(step(s, IDLE, first + 19.5 - s.time));
    const t = lastBlast(s);
    assert.ok(t - first < 20);
    assert.equal(s.hornIgnoredUntil, t + 30);
  });

  test('blasts during the ignore window do not extend it', () => {
    let s = press(nHonk(createState(108), 3));
    const until = s.hornIgnoredUntil;
    assert.equal(until, lastBlast(s) + 30);

    s = press(release(s, 1));
    assert.equal(s.hornIgnoredUntil, until);
    assert.ok(s.time < until);

    s = step(release(s), IDLE, until - s.time - 1);
    assert.ok(s.time < until);
    s = press(s);
    assert.equal(s.hornIgnoredUntil, until);
    assert.ok(s.time < until);
  });

  test('spam and ignore-window blasts do not change ship warnedAt or response', () => {
    let s = press(nHonk(createState(108), 3));
    assert.ok(s.hornIgnoredUntil > s.time);
    const before = s.ships.map((sh) => ({ warnedAt: sh.warnedAt, response: sh.response }));
    s = press(release(s));
    assert.ok(s.time < s.hornIgnoredUntil);
    assert.equal(s.ships.length, before.length);
    for (let i = 0; i < before.length; i++) {
      assert.equal(s.ships[i].warnedAt, before[i].warnedAt);
      assert.equal(s.ships[i].response, before[i].response);
    }
  });
});

describe('trust: false alarm, floor, recovery', () => {
  test('spam / ignore-window blasts subtract 0.25 and floor at 0', () => {
    const s = press(nHonk(createState(108), 8));
    assert.ok(s.trust >= 0 && s.trust < 0.01 && s.trust <= 1);
  });

  test('a spam blast lowers trust by 0.25 (minus at most one tick of recovery)', () => {
    let s = nHonk(createState(108), 3);
    const before = s.trust;
    s = press(s);
    const drop = before - s.trust;
    assert.ok(drop >= 0.25 - 0.01 * DT - 1e-9);
    assert.ok(drop <= 0.25 + 1e-9);
    assert.ok(s.trust >= 0);
  });

  test('trust recovers at 0.01 per second and caps at 1', () => {
    let s = step(createState(108), IDLE, 10);
    assert.equal(s.trust, 1);

    s = nHonk(createState(108), 4);
    const lowered = s.trust;
    assert.ok(lowered < 1);
    s = step(s, IDLE, 10);
    assertClose(s.trust, Math.min(1, lowered + 0.1), 1e-6);
    // Arbiter fix: step() caps one call at the 180 s watch; 100 s is ample to reach the cap.
    s = step(s, IDLE, 100);
    assert.equal(s.trust, 1);
  });
});

describe('horn rings', () => {
  test('formula, ignored=false, present at age 1.999, gone at age >= 2', () => {
    let s = createState(108);
    assert.deepEqual(hornRings(s), []);

    s = press(s);
    const t0 = s.blasts[0];
    let age = s.time - t0;
    assert.ok(age >= 0 && age < 2);
    let rings = hornRings(s);
    assert.equal(rings.length, 1);
    assertClose(rings[0].radius, hornRange(s.fog) * age / 2);
    assertClose(rings[0].alpha, 1 - age / 2);
    assert.equal(rings[0].ignored, false);

    // Arbiter fix: original measured age before release() advanced a tick, overshooting 2 s.
    s = release(s);
    s = step(s, IDLE, 1.999 - (s.time - t0));
    age = s.time - t0;
    assert.ok(age >= 0 && age < 2);
    rings = hornRings(s);
    assert.equal(rings.length, 1);
    assertClose(rings[0].radius, hornRange(s.fog) * age / 2);
    assertClose(rings[0].alpha, 1 - age / 2);

    s = step(s, IDLE, 2 - (s.time - t0));
    assert.ok(s.time - t0 >= 2);
    assert.equal(hornRings(s).length, 0);
  });

  test('ignored is false for the first three blasts and true for spam / ignore-window', () => {
    let s = nHonk(createState(108), 3);
    let rings = hornRings(s);
    assert.equal(rings.length, 3);
    assert.ok(rings.every((r) => r.ignored === false));

    s = press(s);
    rings = hornRings(s);
    assert.equal(rings.length, 4);
    assert.equal(rings.filter((r) => r.ignored).length, 1);
    assert.equal(rings.filter((r) => !r.ignored).length, 3);

    s = press(release(s));
    rings = hornRings(s);
    assert.equal(rings.length, 5);
    assert.equal(rings.filter((r) => r.ignored).length, 2);
  });

  test('a lone spam ring after earlier rings expire is ignored and matches the formula', () => {
    let s = step(nHonk(createState(108), 3), IDLE, 2.1);
    assert.equal(hornRings(s).length, 0);
    assert.equal(s.hornIgnoredUntil, 0);
    s = press(s);
    assert.ok(s.hornIgnoredUntil > 0);
    const age = s.time - lastBlast(s);
    const rings = hornRings(s);
    assert.equal(rings.length, 1);
    assert.equal(rings[0].ignored, true);
    assertClose(rings[0].radius, hornRange(s.fog) * age / 2);
    assertClose(rings[0].alpha, 1 - age / 2);
  });
});
