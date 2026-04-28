// Phase 2g-1 invariants: culture is plumbed into types, yields, and saves
// without changing any pre-existing behavior. The tile-claim system, victory
// check, and AI scoring land in later 2g sub-commits — those tests live
// alongside this file as the system fills in.

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { G } from '../src/core/state';
import {
  loadGameState,
  SAVE_VERSION,
  serializeGameState,
  type SaveData,
} from '../src/core/save';
import { cityYields, createCity } from '../src/systems/city';
import { generateMap } from '../src/systems/mapgen';
import { createSeededRng } from '../src/core/rng';
import { FACTIONS } from '../src/data/factions';
import { PERSONALITIES } from '../src/data/personalities';
import type { Faction, FactionIdx } from '../src/core/types';

function makeFaction(idx: number, isAI: boolean): Faction {
  const tpl = FACTIONS[idx];
  return {
    idx: idx as FactionIdx,
    id: tpl.id,
    name: tpl.name,
    color: tpl.color,
    glyph: tpl.glyph,
    personality: tpl.personality,
    desc: tpl.desc,
    isAI,
    alive: true,
    resources: { gold: 50, aether: 0 },
    science: 0,
    researchProgress: 0,
    techs: new Set(tpl.startTechs),
    currentResearch: null,
    score: 0,
    diplo: {},
  };
}

function buildSmallScenario(): void {
  G.map = generateMap('small', createSeededRng(123));
  G.factions = [makeFaction(0, false)];
  G.units = [];
  G.cities = [];
  G.events = [];
  G.aiMemory = {};
  G.gameOver = false;
  G.turn = 1;
  G.nextUnitId = 1;
  G.nextCityId = 1;
  G.currentFactionIdx = 0 as FactionIdx;
  G.playerFactionIdx = 0 as FactionIdx;
  G.difficulty = 'medium';
  G.cameraX = 0;
  G.cameraY = 0;
  G.zoom = 1;
  G.goldHegemonyCounter = {};
  G.goldHegemonyThreshold = 5000;
  G.goldHegemonyRequired = 3;
  G.culturalHegemonyCounter = {};
  G.culturalHegemonyThreshold = 0.4;
  G.culturalHegemonyRequired = 5;
  G.culturalHegemonyEnabled = true;
}

function clearGameState(): void {
  G.map = null;
  G.factions = [];
  G.units = [];
  G.cities = [];
  G.events = [];
  G.aiMemory = {};
  G.goldHegemonyCounter = {};
  G.culturalHegemonyCounter = {};
}

describe('Phase 2g-1: culture types and save migration', () => {
  beforeEach(() => clearGameState());
  afterEach(() => clearGameState());

  it('cityYields returns culture: 0 for a city with no culture-yielding buildings', () => {
    buildSmallScenario();
    // Pick a tile in the populated map for a synthetic city. mapgen places
    // tiles around (0, 0); use the first walkable one we find.
    const tile = [...G.map!.tiles.values()].find((t) => t.q === 0 && t.r === 0);
    expect(tile).toBeDefined();
    const c = createCity(0 as FactionIdx, tile!.q, tile!.r, 'Test City');
    const y = cityYields(c);
    expect(y.culture).toBe(0);
    // And every other yield key is still present (no field went missing).
    expect(typeof y.food).toBe('number');
    expect(typeof y.prod).toBe('number');
    expect(typeof y.gold).toBe('number');
    expect(typeof y.sci).toBe('number');
    expect(typeof y.aether).toBe('number');
  });

  it('every personality has a culture dim in [0, 1]', () => {
    for (const [id, p] of Object.entries(PERSONALITIES)) {
      const pp = p as unknown as { culture?: number };
      expect(typeof pp.culture, `${id} culture is a number`).toBe('number');
      expect(pp.culture!).toBeGreaterThanOrEqual(0);
      expect(pp.culture!).toBeLessThanOrEqual(1);
    }
  });

  it('round-trips a v3 save preserving cultural hegemony fields', () => {
    buildSmallScenario();
    G.culturalHegemonyCounter = { 0: 2 };
    G.culturalHegemonyThreshold = 0.42;
    G.culturalHegemonyRequired = 7;
    G.culturalHegemonyEnabled = false;

    const data = serializeGameState();
    expect(data.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBe(3);

    // Round-trip through JSON to simulate localStorage.
    const json = JSON.stringify(data);
    const parsed = JSON.parse(json) as SaveData;

    clearGameState();
    loadGameState(parsed);

    expect(G.culturalHegemonyCounter[0]).toBe(2);
    expect(G.culturalHegemonyThreshold).toBe(0.42);
    expect(G.culturalHegemonyRequired).toBe(7);
    expect(G.culturalHegemonyEnabled).toBe(false);
  });

  it('migrates a v2 save (no cultural fields) to v3 defaults', () => {
    buildSmallScenario();
    const data = serializeGameState();
    // Strip the v3 cultural fields and downgrade the version stamp to
    // simulate a save written before 2g-1 landed.
    data.version = 2;
    delete (data.state as { culturalHegemonyThreshold?: number })
      .culturalHegemonyThreshold;
    delete (data.state as { culturalHegemonyRequired?: number })
      .culturalHegemonyRequired;
    delete (data.state as { culturalHegemonyCounter?: unknown })
      .culturalHegemonyCounter;
    delete (data.state as { culturalHegemonyEnabled?: boolean })
      .culturalHegemonyEnabled;

    const round = JSON.parse(JSON.stringify(data)) as SaveData;
    clearGameState();
    loadGameState(round);

    // Defaults should land cleanly.
    expect(G.culturalHegemonyThreshold).toBe(0.4);
    expect(G.culturalHegemonyRequired).toBe(5);
    expect(G.culturalHegemonyEnabled).toBe(true);
    expect(G.culturalHegemonyCounter).toEqual({});
  });
});
