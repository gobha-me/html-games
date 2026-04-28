import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeMoveTargets, createUnit } from '../src/systems/movement';
import { createCity, processCity } from '../src/systems/city';
import { aiPickBuild } from '../src/ai/cityAI';
import { G } from '../src/core/state';
import { hexKey } from '../src/core/hex';
import { createSeededRng } from '../src/core/rng';
import type { Faction, FactionIdx, GameMap, Tile, TerrainId } from '../src/core/types';
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
    G.cities = [];
    G.factions = [];
    G.nextUnitId = 1;
    G.nextCityId = 1;
    G.turn = 1;
    G.playerFactionIdx = asFactionIdx(0);
    G.currentFactionIdx = asFactionIdx(0);
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

function makeFaction(idx: number): Faction {
  return {
    idx: idx as FactionIdx,
    id: 'cogwright',
    name: `F${idx}`,
    color: '#fff',
    glyph: 'X',
    personality: 'industrial',
    desc: '',
    isAI: idx > 0,
    alive: true,
    resources: { gold: 0, aether: 0 },
    science: 0,
    researchProgress: 0,
    techs: new Set(),
    currentResearch: null,
    score: 0,
    diplo: {},
  };
}

describe('naval production', () => {
  let prevMap: GameMap | null;

  beforeEach(() => {
    prevMap = G.map;
    G.map = buildStripMap();
    G.units = [];
    G.cities = [];
    G.factions = [makeFaction(0)];
    G.nextUnitId = 1;
    G.nextCityId = 1;
    G.turn = 1;
    G.playerFactionIdx = asFactionIdx(0);
    G.currentFactionIdx = asFactionIdx(0);
    G.aiMemory = {};
    G.events = [];
  });

  afterEach(() => {
    G.map = prevMap;
  });

  it('processCity spawns a naval unit on a free WATER neighbor', () => {
    // City at (1,1) — interior plains, has WATER neighbors at (0,1), (1,0), etc.
    const city = createCity(asFactionIdx(0), 1, 1, 'Foundry');
    city.buildQueue = { kind: 'unit', id: 'STEAMSHIP' };
    city.productionStored = 35;
    processCity(city);
    expect(G.units.length).toBe(1);
    const ship = G.units[0];
    expect(ship.typeId).toBe('STEAMSHIP');
    const tile = G.map!.tiles.get(hexKey(ship.q, ship.r));
    expect(tile?.terrain).toBe('WATER');
  });

  it('processCity defers naval spawn (refunds production) when no water neighbor is free', () => {
    // City at (2,2) — fully surrounded by PLAINS (no WATER neighbor).
    const city = createCity(asFactionIdx(0), 2, 2, 'Inland');
    city.buildQueue = { kind: 'unit', id: 'STEAMSHIP' };
    const before = 35;
    city.productionStored = before;
    processCity(city);
    // No unit spawned; queue retained for retry; production NOT consumed
    // (refund matches what would have been deducted, modulo this turn's yield).
    expect(G.units.length).toBe(0);
    expect(city.buildQueue).toEqual({ kind: 'unit', id: 'STEAMSHIP' });
    // Production should be at least `before` — the refund canceled the deduct.
    expect(city.productionStored).toBeGreaterThanOrEqual(before);
  });

  it('aiPickBuild never offers naval for a fully inland city', () => {
    const fac = G.factions[0];
    const city = createCity(asFactionIdx(0), 2, 2, 'Inland');
    const rng = createSeededRng(7);
    for (let i = 0; i < 50; i++) {
      const pick = aiPickBuild(fac, city, rng);
      if (pick && pick.kind === 'unit') {
        expect(['STEAMSHIP', 'IRONCLAD', 'AETHER_FRIGATE']).not.toContain(pick.id);
      }
    }
  });
});
