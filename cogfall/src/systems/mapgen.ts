// Procedural map generation.
//
// Pipeline:
//   1. Lay out a w×h offset grid as axial coords.
//   2. Generate a value-noise field (4 octaves, custom hash) seeded from
//      rng. Compute elevation + moisture per tile.
//   3. (2c) Carve water on the lowest WATER_PERCENTILE of tiles by
//      elevation, before the terrain assignment.
//   4. Assign land terrain by elevation/moisture thresholds.
//   5. Stamp a hard mountain/wastes border on the outermost ring (this
//      overwrites any water that ended up on the edge — water lives only
//      in the playable interior).
//   6. Sprinkle ruins (~2.5%) and aether vents (~1.8%) onto plains/hills/
//      wastes tiles, picked via a shuffled pool.
//
// Phase 1 preserves the prototype's magic numbers and order of rng draws.
// Phase 2c adds the water pass; it consumes only the existing noise
// field (no new rng draws), so save-load rng cursor parity is preserved.

import { HEX_DIRS, hexDistance, hexKey, hexNeighbors } from '../core/hex';
import { defaultRng, shuffle, type Rng } from '../core/rng';
import { G } from '../core/state';
import type { GameMap, Tile, TerrainId } from '../core/types';
import { TERRAIN_TYPES } from '../data/terrain';
import { RESOURCES, type ResourceDef } from '../data/resources';
import { MAP_SIZES, type MapSizeId } from '../data/factions';

const RUIN_FRACTION = 0.025;
const AETHER_FRACTION = 0.018;
const WATER_PERCENTILE = 0.18;
const RIVER_DIVISOR = 80;
const RIVER_HEADWATER_QUANTILE = 0.2;
const RIVER_MAX_STEPS = 200;
const RESOURCE_DENSITY = 0.08;
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

  // Compute elevation + moisture per tile (deterministic, no rng draws).
  const fields = new Map<string, { elevation: number; moisture: number }>();
  for (const tile of tiles.values()) {
    const px = tile.q + tile.r * 0.5;
    const py = tile.r;
    fields.set(hexKey(tile.q, tile.r), {
      elevation: noise(px, py),
      moisture: noise(px + 99, py + 99),
    });
  }

  // Water threshold: bottom WATER_PERCENTILE of tiles by elevation. Border
  // ring will overwrite any edge tiles below the threshold, so the water
  // count seen on the playable interior is somewhat lower than the raw
  // percentile suggests — that's intentional and avoids leaky-edge maps.
  const sortedElev = [...fields.values()].map((f) => f.elevation).sort((a, b) => a - b);
  const waterIdx = Math.floor(sortedElev.length * WATER_PERCENTILE);
  const waterThreshold = sortedElev[waterIdx];

  for (const tile of tiles.values()) {
    const f = fields.get(hexKey(tile.q, tile.r))!;
    const elevation = f.elevation;
    const moisture = f.moisture;
    if (elevation < waterThreshold) tile.terrain = 'WATER';
    else if (elevation > 0.78) tile.terrain = 'MOUNTAINS';
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

  // River tracing. Pick headwater seeds from the highest-elevation
  // non-mountain non-water tiles, walk strictly downhill setting
  // riverEdges bits on both tiles of each crossed edge. Refuses to
  // step into a mountain (can't carve a river through stone) and
  // terminates on water (river reaches the sea), the map edge, or
  // any local minimum (no strictly-lower neighbor).
  //
  // No movement-cost or defense-bonus impact this commit — see
  // decision-log entry 5 in core/state.ts. Rivers are visual +
  // bookkeeping in 2c.
  const numRivers = Math.floor(tiles.size / RIVER_DIVISOR);
  const elevSorted = [...tiles.values()].sort(
    (a, b) =>
      fields.get(hexKey(b.q, b.r))!.elevation - fields.get(hexKey(a.q, a.r))!.elevation,
  );
  const seedPool = elevSorted
    .slice(0, Math.floor(elevSorted.length * RIVER_HEADWATER_QUANTILE))
    .filter((t) => t.terrain !== 'MOUNTAINS' && t.terrain !== 'WATER');

  for (let n = 0; n < numRivers && seedPool.length > 0; n++) {
    let cur = seedPool[Math.floor(rng() * seedPool.length)];
    let safety = 0;
    while (safety++ < RIVER_MAX_STEPS) {
      if (cur.terrain === 'WATER') break;
      const curElev = fields.get(hexKey(cur.q, cur.r))!.elevation;
      let bestNeighbor: Tile | null = null;
      let bestElev = curElev;
      let bestDir = -1;
      for (let d = 0; d < 6; d++) {
        const dir = HEX_DIRS[d];
        const nt = tiles.get(hexKey(cur.q + dir.q, cur.r + dir.r));
        if (!nt) continue;
        if (nt.terrain === 'MOUNTAINS') continue;
        const ne = fields.get(hexKey(nt.q, nt.r))!.elevation;
        if (ne < bestElev) {
          bestElev = ne;
          bestNeighbor = nt;
          bestDir = d;
        }
      }
      if (!bestNeighbor) break;
      cur.riverEdges = (cur.riverEdges ?? 0) | (1 << bestDir);
      bestNeighbor.riverEdges = (bestNeighbor.riverEdges ?? 0) | (1 << ((bestDir + 3) % 6));
      cur = bestNeighbor;
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

  // Resource placement. Each resource type samples a fraction of its
  // eligible (allowed-terrain, currently unresourced) tiles. Iteration
  // order over RESOURCES is the data-table insertion order — stable,
  // so seeds reproduce. Resources spawn after ruin/aether stamping
  // because RUINS/AETHER aren't allowed terrains for any resource and
  // we don't want a candidate's terrain flipping out from under us.
  for (const [id, def] of Object.entries(RESOURCES) as [string, ResourceDef][]) {
    const eligible = [...tiles.values()].filter(
      (t) => def.allowedTerrains.includes(t.terrain) && !t.resource
    );
    shuffle(eligible, rng);
    const count = Math.floor(eligible.length * RESOURCE_DENSITY);
    for (let i = 0; i < count; i++) {
      eligible[i].resource = id;
    }
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

// A land tile is a coast iff at least one neighbor is WATER. Used by
// render and (2c-4) start scoring. Map is passed explicitly so callers
// in tests don't need to set up G.map.
export function isCoast(tile: Tile, map: GameMap): boolean {
  if (tile.terrain === 'WATER') return false;
  for (const n of hexNeighbors(tile.q, tile.r)) {
    const nt = map.tiles.get(hexKey(n.q, n.r));
    if (nt && nt.terrain === 'WATER') return true;
  }
  return false;
}
