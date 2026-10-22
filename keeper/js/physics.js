// Metres, seconds, and bearings clockwise from north; y points north.
// This module has no clock, browser state, or unseeded randomness.
export const PHYSICS_DT = 1 / 60;
const RAD = Math.PI / 180;
const hull = (length, cruiseSpeed, maxRudderDeg, rudderRateDegPerS, K, T, reactionSeconds) =>
  Object.freeze({ length, cruiseSpeed, maxRudderDeg, rudderRateDegPerS, K, T,
    reactionSeconds: Object.freeze(reactionSeconds) });
export const HULLS = Object.freeze({
  trawler: hull(12, 1.1, 35, 7.5, 0.08, 4.5, [1.8, 2.5]),
  coaster: hull(30, 3, 35, 5, 0.05, 8, [2, 2.5]),
  speedboat: hull(6, 6, 35, 90, 1.2, 0.35, [1, 1.4]),
  lifeboat: hull(8, 3, 35, 55, 0.45, 0.7, [1.1, 1.7]),
});
const normalise = (heading) => ((heading % 360) + 360) % 360;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function finite(...values) {
  if (!values.every(Number.isFinite)) throw new RangeError('Expected finite numbers');
}
function parameters(type) {
  if (typeof type !== 'string' || !Object.hasOwn(HULLS, type)) throw new RangeError('Unknown hull type');
  return HULLS[type];
}
function checkVessel(vessel) {
  const spec = parameters(vessel?.type);
  finite(vessel.x, vessel.y, vessel.heading, vessel.yawRate, vessel.rudder, vessel.speed);
  if (vessel.speed < 0 || Math.abs(vessel.rudder) > spec.maxRudderDeg) throw new RangeError('Invalid vessel state');
  return spec;
}
function checkRocks(rocks) {
  if (!Array.isArray(rocks)) throw new RangeError('Expected rocks array');
  for (const rock of rocks) {
    finite(rock?.x, rock?.y, rock?.radius);
    if (rock.radius < 0) throw new RangeError('Negative rock radius');
  }
}
export function createVessel(type, { x = 0, y = 0, heading = 0, speed = parameters(type).cruiseSpeed,
  id = type, smuggler = false } = {}) {
  parameters(type);
  finite(x, y, heading, speed);
  if (speed < 0 || (typeof id === 'number' && !Number.isFinite(id)) || typeof smuggler !== 'boolean') {
    throw new RangeError('Invalid vessel options');
  }
  return { id, type, smuggler, x, y, heading: normalise(heading), yawRate: 0, rudder: 0, speed };
}

function integrate(vessel, command, throttle, dt, spec) {
  const rudder = vessel.rudder + clamp(command - vessel.rudder, -spec.rudderRateDegPerS * dt, spec.rudderRateDegPerS * dt);
  // Linear thrust and drag, with extra drag at large rudder angles. Cruise is
  // the full-throttle straight-line equilibrium; turning loses up to 20% speed.
  const drag = 1 + 0.25 * (rudder / spec.maxRudderDeg) ** 2;
  const equilibrium = spec.cruiseSpeed * throttle / drag;
  const speed = equilibrium + (vessel.speed - equilibrium) * Math.exp(-drag * dt / Math.max(1, spec.T));
  // First-order Nomoto: T*r' + r = K*delta, scaled by steerage speed.
  const targetYaw = spec.K * rudder * vessel.speed / spec.cruiseSpeed;
  const yawRate = vessel.speed === 0 ? 0
    : targetYaw + (vessel.yawRate - targetYaw) * Math.exp(-dt / spec.T);
  const change = (vessel.yawRate + yawRate) * dt / 2;
  const heading = normalise(vessel.heading + (vessel.speed === 0 ? 0 : change));
  const midHeading = (vessel.heading + (vessel.speed === 0 ? 0 : change / 2)) * RAD;
  const distance = (vessel.speed + speed) * dt / 2;
  return { ...vessel, rudder, speed, yawRate, heading,
    x: vessel.x + Math.sin(midHeading) * distance,
    y: vessel.y + Math.cos(midHeading) * distance };
}
export function stepVessel(vessel, { rudderCommand = 0, throttle = 1 } = {}, dt) {
  const spec = checkVessel(vessel);
  finite(rudderCommand, throttle, dt);
  if (dt <= 0 || throttle < 0 || throttle > 1) throw new RangeError('Invalid timestep or throttle');
  const command = clamp(rudderCommand, -spec.maxRudderDeg, spec.maxRudderDeg);
  // Integer steps avoid a different final substep after a frame hitch.
  const steps = Math.floor(dt / PHYSICS_DT + 1e-12);
  let next = { ...vessel };
  for (let index = 0; index < steps; index++) next = integrate(next, command, throttle, PHYSICS_DT, spec);
  const remainder = dt - steps * PHYSICS_DT;
  if (remainder > 1e-12) next = integrate(next, command, throttle, remainder, spec);
  finite(next.x, next.y, next.heading, next.yawRate, next.rudder, next.speed);
  return next;
}

export function measureTacticalDiameter(type) {
  const spec = parameters(type);
  let vessel = createVessel(type);
  let angle = 0;
  while (angle < 180) {
    const previous = vessel;
    vessel = stepVessel(vessel, { rudderCommand: spec.maxRudderDeg, throttle: 1 }, PHYSICS_DT);
    const change = normalise(vessel.heading - previous.heading);
    if (angle + change >= 180) return Math.abs(previous.x + (vessel.x - previous.x) * (180 - angle) / change);
    angle += change;
  }
}
export function hornRange(fogDensity) {
  finite(fogDensity);
  if (fogDensity < 0 || fogDensity > 1) throw new RangeError('Fog density must be in [0,1]');
  return 700 - 350 * fogDensity;
}

// First straight-track entry into any reef disc; a tangent counts as a threat.
function impactDistance(vessel, rocks) {
  const east = Math.sin(vessel.heading * RAD), north = Math.cos(vessel.heading * RAD);
  let entry = Infinity;
  for (const rock of rocks) {
    const dx = rock.x - vessel.x, dy = rock.y - vessel.y;
    const along = dx * east + dy * north, across = dx * north - dy * east;
    if (Math.hypot(dx, dy) <= rock.radius) return 0;
    if (Math.abs(across) > rock.radius) continue;
    const halfChord = Math.sqrt(Math.max(0, rock.radius ** 2 - across ** 2));
    if (along + halfChord >= 0) entry = Math.min(entry, Math.max(0, along - halfChord));
  }
  return entry;
}
export function threatensReef(vessel, rocks, horizonSeconds) {
  checkVessel(vessel); checkRocks(rocks); finite(horizonSeconds);
  if (horizonSeconds < 0) throw new RangeError('Negative horizon');
  const entry = impactDistance(vessel, rocks);
  return entry === 0 || (vessel.speed > 0 && Number.isFinite(entry) && entry / vessel.speed <= horizonSeconds);
}

// Each ship gets a stable independent stream (no dependence on fleet order).
function draw(seed, id, salt) {
  let bits = (seed ^ salt) >>> 0;
  for (const char of String(id)) bits = Math.imul(bits ^ char.charCodeAt(0), 16777619) >>> 0;
  bits = (Math.imul(bits, 1664525) + 1013904223) >>> 0;
  return bits / 0x100000000;
}
export function broadcastHorn(ships, { origin, fogDensity, time, seed, trust = 1, rocks }) {
  if (!Array.isArray(ships)) throw new RangeError('Expected ships array');
  finite(origin?.x, origin?.y, time, seed, trust);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || trust < 0 || trust > 1) throw new RangeError('Invalid seed or trust');
  checkRocks(rocks);
  const range = hornRange(fogDensity);
  return ships.map((vessel) => {
    const spec = checkVessel(vessel);
    const heard = Math.hypot(vessel.x - origin.x, vessel.y - origin.y) <= range;
    if (!heard) return { id: vessel.id, heard: false, response: 'none', reactAt: null };
    const [min, max] = spec.reactionSeconds;
    const delay = min + (max - min) * (1 - trust * (1 - draw(seed, vessel.id, 17)));
    const endangered = threatensReef(vessel, rocks, Number.MAX_VALUE);
    const response = vessel.smuggler ? (draw(seed, vessel.id, 71) < 0.5 ? 'ignore' : 'veer')
      : !endangered ? 'hold' : draw(seed, vessel.id, 37) >= trust ? 'ignore' : 'turn-away';
    return { id: vessel.id, heard: true, response, reactAt: time + delay };
  });
}

export function pointOfNoReturn(vessel, rocks) {
  const spec = checkVessel(vessel); checkRocks(rocks);
  const impact = impactDistance(vessel, rocks);
  if (vessel.speed === 0 || !Number.isFinite(impact)) return 0;
  const east = Math.sin(vessel.heading * RAD), north = Math.cos(vessel.heading * RAD);
  // A conservative separating plane in front of EVERY forward rock, including
  // neighbours outside the original collision track. Clearing it avoids a turn
  // into a second reef. This deliberately gives more warning than a bare circle.
  let plane = impact;
  for (const rock of rocks) {
    const along = (rock.x - vessel.x) * east + (rock.y - vessel.y) * north;
    if (along + rock.radius >= 0) plane = Math.min(plane, along - rock.radius);
  }
  let excursion = 0;
  for (const sign of [-1, 1]) {
    let turning = { ...vessel, x: 0, y: 0 };
    // Include the worst crew delay, continuing under the current helm.
    turning = stepVessel(turning, { rudderCommand: vessel.rudder, throttle: 1 }, spec.reactionSeconds[1]);
    let angle = 0;
    let elapsed = 0;
    while (angle < 180 && elapsed < 1200) {
      excursion = Math.max(excursion, turning.x * east + turning.y * north);
      const next = stepVessel(turning, { rudderCommand: sign * spec.maxRudderDeg, throttle: 1 }, PHYSICS_DT);
      angle += ((next.heading - turning.heading + 540) % 360 - 180) * sign;
      turning = next;
      elapsed += PHYSICS_DT;
    }
  }
  // Two ticks reserve reaction scheduling/integration error at the boundary.
  return Math.max(0, (impact - plane + excursion) / vessel.speed + 2 * PHYSICS_DT);
}
