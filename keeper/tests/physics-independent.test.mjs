/**
 * Spec tests for keeper physics (ISSUE.md only). Tolerances on simulated floats.
 * ±1e-9 is only the deterministic contract: dt = n·PHYSICS_DT matches n substeps.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PHYSICS_DT, HULLS, createVessel, stepVessel, measureTacticalDiameter,
  hornRange, threatensReef, broadcastHorn, pointOfNoReturn,
} from '../js/physics.js';
const TYPES = ['trawler', 'coaster', 'speedboat', 'lifeboat'];
// Tactical diameter in ship lengths at full rudder and cruise (ISSUE §3).
const TD = { trawler: [3, 5], coaster: [5, 8], speedboat: [2, 3.5], lifeboat: [2, 4] };
const DET = 1e-9;
const ang = (a, b) => {
  let d = b - a;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
};
const vessel = (type, over = {}) => createVessel(type, {
  x: 0, y: 0, heading: 0, speed: HULLS[type].cruiseSpeed, id: type, smuggler: false, ...over,
});
const advance = (s, command, seconds, step = 0.5) => {
  let left = seconds;
  while (left > 1e-12) {
    const h = Math.min(step, left);
    s = stepVessel(s, command, h);
    left -= h;
  }
  return s;
};
const repeat = (s, command, n) => {
  for (let i = 0; i < n; i++) s = stepVessel(s, command, PHYSICS_DT);
  return s;
};
function close(a, b, tol, label) {
  for (const k of ['x', 'y', 'speed', 'yawRate', 'rudder']) {
    assert.ok(Number.isFinite(a[k]) && Number.isFinite(b[k]) && Math.abs(a[k] - b[k]) <= tol, `${label} ${k}`);
  }
  assert.ok(Math.abs(ang(a.heading, b.heading)) <= tol && a.id === b.id && a.type === b.type && a.smuggler === b.smuggler, label);
}
// Nomoto steady yaw [deg/s] = K [1/s] · rudder [deg]. Ceiling at cruise; linear only above it. Not 1/speed.
const yawCap = (hull, speed) => hull.K * hull.maxRudderDeg * Math.max(1, speed / hull.cruiseSpeed) * 1.12 + 0.05;
function miss(s, rock, horizon) {
  const rad = (s.heading * Math.PI) / 180;
  const ux = Math.sin(rad), uy = Math.cos(rad);
  const len = Math.max(0, s.speed) * Math.max(0, horizon);
  const vx = rock.x - s.x, vy = rock.y - s.y;
  const u = Math.max(0, Math.min(len, vx * ux + vy * uy));
  return Math.hypot(s.x + ux * u - rock.x, s.y + uy * u - rock.y);
}
function tti(s, rock) {
  if (!(s.speed > 1e-8)) return miss(s, rock, 0) <= rock.radius ? 0 : Infinity;
  const rad = (s.heading * Math.PI) / 180;
  const ux = Math.sin(rad), uy = Math.cos(rad);
  const vx = rock.x - s.x, vy = rock.y - s.y, along = vx * ux + vy * uy;
  const lat2 = Math.max(0, vx * vx + vy * vy - along * along);
  if (lat2 > rock.radius ** 2) return Infinity;
  const hit = along - Math.sqrt(rock.radius ** 2 - lat2);
  return hit <= 1e-8 ? 0 : hit / s.speed;
}
function segDist(a, b, rock) {
  const abx = b.x - a.x, aby = b.y - a.y, den = abx * abx + aby * aby;
  const u = den === 0 ? 0 : Math.max(0, Math.min(1, ((rock.x - a.x) * abx + (rock.y - a.y) * aby) / den));
  return Math.hypot(a.x + abx * u - rock.x, a.y + aby * u - rock.y);
}
const delayOk = (reactAt, time, hull) => {
  const d = reactAt - time;
  return d >= hull.reactionSeconds[0] - 1e-9 && d <= hull.reactionSeconds[1] + 1e-9;
};
test('frozen hulls, 1/60 step, reaction window', () => {
  assert.equal(PHYSICS_DT, 1 / 60);
  assert.ok(Object.isFrozen(HULLS));
  assert.deepEqual(Object.keys(HULLS).sort(), [...TYPES].sort());
  for (const type of TYPES) {
    const h = HULLS[type];
    assert.ok(Object.isFrozen(h));
    for (const k of ['length', 'cruiseSpeed', 'maxRudderDeg', 'rudderRateDegPerS', 'K', 'T']) {
      assert.ok(Number.isFinite(h[k]) && h[k] > 0);
    }
    // Crew delay is 1–2.5 s per hull, and the interval has width for seeded variance.
    const [lo, hi] = h.reactionSeconds;
    assert.ok(h.maxRudderDeg < 180 && lo >= 1 - 1e-9 && hi <= 2.5 + 1e-9 && hi > lo);
  }
});
test('invalid inputs throw RangeError', () => {
  const bad = { x: 0, y: 0, heading: 0, speed: 1, id: 'b', smuggler: false };
  for (const type of ['Trawler', 'kayak', '']) assert.throws(() => createVessel(type, bad), RangeError);
  for (const [k, v] of [['x', NaN], ['y', Infinity], ['heading', -Infinity], ['speed', NaN]]) {
    assert.throws(() => createVessel('trawler', { ...bad, [k]: v }), RangeError);
  }
  // Arbiter: spec allows defaulted fields; omitted x defaults to 0 rather than throwing.
  const s = vessel('trawler'), cmd = { rudderCommand: 0, throttle: 1 };
  for (const dt of [0, -0, -1, NaN, Infinity, -Infinity]) assert.throws(() => stepVessel(s, cmd, dt), RangeError);
  for (const fog of [-1e-6, 1 + 1e-6, NaN, Infinity, -Infinity]) assert.throws(() => hornRange(fog), RangeError);
  assert.throws(() => measureTacticalDiameter('kayak'), RangeError);
  assert.throws(() => broadcastHorn([s], { origin: { x: 0, y: 0 }, fogDensity: 2, time: 0, seed: 1, rocks: [] }), RangeError);
});
test('createVessel normalises heading and step does not mutate', () => {
  const s = vessel('coaster', { x: 3, y: -4, heading: -90, speed: 2, id: 'c', smuggler: true });
  assert.equal(s.id, 'c');
  assert.equal(s.smuggler, true);
  assert.ok(Math.abs(s.x - 3) <= 1e-12 && Math.abs(s.y + 4) <= 1e-12 && Math.abs(s.speed - 2) <= 1e-12);
  assert.ok(Math.abs(ang(s.heading, 270)) <= DET && s.heading >= 0 && s.heading < 360);
  // No rudder or yaw argument, so a new vessel is straight.
  assert.ok(Math.abs(s.yawRate) <= 1e-12 && Math.abs(s.rudder) <= 1e-12);
  for (const [h, expect] of [[360, 0], [-360, 0], [450, 90], [-1, 359]]) {
    const n = vessel('lifeboat', { heading: h });
    assert.ok(Math.abs(ang(n.heading, expect)) <= DET && n.heading >= 0 && n.heading < 360);
  }
  const snap = { ...s };
  assert.notEqual(stepVessel(s, { rudderCommand: 40, throttle: 0.5 }, PHYSICS_DT), s);
  assert.deepEqual(s, snap);
});
test('tactical diameter is in band and matches a 180° transfer', () => {
  for (const type of TYPES) {
    const hull = HULLS[type];
    const td = measureTacticalDiameter(type);
    const lengths = td / hull.length;
    const [lo, hi] = TD[type];
    assert.ok(Number.isFinite(td) && td > 0 && lengths >= lo - 1e-4 && lengths <= hi + 1e-4, type);
    for (const sign of [1, -1]) {
      let s = vessel(type), turned = 0, guard = 0, cross = null;
      while (cross === null && guard < 900) {
        const n = stepVessel(s, { rudderCommand: sign * hull.maxRudderDeg, throttle: 1 }, PHYSICS_DT);
        const dh = ang(s.heading, n.heading);
        assert.ok(sign * dh >= -1e-6);
        if (turned + Math.abs(dh) >= 180) cross = Math.abs(s.x + (n.x - s.x) * ((180 - turned) / Math.abs(dh)));
        else { turned += Math.abs(dh); s = n; }
        guard += PHYSICS_DT;
      }
      // Heading north: transverse distance is |x|. Slack is one frame of travel.
      const tol = hull.cruiseSpeed * PHYSICS_DT + hull.length * 0.002 + 0.05;
      assert.ok(cross !== null && Math.abs(td - cross) <= tol, `${type} ${sign}`);
    }
  }
});
test('heading and yaw do not jump', () => {
  for (const type of TYPES) {
    const hull = HULLS[type];
    let s = vessel(type, { heading: 359 }), saw = false;
    for (let i = 0; i < 480; i++) {
      const n = stepVessel(s, { rudderCommand: hull.maxRudderDeg, throttle: 1 }, PHYSICS_DT);
      const dh = ang(s.heading, n.heading);
      const cap = yawCap(hull, Math.max(s.speed, n.speed, 0));
      const dr = ((hull.K * hull.maxRudderDeg + Math.abs(s.yawRate)) / hull.T) * PHYSICS_DT;
      assert.ok(n.heading >= 0 && n.heading < 360 && n.speed >= -1e-6);
      assert.ok(Math.abs(dh) <= cap * PHYSICS_DT + 1e-4);
      assert.ok(Math.abs(n.yawRate - s.yawRate) <= dr * 1.35 + 1e-4 && Math.abs(n.yawRate) <= cap + 1e-6);
      assert.ok(Math.hypot(n.x - s.x, n.y - s.y) <= Math.max(s.speed, n.speed, 0) * PHYSICS_DT * 1.08 + 1e-4);
      if (n.yawRate > 0.2) saw = true;
      s = n;
    }
    assert.ok(saw);
  }
  // x east, y north, heading 0 = north, clockwise. Throttle 1 at cruise holds a straight equilibrium.
  const hull = HULLS.trawler;
  for (const heading of [0, 90, 180, 270]) {
    const s0 = vessel('trawler', { heading, x: 10, y: -4 });
    const s1 = advance(s0, { rudderCommand: 0, throttle: 1 }, 2, PHYSICS_DT);
    const dx = s1.x - 10, dy = s1.y + 4, rad = (heading * Math.PI) / 180;
    const along = dx * Math.sin(rad) + dy * Math.cos(rad), dist = Math.hypot(dx, dy);
    assert.ok(along >= dist * 0.99 && Math.abs(dist - hull.cruiseSpeed * 2) <= hull.cruiseSpeed * 0.2 + 0.25);
    assert.ok(Math.abs(s1.yawRate) <= 0.05);
  }
});
test('rudder rate and clamp', () => {
  for (const type of TYPES) {
    const hull = HULLS[type], partial = Math.min(4, hull.maxRudderDeg * 0.4);
    let s = vessel(type), prev = 0;
    for (let t = 0; t < 30; t += PHYSICS_DT) {
      s = stepVessel(s, { rudderCommand: partial, throttle: 1 }, PHYSICS_DT);
      assert.ok(s.rudder >= -1e-6 && s.rudder <= partial + 1e-4);
      assert.ok(s.rudder - prev <= hull.rudderRateDegPerS * PHYSICS_DT + 1e-5);
      prev = s.rudder;
    }
    assert.ok(Math.abs(s.rudder - partial) <= 1e-3);
    const reached = Math.min(hull.maxRudderDeg, hull.rudderRateDegPerS * 5);
    const hard = stepVessel(vessel(type), { rudderCommand: 1e6, throttle: 1 }, 5);
    const port = stepVessel(vessel(type), { rudderCommand: -1e6, throttle: 1 }, 5);
    assert.ok(Math.abs(hard.rudder - reached) <= 1e-4 && Math.abs(port.rudder + reached) <= 1e-4);
  }
});
test('turn is no tighter than full rudder at that speed', () => {
  const settle = (type, rudderCommand) => {
    const hull = HULLS[type];
    const clamped = Math.max(-hull.maxRudderDeg, Math.min(hull.maxRudderDeg, rudderCommand));
    let s = vessel(type), prev = 0, stable = 0;
    for (let t = 0; t < 600 && stable < 2; t += 0.5) {
      s = stepVessel(s, { rudderCommand, throttle: 1 }, 0.5);
      const calm = Math.abs(s.yawRate - prev) < 1e-3 && Math.abs(s.rudder - clamped) < 1e-3;
      stable = calm ? stable + 0.5 : 0;
      prev = s.yawRate;
    }
    assert.ok(stable >= 2, type);
    return s;
  };
  const radius = (s) => s.speed / (Math.abs(s.yawRate) * Math.PI / 180);
  for (const type of TYPES) {
    const hull = HULLS[type];
    const straight = settle(type, 0);
    const full = settle(type, hull.maxRudderDeg);
    const half = settle(type, hull.maxRudderDeg * 0.5);
    const over = settle(type, hull.maxRudderDeg * 80);
    assert.ok(Math.abs(straight.yawRate) <= 0.02);
    assert.ok(Math.abs(straight.speed - hull.cruiseSpeed) <= hull.cruiseSpeed * 0.1);
    assert.ok(full.speed < straight.speed - 1e-3); // developed turn bleeds speed
    assert.ok(full.yawRate > 0.05 && half.yawRate > 0.02);
    assert.ok(radius(full) > hull.length * 0.25 && radius(half) > radius(full) * 1.15);
    assert.ok(Math.abs(full.yawRate) <= yawCap(hull, full.speed));
    assert.ok(Math.abs(over.rudder - full.rudder) <= 1e-3);
    assert.ok(Math.abs(over.yawRate - full.yawRate) <= Math.abs(full.yawRate) * 0.03 + 0.02);
    let slow = vessel(type, { speed: hull.cruiseSpeed * 0.2, heading: 15 });
    for (let i = 0; i < 180; i++) {
      const n = stepVessel(slow, { rudderCommand: hull.maxRudderDeg, throttle: 0 }, PHYSICS_DT);
      assert.ok(Math.abs(n.yawRate) <= yawCap(hull, Math.max(slow.speed, n.speed, 0)));
      slow = n;
    }
    const accel = advance(vessel(type, { speed: 0 }), { rudderCommand: 0, throttle: 1 }, 45);
    const decel = advance(vessel(type), { rudderCommand: 0, throttle: 0 }, 45);
    assert.ok(accel.speed > 0.2 && decel.speed < hull.cruiseSpeed - 1e-2 && decel.speed >= -1e-6);
  }
});
test('zero speed does not spin', () => {
  for (const type of TYPES) {
    const hull = HULLS[type];
    const s0 = vessel(type, { heading: 123.5, speed: 0, x: 5, y: 6 });
    let s = s0;
    for (let i = 0; i < 180; i++) {
      s = stepVessel(s, { rudderCommand: hull.maxRudderDeg, throttle: 0 }, PHYSICS_DT);
      assert.ok(Math.abs(s.yawRate) <= 1e-8 && Math.abs(ang(s0.heading, s.heading)) <= 1e-8 && Math.abs(s.speed) <= 1e-6);
    }
    assert.ok(Math.hypot(s.x - 5, s.y - 6) <= 1e-5);
    const big = stepVessel(s0, { rudderCommand: -hull.maxRudderDeg, throttle: 0 }, 5);
    assert.ok(Math.abs(big.yawRate) <= 1e-8 && Math.abs(ang(s0.heading, big.heading)) <= 1e-8);
    for (const k of ['x', 'y', 'speed', 'yawRate', 'rudder', 'heading']) assert.ok(Number.isFinite(big[k]));
  }
});
test('dt 0.5 s and 5 s match substeps without NaN', () => {
  for (const type of TYPES) {
    const hull = HULLS[type];
    const cmd = { rudderCommand: hull.maxRudderDeg * 0.7, throttle: 0.4 };
    const mid = advance(vessel(type, { heading: 350 }), { rudderCommand: hull.maxRudderDeg, throttle: 0.7 }, 2);
    const snap = { ...mid };
    close(stepVessel(mid, cmd, 0.5), repeat(mid, cmd, 30), DET, type);
    close(stepVessel(mid, cmd, 5), repeat(mid, cmd, 300), DET, type);
    close(stepVessel(mid, cmd, 300 * PHYSICS_DT), repeat(mid, cmd, 300), DET, type);
    assert.deepEqual(mid, snap);
    const half = stepVessel(vessel(type), { rudderCommand: 1e6, throttle: 1 }, 0.5);
    assert.ok(half.rudder > 0 && half.rudder <= Math.min(hull.maxRudderDeg, hull.rudderRateDegPerS * 0.5) + 1e-4);
    for (const k of ['x', 'y', 'speed', 'yawRate', 'rudder', 'heading']) assert.ok(Number.isFinite(half[k]));
  }
});
test('mid-turn rudder reversal slews and yaw lags', () => {
  for (const type of TYPES) {
    const hull = HULLS[type];
    let s = advance(
      vessel(type, { heading: 10 }),
      { rudderCommand: hull.maxRudderDeg, throttle: 1 },
      hull.maxRudderDeg / hull.rudderRateDegPerS + 3 * hull.T,
    );
    assert.ok(s.rudder > hull.maxRudderDeg * 0.95 && s.yawRate > 0);
    const back = stepVessel(s, { rudderCommand: -hull.maxRudderDeg, throttle: 1 }, PHYSICS_DT);
    assert.ok(s.rudder - back.rudder > 0 && s.rudder - back.rudder <= hull.rudderRateDegPerS * PHYSICS_DT + 1e-5);
    assert.ok(back.yawRate > 0); // one reversed frame cannot flip a developed yaw
    let guard = 0;
    s = back;
    while (s.yawRate >= 0 && guard < 180) {
      const prev = s;
      s = stepVessel(s, { rudderCommand: -hull.maxRudderDeg, throttle: 1 }, 0.25);
      assert.ok(prev.rudder - s.rudder <= hull.rudderRateDegPerS * 0.25 + 1e-4);
      assert.ok(s.rudder >= -hull.maxRudderDeg - 1e-5 && s.rudder <= prev.rudder + 1e-5);
      guard += 0.25;
    }
    assert.ok(s.yawRate < 0 && s.rudder < 0);
  }
});
test('projected straight track threatens a reef', () => {
  const speed = 8, s = vessel('coaster', { heading: 0, speed });
  const hit = { x: 4, y: 50, radius: 6 }, wide = { x: 12, y: 50, radius: 6 };
  assert.equal(threatensReef(s, [hit], 20), true); // abeam mid-track, not only the horizon endpoint
  assert.equal(threatensReef(s, [wide], 20), false);
  assert.equal(threatensReef(s, [wide, hit], 20), true);
  assert.equal(threatensReef(s, [{ x: 0, y: -80, radius: 20 }], 500), false);
  assert.equal(threatensReef(s, [{ x: 3, y: speed * 50, radius: 6 }], 10), false); // closest foot is past the horizon
  const gap = Math.max(1, speed * 0.05);
  assert.equal(threatensReef(s, [{ x: 0, y: speed * 10 + 8, radius: 8 }], 9), false);
  assert.equal(threatensReef(s, [{ x: 0, y: speed * 10 + 8 - gap, radius: 8 }], 10), true);
  assert.equal(threatensReef(s, [{ x: 1, y: 0, radius: 2 }], 0), true);
  assert.equal(threatensReef(s, [{ x: 10, y: 0, radius: 2 }], 0), false);
  const stopped = vessel('coaster', { speed: 0, x: 1, y: 1 });
  assert.equal(threatensReef(stopped, [{ x: 1.2, y: 1.2, radius: 1 }], 30), true);
  assert.equal(threatensReef(stopped, [{ x: 20, y: 1, radius: 1 }], 30), false);
});
test('horn: only a heard threatened ship turns', () => {
  const fog = 0.3, reach = hornRange(fog), origin = { x: 500, y: -200 }, dIn = reach * 0.2;
  const radius = Math.min(8, dIn * 0.25);
  const threatened = vessel('trawler', { x: origin.x + dIn, y: origin.y, heading: 90, id: 'threat' });
  const safe = vessel('coaster', { x: origin.x, y: origin.y + dIn, heading: 0, id: 'safe' });
  const smuggler = vessel('lifeboat', { x: origin.x - dIn * 0.5, y: origin.y, heading: 270, id: 'dark', smuggler: true });
  const far = vessel('speedboat', { x: origin.x, y: origin.y + reach * 1.3, heading: 90, id: 'far', smuggler: true });
  const ahead = (ship) => {
    const rad = (ship.heading * Math.PI) / 180;
    return { x: ship.x + Math.sin(rad) * ship.speed * 40, y: ship.y + Math.cos(rad) * ship.speed * 40, radius };
  };
  const rocks = [ahead(threatened), ahead(smuggler), ahead(far)];
  assert.ok(miss(threatened, rocks[0], 80) < radius && miss(safe, rocks[0], 80) > radius * 2);
  assert.ok(miss(smuggler, rocks[1], 80) < radius && Math.hypot(far.x - origin.x, far.y - origin.y) > reach);
  const ships = [threatened, safe, smuggler, far];
  const opts = { origin, fogDensity: fog, time: 80.25, seed: 11, rocks };
  const snap = JSON.parse(JSON.stringify(ships));
  const a = broadcastHorn(ships, opts);
  assert.deepEqual(ships, snap);
  assert.deepEqual(a, broadcastHorn(ships, opts));
  assert.deepEqual(a, broadcastHorn(ships, { ...opts, trust: 1 })); // default trust
  assert.deepEqual(a.map((r) => r.id), ['threat', 'safe', 'dark', 'far']);
  const [turn, hold, dark, none] = a;
  assert.equal(turn.heard, true); assert.equal(turn.response, 'turn-away');
  assert.equal(hold.heard, true); assert.equal(hold.response, 'hold');
  assert.equal(dark.heard, true); assert.ok(dark.response === 'ignore' || dark.response === 'veer');
  assert.equal(none.heard, false); assert.equal(none.response, 'none'); assert.equal(none.reactAt, null);
  assert.ok(delayOk(turn.reactAt, opts.time, HULLS.trawler));
  assert.ok(delayOk(hold.reactAt, opts.time, HULLS.coaster));
  assert.ok(delayOk(dark.reactAt, opts.time, HULLS.lifeboat));
});
test('fog strictly shortens range', () => {
  const samples = [0, 0.25, 0.5, 0.75, 1].map((f) => hornRange(f));
  for (const r of samples) assert.ok(Number.isFinite(r) && r > 0);
  for (let i = 0; i < samples.length - 1; i++) assert.ok(samples[i] > samples[i + 1]);
  const clear = samples[0], dense = samples[4], d = (clear + dense) / 2;
  const opts = (fog) => ({ origin: { x: 0, y: 0 }, fogDensity: fog, time: 5, seed: 3, rocks: [] });
  assert.equal(broadcastHorn([vessel('trawler', { x: d, y: 0 })], opts(0))[0].heard, true);
  const muffled = broadcastHorn([vessel('trawler', { x: d, y: 0 })], opts(1))[0];
  assert.equal(muffled.heard, false); assert.equal(muffled.response, 'none'); assert.equal(muffled.reactAt, null);
  // 0.6·√2 < 1 < 0.8·√2: a box test would hear the far ship, a diamond test would miss the near one.
  assert.equal(broadcastHorn([vessel('trawler', { x: clear * 0.6, y: clear * 0.6 })], opts(0))[0].response, 'hold');
  assert.equal(broadcastHorn([vessel('trawler', { x: clear * 0.8, y: clear * 0.8 })], opts(0))[0].heard, false);
  assert.equal(broadcastHorn([vessel('trawler', { x: -clear, y: 0 })], opts(0))[0].heard, true);
  assert.equal(broadcastHorn([vessel('trawler', { x: clear + Math.max(0.05, clear * 1e-4), y: 0 })], opts(0))[0].heard, false);
});
test('seeded delay stays in band and repeats', () => {
  const reach = hornRange(0);
  const trawler = vessel('trawler', { id: 'T' });
  const boat = vessel('speedboat', { x: reach * 0.15, y: reach * 0.1, heading: 10, id: 'B' });
  const dark = vessel('lifeboat', { x: 2, y: 2, id: 'D', smuggler: true });
  const rock = { x: 2, y: 2 + HULLS.lifeboat.cruiseSpeed * 25, radius: 6 };
  const base = { origin: { x: 0, y: 0 }, fogDensity: 0, time: 250.5, rocks: [] };
  const delays = new Set(), kinds = new Set();
  for (let seed = 0; seed < 48; seed++) {
    const got = broadcastHorn([trawler, boat], { ...base, seed });
    if (seed === 4) assert.deepEqual(broadcastHorn([trawler, boat], { ...base, seed }), got);
    assert.equal(got[0].response, 'hold'); assert.equal(got[1].response, 'hold');
    assert.ok(delayOk(got[0].reactAt, base.time, HULLS.trawler));
    assert.ok(delayOk(got[1].reactAt, base.time, HULLS.speedboat));
    delays.add(got[0].reactAt);
    const m = broadcastHorn([dark], { ...base, seed, rocks: [rock] })[0];
    assert.ok(m.response === 'ignore' || m.response === 'veer');
    assert.ok(delayOk(m.reactAt, base.time, HULLS.lifeboat));
    kinds.add(m.response);
  }
  assert.ok(delays.size >= 2);
  assert.equal(kinds.size, 2); // the seed selects ignore or veer, and both occur
});
test('horn at the point of no return still clears', () => {
  const hold = { rudderCommand: 0, throttle: 1 };
  for (const type of TYPES) {
    const hull = HULLS[type], radius = Math.max(8, hull.length * 0.5);
    const rock = { x: 0, y: hull.cruiseSpeed * 500 + radius, radius };
    const far = vessel(type), ponr = pointOfNoReturn(far, [rock]);
    const closer = vessel(type, { y: hull.cruiseSpeed * 30 });
    const late = vessel(type, { y: rock.y - radius - hull.cruiseSpeed * hull.reactionSeconds[1] * 0.5 });
    // Lead time before impact, unchanged by sliding along the track. Not time-from-now.
    assert.ok(Number.isFinite(ponr) && ponr > hull.reactionSeconds[1] && ponr < tti(far, rock) - hull.reactionSeconds[1]);
    assert.ok(Math.abs(pointOfNoReturn(closer, [rock]) - ponr) <= Math.max(0.05, ponr * 1e-4));
    assert.ok(pointOfNoReturn(late, [rock]) > tti(late, rock));
    let s = far, guard = 0;
    while (tti(s, rock) > ponr + 1 && guard < 1500) { s = stepVessel(s, hold, 0.5); guard += 0.5; }
    while (guard < 1500 && tti(s, rock) > ponr) {
      const next = stepVessel(s, hold, PHYSICS_DT);
      if (tti(next, rock) < ponr) break;
      s = next; guard += PHYSICS_DT;
    }
    const remain = tti(s, rock);
    assert.ok(guard < 1500 && remain <= ponr + PHYSICS_DT + 1e-3 && remain + 1e-6 >= ponr);
    s = advance(s, hold, hull.reactionSeconds[1], PHYSICS_DT);
    let prev = s, minD = Math.hypot(s.x - rock.x, s.y - rock.y), turned = 0;
    for (let t = 0; t < 240 && !(turned > 25 && s.y > rock.y + radius && minD > radius); t += 0.25) {
      const hdg = s.heading;
      s = stepVessel(s, { rudderCommand: turned < 70 ? hull.maxRudderDeg : 0, throttle: 1 }, 0.25);
      turned += Math.max(0, ang(hdg, s.heading));
      minD = Math.min(minD, segDist(prev, s, rock));
      prev = s;
    }
    // Full starboard off a centerline rock is safe water. Slack is one chord of the arc.
    assert.ok(minD + Math.max(0.5, radius * 0.02) >= radius, type);
  }
});
