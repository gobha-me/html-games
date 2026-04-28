import { describe, expect, it } from 'vitest';
import { generateMap, findFactionStarts, isCoast } from '../src/systems/mapgen';
import { createSeededRng } from '../src/core/rng';
import { G } from '../src/core/state';
import { TERRAIN_TYPES } from '../src/data/terrain';
import { RESOURCES } from '../src/data/resources';
import { HEX_DIRS } from '../src/core/hex';

describe('mapgen', () => {
  describe('generateMap', () => {
    it('produces the expected dimensions for each map size', () => {
      const small = generateMap('small', createSeededRng(1));
      expect(small.w).toBe(20);
      expect(small.h).toBe(14);
      expect(small.tiles.size).toBe(20 * 14);

      const medium = generateMap('medium', createSeededRng(1));
      expect(medium.w).toBe(30);
      expect(medium.h).toBe(20);
      expect(medium.tiles.size).toBe(30 * 20);

      const large = generateMap('large', createSeededRng(1));
      expect(large.w).toBe(42);
      expect(large.h).toBe(28);
      expect(large.tiles.size).toBe(42 * 28);
    });

    it('produces deterministic output for a given seed', () => {
      const a = generateMap('medium', createSeededRng(42));
      const b = generateMap('medium', createSeededRng(42));
      expect(a.w).toBe(b.w);
      expect(a.h).toBe(b.h);
      const aTerrain: string[] = [];
      const bTerrain: string[] = [];
      for (const t of a.tiles.values()) aTerrain.push(`${t.q},${t.r},${t.terrain}`);
      for (const t of b.tiles.values()) bTerrain.push(`${t.q},${t.r},${t.terrain}`);
      expect(aTerrain).toEqual(bTerrain);
    });

    it('produces different output for different seeds', () => {
      const a = generateMap('medium', createSeededRng(1));
      const b = generateMap('medium', createSeededRng(2));
      let diffs = 0;
      for (const ta of a.tiles.values()) {
        const tb = b.tiles.get(`${ta.q},${ta.r}`);
        if (tb && tb.terrain !== ta.terrain) diffs++;
      }
      expect(diffs).toBeGreaterThan(20);
    });

    it('stamps a hard border on every edge tile (mountain/wastes, possibly overwritten by ruin/aether)', () => {
      // The prototype's border step writes MOUNTAINS or WASTES; the ruin/
      // aether placement step then samples from PLAINS/HILLS/WASTES tiles,
      // so a border WASTES can later flip to RUINS or AETHER.
      const m = generateMap('medium', createSeededRng(7));
      for (const t of m.tiles.values()) {
        const offCol = t.q + Math.floor(t.r / 2);
        const onEdge = offCol <= 0 || offCol >= m.w - 1 || t.r <= 0 || t.r >= m.h - 1;
        if (onEdge) {
          expect(['MOUNTAINS', 'WASTES', 'RUINS', 'AETHER']).toContain(t.terrain);
        }
      }
    });

    it('places ruins and aether vents at roughly the expected fraction', () => {
      const m = generateMap('large', createSeededRng(99));
      let ruins = 0;
      let aether = 0;
      for (const t of m.tiles.values()) {
        if (t.terrain === 'RUINS') ruins++;
        if (t.terrain === 'AETHER') aether++;
      }
      expect(ruins).toBeGreaterThan(0);
      expect(aether).toBeGreaterThan(0);
      // Floor(tiles.size * 0.025) for ruins, * 0.018 for aether — exact.
      expect(ruins).toBe(Math.floor(m.tiles.size * 0.025));
      expect(aether).toBe(Math.floor(m.tiles.size * 0.018));
    });
  });

  describe('findFactionStarts', () => {
    it('returns the requested number of walkable starts spread apart', () => {
      G.map = generateMap('medium', createSeededRng(123));
      const starts = findFactionStarts(4, createSeededRng(123));
      expect(starts).toHaveLength(4);
      for (const s of starts) {
        expect(TERRAIN_TYPES[s.terrain].walkable).toBe(true);
      }
      G.map = null;
    });

    it('never returns water, ruin, or aether starts (2c-4)', () => {
      G.map = generateMap('medium', createSeededRng(42));
      const starts = findFactionStarts(4, createSeededRng(42));
      for (const s of starts) {
        expect(s.terrain).not.toBe('WATER');
        expect(s.terrain).not.toBe('RUINS');
        expect(s.terrain).not.toBe('AETHER');
      }
      G.map = null;
    });

    it('respects the minimum distance gate between starts (2c-4)', () => {
      G.map = generateMap('medium', createSeededRng(42));
      const starts = findFactionStarts(4, createSeededRng(42));
      // Spacing floor matches MIN_FACTION_SPACING_FLOOR in mapgen.ts.
      const minDist = 6;
      for (let i = 0; i < starts.length; i++) {
        for (let j = i + 1; j < starts.length; j++) {
          const d =
            (Math.abs(starts[i].q - starts[j].q) +
              Math.abs(starts[i].q + starts[i].r - starts[j].q - starts[j].r) +
              Math.abs(starts[i].r - starts[j].r)) /
            2;
          expect(d).toBeGreaterThanOrEqual(minDist);
        }
      }
      G.map = null;
    });

    it('produces deterministic starts for a given map + seed (2c-4)', () => {
      G.map = generateMap('medium', createSeededRng(123));
      const a = findFactionStarts(4, createSeededRng(7));
      const b = findFactionStarts(4, createSeededRng(7));
      expect(a.map((t) => `${t.q},${t.r}`)).toEqual(b.map((t) => `${t.q},${t.r}`));
      G.map = null;
    });

    it('smart starts cluster near resources more than random walkable (2c-4)', () => {
      let smartResNearby = 0;
      let randomResNearby = 0;
      const trials = 10;
      for (let seed = 1; seed <= trials; seed++) {
        G.map = generateMap('medium', createSeededRng(seed));
        const map = G.map;
        const smart = findFactionStarts(4, createSeededRng(seed));
        for (const s of smart) {
          for (const t of map.tiles.values()) {
            const d =
              (Math.abs(s.q - t.q) +
                Math.abs(s.q + s.r - t.q - t.r) +
                Math.abs(s.r - t.r)) /
              2;
            if (d <= 2 && t.resource) smartResNearby++;
          }
        }
        // Random sampling: 4 walkable land tiles per seed.
        const walkable = [...map.tiles.values()].filter((t) => {
          const tt = TERRAIN_TYPES[t.terrain];
          return tt.walkable && !('isAether' in tt) && !('isRuin' in tt);
        });
        const rng = createSeededRng(seed + 9000);
        for (let p = 0; p < 4; p++) {
          const s = walkable[Math.floor(rng() * walkable.length)];
          for (const t of map.tiles.values()) {
            const d =
              (Math.abs(s.q - t.q) +
                Math.abs(s.q + s.r - t.q - t.r) +
                Math.abs(s.r - t.r)) /
              2;
            if (d <= 2 && t.resource) randomResNearby++;
          }
        }
        G.map = null;
      }
      expect(smartResNearby).toBeGreaterThan(randomResNearby);
    });
  });

  describe('water + coasts (2c-1)', () => {
    it('places water on the lowest elevation band and never on the border', () => {
      const m = generateMap('medium', createSeededRng(42));
      let waterCount = 0;
      for (const t of m.tiles.values()) {
        if (t.terrain === 'WATER') waterCount++;
        const offCol = t.q + Math.floor(t.r / 2);
        const onEdge = offCol <= 0 || offCol >= m.w - 1 || t.r <= 0 || t.r >= m.h - 1;
        if (onEdge) expect(t.terrain).not.toBe('WATER');
      }
      expect(waterCount).toBeGreaterThan(0);
    });

    it('produces deterministic water placement for a given seed', () => {
      const a = generateMap('medium', createSeededRng(7));
      const b = generateMap('medium', createSeededRng(7));
      const aWater = [...a.tiles.values()]
        .filter((t) => t.terrain === 'WATER')
        .map((t) => `${t.q},${t.r}`);
      const bWater = [...b.tiles.values()]
        .filter((t) => t.terrain === 'WATER')
        .map((t) => `${t.q},${t.r}`);
      expect(aWater).toEqual(bWater);
      expect(aWater.length).toBeGreaterThan(0);
    });

    it('water count grows with map size', () => {
      const small = generateMap('small', createSeededRng(42));
      const large = generateMap('large', createSeededRng(42));
      const smallWater = [...small.tiles.values()].filter((t) => t.terrain === 'WATER').length;
      const largeWater = [...large.tiles.values()].filter((t) => t.terrain === 'WATER').length;
      expect(largeWater).toBeGreaterThan(smallWater);
    });

    it('isCoast detects land tiles adjacent to water and excludes water itself', () => {
      const m = generateMap('medium', createSeededRng(42));
      let coastCount = 0;
      let waterCoast = 0;
      for (const t of m.tiles.values()) {
        if (isCoast(t, m)) coastCount++;
        if (t.terrain === 'WATER' && isCoast(t, m)) waterCoast++;
      }
      expect(coastCount).toBeGreaterThan(0);
      expect(waterCoast).toBe(0);
    });
  });

  describe('rivers (2c-2)', () => {
    it('places at least one river segment on a medium map', () => {
      const m = generateMap('medium', createSeededRng(42));
      let withRiver = 0;
      for (const t of m.tiles.values()) {
        if (t.riverEdges) withRiver++;
      }
      expect(withRiver).toBeGreaterThan(0);
    });

    it('produces deterministic rivers for a given seed', () => {
      const a = generateMap('medium', createSeededRng(7));
      const b = generateMap('medium', createSeededRng(7));
      for (const ta of a.tiles.values()) {
        const tb = b.tiles.get(`${ta.q},${ta.r}`)!;
        expect(tb.riverEdges ?? 0).toBe(ta.riverEdges ?? 0);
      }
    });

    it('never sets a river edge that points into a mountain', () => {
      const m = generateMap('medium', createSeededRng(42));
      for (const tile of m.tiles.values()) {
        if (!tile.riverEdges) continue;
        for (let d = 0; d < 6; d++) {
          if (!(tile.riverEdges & (1 << d))) continue;
          const dir = HEX_DIRS[d];
          const neighbor = m.tiles.get(`${tile.q + dir.q},${tile.r + dir.r}`);
          if (neighbor) expect(neighbor.terrain).not.toBe('MOUNTAINS');
        }
      }
    });

    it('river edges are mutual — both tiles agree on the shared edge', () => {
      const m = generateMap('large', createSeededRng(99));
      for (const tile of m.tiles.values()) {
        if (!tile.riverEdges) continue;
        for (let d = 0; d < 6; d++) {
          if (!(tile.riverEdges & (1 << d))) continue;
          const dir = HEX_DIRS[d];
          const neighbor = m.tiles.get(`${tile.q + dir.q},${tile.r + dir.r}`);
          if (!neighbor) continue;
          const oppBit = 1 << ((d + 3) % 6);
          expect((neighbor.riverEdges ?? 0) & oppBit).not.toBe(0);
        }
      }
    });
  });

  describe('resources (2c-3)', () => {
    it('places resources only on each resource\'s allowed terrain', () => {
      const m = generateMap('large', createSeededRng(42));
      let total = 0;
      for (const t of m.tiles.values()) {
        if (!t.resource) continue;
        total++;
        const def = (RESOURCES as Record<string, { allowedTerrains: readonly string[] }>)[
          t.resource
        ];
        expect(def).toBeDefined();
        expect(def.allowedTerrains).toContain(t.terrain);
      }
      expect(total).toBeGreaterThan(0);
    });

    it('produces deterministic resource placement for a given seed', () => {
      const a = generateMap('medium', createSeededRng(7));
      const b = generateMap('medium', createSeededRng(7));
      for (const ta of a.tiles.values()) {
        const tb = b.tiles.get(`${ta.q},${ta.r}`)!;
        expect(tb.resource).toBe(ta.resource);
      }
    });

    it('resource counts grow with map size', () => {
      const small = generateMap('small', createSeededRng(42));
      const large = generateMap('large', createSeededRng(42));
      const smallRes = [...small.tiles.values()].filter((t) => t.resource).length;
      const largeRes = [...large.tiles.values()].filter((t) => t.resource).length;
      expect(largeRes).toBeGreaterThan(smallRes);
    });

    it('does not place resources on RUINS or AETHER', () => {
      const m = generateMap('large', createSeededRng(42));
      for (const t of m.tiles.values()) {
        if (t.terrain === 'RUINS' || t.terrain === 'AETHER') {
          expect(t.resource).toBeNull();
        }
      }
    });
  });

  describe('mapgen options (2c-5)', () => {
    it('waterLevel="none" produces no water tiles', () => {
      const m = generateMap('medium', createSeededRng(42), { waterLevel: 'none' });
      for (const t of m.tiles.values()) {
        expect(t.terrain).not.toBe('WATER');
      }
    });

    it('waterLevel="continents" produces more water than "coasts"', () => {
      const coasts = generateMap('medium', createSeededRng(42), { waterLevel: 'coasts' });
      const continents = generateMap('medium', createSeededRng(42), {
        waterLevel: 'continents',
      });
      const coastsWater = [...coasts.tiles.values()].filter((t) => t.terrain === 'WATER').length;
      const continentsWater = [...continents.tiles.values()].filter(
        (t) => t.terrain === 'WATER',
      ).length;
      expect(continentsWater).toBeGreaterThan(coastsWater);
    });

    it('resourceDensity="lush" places more resources than "sparse"', () => {
      const sparse = generateMap('medium', createSeededRng(42), {
        resourceDensity: 'sparse',
      });
      const lush = generateMap('medium', createSeededRng(42), { resourceDensity: 'lush' });
      const sparseRes = [...sparse.tiles.values()].filter((t) => t.resource).length;
      const lushRes = [...lush.tiles.values()].filter((t) => t.resource).length;
      expect(lushRes).toBeGreaterThan(sparseRes);
    });

    it('defaults reproduce the no-opts output (byte-equivalent)', () => {
      const noOpts = generateMap('medium', createSeededRng(7));
      const defaultOpts = generateMap('medium', createSeededRng(7), {
        waterLevel: 'coasts',
        resourceDensity: 'standard',
      });
      for (const ta of noOpts.tiles.values()) {
        const tb = defaultOpts.tiles.get(`${ta.q},${ta.r}`)!;
        expect(tb.terrain).toBe(ta.terrain);
        expect(tb.resource).toBe(ta.resource);
        expect(tb.riverEdges ?? 0).toBe(ta.riverEdges ?? 0);
      }
    });
  });
});
