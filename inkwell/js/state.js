import { mulberry32, randomSeed } from './rng.js';
import { generatePage } from './map.js';
import { createPlayer } from './entity.js';

export function createInitialState(seed = randomSeed()) {
  const rng = mulberry32(seed);
  const page = generatePage(rng, 1);
  const player = createPlayer(page.playerStart.x, page.playerStart.y);

  return {
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
    meta: {
      runStart: Date.now(),
      deepestPage: 1,
      dailySeed: false,
    },
  };
}

export function pushLog(state, text, tone = 'plain') {
  state.log.push({ text, tone, turn: state.turn });
  if (state.log.length > 24) state.log.shift();
}
