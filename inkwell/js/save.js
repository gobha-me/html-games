import { mulberry32 } from './rng.js';
import { createFovArrays, computeFOV } from './fov.js';

const KEY = 'inkwell.save';
const VERSION = 3;

export function saveRun(state) {
  if (!state || state.mode !== 'playing') return;
  if (state.meta && state.meta.dailySeed) return;
  try {
    const snapshot = {
      version: VERSION,
      seed: state.seed,
      rngState: state.rng.getState(),
      turn: state.turn,
      mode: state.mode,
      player: state.player,
      page: {
        depth: state.page.depth,
        tiles: Array.from(state.page.tiles),
        width: state.page.width,
        height: state.page.height,
        rooms: state.page.rooms,
      },
      entities: state.entities,
      log: state.log,
      fov: state.fov ? { seen: Array.from(state.fov.seen) } : null,
      meta: state.meta,
    };
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch (e) {
    // localStorage can be disabled or full; saving is best-effort.
  }
}

export function loadRun() {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    return null;
  }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data.version !== VERSION) return null;
    const rng = mulberry32(data.rngState);
    const fov = createFovArrays();
    if (data.fov && data.fov.seen) {
      fov.seen.set(Uint8Array.from(data.fov.seen));
    }
    if (!data.player.inventory) data.player.inventory = [];
    if (!data.player.knownSpells) data.player.knownSpells = [];
    if (!data.player.slots) data.player.slots = [null, null, null];
    if (!data.player.buffs) data.player.buffs = { wardTurns: 0, sightTurns: 0 };
    if (data.player.marginaliaTurns == null) data.player.marginaliaTurns = 0;
    if (data.player.inkCostBonus == null) data.player.inkCostBonus = 0;
    if (!data.meta) data.meta = {};
    if (!Array.isArray(data.meta.beastsSeen)) data.meta.beastsSeen = [];
    if (!Array.isArray(data.meta.bossesSlain)) data.meta.bossesSlain = [];
    const state = {
      seed: data.seed,
      rng,
      turn: data.turn,
      mode: 'menu',
      player: data.player,
      page: {
        depth: data.page.depth,
        tiles: Uint8Array.from(data.page.tiles),
        width: data.page.width,
        height: data.page.height,
        rooms: data.page.rooms,
      },
      entities: data.entities,
      log: data.log,
      animations: [],
      fov,
      meta: data.meta,
    };
    computeFOV(state);
    return state;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch (e) {
    return false;
  }
}

export function clearRun() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {}
}
