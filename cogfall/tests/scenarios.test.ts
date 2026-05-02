import { describe, expect, it } from 'vitest';
import { hexKey } from '../src/core/hex';
import {
  getScenario,
  resolveScenarioStarts,
  SCENARIOS,
  type ScenarioDef,
} from '../src/data/scenarios';
import type { FactionIdx, GameMap, Tile } from '../src/core/types';

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
  factions: [
    { idx: 0 as FactionIdx, startQ: 1, startR: 1 },
    { idx: 2 as FactionIdx, startQ: 3, startR: 0 },
  ],
};

describe('scenarios', () => {
  it('ships an empty registry in S3 (S8 will populate)', () => {
    expect(SCENARIOS).toEqual([]);
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
});
