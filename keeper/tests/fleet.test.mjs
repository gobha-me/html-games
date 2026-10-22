import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, summary, bearingTo } from '../js/sim.js';

const DT = 1 / 60;

test('unseen ships of every status are excluded from the dawn tally', () => {
  const ships = ['safe', 'wrecked', 'underway'].flatMap((status) =>
    [false, true].map((everSeen) => ({ status, everSeen })));
  assert.deepEqual(summary({ ships }), { safe: 1, wrecked: 1, unseen: 3 });
});

test('sightings latch only from beam or running lights, including wrecks', () => {
  let state = createState(); state.schedule = []; state.beam = 180;
  state.trawler.smuggler = true;
  state = step(state, { hold: true, horn: true }, DT);
  assert.equal(state.trawler.everSeen, false, 'hearing a rescue horn is not seeing');
  state.beam = bearingTo(state.trawler);
  state = step(state, { hold: true }, DT);
  assert.equal(state.trawler.everSeen, true);
  state.beam = 180;
  state = step(state, { hold: true }, 3);
  assert.equal(state.trawler.afterimage, 0);
  assert.equal(state.trawler.everSeen, true);

  state = createState(); state.schedule = []; state.beam = 180;
  state.trawler.x = 100; state.trawler.y = 0;
  state = step(state, { hold: true }, DT);
  assert.equal(state.trawler.everSeen, true, 'running lights without a hull count');
});

test('outbound ship can physically pass safely without ever becoming visible', () => {
  let state = createState(); state.schedule = []; state.beam = 180;
  Object.assign(state.trawler, { x: 480, y: 0, heading: 90, smuggler: true });
  state = step(state, { hold: true }, 180);
  assert.equal(state.trawler.status, 'safe');
  assert.equal(state.trawler.everSeen, false);
  assert.deepEqual(summary(state), { safe: 0, wrecked: 0, unseen: 1 });
});

// These scenarios use independent chart geometry; none relies on legacy ROCKS.
import { CLEAR_MARGIN, NAVIGATION, SPAWN, planHazards, planSpawns, validateSchedule, fogReach } from '../js/sim.js';
import { createVessel } from '../js/physics.js';

function encounter(type = 'speedboat', options = {}) {
  const state = createState();
  state.schedule = [];
  state.hazards = [{ kind: 'reef', x: 0, y: 0, radius: 24 }];
  Object.assign(state.trawler, createVessel(type, { x: 0, y: 250, heading: 0, ...options }),
    { destination: { x: 0, y: -1350 } });
  return state;
}
const delta = (a, b) => ((a - b + 540) % 360) - 180;

test('warned hulls clear every hazard, then resume their destination with at most one heading sign flip', () => {
  for (const type of ['speedboat', 'lifeboat', 'coaster']) {
    for (const side of [-1, 1]) {
      let state = encounter(type);
      // A neighbour makes one side less attractive; the search must consider both.
      state.hazards.push({ kind: 'wreck', x: side * 85, y: 0, radius: 20 });
      let lastSign = 0, flips = 0, resumed = false, sawOutward = false;
      let maximumOffset = 0, minimumClearance = Infinity;
      for (let tick = 0; tick < 180 * 60; tick++) {
        const prior = state.trawler;
        state = step(state, { horn: tick === 0 }, DT);
        const ship = state.trawler;
        assert.notEqual(ship.status, 'wrecked');
        for (const hazard of state.hazards) minimumClearance = Math.min(minimumClearance,
          Math.hypot(ship.x - hazard.x, ship.y - hazard.y) - hazard.radius - 8);
        const change = delta(ship.heading, prior.heading);
        assert.ok(Math.abs(change) < 1, 'no instantaneous course reversal');
        if (Math.abs(change) > 1e-7) {
          const sign = Math.sign(change);
          if (lastSign && sign !== lastSign) flips++;
          lastSign = sign;
        }
        maximumOffset = Math.max(maximumOffset, Math.abs(delta(ship.heading, 0)));
        if (ship.navigation?.phase === 'out') sawOutward = true;
        if (ship.navigation?.phase === 'resume') {
          resumed = true;
          assert.ok(ship.y < -24 - 8 - CLEAR_MARGIN, 'resume only after the hazard is astern');
        }
        if (ship.status === 'safe') {
          assert.ok(Math.hypot(ship.x, ship.y) > 600);
          assert.ok(ship.x * Math.sin(ship.heading * Math.PI / 180) - ship.y * Math.cos(ship.heading * Math.PI / 180) > 0);
        }
      }
      assert.ok(sawOutward && resumed, `${type}: out then resume`);
      assert.equal(flips, 1, `${type}: turn out then back exactly once`);
      assert.ok(maximumOffset < 45, `${type}: minimal deviation, not a reciprocal escape`);
      assert.ok(minimumClearance >= CLEAR_MARGIN, `${type}: clearance ${minimumClearance}`);
      const ship = state.trawler;
      const destinationBearing = bearingTo({ x: ship.destination.x - ship.x, y: ship.destination.y - ship.y });
      assert.ok(Math.abs(delta(ship.heading, destinationBearing)) < 0.5, 'settles toward its destination');
      assert.equal(ship.status, type === 'speedboat' ? 'safe' : 'underway');
    }
  }
});

test('an impossible late warning still wrecks; clear margin never grants collision immunity', () => {
  let state = encounter('coaster', { y: 34 });
  state = step(state, { horn: true }, 10);
  assert.notEqual(state.trawler.warnedAt, null);
  assert.equal(state.trawler.status, 'wrecked');
  assert.ok(state.trawler.wreckedAt < state.trawler.reactAt);
});

test('only an outward crossing beyond 600 m is safe; every arrival has an off-chart destination', () => {
  let state = encounter('speedboat', { x: 0, y: 605, heading: 0 });
  state.hazards = [];
  state = step(state, {}, DT);
  assert.equal(state.trawler.status, 'underway', 'inbound outside the boundary is not saved');
  for (let seed = 0; seed < 20; seed++) {
    const dawn = step(createState(seed), {}, 180);
    for (const ship of dawn.ships) assert.ok(Math.hypot(ship.destination.x, ship.destination.y) > 600);
  }
  assert.equal(NAVIGATION.exitRange, 600);
  assert.equal(CLEAR_MARGIN, 20);
});

test('500 seeds × five nights satisfy every hazard bound, schedule fairness, and steady spawner gaps', () => {
  const layouts = new Set();
  for (let seed = 0; seed < 500; seed++) for (let night = 1; night <= 5; night++) {
    const hazards = planHazards(seed, { night }), plan = planSpawns(seed, { night });
    const where = `${seed}/${night}`;
    layouts.add(JSON.stringify(hazards));
    assert.deepEqual(hazards, planHazards(seed, { night }));
    assert.ok(hazards.length >= 5 && hazards.length <= 9, where);
    assert.ok(hazards.filter((hazard) => hazard.radius <= 10).length >= 2, where);
    const quadrants = new Set();
    for (const [index, hazard] of hazards.entries()) {
      assert.ok(['reef', 'shoal', 'wreck'].includes(hazard.kind), where);
      assert.ok(hazard.radius >= 6 && hazard.radius <= 34, where);
      const range = Math.hypot(hazard.x, hazard.y);
      assert.ok(range <= 430 && range - hazard.radius >= 90, where);
      quadrants.add(`${hazard.x >= 0}/${hazard.y >= 0}`);
      for (const other of hazards.slice(index + 1)) {
        assert.ok(Math.hypot(hazard.x - other.x, hazard.y - other.y) > hazard.radius + other.radius, where);
      }
    }
    assert.ok(quadrants.size >= 3, where);
    assert.ok(validateSchedule(plan, { night, fogReach: fogReach(0.16), phase0: 285 }).ok, where);
    const times = [0, ...plan.map((ship) => ship.spawnTime)];
    for (let index = 1; index < times.length; index++) {
      assert.ok(times[index] - times[index - 1] <= 2 * SPAWN.intervalStart * (1 + SPAWN.jitter), where);
    }
    assert.ok(plan.some((ship) => ship.spawnTime > 80), where);
    if (night === 1) {
      const state = createState(seed);
      assert.deepEqual(state.hazards, hazards);
      assert.ok(validateSchedule(state.schedule, state.nightParams).ok, where);
    }
  }
  assert.equal(layouts.size, 2500, 'seed and night both affect layouts');
});

test('hazard generation rejects invalid seeds/nights and never shares mutable results', () => {
  for (const seed of [undefined, null, false, true, -1, 1.5, 0x100000000, NaN, Infinity, '1', 1n, {}, []]) {
    assert.throws(() => planHazards(seed), RangeError);
  }
  for (const night of [null, false, 0, 6, 1.5, NaN, Infinity, '1', 1n, {}, []]) {
    assert.throws(() => planHazards(108, { night }), RangeError);
  }
  const hazards = planHazards(0xffffffff), saved = structuredClone(hazards);
  hazards[0].x = 10000;
  assert.deepEqual(planHazards(0xffffffff), saved);
  assert.deepEqual(planHazards(-0), planHazards(0));
});

test('the complete seeded maneuver clears the far side of the chart before resuming, even after exit', () => {
  // The seed-108 incoming lane crosses hazards on BOTH sides of the lighthouse.
  // An exit-only predictor would accept a course without checking its return.
  let state = step(createState(108), {}, 60);
  state.schedule = [];
  state = step(state, { horn: true }, 3);
  assert.notEqual(state.trawler.navigation.phase, 'blocked');
  let lastSign = 0, flips = 0, resumed = false, finished = false;
  for (let elapsed = 0; elapsed < NAVIGATION.predictionSeconds; elapsed += 0.5) {
    // Continue the physical hull beyond the watch, without spawning another fleet.
    state.time = 0; state.phase = 'night'; state.trawler.reactAt = -1;
    const old = state.trawler.heading;
    state = step(state, {}, 0.5);
    const ship = state.trawler, change = delta(ship.heading, old);
    for (const hazard of state.hazards) {
      assert.ok(Math.hypot(ship.x - hazard.x, ship.y - hazard.y) - hazard.radius - 8 >= CLEAR_MARGIN);
    }
    if (Math.abs(change) > 1e-7) {
      const sign = Math.sign(change);
      if (lastSign && lastSign !== sign) flips++;
      lastSign = sign;
    }
    if (ship.navigation.phase === 'resume') resumed = true;
    const target = bearingTo({ x: ship.destination.x - ship.x, y: ship.destination.y - ship.y });
    if (resumed && Math.abs(delta(target, ship.heading)) < 0.05 && Math.abs(ship.yawRate) < 0.01) {
      finished = true; break;
    }
  }
  assert.ok(resumed && finished, 'validate the whole return, not only an outbound exit');
  assert.ok(flips <= 1);
});
