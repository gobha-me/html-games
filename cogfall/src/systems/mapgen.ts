// Procedural map generation.
//
// The prototype's algorithm:
//   1. Lay out a w×h offset grid as axial coords.
//   2. Generate a value-noise field (4 octaves, custom hash) seeded from
//      Math.random(). Use it to assign mountains / hills / wastes / forest /
//      plains based on elevation + moisture thresholds.
//   3. Stamp a hard mountain/wastes border on the outermost ring.
//   4. Sprinkle ruins (~2.5%) and aether vents (~1.8%) onto plains/hills/
//      wastes tiles, picked via a shuffled pool.
//
// Phase 1 preserves all magic numbers and the byte-equivalent code paths;
// only difference is rng injection so tests can pin the output.

import { hexDistance, hexKey, hexNeighbors } from '../core/hex';
import { defaultRng, shuffle, type Rng } from '../core/rng';
import { G } from '../core/state';
import type { GameMap, Tile, TerrainId } from '../core/types';
import { TERRAIN_TYPES } from '../data/terrain';
import { MAP_SIZES, type MapSizeId } from '../data/factions';

const RUIN_FRACTION = 0.025;
const AETHER_FRACTION = 0.018;
const MIN_FACTION_SPACING_FLOOR = 6;
const MIN_FACTION_SPACING_RATIO = 1.2;
const MAX_PLACEMENT_ATTEMPTS = 3000;
const MIN_GOOD_NEIGHBORS = 3;

export function generateMap(size: MapSizeId, rng: Rng = defaultRng): GameMap {
  const dim = MAP_SIZES[size];
  const tiles: Map<string, Tile> = new Map();
  const w = dim.w;
  const h = dim.h;

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const q = col - Math.floor(row / 2);
      const r = row;
      tiles.set(hexKey(q, r), {
        q,
        r,
        terrain: 'PLAINS',
        resource: null,
        improvement: null,
        owner: null,
        cityId: null,
        unitId: null,
        visibility: {},
      });
    }
  }

  const seed = rng() * 1000;

  function hash2(x: number, y: number): number {
    let h = x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
  }

  function fakeNoise(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const a = hash2(ix, iy);
    const b = hash2(ix + 1, iy);
    const c = hash2(ix, iy + 1);
    const d = hash2(ix + 1, iy + 1);
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }

  function noise(x: number, y: number): number {
    let n = 0;
    let amp = 1;
    let freq = 0.15;
    let sum = 0;
    for (let o = 0; o < 4; o++) {
      n += amp * fakeNoise(x * freq + seed, y * freq + seed * 1.3);
      sum += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return n / sum;
  }

  for (const tile of tiles.values()) {
    const px = tile.q + tile.r * 0.5;
    const py = tile.r;
    const elevation = noise(px, py);
    const moisture = noise(px + 99, py + 99);
    if (elevation > 0.78) tile.terrain = 'MOUNTAINS';
    else if (elevation > 0.66) tile.terrain = 'HILLS';
    else if (elevation < 0.32 && moisture < 0.4) tile.terrain = 'WASTES';
    else if (moisture > 0.62) tile.terrain = 'FOREST';
    else tile.terrain = 'PLAINS';
  }

  // Border ring.
  for (const tile of tiles.values()) {
    const offCol = tile.q + Math.floor(tile.r / 2);
    if (offCol <= 0 || offCol >= w - 1 || tile.r <= 0 || tile.r >= h - 1) {
      tile.terrain = (rng() < 0.5 ? 'MOUNTAINS' : 'WASTES') as TerrainId;
    }
  }

  // Ruin / aether placement.
  const candidates = [...tiles.values()].filter(
    (t) => t.terrain === 'PLAINS' || t.terrain === 'HILLS' || t.terrain === 'WASTES'
  );
  shuffle(candidates, rng);
  const ruinCount = Math.floor(tiles.size * RUIN_FRACTION);
  const aetherCount = Math.floor(tiles.size * AETHER_FRACTION);
  for (let i = 0; i < ruinCount && i < candidates.length; i++) {
    candidates[i].terrain = 'RUINS';
  }
  for (let i = ruinCount; i < ruinCount + aetherCount && i < candidates.length; i++) {
    candidates[i].terrain = 'AETHER';
  }

  return { w, h, tiles: tiles as GameMap['tiles'] };
}

// Pick `numFactions` start tiles, evenly spread, biased toward open ground
// (≥3 walkable neighbors). Falls back to random walkable tiles if the
// constraint can't be satisfied within MAX_PLACEMENT_ATTEMPTS attempts.
export function findFactionStarts(numFactions: number, rng: Rng = defaultRng): Tile[] {
  if (!G.map) throw new Error('findFactionStarts requires G.map');
  const walkable = [...G.map.tiles.values()].filter(
    (t) =>
      TERRAIN_TYPES[t.terrain].walkable &&
      !('isAether' in TERRAIN_TYPES[t.terrain]) &&
      !('isRuin' in TERRAIN_TYPES[t.terrain])
  );
  const starts: Tile[] = [];
  let attempts = 0;
  const minDist = Math.max(
    MIN_FACTION_SPACING_FLOOR,
    Math.floor(Math.sqrt(G.map.tiles.size / numFactions) * MIN_FACTION_SPACING_RATIO)
  );

  while (starts.length < numFactions && attempts < MAX_PLACEMENT_ATTEMPTS) {
    const candidate = walkable[Math.floor(rng() * walkable.length)];
    const ok = starts.every((s) => hexDistance(s, candidate) >= minDist);
    if (ok) {
      const goodNeighbors = hexNeighbors(candidate.q, candidate.r).filter((n) => {
        const t = G.map!.tiles.get(hexKey(n.q, n.r));
        return t && TERRAIN_TYPES[t.terrain].walkable;
      }).length;
      if (goodNeighbors >= MIN_GOOD_NEIGHBORS) starts.push(candidate);
    }
    attempts++;
  }

  while (starts.length < numFactions) {
    starts.push(walkable[Math.floor(rng() * walkable.length)]);
  }

  return starts;
}
