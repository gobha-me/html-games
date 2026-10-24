import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVessel, stepVessel, measureTacticalDiameter, threatensReef, hornRange,
  broadcastHorn, PHYSICS_DT,
} from '../js/physics.js';

const boat = (options = {}) => createVessel('trawler', { x: 0, y: 0, heading: 0, ...options });
const horn = (options = {}) => ({ origin: { x: 0, y: 0 }, fogDensity: 0, time: 0, seed: 0,
  trust: 1, rocks: [], ...options });
const rangeError = (message) => ({ name: 'RangeError', message });
const close = (actual, expected, tolerance = 1e-12) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `expected ${expected}, received ${actual}`);

test('a turning fractional tick travels along the midpoint heading, not either endpoint or the opposite half-turn', () => {
  const previous = { ...boat({ speed: 2 }), rudder: 10, yawRate: 12 };
  const dt = 0.01;
  const next = stepVessel(previous, { rudderCommand: 10, throttle: 0.4 }, dt);
  // Independently evaluate this constant-rudder Nomoto step's yaw and
  // trapezoidal distance, then resolve the distance at HALF the heading change.
  const targetYaw = 0.08 * 10 * 2 / 1.1;
  const yaw = targetYaw + (12 - targetYaw) * Math.exp(-dt / 4.5);
  const change = (12 + yaw) * dt / 2;
  const drag = 1 + 0.25 * (10 / 35) ** 2;
  const equilibrium = 1.1 * 0.4 / drag;
  const speed = equilibrium + (2 - equilibrium) * Math.exp(-drag * dt / 4.5);
  const distance = (2 + speed) * dt / 2;
  close(next.x, Math.sin(change * Math.PI / 360) * distance);
  close(next.y, Math.cos(change * Math.PI / 360) * distance);
  close(next.heading, change);
  close(next.yawRate, yaw);
  assert.equal(previous.x, 0);
  assert.equal(previous.yawRate, 12);
});

test('a zero-speed hull with residual yaw cannot rotate or displace sideways as thrust starts', () => {
  const previous = { ...boat({ speed: 0 }), rudder: 10, yawRate: 12 };
  const next = stepVessel(previous, { rudderCommand: 10, throttle: 1 }, 0.01);
  assert.equal(next.heading, 0);
  assert.equal(next.yawRate, 0);
  assert.equal(next.x, 0);
  const drag = 1 + 0.25 * (10 / 35) ** 2;
  const speed = 1.1 / drag * (1 - Math.exp(-drag * 0.01 / 4.5));
  close(next.y, speed * 0.01 / 2);
  assert.ok(next.y > 0, 'thrust produces forward displacement');
});

test('sub-step remainder is integrated once and intervals through exactly 1e-12 are skipped', () => {
  const previous = { ...boat(), yawRate: 3, rudder: 10 };
  for (const dt of [0.999e-12, 1e-12]) assert.deepEqual(stepVessel(previous, {}, dt), previous);
  const above = stepVessel(boat(), {}, 1.001e-12);
  close(above.y, 1.1 * 1.001e-12, 1e-25);
  const dt = PHYSICS_DT + 0.005;
  const whole = stepVessel(previous, { rudderCommand: -15 }, dt);
  const parts = stepVessel(stepVessel(previous, { rudderCommand: -15 }, PHYSICS_DT), { rudderCommand: -15 }, 0.005);
  for (const key of ['x', 'y', 'heading', 'yawRate', 'rudder', 'speed']) close(whole[key], parts[key]);
});

test('tactical diameters resolve the 180-degree crossing between samples for all four fixed hulls', () => {
  for (const [type, expected] of [
    ['trawler', 45.31577929896672], ['coaster', 197.99463555175453],
    ['speedboat', 16.43818316394628], ['lifeboat', 21.917130992507595],
  ]) close(measureTacticalDiameter(type), expected, 1e-10);
});

test('vessel validation exposes exact failures, including null hulls and rudder limits', () => {
  assert.throws(() => stepVessel(null, {}, PHYSICS_DT), rangeError('Unknown hull type'));
  for (const type of [undefined, null, '', 'constructor', '__proto__', 1]) {
    assert.throws(() => createVessel(type, { x: 0, y: 0, heading: 0, speed: 1 }), rangeError('Unknown hull type'));
  }
  for (const key of ['x', 'y', 'heading', 'yawRate', 'rudder', 'speed']) {
    assert.throws(() => stepVessel({ ...boat(), [key]: NaN }, {}, PHYSICS_DT), rangeError('Expected finite numbers'));
  }
  for (const invalid of [{ speed: -0.001 }, { rudder: -35.001 }, { rudder: 35.001 }]) {
    assert.throws(() => stepVessel({ ...boat(), ...invalid }, {}, PHYSICS_DT), rangeError('Invalid vessel state'));
  }
  for (const rudder of [-35, 35]) {
    assert.equal(stepVessel({ ...boat(), rudder }, { rudderCommand: rudder }, 1e-12).rudder, rudder);
  }
  for (const options of [{ speed: -1 }, { id: Infinity }, { smuggler: 1 }]) {
    assert.throws(() => boat(options), rangeError('Invalid vessel options'));
  }
  for (const [options, dt] of [[{}, 0], [{ throttle: -0.001 }, 1], [{ throttle: 1.001 }, 1]]) {
    assert.throws(() => stepVessel(boat(), options, dt), rangeError('Invalid timestep or throttle'));
  }
  assert.throws(() => stepVessel(boat(), { throttle: Infinity }, 1), rangeError('Expected finite numbers'));
});

test('reef, fog and horizon validation distinguish malformed, negative and valid zero geometry', () => {
  assert.throws(() => threatensReef(boat(), null, 1), rangeError('Expected rocks array'));
  assert.throws(() => threatensReef(boat(), [null], 1), rangeError('Expected finite numbers'));
  assert.throws(() => threatensReef(boat(), [{ x: 0, y: 0, radius: -1 }], 1), rangeError('Negative rock radius'));
  assert.equal(threatensReef(boat(), [{ x: 0, y: 0, radius: 0 }], 0), true);
  assert.equal(threatensReef(boat(), [], 0), false);
  assert.throws(() => threatensReef(boat(), [], -1e-9), rangeError('Negative horizon'));
  for (const fog of [-1e-9, 1 + 1e-9]) assert.throws(() => hornRange(fog), rangeError('Fog density must be in [0,1]'));
  assert.equal(hornRange(0), 700);
  assert.equal(hornRange(1), 350);
});

test('broadcast guards require a ships array, finite origin, uint32 seed and bounded trust', () => {
  assert.throws(() => broadcastHorn(null, horn()), rangeError('Expected ships array'));
  for (const origin of [undefined, null, { x: NaN, y: 0 }]) {
    assert.throws(() => broadcastHorn([], horn({ origin })), rangeError('Expected finite numbers'));
  }
  for (const seed of [-1, 0.5, 0x100000000]) {
    assert.throws(() => broadcastHorn([], horn({ seed })), rangeError('Invalid seed or trust'));
  }
  for (const trust of [-1e-9, 1 + 1e-9]) {
    assert.throws(() => broadcastHorn([], horn({ trust })), rangeError('Invalid seed or trust'));
  }
  assert.deepEqual(broadcastHorn([], horn({ seed: 0, trust: 0 })), []);
  assert.deepEqual(broadcastHorn([], horn({ seed: 0xffffffff, trust: 1 })), []);
});

test('smuggler exact-half draw veers, while honest trust equality ignores the warning', () => {
  // Inverting the 32-bit hash/LCG gives seed 1566602136 for id x, salt 71:
  // its draw is exactly 0.5, exercising the strict smuggler boundary.
  const dark = boat({ id: 'x', smuggler: true });
  assert.deepEqual(broadcastHorn([dark], horn({ seed: 1566602136 })), [
    { id: 'x', heard: true, response: 'veer', reactAt: 2.3707806872669606 },
  ]);
  const honest = boat({ id: 'x' });
  // Seed 0 / id x / salt 37 has this exact binary64 trust draw.
  const threshold = 0.48380163917317986;
  const rocks = [{ x: 0, y: 100, radius: 1 }];
  for (const [trust, response] of [
    [threshold - 1e-10, 'ignore'], [threshold, 'ignore'], [threshold + 1e-10, 'turn-away'],
  ]) assert.equal(broadcastHorn([honest], horn({ rocks, trust }))[0].response, response);
});

test('finite inputs that overflow during integration are rejected at the output boundary', () => {
  const previous = boat({ speed: Number.MAX_VALUE });
  assert.throws(() => stepVessel(previous, {}, PHYSICS_DT), rangeError('Expected finite numbers'));
  assert.equal(previous.speed, Number.MAX_VALUE);
  assert.equal(previous.y, 0);
});
