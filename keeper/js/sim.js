import { PHYSICS_DT, HULLS, createVessel, stepVessel, broadcastHorn, threatensReef, pointOfNoReturn } from './physics.js';

// World units are chart metres; bearings increase clockwise from north.
// No wall clock, DOM, storage, or unseeded randomness belongs in this module.
export const NIGHT_SECONDS = 180;
export const AFTERIMAGE_SECONDS = 1.5;
export const CONE_DEGREES = 14;
export const BUDGET_PERIOD_SECONDS = 12;
export const NIGHT_PASSES = Object.freeze([4, 4, 3, 3, 2]);
export const FAST_SHIP_SPEED = 8; // Chart metres / second; audio adapter hook for #115.
export const SPEED = Object.freeze({ slow: 12, default: 30, fast: 60 });
export const ROCKS = Object.freeze([
  Object.freeze({ x: 210, y: -255, radius: 24 }),
  Object.freeze({ x: 244, y: -238, radius: 18 }),
  Object.freeze({ x: 274, y: -219, radius: 14 }),
  Object.freeze({ x: -125, y: -100, radius: 12 }),
]);
const TICK = PHYSICS_DT;
const RAD = Math.PI / 180;
const SHIP_RADIUS = 8;
const NIGHT_FOG_MAX = 0.16;
// The canvas chart points south; the pure physics API points north. Inflate
// collision discs by the hull clearance, consistently for horns, PONR and wrecks.
const REEFS = Object.freeze(ROCKS.map((rock) => Object.freeze({
  x: rock.x, y: -rock.y, radius: rock.radius + SHIP_RADIUS,
})));
const physical = (ship) => ({ ...ship, y: -ship.y });
const fleet = (state) => state.ships ?? [state.trawler];

function checkPeriod(period) {
  if (!Number.isFinite(period) || period <= 0) throw new RangeError('Period must be finite and positive');
}

// Count centre-line crossings, excluding the opening instant and including the end.
// Keeping whole revolutions (rather than wrapping times) preserves multi-pass windows.
export function passesBetween({ bearing, tStart, tEnd, period = BUDGET_PERIOD_SECONDS, phase0 = 0 }) {
  checkPeriod(period);
  if (![bearing, tStart, tEnd, phase0].every(Number.isFinite) || tEnd < tStart) {
    throw new RangeError('Sweep window and bearings must be finite and ordered');
  }
  const offset = wrapBearing(wrapBearing(bearing) - wrapBearing(phase0)) / 360;
  const lastCrossing = (time) => {
    const cycle = Math.floor(time / period - offset);
    // Division/subtraction can round an exact endpoint into the adjacent cycle.
    // Compare actual crossing times, without an epsilon that admits future passes.
    if ((cycle + offset) * period > time) return cycle - 1;
    return (cycle + 1 + offset) * period <= time ? cycle + 1 : cycle;
  };
  return lastCrossing(tEnd) - lastCrossing(tStart);
}

// Fog reach must ALSO extend at least this far: extra travel outside fog is not warning time.
export function spawnRangeFor({ speed, responseSeconds, turnRadius, passes, period = BUDGET_PERIOD_SECONDS, pnrRange }) {
  checkPeriod(period);
  if (!Number.isFinite(speed) || speed <= 0 || !Number.isInteger(passes) || passes < 1
    || ![responseSeconds, turnRadius, pnrRange].every((value) => Number.isFinite(value) && value >= 0)) {
    throw new RangeError('Invalid radial approach budget');
  }
  return pnrRange + speed * responseSeconds + turnRadius + speed * (passes + 1) * period;
}

export function validateSchedule(schedule, { night, fogReach: reach, period = BUDGET_PERIOD_SECONDS, phase0 = 0 }) {
  if (!Number.isInteger(night) || night < 1 || night > NIGHT_PASSES.length) throw new RangeError('Invalid night');
  checkPeriod(period);
  if (!Number.isFinite(reach) || reach <= 0 || !Number.isFinite(phase0)) throw new RangeError('Invalid night visibility');
  if (!Array.isArray(schedule)) throw new TypeError('Schedule must be an array');
  const required = NIGHT_PASSES[night - 1];
  const violations = [];
  for (let index = 0; index < schedule.length; index++) {
    const ship = schedule[index];
    const numbers = ['spawnTime', 'bearing', 'speed', 'responseSeconds', 'turnRadius', 'pnrRange', 'spawnRange'];
    if (!ship || !((typeof ship.id === 'string' && ship.id.length > 0) || Number.isFinite(ship.id))
      || !numbers.every((key) => Number.isFinite(ship[key])) || ship.speed <= 0
      || ['spawnTime', 'responseSeconds', 'turnRadius', 'pnrRange', 'spawnRange'].some((key) => ship[key] < 0)) {
      violations.push({ index, reason: 'invalid-ship', passes: 0, required });
      continue;
    }
    const firstVisible = ship.spawnTime + Math.max(0, ship.spawnRange - reach) / ship.speed;
    const pnrTime = ship.spawnTime + (ship.spawnRange - ship.pnrRange - ship.speed * ship.responseSeconds - ship.turnRadius) / ship.speed;
    if (![firstVisible, pnrTime].every(Number.isFinite)) {
      violations.push({ index, reason: 'invalid-ship', passes: 0, required });
    } else if (pnrTime < firstVisible) {
      violations.push({ index, reason: 'pnr-before-visible', passes: 0, required });
    } else {
      const passes = passesBetween({ bearing: ship.bearing, tStart: firstVisible, tEnd: pnrTime, period, phase0 });
      if (passes < required) violations.push({ index, reason: 'insufficient-passes', passes, required });
    }
  }
  return { ok: violations.length === 0, violations };
}

export function wrapBearing(degrees) {
  if (!Number.isFinite(degrees)) throw new TypeError('Bearing must be finite');
  return ((degrees % 360) + 360) % 360;
}
export function clampSpeed(speed) {
  if (!Number.isFinite(speed)) throw new TypeError('Speed must be finite');
  return Math.max(SPEED.slow, Math.min(SPEED.fast, speed));
}
export function fogReach(density) {
  if (!Number.isFinite(density)) throw new TypeError('Fog must be finite');
  return 500 - 220 * Math.max(0, Math.min(1, density));
}
export function bearingTo(object) {
  return wrapBearing(Math.atan2(object.x, -object.y) / RAD);
}
export function isLit(state, object = state.trawler) {
  const difference = Math.abs(((bearingTo(object) - state.beam + 540) % 360) - 180);
  return Math.hypot(object.x, object.y) <= fogReach(state.fog) && difference <= CONE_DEGREES / 2;
}

export function createState(seed = 108) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new TypeError('Seed must be a uint32');
  }
  // One LCG draw determines the approach lane; the course always crosses the reef.
  const random = ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000;
  const bearing = bearingTo(ROCKS[0]) + (random - 0.5);
  const east = Math.sin(bearing * RAD), north = Math.cos(bearing * RAD);
  // Outermost intersection of the incoming radial lane with an inflated reef.
  const pnrRange = Math.max(...REEFS.map((rock) => {
    const along = rock.x * east + rock.y * north;
    const across = rock.x * north - rock.y * east;
    return Math.abs(across) <= rock.radius ? along + Math.sqrt(rock.radius ** 2 - across ** 2) : 0;
  }));
  const spec = HULLS.trawler;
  const reference = createVessel('trawler', { x: east * 500, y: north * 500, heading: bearing + 180 });
  const lead = pointOfNoReturn(reference, REEFS);
  const approach = {
    id: 'trawler', spawnTime: 0, bearing,
    speed: spec.cruiseSpeed, responseSeconds: spec.reactionSeconds[1],
    // Preserve the generic budget API: turnRadius now carries the additional
    // maneuver distance measured by PONR, including rudder and yaw lag.
    turnRadius: spec.cruiseSpeed * (lead - spec.reactionSeconds[1]),
    pnrRange, passes: NIGHT_PASSES[0],
  };
  const spawnRange = spawnRangeFor(approach);
  const trawler = {
    ...approach, spawnRange,
    ...createVessel('trawler', { x: east * spawnRange, y: -north * spawnRange, heading: bearing + 180 }),
    status: 'underway', warnedAt: null, wreckedAt: null, reactAt: null,
    targetHeading: null, turnSign: 0, response: 'none',
    afterimage: 0, lastSeen: null,
  };
  return {
    seed, time: 0, phase: 'night', beam: 285, speed: SPEED.default,
    fog: 0.08 + random * 0.04, horn: false, blasts: [], trust: 1,
    nightParams: { night: 1, fogReach: fogReach(NIGHT_FOG_MAX), phase0: 285 },
    schedule: [{ ...approach, spawnRange }],
    ships: [trawler], trawler,
  };
}

// Returns only the pose the keeper has actually observed; no live off-beam hull.
export function perception(state, ship = state.trawler) {
  const lit = isLit(state, ship);
  return {
    lit,
    hull: lit ? { x: ship.x, y: ship.y, heading: ship.heading, status: ship.status }
      : ship.afterimage > 0 ? ship.lastSeen : null,
    opacity: lit ? 1 : 0.30 * ship.afterimage / AFTERIMAGE_SECONDS,
    runningLights: !ship.smuggler && ship.status !== 'wrecked' && Math.hypot(ship.x, ship.y) <= fogReach(state.fog) / 2,
    // Stub only: no live hull pose leaks through this bearing/intensity audio hook.
    engineCue: !lit && ship.status === 'underway' && ship.speed >= FAST_SHIP_SPEED
      ? { bearing: bearingTo(ship), intensity: 1 / (1 + Math.hypot(ship.x, ship.y) / fogReach(state.fog)) }
      : null,
  };
}

function tick(state, input, dt) {
  state.time = Math.min(NIGHT_SECONDS, state.time + dt);
  const steer = Number(input.fast === true) - Number(input.slow === true);
  state.speed = clampSpeed(state.speed + steer * 24 * dt);
  if (input.hold !== true) state.beam = wrapBearing(state.beam + state.speed * dt);
  state.fog = 0.08 + 0.08 * state.time / NIGHT_SECONDS;
  state.blasts = state.blasts.filter((time) => state.time - time < 20);
  if (input.horn === true && !state.horn) {
    state.blasts.push(state.time);
    const ships = fleet(state).filter((ship) => ship.status === 'underway' || ship.status === 'safe');
    const responses = broadcastHorn(ships.map(physical), {
      origin: { x: 0, y: 0 }, fogDensity: state.fog, time: state.time,
      seed: (state.seed + state.blasts.length) >>> 0, trust: state.trust, rocks: REEFS,
    });
    // Only false alarms erode trust. A real warning to any endangered listener
    // is useful even when another captain is already on a safe track (#109).
    if (!ships.some((ship, index) => responses[index].heard && threatensReef(physical(ship), REEFS, Number.MAX_VALUE))) {
      state.trust = Math.max(0, state.trust - 0.25);
    }
    for (let index = 0; index < ships.length; index++) {
      const ship = ships[index], response = responses[index];
      ship.lastHorn = response;
      if (ship.warnedAt !== null || !['turn-away', 'veer'].includes(response.response)) continue;
      ship.warnedAt = state.time;
      ship.reactAt = response.reactAt;
      ship.response = response.response;
      const pose = physical(ship);
      // Steer away from the nearest reef; dark launches instead veer away
      // from the lighthouse. The rudder controller sails the reciprocal track.
      const obstacle = response.response === 'veer' ? { x: 0, y: 0 }
        : REEFS.reduce((a, b) => Math.hypot(a.x - pose.x, a.y - pose.y) - a.radius
          < Math.hypot(b.x - pose.x, b.y - pose.y) - b.radius ? a : b);
      const starboard = (obstacle.x - pose.x) * Math.cos(pose.heading * RAD)
        - (obstacle.y - pose.y) * Math.sin(pose.heading * RAD);
      ship.turnSign = starboard > 0 ? -1 : 1;
      ship.targetHeading = response.response === 'veer'
        ? wrapBearing(bearingTo(ship) + ship.turnSign * 30) : wrapBearing(ship.heading + 180);
      if (response.response === 'veer') {
        const error = ((ship.targetHeading - ship.heading + 540) % 360) - 180;
        ship.turnSign = error < 0 ? -1 : 1;
      }
    }
  }
  state.horn = input.horn === true;
  for (const ship of fleet(state)) {
    if (ship.status === 'underway' || ship.status === 'safe') {
      const spec = HULLS[ship.type];
      let rudderCommand = 0;
      if (ship.reactAt !== null && state.time >= ship.reactAt) {
        const error = ((ship.targetHeading - ship.heading + 540) % 360) - 180;
        // Full helm through the early turn; anticipate yaw/helm inertia when
        // settling onto the escape course, without snapping the rendered bow.
        const directedError = Math.abs(error) > 150 ? ship.turnSign * Math.abs(error) : error;
        rudderCommand = (directedError - ship.yawRate * (spec.T + spec.maxRudderDeg / spec.rudderRateDegPerS / 2)) * 1.5;
      }
      const next = stepVessel(physical(ship), { rudderCommand, throttle: 1 }, dt);
      Object.assign(ship, next, { y: -next.y });
      if (ship.status === 'underway' && REEFS.some((rock) => Math.hypot(ship.x - rock.x, -ship.y - rock.y) <= rock.radius)) {
        ship.status = 'wrecked';
        ship.wreckedAt = state.time;
      } else if (Math.hypot(ship.x, ship.y) > 590
        || (ship.warnedAt !== null && Math.abs(((ship.targetHeading - ship.heading + 540) % 360) - 180) < 120
          && !threatensReef(physical(ship), REEFS, Number.MAX_VALUE))) {
        ship.status = 'safe';
      }
    }
    if (isLit(state, ship)) {
      ship.afterimage = AFTERIMAGE_SECONDS;
      ship.lastSeen = { x: ship.x, y: ship.y, heading: ship.heading, status: ship.status };
    } else {
      ship.afterimage = Math.max(0, ship.afterimage - dt);
    }
  }
  if (state.time >= NIGHT_SECONDS) {
    state.phase = 'dawn';
    state.horn = false;
  }
}

// Functional boundary: callers retain an untouched prior state for replay and inspection.
// Fixed substeps prevent tunnelling through the Teeth on a long frame or scripted run.
export function step(previous, input = {}, seconds = TICK) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > NIGHT_SECONDS) {
    throw new RangeError('Step must be between 0 and 180 seconds');
  }
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Input must be an action object');
  }
  for (const key of ['slow', 'fast', 'hold', 'horn']) {
    if (input[key] !== undefined && typeof input[key] !== 'boolean') throw new TypeError(`Invalid ${key}`);
  }
  const state = structuredClone(previous);
  let remaining = Math.min(seconds, NIGHT_SECONDS - state.time);
  while (remaining > 1e-9 && state.phase === 'night') {
    const dt = Math.min(TICK, remaining);
    tick(state, input, dt);
    remaining -= dt;
  }
  // Avoid accumulated floating-point error postponing dawn by one browser frame.
  if (NIGHT_SECONDS - state.time < 1e-8) {
    state.time = NIGHT_SECONDS;
    state.phase = 'dawn';
    state.horn = false;
  }
  return state;
}

export function summary(state) {
  return { safe: fleet(state).filter((ship) => ship.status === 'safe').length,
    wrecked: fleet(state).filter((ship) => ship.status === 'wrecked').length };
}
