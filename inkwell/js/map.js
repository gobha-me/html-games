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
} from './constants.js';
import { createDrip, createSmear, createScrawl, createStairs } from './entity.js';

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
  entities.push(createStairs(stairsPos.x, stairsPos.y));

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

  return { tiles, width: MAP_W, height: MAP_H, rooms, depth, playerStart, entities };
}

function spawnEnemy(rng, depth, x, y) {
  const roll = rng();
  if (depth <= 1) return createDrip(x, y);
  if (depth === 2) {
    return roll < 0.7 ? createDrip(x, y) : createSmear(x, y);
  }
  if (depth === 3) {
    if (roll < 0.5) return createDrip(x, y);
    if (roll < 0.8) return createSmear(x, y);
    return createScrawl(x, y);
  }
  if (roll < 0.4) return createDrip(x, y);
  if (roll < 0.75) return createSmear(x, y);
  return createScrawl(x, y);
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
