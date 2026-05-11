import { mulberry32, randomSeed } from './rng.js';
import { generatePage } from './map.js';
import { createPlayer } from './entity.js';
import { createFovArrays, computeFOV } from './fov.js';

export function createInitialState(seed = randomSeed()) {
  const rng = mulberry32(seed);
  const page = generatePage(rng, 1);
  const player = createPlayer(page.playerStart.x, page.playerStart.y);

  const state = {
    seed,
    rng,
    turn: 0,
    mode: 'menu',
    player,
    page: {
      depth: page.depth,
      tiles: page.tiles,
      width: page.width,
      height: page.height,
      rooms: page.rooms,
    },
    entities: page.entities,
    log: [],
    animations: [],
    fov: createFovArrays(),
    meta: {
      runStart: Date.now(),
      deepestPage: 1,
      dailySeed: false,
    },
  };
  computeFOV(state);
  return state;
}

export function pushLog(state, text, tone = 'plain') {
  const last = state.log[state.log.length - 1];
  if (last && last.text === text && last.tone === tone) {
    last.count = (last.count || 1) + 1;
    last.turn = state.turn;
    return;
  }
  state.log.push({ text, tone, turn: state.turn, count: 1 });
  if (state.log.length > 24) state.log.shift();
}
