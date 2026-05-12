import { describe, expect, it } from 'vitest';
import { hexKey } from '../src/core/hex';
import { createSeededRng } from '../src/core/rng';
import {
  getScenario,
  resolveScenarioStarts,
  SCENARIOS,
  type ScenarioDef,
} from '../src/data/scenarios';
import { generateMap } from '../src/systems/mapgen';
import type { FactionIdx, GameMap, Tile } from '../src/core/types';

const EXPECTED_SCENARIO_COUNT = 3;

function tile(q: number, r: number, terrain: Tile['terrain']): Tile {
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

function makeMap(tiles: Tile[]): GameMap {
  const m: GameMap = { w: 4, h: 4, tiles: new Map() };
  for (const t of tiles) m.tiles.set(hexKey(t.q, t.r), t);
  return m;
}

const SAMPLE_SCENARIO: ScenarioDef = {
  id: 'sample',
  name: 'Sample',
  description: 'Two-faction test fixture.',
  prologue: 'A short prologue for the test fixture.',
  factions: [
    { idx: 0 as FactionIdx, startQ: 1, startR: 1 },
    { idx: 2 as FactionIdx, startQ: 3, startR: 0 },
  ],
};

describe('scenarios', () => {
  it('ships the expected number of scenarios for S8', () => {
    expect(SCENARIOS).toHaveLength(EXPECTED_SCENARIO_COUNT);
  });

  it('every shipped scenario has unique id, non-empty roster, pinned seed, and a real prologue', () => {
    const seenIds = new Set<string>();
    for (const s of SCENARIOS) {
      expect(seenIds.has(s.id), `duplicate id: ${s.id}`).toBe(false);
      seenIds.add(s.id);
      expect(s.factions.length, `${s.id} has no factions`).toBeGreaterThan(0);
      expect(typeof s.seed, `${s.id} missing pinned seed`).toBe('number');
      // Voice floor — anything shorter than ~80 chars is almost certainly
      // placeholder copy, not a steampunk-literary prologue.
      expect(s.prologue.length, `${s.id} prologue too short`).toBeGreaterThanOrEqual(80);
    }
  });

  it('every shipped scenario resolves starts to walkable tiles on its pinned seed', () => {
    for (const s of SCENARIOS) {
      const size = s.mapGenOverrides?.mapSize ?? 'medium';
      const rng = createSeededRng(s.seed!);
      const map = generateMap(size, rng, s.mapGenOverrides);
      expect(
        () => resolveScenarioStarts(s, map),
        `${s.id} starts failed validation`
      ).not.toThrow();
    }
  });

  it('getScenario returns null for null/undefined/empty/unknown ids', () => {
    expect(getScenario(null)).toBeNull();
    expect(getScenario(undefined)).toBeNull();
    expect(getScenario('')).toBeNull();
    expect(getScenario('does-not-exist')).toBeNull();
  });

  it('resolveScenarioStarts returns tiles in scenario.factions order', () => {
    const map = makeMap([
      tile(1, 1, 'PLAINS'),
      tile(3, 0, 'HILLS'),
      tile(0, 0, 'PLAINS'),
    ]);
    const starts = resolveScenarioStarts(SAMPLE_SCENARIO, map);
    expect(starts).toHaveLength(2);
    expect(starts[0].q).toBe(1);
    expect(starts[0].r).toBe(1);
    expect(starts[1].q).toBe(3);
    expect(starts[1].r).toBe(0);
  });

  it('resolveScenarioStarts throws when a coord is off-map', () => {
    const map = makeMap([tile(1, 1, 'PLAINS')]);
    expect(() => resolveScenarioStarts(SAMPLE_SCENARIO, map)).toThrow(/off-map/);
  });

  it('resolveScenarioStarts throws when a coord lands on unwalkable terrain', () => {
    const map = makeMap([
      tile(1, 1, 'PLAINS'),
      tile(3, 0, 'WATER'), // unwalkable
    ]);
    expect(() => resolveScenarioStarts(SAMPLE_SCENARIO, map)).toThrow(/unwalkable/);
  });

  describe('Coastal Conquest', () => {
    const scenario = SCENARIOS.find((s) => s.id === 'coastal_conquest');

    it('seats four distinct factions and pins a continents-water map', () => {
      expect(scenario).toBeDefined();
      const idxs = scenario!.factions.map((f) => f.idx);
      expect(new Set(idxs).size).toBe(4);
      expect(scenario!.mapGenOverrides?.waterLevel).toBe('continents');
    });

    it('every capital sits next to at least one water tile (so the naval framing reads)', () => {
      const size = scenario!.mapGenOverrides?.mapSize ?? 'medium';
      const rng = createSeededRng(scenario!.seed!);
      const map = generateMap(size, rng, scenario!.mapGenOverrides);
      for (const s of scenario!.factions) {
        const neighbors = [
          [s.startQ + 1, s.startR],
          [s.startQ - 1, s.startR],
          [s.startQ, s.startR + 1],
          [s.startQ, s.startR - 1],
          [s.startQ + 1, s.startR - 1],
          [s.startQ - 1, s.startR + 1],
        ];
        const waterCount = neighbors.filter(([q, r]) => {
          const t = map.tiles.get(hexKey(q, r));
          return t && t.terrain === 'WATER';
        }).length;
        expect(
          waterCount,
          `idx ${s.idx} at (${s.startQ},${s.startR}) has no water neighbor`
        ).toBeGreaterThan(0);
      }
    });
  });

  describe('Steamguild Civil War', () => {
    const scenario = SCENARIOS.find((s) => s.id === 'steamguild_civil_war');

    it('seats exactly two Cogwright (idx 0) entries', () => {
      expect(scenario).toBeDefined();
      const cogwrights = scenario!.factions.filter((f) => f.idx === 0);
      expect(cogwrights).toHaveLength(2);
    });

    it('skins the second Cogwright with override fields', () => {
      const second = scenario!.factions[1];
      expect(second.nameOverride).toBeTruthy();
      expect(second.colorOverride).toBeTruthy();
      expect(second.glyphOverride).toBeTruthy();
    });

    it('keeps the first Cogwright as-is (no overrides) so the default skin still ships', () => {
      const first = scenario!.factions[0];
      expect(first.nameOverride).toBeUndefined();
      expect(first.colorOverride).toBeUndefined();
      expect(first.glyphOverride).toBeUndefined();
    });
  });
});
