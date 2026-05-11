import { mulberry32 } from './rng.js';

const KEY = 'inkwell.save';
const VERSION = 1;

export function saveRun(state) {
  if (!state || state.mode !== 'playing') return;
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
    return {
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
      meta: data.meta,
    };
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
