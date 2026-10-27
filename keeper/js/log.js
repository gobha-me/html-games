import { NIGHT_SECONDS } from './sim.js';

// Kept separately from the morning record; replaying a watch never erases it.
export const LOG_KEY = 'keeper.log.v1';
export const LOG_VERSION = 1;
export const LOG_NOTES = Object.freeze(['', 'running dark', 'signalled SOS', 'no name visible', 'same boat as before']);
export const LOG_TYPES = Object.freeze({ trawler: 'Trawler', coaster: 'Coaster', speedboat: 'Launch', lifeboat: 'Lifeboat' });

const validId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 80;
const validType = (type) => typeof type === 'string' && Object.hasOwn(LOG_TYPES, type);

// Only current-watch observation flags admit choices. Never consult the schedule,
// old log entries, live positions, callsigns or hidden encounter flags.
export function revealedThings(state) {
  const ships = state?.ships ?? (state?.trawler ? [state.trawler] : []);
  if (!Array.isArray(ships)) return [];
  return ships.filter((ship) => ship?.everSeen === true && validId(ship.id) && validType(ship.type))
    .map(({ id, type }) => ({ id, type }));
}

function copyEntry(entry) {
  if (!Number.isSafeInteger(entry?.seed) || entry.seed < 0 || entry.seed > 0xffffffff
    || !Number.isSafeInteger(entry.night) || entry.night < 1 || entry.night > 5
    || !Number.isFinite(entry.time) || entry.time < 0 || entry.time > NIGHT_SECONDS
    || !Number.isFinite(entry.bearing) || entry.bearing < 0 || entry.bearing >= 360
    || !validId(entry.what?.id) || !validType(entry.what?.type) || !LOG_NOTES.includes(entry.note)) return null;
  return { seed: entry.seed, night: entry.night, time: entry.time, bearing: entry.bearing,
    what: { id: entry.what.id, type: entry.what.type }, note: entry.note };
}

// Recheck the sighting at submission, even if a caller forges a select value.
// Metadata always comes from the simulation, never from editable form fields.
export function assembleEntry(state, whatId, note = '') {
  const what = revealedThings(state).find(({ id }) => id === whatId);
  if (!what) return null;
  return copyEntry({ seed: state.seed, night: state.nightParams?.night,
    time: state.time, bearing: state.beam, what, note });
}

// Reject the entire corrupt/unsupported document rather than trusting partial
// history. Return fresh objects and discard unrecognised properties.
export function parseLog(raw) {
  try {
    const value = JSON.parse(raw);
    if (value?.version !== LOG_VERSION || !Array.isArray(value.entries)) return null;
    const entries = value.entries.map(copyEntry);
    return entries.every(Boolean) ? { version: LOG_VERSION, entries } : null;
  } catch {
    return null;
  }
}
