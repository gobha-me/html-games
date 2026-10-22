import test from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS_DT as DT, HULLS, createVessel, stepVessel, measureTacticalDiameter,
  hornRange, threatensReef, broadcastHorn, pointOfNoReturn } from '../js/physics.js';

const delta = (a, b) => ((a - b + 540) % 360) - 180;
const rock = [{ x: 0, y: 300, radius: 24 }];
const options = { origin: { x: 0, y: 0 }, fogDensity: 0.2, time: 10, seed: 120, rocks: rock };

test('exact hull schema, deep immutability and tactical diameter bands for every hull', () => {
  assert.equal(DT, 1 / 60);
  assert.ok(Object.isFrozen(HULLS));
  const bands = { trawler: [3, 5], coaster: [5, 8], speedboat: [2, 3.5], lifeboat: [2, 4] };
  for (const [type, spec] of Object.entries(HULLS)) {
    assert.deepEqual(Object.keys(spec).sort(), ['length', 'cruiseSpeed', 'maxRudderDeg', 'rudderRateDegPerS', 'K', 'T', 'reactionSeconds'].sort());
    assert.ok(Object.isFrozen(spec) && Object.isFrozen(spec.reactionSeconds));
    const lengths = measureTacticalDiameter(type) / spec.length;
    assert.ok(lengths >= bands[type][0] && lengths <= bands[type][1], `${type}: ${lengths} lengths`);
    assert.throws(() => { spec.reactionSeconds[0] = 0; }, TypeError);
  }
});

test('vessel schema and north/east coordinates, wrapping, purity and no phantom fields', () => {
  const ship = createVessel('trawler', { x: 10, y: 20, heading: -360, id: 0, smuggler: true });
  assert.deepEqual(ship, { id: 0, type: 'trawler', smuggler: true, x: 10, y: 20, heading: 0, yawRate: 0, rudder: 0, speed: 1.5 });
  const frozen = Object.freeze(ship);
  const next = stepVessel(frozen, {}, 1);
  assert.equal(next.x, 10);
  assert.ok(Math.abs(next.y - 21.5) < 1e-10);
  const east = stepVessel(createVessel('trawler', { heading: 450 }), {}, 1);
  assert.ok(east.x > 1.49 && Math.abs(east.y) < 1e-10);
});

test('hitches match fixed steps, rudder and yaw remain continuous through reversal and north wrap', () => {
  for (const [type, spec] of Object.entries(HULLS)) {
    for (const dt of [0.5, 5, 120 * DT]) {
      const initial = createVessel(type, { heading: 359.99 });
      const input = { rudderCommand: 999, throttle: 1 };
      let individual = initial;
      for (let index = 0; index < Math.round(dt / DT); index++) individual = stepVessel(individual, input, DT);
      assert.deepEqual(stepVessel(initial, input, dt), individual);
    }
    let ship = createVessel(type, { heading: 359.99 });
    let crossedNorth = false;
    for (let index = 0; index < 2400; index++) {
      const command = index < 600 ? 999 : -999;
      const next = stepVessel(ship, { rudderCommand: command }, DT);
      assert.ok(Math.abs(next.rudder - ship.rudder) <= spec.rudderRateDegPerS * DT + 1e-10);
      assert.ok(Math.abs(delta(next.heading, ship.heading)) <= spec.K * spec.maxRudderDeg * DT + 1e-9);
      assert.ok(Math.abs(next.yawRate - ship.yawRate) <= 2 * spec.K * spec.maxRudderDeg * DT / spec.T + 1e-9);
      assert.ok(Math.abs(next.yawRate) <= spec.K * spec.maxRudderDeg + 1e-10);
      if (next.heading < ship.heading && index < 600) crossedNorth = true;
      ship = next;
    }
    assert.ok(crossedNorth);
    assert.ok(ship.yawRate < 0, `${type}: reversal must eventually reverse yaw`);
    // Smaller-than-fixed dt is still integrated, without NaN or overshoot.
    assert.ok(Number.isFinite(stepVessel(ship, { rudderCommand: 0 }, DT / 3).x));
  }
});

test('zero-speed vessel cannot spin; thrust accelerates, drag decelerates, turns shed speed', () => {
  for (const type of Object.keys(HULLS)) {
    const stopped = createVessel(type, { speed: 0, heading: 37 });
    const still = stepVessel(stopped, { rudderCommand: 999, throttle: 0 }, 5);
    assert.equal(still.heading, 37); assert.equal(still.yawRate, 0);
    assert.equal(still.x, 0); assert.equal(still.y, 0);
    const moving = stepVessel(stopped, { throttle: 1 }, 5);
    assert.ok(moving.speed > 0 && moving.speed < HULLS[type].cruiseSpeed);
    assert.ok(stepVessel(moving, { throttle: 0 }, 5).speed < moving.speed);
    const turning = stepVessel(createVessel(type), { rudderCommand: 999 }, 5);
    assert.ok(turning.speed < HULLS[type].cruiseSpeed);
    // No turn tighter than the full-rudder steady radius at this speed.
    assert.ok(turning.speed / (Math.abs(turning.yawRate) * Math.PI / 180)
      >= HULLS[type].cruiseSpeed / (HULLS[type].K * HULLS[type].maxRudderDeg * Math.PI / 180) * 0.95);
  }
});

test('straight-track projection handles tangents, horizon endpoints, behind, stationary and overlap', () => {
  const ship = createVessel('trawler', { speed: 2 });
  const rocks = [{ x: 0, y: 12, radius: 2 }];
  assert.equal(threatensReef(ship, rocks, 5), true);
  assert.equal(threatensReef(ship, rocks, 5 - 1e-8), false);
  assert.equal(threatensReef(ship, [{ x: 2, y: 12, radius: 2 }], 6), true);
  assert.equal(threatensReef(ship, [{ x: 2.001, y: 12, radius: 2 }], 100), false);
  assert.equal(threatensReef(ship, [{ x: 0, y: -12, radius: 2 }], 100), false);
  assert.equal(threatensReef({ ...ship, speed: 0 }, rocks, 100), false);
  assert.equal(threatensReef({ ...ship, speed: 0 }, [{ x: 0, y: 0, radius: 1 }], 0), true);
  assert.equal(threatensReef(ship, [], 100), false);
});

test('broadcast is independent of beam and fleet ordering: threatened turn, safe hold, far none', () => {
  const ships = [createVessel('trawler', { id: 'danger' }),
    createVessel('coaster', { id: 'safe', x: 100, heading: 180 }),
    createVessel('speedboat', { id: 'far', x: hornRange(0.2) + 0.001 })];
  const before = structuredClone(ships);
  const responses = broadcastHorn(ships, options);
  assert.deepEqual(responses.map((r) => r.response), ['turn-away', 'hold', 'none']);
  assert.deepEqual(responses.map((r) => r.heard), [true, true, false]);
  assert.equal(responses[2].reactAt, null);
  assert.deepEqual(broadcastHorn(ships, options), responses);
  assert.deepEqual(broadcastHorn([...ships].reverse(), options), [...responses].reverse());
  assert.deepEqual(ships, before);
});

test('fog strictly reduces inclusive audible range; seeded delay stays in each hull band', () => {
  for (let index = 0; index < 100; index++) assert.ok(hornRange(index / 100) > hornRange((index + 1) / 100));
  assert.ok(hornRange(1) > 0);
  const boundary = createVessel('trawler', { x: hornRange(0), id: 'edge' });
  assert.equal(broadcastHorn([boundary], { ...options, fogDensity: 0 })[0].heard, true);
  assert.equal(broadcastHorn([boundary], { ...options, fogDensity: 1 })[0].heard, false);
  const delays = new Set(), responses = new Set();
  for (const [type, spec] of Object.entries(HULLS)) for (let seed = 0; seed < 64; seed++) {
    const ship = createVessel(type, { id: 'captain' });
    const result = broadcastHorn([ship], { ...options, seed })[0];
    const delay = result.reactAt - options.time;
    assert.ok(delay >= spec.reactionSeconds[0] - 1e-12 && delay <= spec.reactionSeconds[1] + 1e-12);
    delays.add(delay);
    assert.equal(broadcastHorn([ship], { ...options, seed, trust: 0 })[0].response, 'ignore');
    responses.add(broadcastHorn([{ ...ship, smuggler: true }], { ...options, seed })[0].response);
  }
  assert.ok(delays.size > 64);
  assert.deepEqual([...responses].sort(), ['ignore', 'veer']);
});

test('PONR reserves worst crew delay AND helm/yaw lag, clears adjacent reefs for either turn', () => {
  for (const [type, spec] of Object.entries(HULLS)) {
    const initial = createVessel(type, { id: type });
    const rocks = [...rock, { x: 32, y: 308, radius: 18 }];
    const lead = pointOfNoReturn(initial, rocks);
    assert.ok(lead > spec.reactionSeconds[1]);
    const impactTime = (300 - 24) / spec.cruiseSpeed;
    for (const sign of [-1, 1]) {
      let ship = stepVessel(initial, {}, impactTime - lead);
      ship = stepVessel(ship, {}, spec.reactionSeconds[1]);
      let angle = 0;
      while (angle < 180) {
        const next = stepVessel(ship, { rudderCommand: sign * spec.maxRudderDeg }, DT);
        angle += delta(next.heading, ship.heading) * sign;
        assert.ok(rocks.every((r) => Math.hypot(next.x - r.x, next.y - r.y) > r.radius), `${type}: reef clearance`);
        ship = next;
      }
      assert.equal(threatensReef(ship, rocks, 600), false);
    }
    assert.equal(pointOfNoReturn(initial, []), 0);
    assert.equal(pointOfNoReturn({ ...initial, speed: 0 }, rocks), 0);
    assert.ok(Number.isFinite(pointOfNoReturn(stepVessel(initial, { rudderCommand: 20 }, 1), rocks)));
  }
});

test('invalid numeric inputs, unknown/prototype hulls and malformed geometry throw RangeError', () => {
  const ship = createVessel('trawler');
  for (const type of ['unknown', '__proto__', 'toString', null]) {
    assert.throws(() => createVessel(type), RangeError);
    assert.throws(() => measureTacticalDiameter(type), RangeError);
  }
  for (const bad of [NaN, Infinity, -Infinity, '1', null]) {
    for (const key of ['x', 'y', 'heading', 'speed']) assert.throws(() => createVessel('trawler', { [key]: bad }), RangeError);
    assert.throws(() => stepVessel(ship, {}, bad), RangeError);
    for (const key of ['rudderCommand', 'throttle']) assert.throws(() => stepVessel(ship, { [key]: bad }, 1), RangeError);
    for (const key of ['x', 'y', 'heading', 'yawRate', 'rudder', 'speed']) assert.throws(() => stepVessel({ ...ship, [key]: bad }, {}, 1), RangeError);
    assert.throws(() => hornRange(bad), RangeError);
    assert.throws(() => threatensReef(ship, rock, bad), RangeError);
    for (const key of ['time', 'seed', 'trust']) assert.throws(() => broadcastHorn([ship], { ...options, [key]: bad }), RangeError);
  }
  for (const bad of [-1, 1.01]) assert.throws(() => hornRange(bad), RangeError);
  for (const bad of [0, -1]) assert.throws(() => stepVessel(ship, {}, bad), RangeError);
  for (const bad of [-0.01, 1.01]) assert.throws(() => stepVessel(ship, { throttle: bad }, 1), RangeError);
  assert.throws(() => createVessel('trawler', { speed: -1 }), RangeError);
  assert.throws(() => createVessel('trawler', { smuggler: 1 }), RangeError);
  assert.throws(() => createVessel('trawler', { id: NaN }), RangeError);
  assert.throws(() => threatensReef(ship, rock, -1), RangeError);
  for (const rocks of [null, [null], [{ x: 0, y: 0, radius: -1 }], [{ x: 0, y: NaN, radius: 1 }]]) {
    assert.throws(() => pointOfNoReturn(ship, rocks), RangeError);
    assert.throws(() => threatensReef(ship, rocks, 10), RangeError);
    assert.throws(() => broadcastHorn([ship], { ...options, rocks }), RangeError);
  }
  assert.throws(() => broadcastHorn(null, options), RangeError);
  assert.throws(() => broadcastHorn([ship], { ...options, seed: 0x100000000 }), RangeError);
  assert.throws(() => broadcastHorn([ship], { ...options, trust: -1 }), RangeError);
  assert.throws(() => broadcastHorn([ship], { ...options, origin: { x: 0, y: Infinity } }), RangeError);
  assert.throws(() => stepVessel({ ...ship, rudder: 100 }, {}, 1), RangeError);
});
