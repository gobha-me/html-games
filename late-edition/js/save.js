// Version 1 is an edition-boundary snapshot, not an arbitrary object graph.
// Decode through allowlists before constructing a sim; never assign parsed keys
// to a live instance. Limits also bound work on hostile local storage content.
import { DISTRICTS, FILE_DRAWER, LEAD_LIFETIME_SEC, OPERATIVE_ROSTER, WORLD_W, WORLD_H } from './config.js';

export const SAVE_FORMAT = 'late-edition-save';
export const SAVE_VERSION = 1;
export const MAX_SAVE_LENGTH = 2_000_000;
const invalid = () => { throw new Error('Invalid save state'); };
const number = (min = 0, max = Number.MAX_SAFE_INTEGER, integer = false) => (v) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isSafeInteger(v))) invalid();
  return v;
};
const count = number(0, Number.MAX_SAFE_INTEGER, true);
const text = (v) => {
  if (typeof v !== 'string' || v.length > 4096) invalid();
  return v;
};
const choice = (...values) => (v) => values.includes(v) ? v : invalid();
const boolean = choice(true, false);
const optional = (decode) => (v) => v === undefined ? undefined : decode(v);
const nullable = (decode) => (v) => v === null ? null : decode(v);
const object = (schema) => (v) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) invalid();
  return Object.fromEntries(Object.entries(schema).flatMap(([key, decode]) => {
    const value = decode(Object.hasOwn(v, key) ? v[key] : undefined);
    return value === undefined ? [] : [[key, value]];
  }));
};
const array = (decode, max, min = 0) => (v) => {
  if (!Array.isArray(v) || v.length > max || v.length < min) invalid();
  return v.map(decode);
};
const dictionary = (decode) => (v) => {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).length > 10000) invalid();
  const result = Object.create(null);
  for (const [key, value] of Object.entries(v)) {
    // Discard these at every depth, including subject dictionaries.
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    result[text(key)] = decode(value);
  }
  return result;
};
const districtId = choice(...DISTRICTS.map((district) => district.id));
const arcId = nullable(choice('red_hook', 'transit_graft', 'tenement_torch'));
const arcPart = number(0, 3, true);
const dossierSchema = {
  freshness: number(0, FILE_DRAWER.freshness, true), exposure: number(0, 4, true),
  weight: number(1, FILE_DRAWER.maxWeight, true), baseValue: number(),
  arcProgress: arcPart, subjectProgress: count,
};
const storySchema = {
  uid: text, subject: text, subjectStatus: optional(choice('dead')),
  tags: array(text, 32), beat: text, color: text, headline: text, subdeck: text,
  baseValue: number(), credibility: number(-100, 100), heat: number(-100, 100),
  districtId: optional(districtId), photoVerified: boolean, scoopedByRival: boolean,
  arcId, arcPart, arcCode: nullable(text), arcTitle: nullable(text), seriesBadge: nullable(text),
  dossier: optional(object(dossierSchema)),
};
const story = object(storySchema);
const x = number(-WORLD_W, WORLD_W * 2);
const y = number(-WORLD_H, WORLD_H * 2);
const lead = object({ ...storySchema, districtId, districtName: text,
  x, y, progress: number(0, 100), rivalProgress: number(0, 100),
  timeLeft: number(0, LEAD_LIFETIME_SEC), killedForRival: optional(boolean),
});
const file = object({ ...dossierSchema, freshness: number(1, FILE_DRAWER.freshness, true), uid: text, subject: text, tags: array(text, 32),
  districtId, arcId, story,
});
const operative = (v, index) => {
  const roster = OPERATIVE_ROSTER[index];
  return object({
    ...Object.fromEntries(Object.entries(roster).map(([key, value]) => [key, choice(value)])),
    x, y, targetX: x, targetY: y, angle: number(-Math.PI, Math.PI), state: text,
    targetLeadId: nullable(text), targetRivalId: nullable(text),
    flashCooldown: number(0, 7), stepPhase: number(),
  })(v);
};
const page = object(Object.fromEntries(['banner', 'above_fold', 'photo_expose', 'editorial']
  .map((slot) => [slot, nullable(story)])));
const schema = {
  phase: choice('desk'), awaitingFirstDispatch: choice(false), deskTooSmall: boolean,
  time: number(), edition: number(2, Number.MAX_SAFE_INTEGER, true), maxEditions: choice(5),
  clockSec: choice(0), speed: choice(1, 2), paused: boolean,
  gameOver: choice(false), victory: choice(false), gameOverReason: choice(''),
  editionSummary: choice(null), activeDilemma: choice(null),
  cash: number(), circulation: number(2000), credibility: number(Number.MIN_VALUE, 100),
  syndicateHeat: number(0, 100), pressHp: number(Number.MIN_VALUE, 100),
  editionsPrinted: number(1, Number.MAX_SAFE_INTEGER, true), lastPublishedTime: number(),
  scoopsTotal: count, peakCirculation: number(2000), lastPrintedFrontPage: nullable(page),
  selectedOpId: choice(...OPERATIVE_ROSTER.map((op) => op.id)), selectedLeadId: nullable(text),
  nextLeadUid: number(1, Number.MAX_SAFE_INTEGER, true), nextRivalUid: number(1, Number.MAX_SAFE_INTEGER, true),
  catalogIdx: count, arcProgress: object({ red_hook: arcPart, transit_graft: arcPart, tenement_torch: arcPart }),
  arcRotation: count, dilemmaIdx: count, dilemmaTriggeredThisEdition: choice(false),
  rivalSpawnTimer: number(0, 60), randomDraws: count, raidBlocked: boolean,
  editionLayout: object({ assisted: choice(false) }),
  subjectStates: dictionary(choice('dead', 'exposed')), subjectProgress: dictionary(count),
  pendingBurns: array(object({ uid: text, subject: text, dueEdition: number(2, Number.MAX_SAFE_INTEGER, true) }), 10000),
  operatives: array(operative, OPERATIVE_ROSTER.length, OPERATIVE_ROSTER.length),
  leads: array(lead, 4), scoopedStories: array(story, 10000), insideStories: array(story, 0),
  spikedStories: array(file, FILE_DRAWER.capacity), frontPage: page,
  rivals: array(object({ id: text, type: choice('goon', 'herald'), label: text, x, y,
    angle: number(-Math.PI, Math.PI), speed: choice(78, 90), hp: choice(80, 100),
    stunTimer: number(-0.05, 4.5), targetLeadId: nullable(text),
  }), 1000),
  rivalStandings: array(object({ id: choice('herald', 'observer', 'gazette'), name: text,
    circulation: number(8000), color: text,
  }), 3, 3),
};

export const SAVE_FIELDS = Object.keys(schema);

export function decodeSaveState(value) {
  const state = object(schema)(value);
  if (state.edition !== state.editionsPrinted + 1 || state.lastPublishedTime > state.time ||
    state.peakCirculation < state.circulation || Object.values(state.frontPage).some(Boolean)) invalid();
  // Each live story has one owner. Nested source snapshots and printed history
  // intentionally repeat their owner's UID and are not independent inventory.
  const inventory = [...state.leads, ...state.scoopedStories, ...state.spikedStories];
  const ids = inventory.map((entry) => entry.uid);
  if (new Set(ids).size !== ids.length || new Set(state.rivals.map((rival) => rival.id)).size !== state.rivals.length ||
    new Set(state.rivalStandings.map((rival) => rival.id)).size !== 3) invalid();
  for (const entry of inventory) {
    const match = /^lead_([1-9]\d*)$/.exec(entry.uid);
    if (!match || Number(match[1]) >= state.nextLeadUid) invalid();
    if (entry.story && entry.story.uid !== entry.uid) invalid();
  }
  for (const rival of state.rivals) {
    const match = /^rv_([1-9]\d*)$/.exec(rival.id);
    if (!match || Number(match[1]) >= state.nextRivalUid) invalid();
  }
  return state;
}
