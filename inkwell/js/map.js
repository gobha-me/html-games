import {
  MAP_W,
  MAP_H,
  TILE,
  ROOMS_MIN,
  ROOMS_MAX,
  ROOM_W,
  ROOM_H,
  DRIPS_MIN,
  DRIPS_MAX,
  ITEMS_PER_PAGE,
} from './constants.js';
import {
  createDrip,
  createSmear,
  createScrawl,
  createMarginalia,
  createFoxing,
  createErratum,
  createMarginLord,
  createFrontispiece,
  createColophon,
  createStairs,
  createInkpot,
  createCloth,
  createSeal,
  createNib,
  createMarginaliaItem,
  createFountainPen,
  createReedPen,
  createGlyphStrike,
  createGlyphWard,
  createGlyphSight,
  createGlyphBind,
  createGlyphErase,
} from './entity.js';

export function generatePage(rng, depth = 1) {
  const tiles = new Uint8Array(MAP_W * MAP_H);
  tiles.fill(TILE.WALL);

  const rooms = [];
  const targetRooms = rng.int(ROOMS_MIN, ROOMS_MAX);
  let attempts = 0;
  while (rooms.length < targetRooms && attempts < 200) {
    attempts++;
    const w = rng.int(ROOM_W[0], ROOM_W[1]);
    const h = rng.int(ROOM_H[0], ROOM_H[1]);
    const x = rng.int(1, MAP_W - w - 2);
    const y = rng.int(1, MAP_H - h - 2);
    const room = { x, y, w, h };
    if (rooms.some((r) => roomsOverlap(r, room, 1))) continue;
    rooms.push(room);
    carveRoom(tiles, room);
    if (rooms.length > 1) {
      const prev = rooms[rooms.length - 2];
      carveCorridor(tiles, centerOf(prev), centerOf(room), rng);
    }
  }

  const spawnRoom = rooms[0];
  const playerStart = centerOf(spawnRoom);

  const entities = [];
  const stairsRoom = pickFarthestRoom(rooms, playerStart);
  const stairsPos = centerOf(stairsRoom);
  const boss = bossForDepth(depth, stairsPos.x, stairsPos.y);
  if (boss) {
    entities.push(boss);
  } else {
    entities.push(createStairs(stairsPos.x, stairsPos.y));
  }

  const enemyCount = rng.int(DRIPS_MIN, DRIPS_MAX);
  let placed = 0;
  let tries = 0;
  while (placed < enemyCount && tries < 200) {
    tries++;
    const room = rng.pick(rooms.slice(1));
    if (!room) break;
    const dx = rng.int(room.x, room.x + room.w - 1);
    const dy = rng.int(room.y, room.y + room.h - 1);
    if (entities.some((e) => e.x === dx && e.y === dy)) continue;
    entities.push(spawnEnemy(rng, depth, dx, dy));
    placed++;
  }

  const itemCount = rng.int(ITEMS_PER_PAGE[0], ITEMS_PER_PAGE[1]);
  let itemPlaced = 0;
  let itemTries = 0;
  while (itemPlaced < itemCount && itemTries < 200) {
    itemTries++;
    const room = rng.pick(rooms.slice(1));
    if (!room) break;
    const ix = rng.int(room.x, room.x + room.w - 1);
    const iy = rng.int(room.y, room.y + room.h - 1);
    if (entities.some((e) => e.x === ix && e.y === iy)) continue;
    entities.push(spawnItem(rng, depth, ix, iy));
    itemPlaced++;
  }

  const glyphCount = 1 + (rng.chance(0.25) ? 1 : 0);
  let glyphPlaced = 0;
  let glyphTries = 0;
  while (glyphPlaced < glyphCount && glyphTries < 200) {
    glyphTries++;
    const room = rng.pick(rooms.slice(1));
    if (!room) break;
    const gx = rng.int(room.x, room.x + room.w - 1);
    const gy = rng.int(room.y, room.y + room.h - 1);
    if (entities.some((e) => e.x === gx && e.y === gy)) continue;
    entities.push(spawnGlyph(rng, depth, gx, gy));
    glyphPlaced++;
  }

  return { tiles, width: MAP_W, height: MAP_H, rooms, depth, playerStart, entities };
}

function spawnItem(rng, depth, x, y) {
  const roll = rng();
  if (depth < 3) {
    if (roll < 0.35) return createInkpot(x, y);
    if (roll < 0.65) return createCloth(x, y);
    if (roll < 0.85) return createSeal(x, y);
    return createNib(x, y);
  }
  if (depth < 5) {
    if (roll < 0.28) return createInkpot(x, y);
    if (roll < 0.52) return createCloth(x, y);
    if (roll < 0.7) return createSeal(x, y);
    if (roll < 0.83) return createNib(x, y);
    return createReedPen(x, y);
  }
  if (depth < 7) {
    if (roll < 0.24) return createInkpot(x, y);
    if (roll < 0.46) return createCloth(x, y);
    if (roll < 0.6) return createSeal(x, y);
    if (roll < 0.74) return createNib(x, y);
    if (roll < 0.86) return createReedPen(x, y);
    return createMarginaliaItem(x, y);
  }
  if (roll < 0.2) return createInkpot(x, y);
  if (roll < 0.4) return createCloth(x, y);
  if (roll < 0.54) return createSeal(x, y);
  if (roll < 0.66) return createNib(x, y);
  if (roll < 0.78) return createReedPen(x, y);
  if (roll < 0.9) return createMarginaliaItem(x, y);
  return createFountainPen(x, y);
}

export function spawnGlyph(rng, depth, x, y) {
  const roll = rng();
  if (depth < 3) {
    if (roll < 0.34) return createGlyphStrike(x, y);
    if (roll < 0.67) return createGlyphWard(x, y);
    return createGlyphSight(x, y);
  }
  if (roll < 0.22) return createGlyphStrike(x, y);
  if (roll < 0.44) return createGlyphWard(x, y);
  if (roll < 0.62) return createGlyphSight(x, y);
  if (roll < 0.82) return createGlyphBind(x, y);
  return createGlyphErase(x, y);
}

function bossForDepth(depth, x, y) {
  if (depth === 5) return createMarginLord(x, y, depth);
  if (depth === 10) return createFrontispiece(x, y);
  if (depth === 15) return createColophon(x, y);
  return null;
}

function spawnEnemy(rng, depth, x, y) {
  const roll = rng();
  if (depth <= 1) return createDrip(x, y);
  if (depth === 2) {
    return roll < 0.7 ? createDrip(x, y) : createSmear(x, y);
  }
  if (depth === 3) {
    if (roll < 0.4) return createDrip(x, y);
    if (roll < 0.65) return createSmear(x, y);
    if (roll < 0.85) return createScrawl(x, y);
    return createMarginalia(x, y);
  }
  if (depth === 4) {
    if (roll < 0.3) return createDrip(x, y);
    if (roll < 0.55) return createSmear(x, y);
    if (roll < 0.8) return createScrawl(x, y);
    return createMarginalia(x, y);
  }
  if (depth === 5 || depth === 6) {
    if (roll < 0.22) return createDrip(x, y);
    if (roll < 0.46) return createSmear(x, y);
    if (roll < 0.66) return createScrawl(x, y);
    if (roll < 0.83) return createMarginalia(x, y);
    return createFoxing(x, y);
  }
  if (roll < 0.18) return createDrip(x, y);
  if (roll < 0.38) return createSmear(x, y);
  if (roll < 0.58) return createScrawl(x, y);
  if (roll < 0.75) return createMarginalia(x, y);
  if (roll < 0.9) return createFoxing(x, y);
  return createErratum(x, y);
}

export function tileAt(page, x, y) {
  if (x < 0 || y < 0 || x >= page.width || y >= page.height) return TILE.VOID;
  return page.tiles[y * page.width + x];
}

export function isWalkable(page, x, y) {
  return tileAt(page, x, y) === TILE.FLOOR;
}

function centerOf(room) {
  return { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
}

function pickFarthestRoom(rooms, from) {
  let best = rooms[rooms.length - 1];
  let bestDist = -1;
  for (let i = 1; i < rooms.length; i++) {
    const c = centerOf(rooms[i]);
    const d = (c.x - from.x) * (c.x - from.x) + (c.y - from.y) * (c.y - from.y);
    if (d > bestDist) {
      bestDist = d;
      best = rooms[i];
    }
  }
  return best;
}

function roomsOverlap(a, b, pad = 0) {
  return (
    a.x - pad < b.x + b.w &&
    a.x + a.w > b.x - pad &&
    a.y - pad < b.y + b.h &&
    a.y + a.h > b.y - pad
  );
}

function carveRoom(tiles, room) {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      tiles[y * MAP_W + x] = TILE.FLOOR;
    }
  }
}

function carveCorridor(tiles, a, b, rng) {
  if (rng.chance(0.5)) {
    carveHLine(tiles, a.x, b.x, a.y);
    carveVLine(tiles, a.y, b.y, b.x);
  } else {
    carveVLine(tiles, a.y, b.y, a.x);
    carveHLine(tiles, a.x, b.x, b.y);
  }
}

function carveHLine(tiles, x1, x2, y) {
  const [lo, hi] = x1 < x2 ? [x1, x2] : [x2, x1];
  for (let x = lo; x <= hi; x++) tiles[y * MAP_W + x] = TILE.FLOOR;
}

function carveVLine(tiles, y1, y2, x) {
  const [lo, hi] = y1 < y2 ? [y1, y2] : [y2, y1];
  for (let y = lo; y <= hi; y++) tiles[y * MAP_W + x] = TILE.FLOOR;
}
