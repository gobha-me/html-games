// World units are chart metres; bearings increase clockwise from north.
// No wall clock, DOM, storage, or unseeded randomness belongs in this module.
export const NIGHT_SECONDS = 180;
export const AFTERIMAGE_SECONDS = 1.5;
export const CONE_DEGREES = 14;
export const SPEED = Object.freeze({ slow: 12, default: 30, fast: 60 });
export const ROCKS = Object.freeze([
  Object.freeze({ x: 210, y: -255, radius: 24 }),
  Object.freeze({ x: 244, y: -238, radius: 18 }),
  Object.freeze({ x: 274, y: -219, radius: 14 }),
  Object.freeze({ x: -125, y: -100, radius: 12 }),
]);
const TICK = 1 / 60;
const RAD = Math.PI / 180;

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
  return {
    seed, time: 0, phase: 'night', beam: 285, speed: SPEED.default,
    fog: 0.08 + random * 0.04, horn: false, blasts: [], ignoreUntil: 0,
    trawler: {
      x: -310, y: -255 + (random - 0.5) * 10, heading: 90,
      status: 'underway', warnedAt: null, wreckedAt: null,
      afterimage: 0, lastSeen: null,
    },
  };
}

// Returns only the pose the keeper has actually observed; no live off-beam hull.
export function perception(state) {
  const ship = state.trawler;
  const lit = isLit(state);
  return {
    lit,
    hull: lit ? { x: ship.x, y: ship.y, heading: ship.heading, status: ship.status }
      : ship.afterimage > 0 ? ship.lastSeen : null,
    opacity: lit ? 1 : 0.30 * ship.afterimage / AFTERIMAGE_SECONDS,
    runningLights: ship.status !== 'wrecked' && Math.hypot(ship.x, ship.y) <= fogReach(state.fog) / 2,
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
    if (state.blasts.length > 3) state.ignoreUntil = state.time + 20;
  }
  state.horn = input.horn === true;
  const ship = state.trawler;
  if (ship.status === 'underway') {
    const near = Math.hypot(ship.x, ship.y) < fogReach(state.fog) * 0.4;
    if (state.horn && state.time >= state.ignoreUntil && ship.warnedAt === null && (isLit(state) || near)) {
      ship.warnedAt = state.time;
    }
    // A real response delay and turning circle make a last-second horn too late.
    if (ship.warnedAt !== null && state.time - ship.warnedAt >= 2) {
      ship.heading = Math.max(0, ship.heading - 22 * dt);
    }
    ship.x += Math.sin(ship.heading * RAD) * 6.6 * dt;
    ship.y -= Math.cos(ship.heading * RAD) * 6.6 * dt;
    if (ROCKS.some((rock) => Math.hypot(ship.x - rock.x, ship.y - rock.y) <= rock.radius + 8)) {
      ship.status = 'wrecked';
      ship.wreckedAt = state.time;
    } else if (Math.hypot(ship.x, ship.y) > 590) {
      ship.status = 'safe';
    }
  }
  if (isLit(state)) {
    ship.afterimage = AFTERIMAGE_SECONDS;
    ship.lastSeen = { x: ship.x, y: ship.y, heading: ship.heading, status: ship.status };
  } else {
    ship.afterimage = Math.max(0, ship.afterimage - dt);
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
  return { safe: state.trawler.status === 'safe' ? 1 : 0, wrecked: state.trawler.status === 'wrecked' ? 1 : 0 };
}
