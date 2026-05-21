/**
 * Oregon Trail — Event Runner
 * 
 * Pure-function event dispatcher: selects events by category, applies their
 * effects to game state, and updates the Trail Ledger reputation system.
 * 
 * No DOM, no side effects. Fully testable with mock state and seeded RNG.
 * 
 * @module event-runner
 */

import { WEATHER_EVENTS } from './events/weather.js';
import { ILLNESS_EVENTS } from './events/illness.js';
import { ENCOUNTER_EVENTS } from './events/encounter.js';
import { TERRAIN_EVENTS } from './events/terrain.js';
import { OPPORTUNITY_EVENTS } from './events/opportunity.js';
import MORAL_EVENTS from './events/moral.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** The four factions tracked by the Trail Ledger. */
const FACTIONS = Object.freeze([
  'nativeTribes',
  'fellowSettlers',
  'riverTraders',
  'outlaws'
]);

/** Human-readable faction labels. */
const FACTION_LABELS = Object.freeze({
  nativeTribes: 'Native Tribes',
  fellowSettlers: 'Fellow Settlers',
  riverTraders: 'River Traders',
  outlaws: 'Outlaws'
});

/** Reputation score thresholds → qualitative labels. */
const REPUTATION_LABELS = Object.freeze([
  { min: 75,  label: 'Revered' },
  { min: 50,  label: 'Trusted' },
  { min: 25,  label: 'Friendly' },
  { min: -24, label: 'Neutral' },
  { min: -49, label: 'Suspect' },
  { min: -74, label: 'Hostile' },
  { min: -100, label: 'Hated' }
]);

/** Valid event categories. */
const EVENT_CATEGORIES = Object.freeze([
  'weather',
  'illness',
  'encounter',
  'terrain',
  'opportunity',
  'moral'
]);

// ─── Event Corpora ───────────────────────────────────────────────────────────
// All six event corpora are imported from ./events/*.js:
//   weather (#227), illness (#228), encounter (#229), terrain (#230),
//   opportunity (#231), moral (#232).
//
// Each event follows the schema:
//   { id, title, description, effects: { resources?, reputation? }, choices? }

/** Map from category name to its corpus array. */
const EVENT_CORPORA = Object.freeze({
  weather: WEATHER_EVENTS,
  illness: ILLNESS_EVENTS,
  encounter: ENCOUNTER_EVENTS,
  terrain: TERRAIN_EVENTS,
  opportunity: OPPORTUNITY_EVENTS,
  moral: MORAL_EVENTS
});

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Clamp a value between min and max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Deep-clone a plain object (shallow enough for our state shape).
 * @param {object} obj
 * @returns {object}
 */
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ─── Trail Ledger ────────────────────────────────────────────────────────────

/**
 * Create a fresh Trail Ledger with zero reputation for all factions.
 * @param {object} [overrides] — Partial ledger to override defaults
 * @returns {object} Ledger state
 */
function createLedger(overrides = {}) {
  const ledger = {
    nativeTribes: 0,
    fellowSettlers: 0,
    riverTraders: 0,
    outlaws: 0
  };
  for (const faction of FACTIONS) {
    if (overrides[faction] !== undefined) {
      ledger[faction] = clamp(overrides[faction], -100, 100);
    }
  }
  return ledger;
}

/**
 * Map a numeric reputation score to a qualitative label.
 * @param {number} score — Reputation score [-100, 100]
 * @returns {string} Human-readable label
 */
function getReputationLabel(score) {
  for (const tier of REPUTATION_LABELS) {
    if (score >= tier.min) {
      return tier.label;
    }
  }
  return 'Hated'; // fallback for anything below -100
}

/**
 * Get a human-readable summary of the entire ledger.
 * @param {object} ledger
 * @returns {object} Summary with labels and scores per faction
 */
function getLedgerSummary(ledger) {
  const summary = {};
  for (const faction of FACTIONS) {
    const score = ledger[faction] ?? 0;
    summary[faction] = {
      label: FACTION_LABELS[faction],
      score,
      reputation: getReputationLabel(score)
    };
  }
  return summary;
}

/**
 * Apply reputation deltas to a ledger atomically.
 * Returns a new ledger (no mutation of input).
 * @param {object} ledger — Current ledger state
 * @param {object} deltas — { nativeTribes?: number, fellowSettlers?: number, ... }
 * @returns {object} New ledger with deltas applied
 */
function applyReputation(ledger, deltas) {
  const newLedger = clone(ledger);
  for (const faction of FACTIONS) {
    const delta = deltas[faction];
    if (delta !== undefined && delta !== 0) {
      newLedger[faction] = clamp(
        (newLedger[faction] ?? 0) + delta,
        -100,
        100
      );
    }
  }
  return newLedger;
}

/**
 * Serialize a ledger for save/load (plain object, already serializable).
 * @param {object} ledger
 * @returns {object} Serializable copy
 */
function serializeLedger(ledger) {
  return clone(ledger);
}

/**
 * Deserialize a ledger from saved data.
 * @param {object} data — Saved ledger data
 * @returns {object} Restored ledger
 */
function deserializeLedger(data) {
  return createLedger(data);
}

// ─── Effect Application ──────────────────────────────────────────────────────

/**
 * Apply resource deltas to a game state's resources.
 * Handles: food, money, ammo, morale, wagonCondition, and per-member HP.
 * All values are clamped to valid ranges.
 * 
 * @param {object} state — Current game state (must have .resources and .party)
 * @param {object} resourceDeltas — { food?, money?, ammo?, morale?, wagonCondition?, health? }
 * @returns {object} New state with resources updated (no mutation)
 */
function applyResourceEffects(state, resourceDeltas) {
  const newState = clone(state);
  const res = newState.resources;

  // Simple scalar resources
  const scalarResources = ['food', 'money', 'ammo', 'morale', 'wagonCondition'];
  for (const key of scalarResources) {
    if (resourceDeltas[key] !== undefined) {
      res[key] = clamp((res[key] ?? 0) + resourceDeltas[key], 0, key === 'morale' || key === 'wagonCondition' ? 100 : Infinity);
    }
  }

  // Health is an array — one entry per party member
  if (resourceDeltas.health !== undefined && Array.isArray(resourceDeltas.health)) {
    const healthDeltas = resourceDeltas.health;
    for (let i = 0; i < healthDeltas.length; i++) {
      if (newState.party.members[i] !== undefined) {
        newState.party.members[i].hp = clamp(
          (newState.party.members[i].hp ?? 0) + healthDeltas[i],
          0,
          100
        );
      }
    }
  }

  return newState;
}

/**
 * Apply all effects from an event (resources + reputation) to game state.
 * Returns { state, ledger } — both are new objects (no mutation).
 * 
 * @param {object} state — Current game state
 * @param {object} ledger — Current Trail Ledger
 * @param {object} effects — Event effects: { resources?, reputation? }
 * @returns {{ state: object, ledger: object }} Updated state and ledger
 */
function applyEffects(state, ledger, effects) {
  let newState = state;
  let newLedger = ledger;

  if (effects.resources) {
    newState = applyResourceEffects(state, effects.resources);
  }

  if (effects.reputation) {
    newLedger = applyReputation(ledger, effects.reputation);
  }

  return { state: newState, ledger: newLedger };
}

// ─── Event Selection ─────────────────────────────────────────────────────────

/**
 * Get a fallback "no event" event when a corpus is empty.
 * @param {string} category
 * @returns {object} Stub event
 */
function createFallbackEvent(category) {
  return {
    id: `fallback_${category}`,
    title: 'Quiet Day on the Trail',
    description: `Nothing notable happens today. The ${category} conditions are calm.`,
    effects: {},
    choices: []
  };
}

/**
 * Select a random event from the given category's corpus.
 * Uses the provided seeded RNG for deterministic testing.
 * Falls back to a stub event if the corpus is empty.
 * 
 * @param {string} category — One of EVENT_CATEGORIES
 * @param {object} [ledger] — Current ledger (for future reputation-weighted selection)
 * @param {function} [rng] — Seeded RNG function returning [0, 1)
 * @returns {object} Selected event
 */
function selectEvent(category, ledger, rng) {
  const corpus = EVENT_CORPORA[category];
  if (!corpus || corpus.length === 0) {
    return createFallbackEvent(category);
  }

  const randomFn = rng || Math.random;
  const index = Math.floor(randomFn() * corpus.length);
  return corpus[index];
}

/**
 * Compute weight multipliers for events based on current reputation.
 * v0.1 stub: returns uniform weights (all 1.0).
 * Future: high reputation → more helpful events, low reputation → harsher events.
 * 
 * @param {string} category
 * @param {object} ledger
 * @returns {number[]} Weight for each event in the corpus
 */
function getEventWeights(category, ledger) {
  const corpus = EVENT_CORPORA[category];
  if (!corpus) return [];
  // v0.1: uniform weights — Phase 3 will implement reputation-based weighting
  return new Array(corpus.length).fill(1.0);
}

// ─── Choice Resolution ───────────────────────────────────────────────────────

/**
 * Resolve a player's choice from an event with branching outcomes.
 * 
 * @param {object} event — The event with a .choices array
 * @param {number} choiceIndex — Index into the choices array
 * @returns {object|null} The effects object for the chosen outcome, or null if invalid
 */
function resolveChoice(event, choiceIndex) {
  if (!event.choices || !Array.isArray(event.choices)) {
    return null;
  }
  if (choiceIndex < 0 || choiceIndex >= event.choices.length) {
    return null;
  }
  const choice = event.choices[choiceIndex];
  return choice.effects || {};
}

// ─── Main Dispatcher ─────────────────────────────────────────────────────────

/**
 * Dispatch an event: select from corpus, apply effects, update ledger.
 * 
 * This is the main entry point. It orchestrates event selection and effect
 * application in one atomic operation.
 * 
 * @param {string} category — One of EVENT_CATEGORIES
 * @param {object} state — Current game state (must have .resources and .party)
 * @param {object} ledger — Current Trail Ledger
 * @param {function} [rng] — Seeded RNG function returning [0, 1)
 * @returns {{ state: object, ledger: object, event: object }} Updated state, ledger, and the triggered event
 */
function dispatchEvent(category, state, ledger, rng) {
  // Validate category
  if (!EVENT_CATEGORIES.includes(category)) {
    throw new Error(`Unknown event category: "${category}". Valid: ${EVENT_CATEGORIES.join(', ')}`);
  }

  // Select event
  const event = selectEvent(category, ledger, rng);

  // Apply effects (resources + reputation)
  const { state: newState, ledger: newLedger } = applyEffects(state, ledger, event.effects);

  return {
    state: newState,
    ledger: newLedger,
    event
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export {
  // Ledger
  createLedger,
  getReputationLabel,
  getLedgerSummary,
  applyReputation,
  serializeLedger,
  deserializeLedger,

  // Event selection
  selectEvent,
  getEventWeights,

  // Effect application
  applyEffects,
  resolveChoice,

  // Main dispatcher
  dispatchEvent,

  // Constants
  FACTIONS,
  FACTION_LABELS,
  REPUTATION_LABELS,
  EVENT_CATEGORIES
};
