import { KIND, PLAYER_START, ENEMY_STATS } from './constants.js';

let nextId = 1;

export function createEntity(kind, x, y, overrides = {}) {
  return {
    id: nextId++,
    kind,
    x,
    y,
    alive: true,
    ...overrides,
  };
}

export function createPlayer(x, y) {
  return createEntity(KIND.PLAYER, x, y, {
    hp: PLAYER_START.hp,
    hpMax: PLAYER_START.hpMax,
    attack: PLAYER_START.attack,
    ink: PLAYER_START.inkMax,
    inkMax: PLAYER_START.inkMax,
    glyph: '@',
  });
}

export function createDrip(x, y) {
  return createEnemy(KIND.DRIP, x, y, ENEMY_STATS.drip);
}

export function createSmear(x, y) {
  return createEnemy(KIND.SMEAR, x, y, ENEMY_STATS.smear);
}

export function createScrawl(x, y) {
  return createEnemy(KIND.SCRAWL, x, y, ENEMY_STATS.scrawl);
}

export function createStairs(x, y) {
  return createEntity(KIND.STAIRS, x, y, {
    glyph: '>',
    name: 'stairs down',
  });
}

export function stairsAt(state, x, y) {
  for (const e of state.entities) {
    if (e.alive && e.kind === KIND.STAIRS && e.x === x && e.y === y) return e;
  }
  return null;
}

function createEnemy(kind, x, y, stats) {
  return createEntity(kind, x, y, {
    hp: stats.hp,
    hpMax: stats.hpMax,
    attack: stats.attack,
    glyph: stats.glyph,
    name: stats.name,
  });
}

export function entityAt(state, x, y) {
  if (state.player.x === x && state.player.y === y && state.player.alive) {
    return state.player;
  }
  for (const e of state.entities) {
    if (e.alive && e.x === x && e.y === y) return e;
  }
  return null;
}

const HOSTILE_KINDS = new Set([KIND.DRIP, KIND.SMEAR, KIND.SCRAWL]);

export function isHostile(e) {
  return !!(e && e.alive && HOSTILE_KINDS.has(e.kind));
}
