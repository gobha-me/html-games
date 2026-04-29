// Phase 2n-2: pure-function threat-range tests. Asserts the set of
// threatened hexes the overlay renders given a small map + a few enemies.
// No DOM, no rendering — covers the filter rules (atk-0 skip, fog skip,
// off-map neighbor filter) and the union-of-neighbors set semantics.

import { describe, expect, it, beforeEach } from 'vitest';
import { G } from '../src/core/state';
import { hexKey } from '../src/core/hex';
import { computeThreatRange } from '../src/systems/threat';
import type { FactionIdx, Unit, UnitTypeId } from '../src/core/types';

function buildPlainsMap(half = 3): void {
  G.map = {
    w: half * 2 + 1,
    h: half * 2 + 1,
    tiles: new Map(),
  };
  for (let q = -half; q <= half; q++) {
    for (let r = -half; r <= half; r++) {
      G.map.tiles.set(hexKey(q, r), {
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
}

function paintAllVisible(viewer: FactionIdx): void {
  if (!G.map) throw new Error('map not built');
  for (const t of G.map.tiles.values()) {
    t.visibility[viewer] = 'visible';
  }
}

function makeUnit(
  id: number,
  factionIdx: number,
  q: number,
  r: number,
  typeId: UnitTypeId
): Unit {
  return {
    id,
    typeId,
    factionIdx: factionIdx as FactionIdx,
    q,
    r,
    hp: 25,
    maxHp: 25,
    mp: 2,
    maxMp: 2,
    fortified: false,
  };
}

const VIEWER = 0 as FactionIdx;

describe('computeThreatRange', () => {
  beforeEach(() => {
    G.map = null;
    G.units = [];
    G.cities = [];
    G.playerFactionIdx = VIEWER;
  });

  it('returns the six neighbors of a single visible enemy COGMAN', () => {
    buildPlainsMap(3);
    paintAllVisible(VIEWER);
    G.units = [makeUnit(1, 1, 0, 0, 'COGMAN')];
    const tiles = computeThreatRange(VIEWER);
    const expected = [
      hexKey(1, 0),
      hexKey(1, -1),
      hexKey(0, -1),
      hexKey(-1, 0),
      hexKey(-1, 1),
      hexKey(0, 1),
    ];
    expect(tiles.sort()).toEqual(expected.sort());
  });

  it('unions neighbors of two adjacent enemies (dedup, ≤ 11 keys)', () => {
    buildPlainsMap(3);
    paintAllVisible(VIEWER);
    G.units = [
      makeUnit(1, 1, 0, 0, 'COGMAN'),
      makeUnit(2, 1, 1, 0, 'COGMAN'),
    ];
    const tiles = computeThreatRange(VIEWER);
    const set = new Set(tiles);
    expect(set.size).toBe(tiles.length);
    expect(tiles.length).toBeLessThanOrEqual(11);
    expect(tiles.length).toBeGreaterThan(6);
  });

  it('excludes atk-0 units (workers / pioneers)', () => {
    buildPlainsMap(3);
    paintAllVisible(VIEWER);
    G.units = [
      makeUnit(1, 1, 0, 0, 'WORKER'),
      makeUnit(2, 1, 2, 0, 'PIONEER'),
    ];
    expect(computeThreatRange(VIEWER)).toEqual([]);
  });

  it('excludes enemies on tiles the viewer cannot see (fog gate)', () => {
    buildPlainsMap(3);
    // Only paint the immediate neighborhood of (3, 0) NOT visible to viewer.
    if (!G.map) throw new Error('map not built');
    for (const t of G.map.tiles.values()) {
      t.visibility[VIEWER] = 'unseen';
    }
    G.units = [makeUnit(1, 1, 3, 0, 'COGMAN')];
    expect(computeThreatRange(VIEWER)).toEqual([]);
  });

  it('filters off-map neighbors at the edge of the map', () => {
    buildPlainsMap(2);
    paintAllVisible(VIEWER);
    // Place a COGMAN at the corner (2, 0); some of its 6 neighbors fall
    // off the 5x5 axial cluster and must be filtered out.
    G.units = [makeUnit(1, 1, 2, 0, 'COGMAN')];
    const tiles = computeThreatRange(VIEWER);
    for (const k of tiles) {
      expect(G.map!.tiles.has(k)).toBe(true);
    }
    expect(tiles.length).toBeLessThan(6);
  });
});
