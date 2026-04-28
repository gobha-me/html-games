import { describe, expect, it } from 'vitest';
import { generateMap, findFactionStarts, isCoast } from '../src/systems/mapgen';
import { createSeededRng } from '../src/core/rng';
import { G } from '../src/core/state';
import { TERRAIN_TYPES } from '../src/data/terrain';

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
});
