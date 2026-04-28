import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AUTOSAVE_KEY,
  loadGameState,
  readSlot,
  SAVE_VERSION,
  SaveDataMismatchError,
  SaveVersionMismatchError,
  saveAuto,
  serializeGameState,
  validateSaveAgainstData,
  writeSlot,
} from '../src/core/save';
import { updateAIStrategy } from '../src/ai/strategy';
import { G } from '../src/core/state';
import { generateMap } from '../src/systems/mapgen';
import { createSeededRng } from '../src/core/rng';
import { FACTIONS } from '../src/data/factions';
import type { Faction, FactionIdx } from '../src/core/types';

// Local faction builder — avoids importing systems/setup.ts (which reaches
// into render/pixi at module-load and throws on the missing #map-canvas
// DOM element under jsdom).
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
  G.factions = [makeFaction(0, false), makeFaction(1, true)];
  G.factions[0].techs.add('rediscovery');
  G.factions[0].techs.add('metallurgy');
  G.factions[0].resources.gold = 213;
  G.factions[0].diplo[1] = 'war';
  G.factions[1].diplo[0] = 'war';
  G.units = [];
  G.cities = [];
  G.turn = 7;
  G.currentFactionIdx = 0 as FactionIdx;
  G.playerFactionIdx = 0 as FactionIdx;
  G.difficulty = 'medium';
  G.cameraX = 100;
  G.cameraY = -200;
  G.zoom = 1.5;
  G.events = [{ turn: 7, msg: 'Test event', type: 'good' }];
  G.aiMemory = {};
  G.gameOver = false;
  G.nextUnitId = 1;
  G.nextCityId = 1;
  G.goldHegemonyCounter = { 0: 1 };
  G.goldHegemonyThreshold = 5000;
  G.goldHegemonyRequired = 3;
}

function clearGameState(): void {
  G.map = null;
  G.factions = [];
  G.units = [];
  G.cities = [];
  G.events = [];
  G.aiMemory = {};
  G.goldHegemonyCounter = {};
  G.selected = null;
  G.moveTargets = [];
  G.attackTargets = [];
  G.isDragging = false;
  G.dragStart = null;
}

describe('save / load', () => {
  beforeEach(() => {
    localStorage.clear();
    clearGameState();
  });

  afterEach(() => {
    localStorage.clear();
    clearGameState();
  });

  it('round-trips a small game state with Sets and the tile Map preserved', () => {
    buildSmallScenario();
    const factionTechsBefore = new Set(G.factions[0].techs);
    const tileCountBefore = G.map!.tiles.size;
    const goldBefore = G.factions[0].resources.gold;
    const turnBefore = G.turn;
    const eventBefore = { ...G.events[0] };

    const data = serializeGameState();
    expect(data.version).toBe(SAVE_VERSION);
    expect(data.turn).toBe(turnBefore);
    expect(data.factionName).toBe(G.factions[0].name);

    // Round-trip through JSON to simulate localStorage.
    const json = JSON.stringify(data);
    const parsed = JSON.parse(json) as ReturnType<typeof serializeGameState>;

    clearGameState();
    expect(G.map).toBeNull();
    expect(G.factions).toHaveLength(0);

    loadGameState(parsed);

    expect(G.map).not.toBeNull();
    expect(G.map!.tiles.size).toBe(tileCountBefore);
    expect(G.map!.tiles).toBeInstanceOf(Map);
    expect(G.factions).toHaveLength(2);
    expect(G.factions[0].techs).toBeInstanceOf(Set);
    expect(G.factions[0].techs).toEqual(factionTechsBefore);
    expect(G.factions[0].resources.gold).toBe(goldBefore);
    expect(G.factions[0].diplo[1]).toBe('war');
    expect(G.turn).toBe(turnBefore);
    expect(G.events[0]).toEqual(eventBefore);
  });

  it('clears transient state on load', () => {
    buildSmallScenario();
    G.selected = { type: 'tile', ref: G.map!.tiles.values().next().value! };
    G.moveTargets = [{ q: 1, r: 1, cost: 1 }];
    G.isDragging = true;

    const data = serializeGameState();
    const round = JSON.parse(JSON.stringify(data)) as ReturnType<typeof serializeGameState>;
    loadGameState(round);

    expect(G.selected).toBeNull();
    expect(G.moveTargets).toEqual([]);
    expect(G.attackTargets).toEqual([]);
    expect(G.isDragging).toBe(false);
    expect(G.dragStart).toBeNull();
  });

  it('throws SaveVersionMismatchError on version mismatch', () => {
    buildSmallScenario();
    const data = serializeGameState();
    data.version = SAVE_VERSION + 1;
    expect(() => loadGameState(data)).toThrow(SaveVersionMismatchError);
  });

  it('saveAuto writes to the autosave key in localStorage', () => {
    buildSmallScenario();
    saveAuto();
    const stored = localStorage.getItem(AUTOSAVE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!) as ReturnType<typeof serializeGameState>;
    expect(parsed.version).toBe(SAVE_VERSION);
    expect(parsed.turn).toBe(G.turn);
  });

  it('readSlot returns null for a missing key', () => {
    expect(readSlot('cogfall:save:nonexistent')).toBeNull();
  });

  it('writeSlot + readSlot round-trip through localStorage', () => {
    buildSmallScenario();
    const data = serializeGameState();
    writeSlot('cogfall:save:1', data);
    const got = readSlot('cogfall:save:1');
    expect(got).not.toBeNull();
    expect(got!.turn).toBe(data.turn);
    expect(got!.factionName).toBe(data.factionName);
  });

  it('loads a v3 save (no modHash/modName) cleanly as if no mod was active', () => {
    // v3 → v4 migration smoke test: v3 saves predate the mod system, so
    // their SerializedGameState lacks modHash/modName. Loading must succeed
    // and leave G in a usable state.
    buildSmallScenario();
    const data = serializeGameState();
    data.version = 3;
    delete (data.state as { modHash?: string }).modHash;
    delete (data.state as { modName?: string }).modName;
    const round = JSON.parse(JSON.stringify(data)) as ReturnType<typeof serializeGameState>;
    expect(() => loadGameState(round)).not.toThrow();
    expect(G.factions).toHaveLength(2);
    expect(G.turn).toBe(7);
  });

  it('validateSaveAgainstData detects unknown unit / building / tech IDs', () => {
    buildSmallScenario();
    const data = serializeGameState();
    // Inject unknown ids into the serialized shape.
    data.state.units.push({
      id: 99,
      typeId: 'PHANTOM_UNIT' as never,
      factionIdx: 0 as FactionIdx,
      q: 0,
      r: 0,
      hp: 1,
      maxHp: 1,
      mp: 0,
      maxMp: 0,
      fortified: false,
    });
    data.state.cities.push({
      id: 99,
      factionIdx: 0 as FactionIdx,
      q: 0,
      r: 0,
      name: 'Ghost',
      buildings: ['phantom_building' as never],
      population: 1,
      foodStored: 0,
      foodNeeded: 10,
      productionStored: 0,
      buildQueue: null,
      isCapital: false,
      hp: 10,
      maxHp: 10,
    });
    data.state.factions[0].techs.push('phantom_tech' as never);

    const missing = validateSaveAgainstData(data.state);
    const ids = missing.map((m) => `${m.kind}:${m.id}`);
    expect(ids).toContain('unit:PHANTOM_UNIT');
    expect(ids).toContain('building:phantom_building');
    expect(ids).toContain('tech:phantom_tech');
    expect(missing).toHaveLength(3);
  });

  it('loadGameState throws SaveDataMismatchError when IDs are missing from data tables', () => {
    buildSmallScenario();
    const data = serializeGameState();
    data.state.factions[0].techs.push('phantom_tech' as never);
    const round = JSON.parse(JSON.stringify(data)) as ReturnType<typeof serializeGameState>;
    expect(() => loadGameState(round)).toThrow(SaveDataMismatchError);
  });

  it('loads a v2 save without targetCityId and survives an updateAIStrategy call', () => {
    // Backwards-compat smoke test: 2f-2 added optional targetCityId to
    // AIMemory. A pre-2f-2 save will have aiMemory entries with no such
    // field. Loading must succeed and updateAIStrategy must not throw.
    buildSmallScenario();
    G.aiMemory[1] = {
      grudges: { 0: 25 },
      strategicPhase: 'contest',
      targetEnemy: null,
      lastDeclareWarTurn: 0,
    };
    const data = serializeGameState();
    // Strip the optional field to simulate a pre-2f-2 save shape.
    for (const idx of Object.keys(data.state.aiMemory)) {
      const m = data.state.aiMemory[Number(idx)];
      if (m) delete (m as { targetCityId?: number | null }).targetCityId;
    }
    const round = JSON.parse(JSON.stringify(data)) as ReturnType<typeof serializeGameState>;
    loadGameState(round);
    // updateAIStrategy must run without crash on the legacy memory shape.
    expect(() => updateAIStrategy(G.factions[1])).not.toThrow();
  });
});
