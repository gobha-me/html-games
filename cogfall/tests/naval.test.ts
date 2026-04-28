import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeMoveTargets, createUnit } from '../src/systems/movement';
import { G } from '../src/core/state';
import { hexKey } from '../src/core/hex';
import type { GameMap, Tile, TerrainId } from '../src/core/types';
import { asFactionIdx } from '../src/core/types';

function makeTile(q: number, r: number, terrain: TerrainId): Tile {
  return {
    q,
    r,
    terrain,
    resource: null,
    improvement: null,
    owner: null,
    cityId: null,
    unitId: null,
    visibility: {},
  };
}

// 5×5 strip-map test fixture.
//   row r=0: WATER WATER WATER WATER WATER
//   row r=1: WATER PLAINS PLAINS PLAINS WATER
//   row r=2: WATER PLAINS PLAINS PLAINS WATER
//   row r=3: WATER PLAINS PLAINS PLAINS WATER
//   row r=4: WATER WATER WATER WATER WATER
//
// Coordinates use offset → axial as in mapgen. We build with raw axial q/r
// since computeMoveTargets only cares about hexNeighbors(q,r).
function buildStripMap(): GameMap {
  const tiles = new Map<string, Tile>();
  for (let r = 0; r < 5; r++) {
    for (let q = 0; q < 5; q++) {
      const isWaterRing = q === 0 || q === 4 || r === 0 || r === 4;
      const terrain: TerrainId = isWaterRing ? 'WATER' : 'PLAINS';
      tiles.set(hexKey(q, r), makeTile(q, r, terrain));
    }
  }
  return { w: 5, h: 5, tiles };
}

describe('naval movement', () => {
  let prevMap: GameMap | null;
  let prevUnits: typeof G.units;
  let prevNextId: number;

  beforeEach(() => {
    prevMap = G.map;
    prevUnits = G.units;
    prevNextId = G.nextUnitId;
    G.map = buildStripMap();
    G.units = [];
    G.nextUnitId = 1;
  });

  afterEach(() => {
    G.map = prevMap;
    G.units = prevUnits;
    G.nextUnitId = prevNextId;
  });

  it('naval unit can step into water and not into land', () => {
    const f = asFactionIdx(0);
    // Place STEAMSHIP on a water tile (q=2, r=0).
    const ship = createUnit('STEAMSHIP', f, 2, 0);
    const targets = computeMoveTargets(ship);
    const set = new Set(targets.map((t) => `${t.q},${t.r}`));
    // STEAMSHIP has mp=3, cost-per-water=1; should reach all 24 water tiles
    // within 3 hops along the ring.
    // Adjacent water hexes (1,0) and (3,0) must be present.
    expect(set.has('1,0')).toBe(true);
    expect(set.has('3,0')).toBe(true);
    // No PLAINS tile (interior) should ever be reachable.
    for (const t of targets) {
      const tile = G.map!.tiles.get(`${t.q},${t.r}`);
      expect(tile?.terrain).toBe('WATER');
    }
  });

  it('land unit cannot enter water (regression)', () => {
    const f = asFactionIdx(0);
    // Place COGMAN on an interior plains tile.
    const cog = createUnit('COGMAN', f, 2, 2);
    const targets = computeMoveTargets(cog);
    for (const t of targets) {
      const tile = G.map!.tiles.get(`${t.q},${t.r}`);
      expect(tile?.terrain).not.toBe('WATER');
    }
  });

  it('naval moveCost is 1 per water hex regardless of terrain.moveCost', () => {
    const f = asFactionIdx(0);
    // STEAMSHIP at (2,0). Adjacent water (1,0) cost should be exactly 1
    // even though TERRAIN_TYPES.WATER.moveCost is 99.
    const ship = createUnit('STEAMSHIP', f, 2, 0);
    const targets = computeMoveTargets(ship);
    const adj = targets.find((t) => t.q === 1 && t.r === 0);
    expect(adj?.cost).toBe(1);
  });
});
