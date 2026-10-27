import { createState, fogAt, specialtyApproach, validateSchedule, NIGHT_SECONDS, SPEED } from './sim.js';
import { HULLS } from './physics.js';
import { decodeKeying } from './morse.js';

// Storage access belongs to main.js. This codec snapshots all simulation data,
// including unfinished keying, physical turns, observations and prior mornings.
export const SAVE_KEY = 'keeper.save.v1';
export const SAVE_VERSION = 2;
export const MAX_SAVE_BYTES = 1_000_000;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const between = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const count = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 100;
const text = (value) => typeof value === 'string' && value.length <= 10_000;
const nullable = (value, predicate) => value === null || predicate(value);

function same(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && same(a[key], b[key]));
}
function keysMatch(value, required, optional = []) {
  return object(value) && required.every((key) => Object.hasOwn(value, key))
    && Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
}
function finiteTree(value, depth = 0) {
  if (depth > 24) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  return typeof value === 'object' && Object.entries(value).every(([key, child]) =>
    !['__proto__', 'constructor', 'prototype'].includes(key) && finiteTree(child, depth + 1));
}
const point = (value) => object(value) && between(value.x, -1e6, 1e6) && between(value.y, -1e6, 1e6);
const bearing = (value) => between(value, 0, 360) && value < 360;

function validShip(ship, approach, state, template) {
  if (!keysMatch(ship, Object.keys({ ...template, ...approach }).filter((key) => key !== 'passes'), ['passes', 'lastHorn'])
    || !Object.hasOwn(HULLS, ship.type)) return false;
  const hull = HULLS[ship.type];
  if (!Object.keys(approach).every((key) => key === 'speed' || same(ship[key], approach[key]))
    || ship.smuggler !== (approach.smuggler ?? false) || !point(ship) || !point(ship.destination)
    || !bearing(ship.heading) || !between(ship.speed, 0, hull.cruiseSpeed)
    || !between(ship.rudder, -hull.maxRudderDeg, hull.maxRudderDeg)
    || !between(ship.yawRate, -360, 360) || !['underway', 'safe', 'wrecked', 'lost'].includes(ship.status)
    || typeof ship.everSeen !== 'boolean' || !between(ship.afterimage, 0, 1.5)
    || !text(ship.callsign) || !['none', 'turn-away', 'veer', 'flee'].includes(ship.response)
    || ![-1, 0, 1].includes(ship.turnSign) || !nullable(ship.targetHeading, bearing)) return false;
  if (!['litSeconds', 'unlitSeconds'].every((key) => between(ship[key], 0, NIGHT_SECONDS))
    || !['litSecondsError', 'unlitSecondsError'].every((key) => between(ship[key], -1e-6, 1e-6))
    || typeof ship.askedLight !== 'boolean'
    || (ship.status === 'lost' && ship.distress !== true)
    || (ship.response === 'flee' && !ship.smuggler)) return false;
  for (const key of ['warnedAt', 'wreckedAt', 'lostAt']) {
    if (!nullable(ship[key], (time) => between(time, 0, state.time))) return false;
  }
  if ((ship.status === 'wrecked') !== (ship.wreckedAt !== null)
    || (ship.status === 'lost') !== (ship.lostAt !== null)
    || !nullable(ship.reactAt, (time) => between(time, 0, NIGHT_SECONDS + 120))) return false;
  if (!nullable(ship.lastSeen, (pose) => point(pose) && bearing(pose.heading)
    && ['underway', 'safe', 'wrecked', 'lost'].includes(pose.status))) return false;
  if (!nullable(ship.reply, (reply) => object(reply) && between(reply.startedAt, 0, state.time)
    && Array.isArray(reply.flashes) && reply.flashes.length <= 1000
    && reply.flashes.every((flash, index, flashes) => object(flash) && between(flash.on, 0, 1e6)
      && between(flash.off, flash.on, 1e6) && flash.off > flash.on
      && (index === 0 || flash.on > flashes[index - 1].off))
    && (reply.repeatSeconds === undefined || (ship.distress === true
      && between(reply.repeatSeconds, Number.MIN_VALUE, 1e6)
      && reply.repeatSeconds * 1000 > (reply.flashes.at(-1)?.off ?? 0))))) return false;
  if (!nullable(ship.navigation, (nav) => object(nav) && ['out', 'resume', 'blocked'].includes(nav.phase)
    && bearing(nav.heading) && bearing(nav.course) && [-1, 0, 1].includes(nav.sign)
    && Array.isArray(nav.obstacles) && nav.obstacles.every((index) =>
      Number.isInteger(index) && index >= 0 && index < state.hazards.length))) return false;
  if (ship.lastHorn !== undefined && (!object(ship.lastHorn) || ship.lastHorn.id !== ship.id
    || typeof ship.lastHorn.heard !== 'boolean'
    || !['none', 'turn-away', 'veer', 'ignore', 'hold'].includes(ship.lastHorn.response)
    || !nullable(ship.lastHorn.reactAt, (time) => between(time, 0, NIGHT_SECONDS + 120)))) return false;
  return true;
}

function validHistory(mornings, night) {
  if (!Array.isArray(mornings) || mornings.length >= night) return false;
  let cumulative = 0;
  return mornings.every((morning, index) => {
    if (!object(morning) || morning.night !== night - mornings.length + index
      || !['safe', 'wrecked', 'unseen', 'logged'].every((key) => count(morning[key]))
      || (morning.lost !== undefined && !count(morning.lost))) return false;
    cumulative += morning.wrecked;
    return morning.cumulativeWrecks === cumulative && cumulative < 3 && morning.relieved === false;
  });
}

function validStory(state) {
  const story = state.story;
  if (story === null) return true; // Migrated #113 watch, without retroactive scripts.
  if (!keysMatch(story, ['version', 'choice', 'crateSeen', 'crateAfterimage', 'crateLastSeen'])
    || story.version !== 1 || ![null, 'launch', 'distress'].includes(story.choice)
    || (state.nightParams.night !== 3 && story.choice !== null)
    || typeof story.crateSeen !== 'boolean' || !between(story.crateAfterimage, 0, 1.5)
    || !nullable(story.crateLastSeen, point)
    || story.crateSeen !== (story.crateLastSeen !== null)
    || (!story.crateSeen && story.crateAfterimage !== 0)) return false;
  return !story.crateSeen || (state.nightParams.night === 4 && state.time >= 180);
}
function validEncounters(state) {
  const encounters = state.run.encounters;
  return Array.isArray(encounters) && encounters.length === state.run.mornings.length
    && encounters.every((entry, index) => keysMatch(entry, ['night', 'attempt', 'launchSeen', 'launchWrecked',
      'distressSeen', 'distressAnswered', 'crateSeen', 'choice'])
      && entry.night === state.run.mornings[index].night
      && Number.isSafeInteger(entry.attempt) && entry.attempt >= 0
      && ['launchSeen', 'launchWrecked', 'distressSeen', 'distressAnswered', 'crateSeen'].every((key) => typeof entry[key] === 'boolean')
      && entry.launchWrecked === false
      && [null, 'launch', 'distress'].includes(entry.choice)
      && (entry.night === 3 || (!entry.distressSeen && !entry.distressAnswered && entry.choice === null))
      && (!entry.distressAnswered || entry.distressSeen)
      && (entry.night === 4 || !entry.crateSeen));
}

function validState(state) {
  if (!object(state)) return false;
  const fresh = createState(state.seed, { night: state.nightParams?.night, mystery: state.story !== null, runId: state.run?.id });
  if (!keysMatch(state, Object.keys(fresh)) || !finiteTree(state)
    || !between(state.time, 0, NIGHT_SECONDS)
    || state.phase !== (state.time === NIGHT_SECONDS ? 'dawn' : 'night')
    || !bearing(state.beam) || !between(state.speed, SPEED.slow, SPEED.fast)
    || state.fog !== fogAt(state.nightParams.night, state.time)
    || typeof state.horn !== 'boolean' || typeof state.lamp !== 'boolean'
    || !between(state.trust, 0, 1) || !between(state.hornIgnoredUntil, 0, NIGHT_SECONDS + 30)
    || !same(state.hazards, fresh.hazards) || !validPlan(state.schedule, fresh.schedule)
    || !same(state.nightParams, fresh.nightParams) || !validateSchedule(state.schedule, state.nightParams).ok
    || !keysMatch(state.run, ['id', 'attempt', 'mornings', 'encounters'])
    || !text(state.run.id) || state.run.id.length < 1 || state.run.id.length > 80
    || !Number.isSafeInteger(state.run.attempt) || state.run.attempt < 0
    || !validHistory(state.run.mornings, state.nightParams.night)
    || !validEncounters(state) || !validStory(state)
    || !keysMatch(state.settings, ['incomingWpm']) || ![5, 8].includes(state.settings.incomingWpm)) return false;
  for (const key of ['blasts', 'ignoredBlasts']) {
    if (!Array.isArray(state[key]) || !state[key].every((time, index, times) =>
      between(time, 0, state.time) && (index === 0 || time >= times[index - 1]))) return false;
  }
  const keying = state.morse;
  if (!keysMatch(keying, Object.keys(fresh.morse)) || !text(keying.text) || !text(keying.symbols)
    || !between(keying.unit, Number.MIN_VALUE, NIGHT_SECONDS * 1000)
    || !between(keying.threshold, 150, 400)
    || !Array.isArray(keying.events) || keying.events.length > 10_000
    || !nullable(keying.down, (time) => between(time, 0, state.time * 1000))
    || (state.phase === 'night' && state.lamp !== (keying.down !== null))) return false;
  decodeKeying(keying.events); // Also rejects overlapping, unordered or malformed presses.
  if (keying.events.some((event) => event.up > state.time * 1000 + 1e-6)) return false;
  if (!nullable(keying.lastMessage, (message) => object(message) && text(message.text) && text(message.symbols)
    && between(message.time, 0, state.time)
    && (message.recipient === null || state.ships.some((ship) => ship.id === message.recipient)))) return false;
  const arrived = state.schedule.filter((approach) => approach.spawnTime <= state.time);
  return Array.isArray(state.ships) && state.ships.length === arrived.length
    && state.ships[0]?.id === fresh.trawler.id
    && new Set(state.ships.map((ship) => ship.id)).size === arrived.length
    && state.ships.every((ship) => {
      const approach = arrived.find(({ id }) => id === ship.id);
      return approach && validShip(ship, approach, state, fresh.trawler);
    });
}

// Preserve the generated traffic exactly. Opt-in #111 entries must match the
// public builder and pass the same schedule validation as a newly started watch.
function validPlan(schedule, generated) {
  return Array.isArray(schedule) && schedule.length <= 100
    && same(schedule.slice(0, generated.length), generated)
    && new Set(schedule.map((entry) => entry.id)).size === schedule.length
    && schedule.slice(generated.length).every((entry) => same(entry, specialtyApproach(entry)));
}

export function serializeSave(state) {
  // trawler aliases ships[0] in the live sim. Rebuild that alias on read instead
  // of allowing JSON to turn it into an independent, stale copy of the vessel.
  const snapshot = { ...state };
  delete snapshot.trawler;
  return JSON.stringify({ version: SAVE_VERSION, state: snapshot }, (_key, value) => {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('Non-finite save value');
    // JSON otherwise loses -0, violating strict deterministic round trips.
    return Object.is(value, -0) ? { $number: '-0' } : value;
  });
}

export function parseSave(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > MAX_SAVE_BYTES) return null;
    const value = JSON.parse(raw, (_key, item) =>
      object(item) && Object.keys(item).length === 1 && item.$number === '-0' ? -0 : item);
    if (!keysMatch(value, ['version', 'state']) || ![1, SAVE_VERSION].includes(value.version)
      || !object(value.state) || Object.hasOwn(value.state, 'trawler') || !Array.isArray(value.state.ships)) return null;
    if (value.version === 1) {
      // Keep the exact old fleet/timing. Upgrade bookkeeping only, never inject
      // missed story encounters into an in-progress watch or fabricate evidence.
      if (Object.hasOwn(value.state, 'story') || !keysMatch(value.state.run, ['mornings'])
        || !Array.isArray(value.state.run.mornings)) return null;
      value.state.story = null;
      Object.assign(value.state.run, { id: `legacy-${value.state.seed}`, attempt: 0,
        encounters: value.state.run.mornings.map(({ night }) => ({ night, attempt: 0,
          launchSeen: false, launchWrecked: false, distressSeen: false,
          distressAnswered: false, crateSeen: false, choice: null })) });
    }
    value.state.trawler = value.state.ships[0];
    return validState(value.state) ? value.state : null;
  } catch {
    return null;
  }
}
