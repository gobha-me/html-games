import { KIND, PLAYER_START, ENEMY_STATS, BOSS_STATS, ITEMS, GLYPHS } from './constants.js';

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
    inventory: [],
    knownSpells: [],
    slots: [null, null, null],
    buffs: { wardTurns: 0, sightTurns: 0 },
    marginaliaTurns: 0,
    inkCostBonus: 0,
  });
}

export function createInkpot(x, y)      { return createItem(KIND.ITEM_INKPOT, x, y); }
export function createCloth(x, y)       { return createItem(KIND.ITEM_CLOTH, x, y); }
export function createSeal(x, y)        { return createItem(KIND.ITEM_SEAL, x, y); }
export function createNib(x, y)         { return createItem(KIND.ITEM_NIB, x, y); }
export function createMarginaliaItem(x, y) { return createItem(KIND.ITEM_MARGINALIA, x, y); }
export function createFountainPen(x, y) { return createItem(KIND.ITEM_FOUNTAIN_PEN, x, y); }
export function createReedPen(x, y)     { return createItem(KIND.ITEM_REED_PEN, x, y); }

function createItem(kind, x, y) {
  const spec = ITEMS[kind];
  return createEntity(kind, x, y, {
    glyph: spec.glyph,
    name: spec.name,
  });
}

const ITEM_KINDS = new Set([
  KIND.ITEM_INKPOT,
  KIND.ITEM_CLOTH,
  KIND.ITEM_SEAL,
  KIND.ITEM_NIB,
  KIND.ITEM_MARGINALIA,
  KIND.ITEM_FOUNTAIN_PEN,
  KIND.ITEM_REED_PEN,
]);

export function isItem(e) {
  return !!(e && e.alive && ITEM_KINDS.has(e.kind));
}

export function createGlyphStrike(x, y) { return createGlyph(KIND.GLYPH_STRIKE, x, y); }
export function createGlyphWard(x, y)   { return createGlyph(KIND.GLYPH_WARD, x, y); }
export function createGlyphSight(x, y)  { return createGlyph(KIND.GLYPH_SIGHT, x, y); }
export function createGlyphBind(x, y)   { return createGlyph(KIND.GLYPH_BIND, x, y); }
export function createGlyphErase(x, y)  { return createGlyph(KIND.GLYPH_ERASE, x, y); }

function createGlyph(kind, x, y) {
  const spec = GLYPHS[kind];
  return createEntity(kind, x, y, {
    glyph: spec.glyph,
    name: spec.name,
  });
}

const GLYPH_KINDS = new Set([
  KIND.GLYPH_STRIKE,
  KIND.GLYPH_WARD,
  KIND.GLYPH_SIGHT,
  KIND.GLYPH_BIND,
  KIND.GLYPH_ERASE,
]);

export function isGlyph(e) {
  return !!(e && e.alive && GLYPH_KINDS.has(e.kind));
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

export function createMarginalia(x, y) {
  return createEnemy(KIND.MARGINALIA, x, y, ENEMY_STATS.marginalia);
}

export function createFoxing(x, y) {
  return createEnemy(KIND.FOXING, x, y, ENEMY_STATS.foxing);
}

export function createErratum(x, y) {
  return createEnemy(KIND.ERRATUM, x, y, ENEMY_STATS.erratum, {
    teleportCooldown: 0,
  });
}

export function createMarginLord(x, y, depth) {
  const stats = BOSS_STATS.boss_margin_lord;
  const scale = Math.max(0, Math.floor((depth - 5) / 5));
  return createEnemy(KIND.BOSS_MARGIN_LORD, x, y, stats, {
    boss: true,
    bossBrain: 'margin_lord',
    attack: stats.attack + scale,
  });
}

export function createFrontispiece(x, y) {
  return createEnemy(KIND.BOSS_FRONTISPIECE, x, y, BOSS_STATS.boss_frontispiece, {
    boss: true,
    bossBrain: 'frontispiece',
    titleErased: false,
    dripCooldown: 0,
  });
}

export function createColophon(x, y) {
  return createEnemy(KIND.BOSS_COLOPHON, x, y, BOSS_STATS.boss_colophon, {
    boss: true,
    bossBrain: 'colophon',
  });
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

function createEnemy(kind, x, y, stats, extras = {}) {
  return createEntity(kind, x, y, {
    hp: stats.hp,
    hpMax: stats.hpMax,
    attack: stats.attack,
    glyph: stats.glyph,
    name: stats.name,
    ...extras,
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

const HOSTILE_KINDS = new Set([
  KIND.DRIP,
  KIND.SMEAR,
  KIND.SCRAWL,
  KIND.MARGINALIA,
  KIND.FOXING,
  KIND.ERRATUM,
  KIND.BOSS_MARGIN_LORD,
  KIND.BOSS_FRONTISPIECE,
  KIND.BOSS_COLOPHON,
]);

export function isHostile(e) {
  return !!(e && e.alive && HOSTILE_KINDS.has(e.kind));
}
