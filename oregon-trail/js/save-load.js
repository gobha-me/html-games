/**
 * Oregon Trail — Save / Load
 *
 * localStorage persistence for full game state.
 * No DOM, no side effects beyond localStorage I/O.
 *
 * @module save-load
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** Namespaced localStorage key. */
const SAVE_KEY = 'oregon-trail:save:v1';

/** Schema version — bump when the saved-state shape changes. */
const SAVE_VERSION = 1;

// ─── Core ────────────────────────────────────────────────────────────────────

/**
 * Serialize the full game state and write it to localStorage.
 *
 * Strips non-serializable properties (the `rng` function) before writing.
 * Wrapped in try/catch — silently fails if localStorage is unavailable or full.
 *
 * @param {object} state — The current game state object.
 * @param {object} [ledger] — Optional Trail Ledger to persist.
 * @param {object} [stats] — Optional stats snapshot to persist.
 */
export function saveGame(state, ledger, stats) {
  if (!state) return;
  try {
    const { rng, ...serializable } = state;
    const payload = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      state: serializable
    };
    if (ledger) payload.ledger = ledger;
    if (stats) payload.stats = stats;
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch (e) {
    // localStorage can be disabled, blocked, or full — saving is best-effort.
  }
}

/**
 * Convenience alias: auto-save the current state after each turn.
 * Identical to `saveGame`; named for intent clarity at call sites.
 *
 * @param {object} state — The current game state object.
 * @param {object} [ledger] — Optional Trail Ledger to persist.
 * @param {object} [stats] — Optional stats snapshot to persist.
 */
export function autoSave(state, ledger, stats) {
  saveGame(state, ledger, stats);
}

/**
 * Read and restore a previously saved game state from localStorage.
 *
 * Validates the version and required fields. Returns `null` when no save
 * exists, the version is stale, or the data is corrupted.
 *
 * The `rng` function is restored with a fresh seed (deterministic replay
 * is not guaranteed after load).
 *
 * @param {Function} [createRNG] — Optional RNG factory from turn-loop.
 *   If omitted, a basic fallback RNG is used.
 * @returns {object|null} The restored game state, or null.
 */
export function loadGame(createRNG) {
  let raw;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return null;
  }
  if (!raw) return null;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    return null; // Corrupted JSON
  }

  // Version gate
  if (payload.version !== SAVE_VERSION) return null;

  const saved = payload.state;
  if (!saved || typeof saved !== 'object') return null;

  // Minimal shape validation — these fields must exist for a valid save.
  const requiredKeys = ['day', 'distanceTraveled', 'resources', 'party'];
  for (const key of requiredKeys) {
    if (!(key in saved)) return null;
  }

  // Restore the RNG (fresh seed — not deterministic replay).
  const rngFactory = createRNG || function() {
    let s = Date.now() | 0;
    return function() {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

  return {
    state: {
      ...saved,
      rng: rngFactory(),
      _turnLog: saved._turnLog || []
    },
    ledger: payload.ledger ?? null,
    stats: payload.stats ?? null
  };
}
 * Check whether a valid, version-matching save exists in localStorage.
 *
 * @returns {boolean}
 */
export function hasSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw);
    return payload.version === SAVE_VERSION;
  } catch (e) {
    return false;
  }
}

/**
 * Remove the saved state from localStorage.
 * Safe to call even when no save exists.
 */
export function deleteSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    // Best-effort; ignore errors.
  }
}
