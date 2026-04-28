// Phase 2h-1: fog edge-distance BFS + fogLerp invariants. Renderer-side
// concern, but the BFS itself is deterministic and easy to pin without DOM.

import { describe, expect, it, beforeEach } from 'vitest';
import { G } from '../src/core/state';
import {
  FOG_MAX_DISTANCE,
  fogLerp,
  getFogEdgeDistance,
  recomputeVisibility,
} from '../src/systems/visibility';
import { hexKey } from '../src/core/hex';
import { FACTIONS } from '../src/data/factions';
import type { Faction, FactionIdx } from '../src/core/types';

function makeFaction(idx: number): Faction {
  const tpl = FACTIONS[idx];
  return {
    idx: idx as FactionIdx,
    id: tpl.id,
    name: tpl.name,
    color: tpl.color,
    glyph: tpl.glyph,
    personality: tpl.personality,
    desc: tpl.desc,
    isAI: false,
    alive: true,
    resources: { gold: 0, aether: 0 },
    science: 0,
    researchProgress: 0,
    techs: new Set(tpl.startTechs),
    currentResearch: null,
    score: 0,
    diplo: {},
  };
}

function buildPlainsMap(half = 5): void {
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

function paintAllSeen(): void {
  if (!G.map) throw new Error('map not built');
  for (const t of G.map.tiles.values()) {
    t.visibility[G.playerFactionIdx] = 'seen';
  }
}

function placePlayerCogmanAtOrigin(): void {
  G.units = [
    {
      id: 1,
      typeId: 'COGMAN',
      factionIdx: 0 as FactionIdx,
      q: 0,
      r: 0,
      hp: 10,
      maxHp: 10,
      mp: 2,
      maxMp: 2,
      fortified: false,
    },
  ];
}

describe('fog edge-distance', () => {
  beforeEach(() => {
    G.map = null;
    G.units = [];
    G.cities = [];
    G.factions = [makeFaction(0)];
    G.playerFactionIdx = 0 as FactionIdx;
  });

  it('builds a BFS ring around a visible cluster after recomputeVisibility', () => {
    // Pre-paint everything as 'seen' so the post-recompute degrade has somewhere
    // to land. Inject a COGMAN (sight 2) at origin → tiles ≤ 2 hops are visible.
    buildPlainsMap(5);
    paintAllSeen();
    placePlayerCogmanAtOrigin();
    recomputeVisibility();

    const origin = G.map!.tiles.get(hexKey(0, 0))!;
    expect(origin.visibility[0]).toBe('visible');
    expect(getFogEdgeDistance(origin)).toBe(0);

    // Distance 3 from origin: 'seen', sits one BFS hop outside the visible
    // cluster's outer rim → edge-distance 1.
    const ring3 = G.map!.tiles.get(hexKey(3, 0))!;
    expect(ring3.visibility[0]).toBe('seen');
    expect(getFogEdgeDistance(ring3)).toBe(1);

    // Distance 5: capped at FOG_MAX_DISTANCE.
    const farTile = G.map!.tiles.get(hexKey(5, 0))!;
    expect(farTile.visibility[0]).toBe('seen');
    expect(getFogEdgeDistance(farTile)).toBe(FOG_MAX_DISTANCE);
  });

  it('fogLerp interpolates linearly between near and far, saturating at the cap', () => {
    buildPlainsMap(5);
    paintAllSeen();
    placePlayerCogmanAtOrigin();
    recomputeVisibility();

    const ring3 = G.map!.tiles.get(hexKey(3, 0))!; // edge-distance 1
    const farTile = G.map!.tiles.get(hexKey(5, 0))!; // edge-distance == cap
    expect(fogLerp(ring3, 0.2, 0.45)).toBeCloseTo(0.2 + (0.45 - 0.2) * (1 / 3), 5);
    expect(fogLerp(farTile, 0.2, 0.45)).toBeCloseTo(0.45, 5);
  });

  it('returns the cap for tiles unreachable from any visible tile', () => {
    // No units, no cities → recomputeVisibility leaves everything 'unseen' and
    // marks nothing 'visible'. BFS rebuild produces an empty cache; every
    // lookup falls through to the FOG_MAX_DISTANCE default.
    buildPlainsMap(3);
    recomputeVisibility();
    const t = G.map!.tiles.get(hexKey(0, 0))!;
    expect(getFogEdgeDistance(t)).toBe(FOG_MAX_DISTANCE);
  });
});
