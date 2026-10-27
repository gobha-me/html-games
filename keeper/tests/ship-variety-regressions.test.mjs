import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../js/sim.js';
import { keyingFor } from '../js/morse.js';
import { HULLS, PHYSICS_DT as DT, threatensReef, THREAT_HORIZON_SECONDS } from '../js/physics.js';

const {
  createState, step, isLit, bearingTo, perception, specialtyApproach,
  LIFEBOAT_LOST_SECONDS, LIFEBOAT_DRIFT_THROTTLE,
} = sim;

const HOLD = Object.freeze({ hold: true });
const gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const find = (state, id) => state.ships.find((ship) => ship.id === id);

function quietRock(state, avoid = []) {
  const trawler = bearingTo(state.trawler);
  const rock = state.hazards.slice(3).find((candidate) => gap(bearingTo(candidate), trawler) > 40
    && avoid.every((bearing) => gap(bearingTo(candidate), bearing) > 40));
  assert.ok(rock, `seed ${state.seed} has no quiet rock`);
  return rock;
}

function openBearing(state, avoid = []) {
  const trawler = bearingTo(state.trawler);
  for (let bearing = 0; bearing < 360; bearing += 5) {
    if (gap(bearing, trawler) > 40 && avoid.every((other) => gap(bearing, other) > 40)
      && state.hazards.every((rock) => gap(bearing, bearingTo(rock)) > 25)) return bearing;
  }
  assert.fail('no open bearing');
}

function install(state, approach) {
  if (typeof sim.installSpecialty === 'function') {
    return sim.installSpecialty(state, approach);
  }
  const next = structuredClone(state);
  const entry = { ...structuredClone(approach), spawnTime: next.time };
  next.schedule.push(entry);
  return step(next, HOLD, DT);
}

test('R1: strict spawnTime > prevents opener or prior arrival from re-entering after emptySea', () => {
  const base = createState(108);
  assert.equal(base.schedule[0].id, 'trawler');
  assert.equal(base.schedule[0].spawnTime, 0);

  // Clearing ships at t=0 (emptySea) and blasting horn on the first tick must not re-admit opener.
  const emptyAtZero = { ...createState(108), ships: [] };
  const afterFirstTick = step(emptyAtZero, { hold: true, horn: true }, DT);
  assert.equal(find(afterFirstTick, 'trawler'), undefined, 'opener at t=0 must not re-enter after emptySea');
  assert.equal(afterFirstTick.ships.length, 0);
  assert.equal(afterFirstTick.trust, 0.75, 'horn on emptySea is a false alarm');

  // Advancing one tick so a scheduled ship at t=DT arrives, then clearing ships and stepping again
  // must not re-admit either the t=0 opener or the t=DT arrival at the state.time - dt boundary.
  const withTickArrival = structuredClone(base);
  const bearing = openBearing(withTickArrival);
  withTickArrival.schedule.push(specialtyApproach({ id: 'tick-1', bearing, spawnTime: DT, spawnRange: 300 }));
  const arrived = step(withTickArrival, HOLD, DT);
  assert.notEqual(find(arrived, 'trawler'), undefined);
  assert.notEqual(find(arrived, 'tick-1'), undefined);

  const clearedAfterArrival = { ...arrived, ships: [] };
  const afterSecondTick = step(clearedAfterArrival, { hold: true, horn: true }, DT);
  assert.equal(find(afterSecondTick, 'trawler'), undefined);
  assert.equal(find(afterSecondTick, 'tick-1'), undefined);
  assert.equal(afterSecondTick.ships.length, 0);
  assert.equal(afterSecondTick.trust, 0.75);
});

test('R2: lifeboat SOS repeat and unlit loss timer apply only when distress is true', () => {
  let state = createState(108);
  const rock = quietRock(state);
  const distressBearing = bearingTo(rock);
  const distressApproach = specialtyApproach({
    id: 'sos-lb',
    type: 'lifeboat',
    bearing: distressBearing,
    spawnRange: Math.hypot(rock.x, rock.y) - rock.radius - 40,
  });

  const clearBearing = openBearing(state, [distressBearing]);
  const genericApproach = {
    ...specialtyApproach({ id: 'generic-lb', type: 'lifeboat', bearing: clearBearing, spawnRange: 200 }),
    distress: false,
    speed: HULLS.lifeboat.cruiseSpeed,
  };

  state = install(state, distressApproach);
  state = install(state, genericApproach);
  state.beam = openBearing(state, [distressBearing, clearBearing]);

  const distressBoat = find(state, 'sos-lb');
  const genericBoat = find(state, 'generic-lb');
  assert.equal(distressBoat.speed, HULLS.lifeboat.cruiseSpeed * LIFEBOAT_DRIFT_THROTTLE);
  assert.deepEqual(distressBoat.reply?.flashes, keyingFor('SOS', 8));
  assert.ok(distressBoat.reply?.repeatSeconds > 0);
  assert.equal(perception(state, distressBoat).runningLights, false);

  assert.equal(genericBoat.type, 'lifeboat');
  assert.equal(genericBoat.distress, false);
  assert.equal(isLit(state, distressBoat), false);
  assert.equal(isLit(state, genericBoat), false);
  const afterDark = step(state, HOLD, LIFEBOAT_LOST_SECONDS + 1);
  assert.equal(find(afterDark, 'sos-lb').status, 'lost');
  assert.notEqual(find(afterDark, 'sos-lb').lostAt, null);
  assert.equal(find(afterDark, 'generic-lb').status, 'underway', 'non-distress lifeboat hull is not lost from darkness');
  assert.equal(find(afterDark, 'generic-lb').lostAt, null);
  assert.equal(find(afterDark, 'generic-lb').unlitSeconds, 0);
  assert.equal(genericBoat.reply, null, 'non-distress lifeboat hull does not auto-SOS');
  assert.equal(perception(state, genericBoat).signal, false);
  assert.equal(perception(state, genericBoat).runningLights, true);
  assert.equal(distressApproach.distress, true, 'specialtyApproach sets distress: true for lifeboats');
  assert.equal(distressBoat.distress, true);
});

test('R3: blastHorn excludes distress ships while non-distress lifeboat hulls still hear the horn', () => {
  const base = createState(108);
  const rock = quietRock(base);
  const rockBearing = bearingTo(rock);
  const reefs = base.hazards.map((hazard) => ({ x: hazard.x, y: -hazard.y, radius: hazard.radius + 8 }));
  const withoutOpener = { ...base, schedule: base.schedule.slice(1), ships: [] };

  const distressOnly = install(withoutOpener, specialtyApproach({
    id: 'sos-only',
    type: 'lifeboat',
    bearing: rockBearing,
    spawnRange: Math.hypot(rock.x, rock.y) - rock.radius - 30,
  }));
  distressOnly.beam = (rockBearing + 180) % 360;
  const sosShip = find(distressOnly, 'sos-only');
  assert.equal(threatensReef({ ...sosShip, y: -sosShip.y }, reefs, THREAT_HORIZON_SECONDS), true);

  const afterDistressBlast = step(distressOnly, { hold: true, horn: true }, DT);
  assert.equal(afterDistressBlast.trust, 0.75, 'fleet with only a distress lifeboat treats horn as false alarm');
  assert.equal(find(afterDistressBlast, 'sos-only').lastHorn, undefined);
  assert.equal(find(afterDistressBlast, 'sos-only').warnedAt, null);
  assert.equal(find(afterDistressBlast, 'sos-only').response, 'none');

  const otherRock = quietRock(base, [rockBearing]);
  const hullBearing = bearingTo(otherRock);
  let mixed = install(withoutOpener, specialtyApproach({
    id: 'sos-mixed',
    type: 'lifeboat',
    bearing: rockBearing,
    spawnRange: Math.hypot(rock.x, rock.y) - rock.radius - 30,
  }));
  mixed = install(mixed, {
    ...specialtyApproach({
      id: 'honest-lifeboat-hull',
      type: 'lifeboat',
      bearing: hullBearing,
      spawnRange: Math.hypot(otherRock.x, otherRock.y) + 80,
    }),
    distress: false,
    threatening: true,
    speed: HULLS.lifeboat.cruiseSpeed,
  });
  mixed.beam = openBearing(mixed, [rockBearing, hullBearing]);

  const afterMixedBlast = step(mixed, { hold: true, horn: true }, DT);
  const warnedHull = find(afterMixedBlast, 'honest-lifeboat-hull');
  const ignoredSos = find(afterMixedBlast, 'sos-mixed');
  assert.equal(afterMixedBlast.trust, 1, 'endangered non-distress lifeboat hull justifies the horn blast');
  assert.equal(warnedHull.lastHorn?.heard, true);
  assert.equal(warnedHull.response, 'turn-away');
  assert.equal(warnedHull.warnedAt, afterMixedBlast.time);
  assert.equal(ignoredSos.lastHorn, undefined);
  assert.equal(ignoredSos.warnedAt, null);
  assert.equal(ignoredSos.response, 'none');
});
