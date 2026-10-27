import { NIGHT_SECONDS, encounterRecord } from './sim.js';
import { MYSTERY, resolveEnding } from './mystery.js';

// Stable storage key; the document version evolves independently.
export const LOG_KEY = 'keeper.log.v1';
export const LOG_VERSION = 2;
export const LOG_NOTES = Object.freeze(['', 'running dark', 'signalled SOS', 'no name visible', 'same boat as before']);
export const LOG_TYPES = Object.freeze({ trawler: 'Trawler', coaster: 'Coaster', speedboat: 'Launch', lifeboat: 'Lifeboat', crate: 'Crate · Board’s mark' });
const validId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 80;
const validType = (type) => typeof type === 'string' && Object.hasOwn(LOG_TYPES, type);

// Never consult future schedule entries, positions or unobserved story flags.
export function revealedThings(state) {
  const ships = state?.ships ?? (state?.trawler ? [state.trawler] : []);
  if (!Array.isArray(ships)) return [];
  const things = ships.filter((ship) => ship?.everSeen === true && validId(ship.id) && validType(ship.type))
    .map(({ id, type }) => ({ id, type }));
  if (state.story?.crateSeen === true) things.push({ id: MYSTERY.crate, type: 'crate' });
  return things;
}
function copyEntry(entry, legacy = false) {
  if (!Number.isSafeInteger(entry?.seed) || entry.seed < 0 || entry.seed > 0xffffffff
    || !Number.isSafeInteger(entry.night) || entry.night < 1 || entry.night > 5
    || !Number.isFinite(entry.time) || entry.time < 0 || entry.time > NIGHT_SECONDS
    || !Number.isFinite(entry.bearing) || entry.bearing < 0 || entry.bearing >= 360
    || !validId(entry.what?.id) || !validType(entry.what?.type) || !LOG_NOTES.includes(entry.note)
    || (legacy && entry.what.type === 'crate')
    || (!legacy && (!(entry.runId === null || validId(entry.runId))
      || !Number.isSafeInteger(entry.attempt) || entry.attempt < 0))) return null;
  return { seed: entry.seed, night: entry.night, time: entry.time, bearing: entry.bearing,
    what: { id: entry.what.id, type: entry.what.type }, note: entry.note,
    runId: legacy ? null : entry.runId, attempt: legacy ? 0 : entry.attempt };
}
function timelyEvidence(entry) {
  const { id, type } = entry.what;
  if (id === MYSTERY.launch) return type === 'speedboat' && entry.time >= (entry.night === 5 ? MYSTERY.finalHour : MYSTERY.hour);
  if (id === MYSTERY.distress) return type === 'lifeboat' && entry.night === 3 && entry.time >= MYSTERY.hour;
  if (id === MYSTERY.crate) return type === 'crate' && entry.night === 4 && entry.time >= 180;
  return true;
}
function currentEntries(state, entries) {
  if (!Array.isArray(entries)) return [];
  const watches = [...(state.run?.encounters ?? []), encounterRecord(state)];
  return entries.map((entry) => copyEntry(entry)).filter((entry) => entry
    && timelyEvidence(entry) && entry.runId !== null && entry.runId === state.run.id && entry.seed === state.seed
    && watches.some((watch) => watch.night === entry.night && watch.attempt === entry.attempt)
    && (entry.night !== state.nightParams.night || entry.time <= state.time));
}

// Notes are re-derived for each selected, observed thing, including on submit.
// Recognition is specific to the recurring launch, never an arbitrary hull type.
export function notesFor(state, whatId, entries = []) {
  const thing = revealedThings(state).find(({ id }) => id === whatId);
  if (!thing) return [];
  const notes = ['', 'no name visible'];
  if (thing.type === 'speedboat') notes.push('running dark');
  if (state.ships.some((ship) => ship.id === thing.id && ship.distress === true)) notes.push('signalled SOS');
  if (thing.id === MYSTERY.launch && currentEntries(state, entries).some((entry) =>
    entry.night < state.nightParams.night && entry.what.id === MYSTERY.launch && entry.what.type === 'speedboat'
    && state.run.encounters.some((watch) => watch.night === entry.night && watch.launchSeen))) notes.push('same boat as before');
  return notes;
}
export function assembleEntry(state, whatId, note = '', entries = []) {
  const what = revealedThings(state).find(({ id }) => id === whatId);
  if (!what || !notesFor(state, whatId, entries).includes(note)) return null;
  return copyEntry({ seed: state.seed, night: state.nightParams.night,
    time: state.time, bearing: state.beam, what, note, runId: state.run.id, attempt: state.run.attempt });
}

// Only evidence from completed, retained attempts and this actual attempt counts.
// Notes are assertions; a claimed SOS or recognition never substitutes for rescue.
export function endingFor(state, entries = []) {
  if (state.nightParams.night !== 5 || state.phase !== 'dawn') return null;
  const watches = [...state.run.encounters, encounterRecord(state)];
  const valid = currentEntries(state, entries);
  const has = (watch, id, type) => valid.some((entry) => entry.night === watch.night
    && entry.attempt === watch.attempt && entry.what.id === id && entry.what.type === type);
  const distress = watches.find((watch) => watch.night === 3);
  const crate = watches.find((watch) => watch.night === 4);
  return resolveEnding({ launchWrecked: encounterRecord(state).launchWrecked,
    launchNights: watches.filter((watch) => watch.launchSeen && has(watch, MYSTERY.launch, 'speedboat')).map((watch) => watch.night),
    distressAnswered: distress?.distressAnswered === true,
    distressLogged: distress?.distressSeen === true && has(distress, MYSTERY.distress, 'lifeboat'),
    crateLogged: crate?.crateSeen === true && has(crate, MYSTERY.crate, 'crate') });
}

// Version-one history stays readable, but lacks run/attempt provenance and can
// neither unlock recognition nor count toward a current run's Report.
export function parseLog(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 1_000_000) return null;
    const value = JSON.parse(raw);
    if (![1, LOG_VERSION].includes(value?.version) || !Array.isArray(value.entries) || value.entries.length > 10_000) return null;
    const entries = value.entries.map((entry) => copyEntry(entry, value.version === 1));
    return entries.every(Boolean) ? { version: LOG_VERSION, entries } : null;
  } catch {
    return null;
  }
}
