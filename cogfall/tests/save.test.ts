import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AUTOSAVE_KEY,
  loadGameState,
  readSlot,
  SAVE_VERSION,
  SaveVersionMismatchError,
  saveAuto,
  serializeGameState,
  writeSlot,
} from '../src/core/save';
import { G } from '../src/core/state';
import { generateMap } from '../src/systems/mapgen';
import { createSeededRng } from '../src/core/rng';
import { FACTIONS } from '../src/data/factions';
import type { Faction, FactionIdx } from '../src/core/types';

// Local faction builder — avoids importing systems/setup.ts (which reaches
// into render/canvas at module-load and throws on the missing #map-canvas
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
});
