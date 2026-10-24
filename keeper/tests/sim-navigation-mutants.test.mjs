import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, step } from '../js/sim.js';
import { createVessel, stepVessel, PHYSICS_DT } from '../js/physics.js';

function encounter(type, hazards, options = {}) {
  const state = createState(108);
  state.schedule = [];
  state.hazards = hazards;
  Object.assign(state.trawler, createVessel(type, { x: 0, y: 250, heading: 0 }), {
    destination: { x: 0, y: -1350 }, reactAt: 0, response: 'turn-away', ...options,
  });
  return state;
}
const reef = { kind: 'reef', x: 0, y: 0, radius: 24 };

test('a physically enclosed hull receives the complete blocked plan and still wrecks', () => {
  const previous = encounter('trawler', [{ ...reef, radius: 100 }], { y: 0 });
  const next = step(previous, { hold: true });
  assert.deepEqual(next.trawler.navigation, { phase: 'blocked', heading: 0, sign: 0, course: 0, obstacles: [0] });
  assert.equal(next.trawler.targetHeading, 0);
  assert.equal(next.trawler.turnSign, 0);
  assert.equal(next.trawler.status, 'wrecked');
  assert.equal(next.trawler.wreckedAt, PHYSICS_DT);
  assert.equal(previous.trawler.navigation, null);
});

test('avoidance chooses the smallest clear offset and checks both sides of a neighbouring reef', () => {
  for (const [side, heading, sign] of [[0, 347, -1], [-1, 13, 1], [1, 347, -1]]) {
    const hazards = side === 0 ? [reef] : [reef, { kind: 'wreck', x: side * 85, y: 0, radius: 20 }];
    const next = step(encounter('speedboat', hazards), { hold: true });
    assert.deepEqual(next.trawler.navigation, { phase: 'out', heading, sign, course: 0, obstacles: [0] });
    assert.equal(next.trawler.targetHeading, heading);
    assert.equal(next.trawler.rudder, sign * 1.5);
    assert.equal(next.trawler.status, 'underway');
  }
});

test('the prediction includes the slow hull turn and return leg, rather than an instantaneous change of heading', () => {
  const next = step(encounter('trawler', [reef], { y: 100 }), { hold: true });
  assert.deepEqual(next.trawler.navigation, { phase: 'out', heading: 320, sign: -1, course: 0, obstacles: [0] });
  assert.equal(next.trawler.rudder, -0.125);
});

test('an unobstructed return leg resumes its destination immediately', () => {
  const next = step(encounter('speedboat', []), { hold: true });
  assert.deepEqual(next.trawler.navigation, { phase: 'resume', heading: 359, sign: -1, course: 0, obstacles: [] });
  assert.equal(next.trawler.targetHeading, 0);
  assert.equal(next.trawler.rudder, 0);
});

test('the hazard must be strictly astern of the full clearance plane before resuming', () => {
  const navigation = { phase: 'out', heading: 0, sign: 1, course: 0, obstacles: [0] };
  const boundary = encounter('speedboat', [reef], { x: 100, y: -52,
    navigation, destination: { x: 100, y: -1652 } });
  const atPlane = step(boundary, { hold: true });
  assert.equal(atPlane.trawler.navigation.phase, 'out');
  const pastPlane = step(atPlane, { hold: true });
  assert.equal(pastPlane.trawler.navigation.phase, 'resume');
  const blocked = encounter('speedboat', [], { navigation: { ...navigation, phase: 'blocked', sign: 0, obstacles: [] } });
  assert.equal(step(blocked, { hold: true }).trawler.navigation.phase, 'blocked');
});

test('the helm reserves both yaw coast and rudder slew on either turn sign', () => {
  for (const sign of [-1, 1]) {
    const heading = sign === 1 ? 8.1 : 351.9;
    const previous = encounter('trawler', [reef], { rudder: sign * 10, yawRate: sign * 0.2,
      navigation: { phase: 'out', heading, sign, course: 0, obstacles: [0] } });
    const next = step(previous, { hold: true });
    assert.ok(Math.abs(next.trawler.rudder - sign * 10) < 1e-10, `coast reservation on sign ${sign}: ${next.trawler.rudder}`);
    assert.equal(next.trawler.navigation.phase, 'out');
  }
});

test('avoidance predicts live yaw and rudder momentum rather than assuming a hull at rest', () => {
  for (const [type, yawRate, rudder, heading, sign, nextRudder] of [
    ['speedboat', 30, 30, 34, 1, 28.5],
    ['speedboat', -30, -30, 326, -1, -28.5],
    ['trawler', 2, 30, 37, 1, 30.125],
  ]) {
    const previous = encounter(type, [reef], { y: 100, yawRate, rudder, destination: { x: 0, y: -1500 } });
    const next = step(previous, { hold: true });
    assert.deepEqual(next.trawler.navigation, { phase: 'out', heading, sign, course: 0, obstacles: [0] });
    assert.equal(next.trawler.rudder, nextRudder);
  }
});

test('a broad impassable reef rejects retreat-only plans and exhausts the forward prediction', () => {
  // The near edge is 100 m away; its wide face permits a sideways/retreating
  // course but cannot be cleared toward the destination inside the horizon.
  const previous = encounter('speedboat', [{ x: 0, y: -1e6, radius: 999900 }], {
    y: 0, destination: { x: 0, y: -1600 },
  });
  const next = step(previous, { hold: true });
  assert.deepEqual(next.trawler.navigation, { phase: 'blocked', heading: 0, sign: 0, course: 0, obstacles: [0] });
  assert.equal(next.trawler.status, 'underway');
});

test('a nearly aligned bow is not settled while substantial residual yaw remains', () => {
  // The first physical tick reaches 1 degree, with about 58 degrees/s yaw
  // still to unwind. Looking only at heading would reject its clear arc.
  const yawRate = 1 / ((1 + Math.exp(-PHYSICS_DT / 0.35)) * PHYSICS_DT / 2);
  const previous = encounter('speedboat', [reef], { y: 150, yawRate });
  const next = step(previous, { hold: true });
  assert.deepEqual(next.trawler.navigation, { phase: 'out', heading: 1, sign: 1, course: 0, obstacles: [0] });
});

test('a first predicted position exactly on the clearance disc rejects every candidate', () => {
  // Every candidate initially slews the same rudder magnitude. Put a point
  // reef exactly 8 + 20 m from the first port-turn pose, before yaw settles.
  const first = stepVessel(createVessel('speedboat', { x: 0, y: 0, heading: 0 }),
    { rudderCommand: -1.5 }, PHYSICS_DT);
  const previous = encounter('speedboat', [{ x: first.x + 28, y: -first.y, radius: 0 }], {
    y: 0, destination: { x: 0, y: -1600 },
  });
  const next = step(previous, { hold: true });
  assert.deepEqual(next.trawler.navigation, { phase: 'blocked', heading: 0, sign: 0, course: 0, obstacles: [0] });
  assert.equal(next.trawler.status, 'underway');
});
