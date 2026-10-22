import { PHYSICS_DT, THREAT_HORIZON_SECONDS, HULLS, hornRange, createVessel, stepVessel, broadcastHorn, threatensReef, pointOfNoReturn } from './physics.js';

// World units are chart metres; bearings increase clockwise from north.
// No wall clock, DOM, storage, or unseeded randomness belongs in this module.
export const NIGHT_SECONDS = 180;
export const AFTERIMAGE_SECONDS = 1.5;
export const CONE_DEGREES = 14;
export const BUDGET_PERIOD_SECONDS = 12;
export const NIGHT_PASSES = Object.freeze([4, 4, 3, 3, 2]);
export const CLEAR_MARGIN = 20;
export const NAVIGATION = Object.freeze({ exitRange: 600, destinationLeg: 1600,
  maxOffset: 179, searchStep: 1, predictionSeconds: 2400, settleDegrees: 0.05, settleYaw: 0.01, helmGain: 1.5 });
export const FAST_SHIP_SPEED = 8; // Chart metres / second; audio adapter hook for #115.
export const SPEED = Object.freeze({ slow: 12, default: 30, fast: 60 });
export const SPAWN = Object.freeze({
  firstMin: 24, firstMax: 36,
  intervalStart: 40, intervalEnd: 18, jitter: 0.25,
  maxActive: 3, lastSpawn: 120, minBearingGap: 20, threatShare: 0.6,
});
export const TRAFFIC = Object.freeze({ attempts: 8, lateAfter: 80, maxThreats: 2,
  bearingJitter: 3, openingJitter: 0.5 });
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
const reefsFor = (hazards, margin = 0) => hazards.map((rock) => ({
  x: rock.x, y: -rock.y, radius: rock.radius + SHIP_RADIUS + margin,
}));

export const HAZARD = Object.freeze({
  minCount: 5, maxCount: 9, minRadius: 6, maxRadius: 34,
  smallMaxRadius: 10, smallCount: 2, minCentre: 160, maxCentre: 300,
  angleJitter: 4,
});
function checkSeedNight(seed, night) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Seed must be a uint32');
  if (!Number.isInteger(night) || night < 1 || night > NIGHT_PASSES.length) throw new RangeError('Invalid night');
}
function rng(seed) {
  let bits = seed;
  return () => {
    bits = (Math.imul(bits, 1664525) + 1013904223) >>> 0;
    return bits / 0x100000000;
  };
}
export function planHazards(seed, { night = 1 } = {}) {
  checkSeedNight(seed, night);
  const random = rng((seed ^ Math.imul(night, 0x9e3779b9)) >>> 0);
  const count = HAZARD.minCount + Math.floor(random() * (HAZARD.maxCount - HAZARD.minCount + 1));
  const phase = random() * 360;
  // Equal sectors guarantee separation even at the nearest radial bound:
  // 2 * 160 * sin((360/9 - 8)/2) > 2 * 34. No retries or fallback layout.
  return Array.from({ length: count }, (_, index) => {
    const angle = (phase + index * 360 / count + (random() * 2 - 1) * HAZARD.angleJitter) * RAD;
    const range = HAZARD.minCentre + random() * (HAZARD.maxCentre - HAZARD.minCentre);
    const maximum = index < HAZARD.smallCount ? HAZARD.smallMaxRadius : HAZARD.maxRadius;
    const radius = HAZARD.minRadius + random() * (maximum - HAZARD.minRadius);
    return { kind: ['reef', 'shoal', 'wreck'][Math.floor(random() * 3)],
      x: Math.sin(angle) * range, y: -Math.cos(angle) * range, radius };
  });
}
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

function firstApproach(seed, hazards, night) {
  const reefs = reefsFor(hazards, CLEAR_MARGIN);
  const outermost = hazards.reduce((a, b) => Math.hypot(a.x, a.y) + a.radius > Math.hypot(b.x, b.y) + b.radius ? a : b);
  // One LCG draw determines the approach lane; the course always crosses the reef.
  const random = ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000;
  const bearing = wrapBearing(bearingTo(outermost) + (random * 2 - 1) * TRAFFIC.openingJitter);
  const east = Math.sin(bearing * RAD), north = Math.cos(bearing * RAD);
  // Outermost intersection of the incoming radial lane with an inflated reef.
  const pnrRange = Math.max(...reefs.map((rock) => {
    const along = rock.x * east + rock.y * north;
    const across = rock.x * north - rock.y * east;
    return Math.abs(across) <= rock.radius ? along + Math.sqrt(rock.radius ** 2 - across ** 2) : 0;
  }));
  const spec = HULLS.trawler;
  const reference = createVessel('trawler', { x: east * 500, y: north * 500, heading: bearing + 180 });
  const lead = pointOfNoReturn(reference, reefs);
  const approach = {
    id: 'trawler', spawnTime: 0, bearing,
    speed: spec.cruiseSpeed, responseSeconds: spec.reactionSeconds[1],
    // Preserve the generic budget API: turnRadius now carries the additional
    // maneuver distance measured by PONR, including rudder and yaw lag.
    turnRadius: spec.cruiseSpeed * (lead - spec.reactionSeconds[1]),
    pnrRange, passes: NIGHT_PASSES[night - 1],
  };
  const spawnRange = spawnRangeFor(approach);
  return { ...approach, spawnRange };
}

// A warning can prolong a threatened approach. Reserve its berth through dawn,
// rather than freeing capacity at an impact that the keeper might prevent.
function openingReservation(seed, hazards, night = 1) {
  return { ...firstApproach(seed, hazards, night), type: 'trawler', threatening: true, exitTime: NIGHT_SECONDS };
}

export function planSpawns(seed, { night = 1 } = {}) {
  checkSeedNight(seed, night);
  const hazards = planHazards(seed, { night });
  return extraApproaches(seed, night, openingReservation(seed, hazards, night), hazards);
}

function extraApproaches(seed, night, first, hazards) {
  const random = rng(seed), reefs = reefsFor(hazards, CLEAR_MARGIN);
  const schedule = [first], reach = fogReach(NIGHT_FOG_MAX);
  let spawnTime = SPAWN.firstMin + random() * (SPAWN.firstMax - SPAWN.firstMin);
  while (spawnTime <= SPAWN.lastSpawn) {
    for (let attempt = 0; attempt < TRAFFIC.attempts; attempt++) {
      const threatening = random() < SPAWN.threatShare && attempt < TRAFFIC.attempts - 1;
      // Four passes plus a coaster's physical turn do not fit this fog horizon.
      const type = !threatening ? 'coaster' : NIGHT_PASSES[night - 1] === 4 ? 'trawler'
        : random() < 0.5 ? 'trawler' : 'coaster';
      let bearing = threatening ? wrapBearing(bearingTo(hazards[Math.floor(random() * hazards.length)]) + (random() * 2 - 1) * TRAFFIC.bearingJitter)
        : wrapBearing(first.bearing + SPAWN.minBearingGap + random() * (360 - 2 * SPAWN.minBearingGap));
      const overlapping = schedule.filter((ship) => ship.exitTime >= spawnTime);
      if (attempt === TRAFFIC.attempts - 1) {
        const bearings = overlapping.map((ship) => ship.bearing).sort((a, b) => a - b);
        let widest = 0;
        for (let index = 0; index < bearings.length; index++) {
          const width = wrapBearing(bearings[(index + 1) % bearings.length] - bearings[index]) || 360;
          if (width > widest) { widest = width; bearing = wrapBearing(bearings[index] + width / 2); }
        }
      }
      // Keep rotating berths through the busy early watch. A second permanent
      // reservation is admitted only after the last-minute traffic guarantee.
      if (threatening && (spawnTime <= TRAFFIC.lateAfter || overlapping.filter((ship) => ship.threatening).length >= TRAFFIC.maxThreats)) continue;
      if (overlapping.length >= SPAWN.maxActive
        || overlapping.some((ship) => Math.abs(((ship.bearing - bearing + 540) % 360) - 180) < SPAWN.minBearingGap)) continue;
      const spec = HULLS[type], speed = spec.cruiseSpeed;
      const east = Math.sin(bearing * RAD), north = Math.cos(bearing * RAD);
      const reference = createVessel(type, { x: east * 500, y: north * 500, heading: bearing + 180 });
      const pnrRange = threatening ? Math.max(...reefs.map((rock) => {
        const along = rock.x * east + rock.y * north;
        const across = rock.x * north - rock.y * east;
        return Math.abs(across) <= rock.radius ? along + Math.sqrt(rock.radius ** 2 - across ** 2) : 0;
      })) : 0;
      const lead = threatening ? pointOfNoReturn(reference, reefs) : spec.reactionSeconds[1];
      const approach = {
        id: `ship-${schedule.length}`, type, spawnTime, bearing, speed, threatening,
        responseSeconds: spec.reactionSeconds[1], turnRadius: speed * (lead - spec.reactionSeconds[1]), pnrRange,
      };
      // Clear traffic sails outward from the fog horizon, outside every reef.
      // Threats approach inward using the same physical PONR budget as the opener.
      approach.spawnRange = threatening ? spawnRangeFor({ ...approach, passes: NIGHT_PASSES[night - 1] }) : reach;
      approach.exitTime = threatening ? NIGHT_SECONDS
        : Math.min(NIGHT_SECONDS, spawnTime + (NAVIGATION.exitRange - approach.spawnRange) / speed + 2 * TICK);
      if (approach.spawnRange > reach
        || !validateSchedule([approach], { night, fogReach: reach, phase0: 285 }).ok) continue;
      schedule.push(approach);
      break;
    }
    // Rejected slots still advance the seeded clock; released berths can be reused.
    const gap = SPAWN.intervalStart + (SPAWN.intervalEnd - SPAWN.intervalStart) * spawnTime / NIGHT_SECONDS;
    spawnTime += gap * (1 - SPAWN.jitter + random() * 2 * SPAWN.jitter);
  }
  return schedule.slice(1);
}

function arrive(approach, type = approach.type ?? 'trawler') {
  const { bearing, spawnRange } = approach;
  const east = Math.sin(bearing * RAD), north = Math.cos(bearing * RAD);
  return {
    ...approach, spawnRange,
    ...createVessel(type, { id: approach.id, x: east * spawnRange, y: -north * spawnRange,
      heading: bearing + (approach.threatening === false ? 0 : 180) }),
    destination: { x: east * (spawnRange + (approach.threatening === false ? 1 : -1) * NAVIGATION.destinationLeg),
      y: -north * (spawnRange + (approach.threatening === false ? 1 : -1) * NAVIGATION.destinationLeg) },
    navigation: null,
    status: 'underway', warnedAt: null, wreckedAt: null, reactAt: null,
    targetHeading: null, turnSign: 0, response: 'none',
    afterimage: 0, lastSeen: null, everSeen: false,
  };
}

export function createState(seed = 108) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new TypeError('Seed must be a uint32');
  }
  seed = Math.abs(seed); // Normalise -0 so equal seeds give identical (Object.is) states.
  const hazards = planHazards(seed);
  const approach = openingReservation(seed, hazards);
  const trawler = arrive(approach);
  const random = ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000;
  return {
    seed, time: 0, phase: 'night', beam: 285, speed: SPEED.default,
    fog: 0.08 + random * 0.04, horn: false, blasts: [], ignoredBlasts: [], hornIgnoredUntil: 0, trust: 1,
    nightParams: { night: 1, fogReach: fogReach(NIGHT_FOG_MAX), phase0: 285 },
    hazards,
    schedule: [approach, ...extraApproaches(seed, 1, approach, hazards)],
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

function blastHorn(state) {
  const reefs = reefsFor(state.hazards);
  const inIgnoreWindow = state.time < state.hornIgnoredUntil;
  const spam = state.blasts.length >= 3;
  const ignored = inIgnoreWindow || spam;
  if (spam && !inIgnoreWindow) state.hornIgnoredUntil = state.time + 30;
  state.blasts.push(state.time);
  if (ignored) {
    state.ignoredBlasts.push(state.time);
    state.trust = Math.max(0, state.trust - 0.25);
    return;
  }
  const ships = fleet(state).filter((ship) => ship.status === 'underway' || ship.status === 'safe');
  const responses = broadcastHorn(ships.map(physical), {
    origin: { x: 0, y: 0 }, fogDensity: state.fog, time: state.time,
    seed: (state.seed + state.blasts.length) >>> 0, trust: state.trust, rocks: reefs,
  });
  // Only false alarms erode trust. A real warning to any endangered listener
  // is useful even when another captain is already on a safe track (#109).
  if (!ships.some((ship, index) => responses[index].heard && threatensReef(physical(ship), reefs, THREAT_HORIZON_SECONDS))) {
    state.trust = Math.max(0, state.trust - 0.25);
  }
  for (let index = 0; index < ships.length; index++) {
    const ship = ships[index], response = responses[index];
    ship.lastHorn = response;
    if (ship.warnedAt !== null || !['turn-away', 'veer'].includes(response.response)) continue;
    ship.warnedAt = state.time;
    ship.reactAt = response.reactAt;
    ship.response = response.response;
    if (response.response === 'veer') {
      // Dark launches keep their separate seeded flight response.
      ship.targetHeading = wrapBearing(bearingTo(ship) + 30);
      ship.turnSign = Math.sign(headingError(ship.targetHeading, ship.heading));
    }
  }
}

const headingError = (target, heading) => ((target - heading + 540) % 360) - 180;
const destinationHeading = (ship) => bearingTo({ x: ship.destination.x - ship.x, y: ship.destination.y - ship.y });

// Use one rudder sign per leg. Unwinding to zero lets Nomoto yaw decay without
// steering back and forth. Reserve the integral of yaw plus rudder slew before
// adding more helm, so the bow settles smoothly near the commanded bearing.
function navigationHelm(vessel, target, sign) {
  const spec = HULLS[vessel.type];
  const coast = vessel.yawRate * sign * spec.T
    + spec.K * Math.max(0, vessel.rudder * sign) ** 2 / (2 * spec.rudderRateDegPerS);
  const error = headingError(target, vessel.heading) * sign;
  return sign * Math.max(0, Math.min(spec.maxRudderDeg, (error - coast) * NAVIGATION.helmGain));
}
function updateNavigation(ship, navigation, hazards) {
  if (navigation.phase !== 'out') return;
  const east = Math.sin(navigation.course * RAD), south = -Math.cos(navigation.course * RAD);
  const astern = navigation.obstacles.every((index) => {
    const rock = hazards[index];
    return (rock.x - ship.x) * east + (rock.y - ship.y) * south + rock.radius + SHIP_RADIUS + CLEAR_MARGIN < 0;
  });
  if (astern && !threatensReef({ ...physical(ship), heading: destinationHeading(ship) },
    reefsFor(hazards, CLEAR_MARGIN), Number.MAX_VALUE)) navigation.phase = 'resume';
}
function chooseAvoidance(ship, hazards) {
  const reefs = reefsFor(hazards).map((rock) => ({ ...rock, radius: rock.radius + CLEAR_MARGIN }));
  const start = createVessel(ship.type, { x: ship.x, y: -ship.y, heading: ship.heading, speed: ship.speed });
  start.rudder = ship.rudder; start.yawRate = ship.yawRate;
  const obstacles = reefs.flatMap((rock, index) => threatensReef(start, [rock], Number.MAX_VALUE) ? [index] : []);
  // Search equal offsets on both sides before increasing the angle. Every
  // candidate uses the live controller, hull dynamics and all hazard discs.
  for (let offset = NAVIGATION.searchStep; offset <= NAVIGATION.maxOffset; offset += NAVIGATION.searchStep) {
    for (const sign of [-1, 1]) {
      const navigation = { phase: 'out', heading: wrapBearing(ship.heading + sign * offset),
        sign, course: ship.heading, obstacles };
      if (clearsManeuver(start, ship.destination, navigation, hazards, reefs)) return navigation;
    }
  }
  // No physically clear route: keep the original track, with no immunity or
  // synthetic safe status. The impending collision still runs normally.
  return { phase: 'blocked', heading: ship.heading, sign: 0, course: ship.heading, obstacles };
}
function clearsManeuver(start, destination, plan, hazards, reefs) {
  const navigation = { ...plan };
  let vessel = start;
  for (let elapsed = 0; elapsed < NAVIGATION.predictionSeconds; elapsed += TICK) {
    const chartShip = { ...vessel, y: -vessel.y, destination };
    updateNavigation(chartShip, navigation, hazards);
    const target = navigation.phase === 'resume' ? destinationHeading(chartShip) : navigation.heading;
    const command = navigationHelm(vessel, target, navigation.phase === 'resume' ? -navigation.sign : navigation.sign);
    vessel = stepVessel(vessel, { rudderCommand: command, throttle: 1 }, TICK);
    if (reefs.some((rock) => Math.hypot(vessel.x - rock.x, vessel.y - rock.y) <= rock.radius)) return false;
    const settled = Math.abs(headingError(target, vessel.heading)) < NAVIGATION.settleDegrees
      && Math.abs(vessel.yawRate) < NAVIGATION.settleYaw;
    if (settled) {
      // A settled leg's remaining straight track must clear every disc. The
      // return leg then has no remaining hazards and needs no repeated turns.
      if (threatensReef(vessel, reefs, Number.MAX_VALUE)) return false;
      if (navigation.phase === 'resume') return true;
      // Once settled, a non-forward leg cannot put a still-forward obstacle
      // astern. Reject it rather than waiting out the whole prediction window.
      if (Math.cos(headingError(vessel.heading, navigation.course) * RAD) <= 0) return false;
    }
  }
  return false;
}

function tick(state, input, dt) {
  const reefs = reefsFor(state.hazards);
  state.trust = Math.min(1, state.trust + 0.01 * dt);
  state.time = Math.min(NIGHT_SECONDS, state.time + dt);
  const steer = Number(input.fast === true) - Number(input.slow === true);
  state.speed = clampSpeed(state.speed + steer * 24 * dt);
  if (input.hold !== true) state.beam = wrapBearing(state.beam + state.speed * dt);
  state.fog = 0.08 + 0.08 * state.time / NIGHT_SECONDS;
  state.blasts = state.blasts.filter((time) => state.time - time < 20);
  state.ignoredBlasts = state.ignoredBlasts.filter((time) => state.time - time < 2);
  for (const approach of state.schedule) {
    if (approach.spawnTime > state.time - dt && approach.spawnTime <= state.time
      && !fleet(state).some((ship) => ship.id === approach.id)) state.ships.push(arrive(approach));
  }
  if (input.horn === true && !state.horn) blastHorn(state);
  state.horn = input.horn === true;
  for (const ship of fleet(state)) {
    if (ship.status === 'underway' || ship.status === 'safe') {
      let rudderCommand = 0;
      if (ship.reactAt !== null && state.time >= ship.reactAt) {
        if (ship.response === 'turn-away' && ship.navigation === null) {
          ship.navigation = chooseAvoidance(ship, state.hazards);
          ship.targetHeading = ship.navigation.heading;
          ship.turnSign = ship.navigation.sign;
        }
        if (ship.navigation) {
          updateNavigation(ship, ship.navigation, state.hazards);
          ship.targetHeading = ship.navigation.phase === 'resume' ? destinationHeading(ship) : ship.navigation.heading;
          rudderCommand = navigationHelm(physical(ship), ship.targetHeading,
            ship.navigation.phase === 'resume' ? -ship.navigation.sign : ship.navigation.sign);
        } else {
          rudderCommand = navigationHelm(physical(ship), ship.targetHeading, ship.turnSign);
        }
      }
      const shipDt = ship.spawnTime > state.time - dt ? state.time - ship.spawnTime : dt;
      const next = shipDt > 0 ? stepVessel(physical(ship), { rudderCommand, throttle: 1 }, shipDt) : physical(ship);
      Object.assign(ship, next, { y: -next.y });
      if (ship.status === 'underway' && reefs.some((rock) => Math.hypot(ship.x - rock.x, -ship.y - rock.y) <= rock.radius)) {
        ship.status = 'wrecked';
        ship.wreckedAt = state.time;
      } else if (Math.hypot(ship.x, ship.y) > NAVIGATION.exitRange
        && ship.x * Math.sin(ship.heading * RAD) - ship.y * Math.cos(ship.heading * RAD) > 0) {
        ship.status = 'safe';
      }
    }
    if (isLit(state, ship) || perception(state, ship).runningLights) ship.everSeen = true;
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
    if (Object.hasOwn(input, key) && typeof input[key] !== 'boolean') throw new TypeError(`Invalid ${key}`);
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

// Ring history uses blast timestamps; ignored status is fixed at emission time.
export function hornRings(state) {
  return state.blasts.flatMap((time) => {
    const age = state.time - time;
    return age >= 0 && age < 2 ? [{
      radius: hornRange(state.fog) * age / 2,
      alpha: 1 - age / 2,
      ignored: state.ignoredBlasts.includes(time),
    }] : [];
  });
}

export function summary(state) {
  return { safe: fleet(state).filter((ship) => ship.everSeen && ship.status === 'safe').length,
    wrecked: fleet(state).filter((ship) => ship.everSeen && ship.status === 'wrecked').length,
    unseen: fleet(state).filter((ship) => !ship.everSeen).length };
}
