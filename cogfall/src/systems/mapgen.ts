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
import { RESOURCES, type ResourceDef, getResource } from '../data/resources';
import { MAP_SIZES, type MapSizeId } from '../data/factions';
import { makeNoise } from './noise';

const RUIN_FRACTION = 0.025;
const AETHER_FRACTION = 0.018;
const RIVER_DIVISOR = 80;
const RIVER_HEADWATER_QUANTILE = 0.2;
const RIVER_MAX_STEPS = 200;
const MIN_FACTION_SPACING_FLOOR = 6;
const MIN_FACTION_SPACING_RATIO = 1.2;
const MIN_GOOD_NEIGHBORS = 3;
const START_SCORE_RADIUS = 2;
const START_COAST_BONUS = 4;
const START_WALLED_PENALTY = 8;
const START_WALLED_NEIGHBOR_THRESHOLD = 4;

export type WaterLevel = 'none' | 'lakes' | 'coasts' | 'continents';
export type ResourceDensity = 'sparse' | 'standard' | 'lush';

const WATER_PERCENTILES: Record<WaterLevel, number> = {
  none: 0,
  lakes: 0.08,
  coasts: 0.18,
  continents: 0.3,
};

const RESOURCE_DENSITIES: Record<ResourceDensity, number> = {
  sparse: 0.04,
  standard: 0.08,
  lush: 0.14,
};

export interface MapGenOptions {
  waterLevel?: WaterLevel;
  resourceDensity?: ResourceDensity;
}

export function generateMap(
  size: MapSizeId,
  rng: Rng = defaultRng,
  opts: MapGenOptions = {},
): GameMap {
  const waterPercentile = WATER_PERCENTILES[opts.waterLevel ?? 'coasts'];
  const resourceDensity = RESOURCE_DENSITIES[opts.resourceDensity ?? 'standard'];
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

  // Persist the noise seed on G so the Phase 2L debug overlay can
  // re-derive the elevation field after the closure goes out of scope.
  // Same value the noise closure has always used — extracted, not
  // changed.
  const seed = rng() * 1000;
  G.mapSeed = seed;
  const noise = makeNoise(seed);

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
  const waterIdx = Math.floor(sortedElev.length * waterPercentile);
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
    const count = Math.floor(eligible.length * resourceDensity);
    for (let i = 0; i < count; i++) {
      eligible[i].resource = id;
    }
  }

  return { w, h, tiles: tiles as GameMap['tiles'] };
}

// Pick `numFactions` start tiles by scoring viable candidates and greedily
// taking the highest-scoring tile that respects the spacing gate. Score
// rewards resource yield in a 2-tile radius and coast access; penalizes
// being walled in by unwalkable terrain. Falls back to random walkable
// tiles if the spacing gate exhausts the candidate pool.
export function findFactionStarts(numFactions: number, rng: Rng = defaultRng): Tile[] {
  if (!G.map) throw new Error('findFactionStarts requires G.map');
  const map = G.map;

  const viable = [...map.tiles.values()].filter((t) => {
    const tt = TERRAIN_TYPES[t.terrain];
    if (!tt.walkable) return false;
    if ('isAether' in tt || 'isRuin' in tt) return false;
    const goodNeighbors = hexNeighbors(t.q, t.r).filter((n) => {
      const nt = map.tiles.get(hexKey(n.q, n.r));
      return nt && TERRAIN_TYPES[nt.terrain].walkable;
    }).length;
    return goodNeighbors >= MIN_GOOD_NEIGHBORS;
  });

  // Score once, sort once. No rng draws here — tie-break uses tile coords
  // so two scores are resolved deterministically without burning cursor.
  const scored = viable
    .map((t) => ({ tile: t, score: scoreStart(t, map) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.tile.q !== b.tile.q) return a.tile.q - b.tile.q;
      return a.tile.r - b.tile.r;
    });

  const minDist = Math.max(
    MIN_FACTION_SPACING_FLOOR,
    Math.floor(Math.sqrt(map.tiles.size / numFactions) * MIN_FACTION_SPACING_RATIO),
  );

  // Greedy at full minDist; if we can't fit numFactions, relax distance
  // by 1 until we hit MIN_FACTION_SPACING_FLOOR. As a last resort allow
  // dist=0 (no spacing) so we always return numFactions starts. The
  // schedule is deterministic, so seed → starts is reproducible.
  const starts: Tile[] = [];
  const distSchedule: number[] = [];
  for (let d = minDist; d >= MIN_FACTION_SPACING_FLOOR; d--) distSchedule.push(d);
  distSchedule.push(0);
  for (const dist of distSchedule) {
    if (starts.length >= numFactions) break;
    for (const c of scored) {
      if (starts.length >= numFactions) break;
      if (starts.includes(c.tile)) continue;
      if (starts.every((s) => hexDistance(s, c.tile) >= dist)) {
        starts.push(c.tile);
      }
    }
  }

  // Belt-and-suspenders fallback: if `scored` was somehow empty (a map
  // with no viable land at all), pick from any walkable tile.
  if (starts.length < numFactions) {
    const walkableAny = [...map.tiles.values()].filter((t) => {
      const tt = TERRAIN_TYPES[t.terrain];
      return tt.walkable && !('isAether' in tt) && !('isRuin' in tt);
    });
    while (starts.length < numFactions && walkableAny.length > 0) {
      starts.push(walkableAny[Math.floor(rng() * walkableAny.length)]);
    }
  }

  return starts;
}

function scoreStart(tile: Tile, map: GameMap): number {
  let score = 0;
  let coastFound = false;

  for (const t of map.tiles.values()) {
    const d = hexDistance({ q: tile.q, r: tile.r }, { q: t.q, r: t.r });
    if (d > START_SCORE_RADIUS) continue;
    const res = getResource(t.resource);
    if (res) score += (res.food ?? 0) + (res.prod ?? 0) + (res.gold ?? 0);
    if (!coastFound && isCoast(t, map)) coastFound = true;
  }
  if (coastFound) score += START_COAST_BONUS;

  const blockedCount = hexNeighbors(tile.q, tile.r).filter((n) => {
    const nt = map.tiles.get(hexKey(n.q, n.r));
    return !nt || !TERRAIN_TYPES[nt.terrain].walkable;
  }).length;
  if (blockedCount >= START_WALLED_NEIGHBOR_THRESHOLD) score -= START_WALLED_PENALTY;

  return score;
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
