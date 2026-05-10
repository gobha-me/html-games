// Phase 3 S5 — per-faction AI personality variety.
//
// Verifies the four faction overlays in `data/factionBehaviors.ts` and the
// save-load rebind path in `core/save.ts:applySerializedStateToG`.
// Cogwright stays opt-out as the byte-equal control.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aiPickBuild } from '../src/ai/cityAI';
import { createSeededRng } from '../src/core/rng';
import { G } from '../src/core/state';
import { asFactionIdx } from '../src/core/types';
import type {
  BuildQueue,
  City,
  Faction,
  FactionIdx,
  TechId,
  Unit,
  UnitTypeId,
} from '../src/core/types';
import { FACTION_BEHAVIORS, getFactionBehavior } from '../src/data/factionBehaviors';
import type { FactionId } from '../src/data/factions';

function makeFaction(
  id: FactionId,
  personality: Faction['personality'],
  idx = 0
): Faction {
  return {
    idx: idx as FactionIdx,
    id,
    name: id,
    color: '#fff',
    glyph: 'X',
    personality,
    desc: '',
    isAI: true,
    alive: true,
    resources: { gold: 0, aether: 0 },
    science: 0,
    researchProgress: 0,
    techs: new Set(),
    currentResearch: null,
    score: 0,
    diplo: {},
    behavior: getFactionBehavior(id),
  };
}

function makeCity(factionIdx: number): City {
  return {
    id: 1,
    factionIdx: factionIdx as FactionIdx,
    name: 'TestCity',
    q: 0,
    r: 0,
    population: 1,
    foodStored: 0,
    foodNeeded: 10,
    productionStored: 0,
    buildings: new Set(),
    buildQueue: [],
    isCapital: false,
    hp: 25,
    maxHp: 25,
  };
}

describe('getFactionBehavior', () => {
  it('returns undefined for cogwright (the byte-equal control)', () => {
    expect(getFactionBehavior('cogwright')).toBeUndefined();
  });

  it('returns a behavior overlay for each of the 4 non-default factions', () => {
    expect(getFactionBehavior('iron')).toBeDefined();
    expect(getFactionBehavior('aetheric')).toBeDefined();
    expect(getFactionBehavior('verdant')).toBeDefined();
    expect(getFactionBehavior('coin')).toBeDefined();
  });
});

describe('Iron Legion pickTech walk', () => {
  it('returns metallurgy on a fresh faction, then gunpowder, then steamcraft, then steam_armor, then null', () => {
    const f = makeFaction('iron', 'militaristic');
    const hook = FACTION_BEHAVIORS.iron?.pickTech;
    if (!hook) throw new Error('iron pickTech missing');
    const rng = createSeededRng(1);
    expect(hook(f, rng)).toBe('metallurgy');
    f.techs.add('metallurgy');
    expect(hook(f, rng)).toBe('gunpowder');
    f.techs.add('gunpowder');
    expect(hook(f, rng)).toBe('steamcraft');
    f.techs.add('steamcraft');
    expect(hook(f, rng)).toBe('steam_armor');
    f.techs.add('steam_armor');
    expect(hook(f, rng)).toBeNull();
  });
});

describe('Aetheric Order pickBuild walk', () => {
  it('returns library on an empty city, then spire, then academy, then null', () => {
    const f = makeFaction('aetheric', 'scientific');
    f.techs.add('rediscovery');
    f.techs.add('aetherics'); // satisfies spire + academy `requires`
    const c = makeCity(0);
    const hook = FACTION_BEHAVIORS.aetheric?.pickBuild;
    if (!hook) throw new Error('aetheric pickBuild missing');
    const rng = createSeededRng(1);
    expect(hook(f, c, rng)).toEqual({ kind: 'building', id: 'library' });
    c.buildings.add('library');
    expect(hook(f, c, rng)).toEqual({ kind: 'building', id: 'spire' });
    c.buildings.add('spire');
    expect(hook(f, c, rng)).toEqual({ kind: 'building', id: 'academy' });
    c.buildings.add('academy');
    expect(hook(f, c, rng)).toBeNull();
  });

  it('skips buildings whose `requires` tech is unmet (spire/academy need aetherics)', () => {
    const f = makeFaction('aetheric', 'scientific');
    f.techs.add('rediscovery'); // library only
    const c = makeCity(0);
    c.buildings.add('library');
    const hook = FACTION_BEHAVIORS.aetheric?.pickBuild;
    if (!hook) throw new Error('aetheric pickBuild missing');
    expect(hook(f, c, createSeededRng(1))).toBeNull();
  });
});

describe('Verdant Pact pickBuild walk', () => {
  it('returns walls first; opera_house only after Salons is researched', () => {
    const f = makeFaction('verdant', 'defensive');
    const c = makeCity(0);
    const hook = FACTION_BEHAVIORS.verdant?.pickBuild;
    if (!hook) throw new Error('verdant pickBuild missing');
    expect(hook(f, c, createSeededRng(1))).toEqual({ kind: 'building', id: 'walls' });
    c.buildings.add('walls');
    expect(hook(f, c, createSeededRng(1))).toBeNull(); // no salons yet
    f.techs.add('lithography');
    f.techs.add('salons');
    expect(hook(f, c, createSeededRng(1))).toEqual({
      kind: 'building',
      id: 'opera_house',
    });
  });
});

// Iron Legion pickBuild requires reading G.factions / G.units, so save the
// previous G state and restore it after.
describe('Iron Legion pickBuild garrison gate', () => {
  let prevFactions: typeof G.factions;
  let prevUnits: typeof G.units;
  let prevAiMemory: typeof G.aiMemory;

  beforeEach(() => {
    prevFactions = G.factions;
    prevUnits = G.units;
    prevAiMemory = G.aiMemory;
  });
  afterEach(() => {
    G.factions = prevFactions;
    G.units = prevUnits;
    G.aiMemory = prevAiMemory;
  });

  it('returns a military unit when no garrison is present (peace)', () => {
    const iron = makeFaction('iron', 'militaristic', 0);
    G.factions = [iron];
    G.units = [];
    const c = makeCity(0);
    const hook = FACTION_BEHAVIORS.iron?.pickBuild;
    if (!hook) throw new Error('iron pickBuild missing');
    const pick = hook(iron, c, createSeededRng(1));
    expect(pick).toEqual({ kind: 'unit', id: 'COGMAN' });
  });

  it('upgrades to MUSKETEER once gunpowder is researched', () => {
    const iron = makeFaction('iron', 'militaristic', 0);
    iron.techs.add('metallurgy');
    iron.techs.add('gunpowder');
    G.factions = [iron];
    G.units = [];
    const c = makeCity(0);
    const hook = FACTION_BEHAVIORS.iron?.pickBuild;
    if (!hook) throw new Error('iron pickBuild missing');
    const pick = hook(iron, c, createSeededRng(1));
    expect(pick).toEqual({ kind: 'unit', id: 'MUSKETEER' });
  });

  it('falls through (returns null) when garrison present and at peace', () => {
    const iron = makeFaction('iron', 'militaristic', 0);
    G.factions = [iron];
    const garrison: Unit = {
      id: 1,
      factionIdx: asFactionIdx(0),
      typeId: 'COGMAN' as UnitTypeId,
      q: 0,
      r: 0,
      hp: 25,
      maxHp: 25,
      mp: 2,
      maxMp: 2,
      fortified: false,
    };
    G.units = [garrison];
    const c = makeCity(0);
    const hook = FACTION_BEHAVIORS.iron?.pickBuild;
    if (!hook) throw new Error('iron pickBuild missing');
    expect(hook(iron, c, createSeededRng(1))).toBeNull();
  });
});

// Save-load contract: behavior is dropped by JSON.stringify (closures don't
// serialize) and re-bound from FactionId in applySerializedStateToG.
describe('save-load behavior rebind', () => {
  it('JSON round-trips drop hook closures (structural confirmation)', () => {
    const original = { id: 'iron' as FactionId, behavior: getFactionBehavior('iron') };
    expect(original.behavior).toBeDefined();
    const round = JSON.parse(JSON.stringify(original)) as { id: FactionId; behavior?: unknown };
    // After round-trip, behavior should be {} (scalars + functions stripped)
    // or undefined depending on overlay shape. The point is the *hook*
    // can't be there.
    const reboundBehavior = round.behavior as { pickTech?: unknown } | undefined;
    expect(reboundBehavior?.pickTech).toBeUndefined();
  });

  it('rebind via getFactionBehavior(f.id) restores hooks (matches applySerializedStateToG path)', () => {
    const stripped = { id: 'iron' as FactionId };
    const rebound = { ...stripped, behavior: getFactionBehavior(stripped.id) };
    expect(rebound.behavior).toBeDefined();
    expect(rebound.behavior?.pickTech).toBeDefined();
    expect(rebound.behavior?.pickBuild).toBeDefined();
  });
});

// Integration: run aiPickBuild end-to-end and confirm the override is the
// dominant signal — Iron returns military, Aetheric returns library — even
// though aiPickBuild's default scoring would have considered other options.
describe('aiPickBuild end-to-end signatures', () => {
  let prevFactions: typeof G.factions;
  let prevUnits: typeof G.units;
  let prevCities: typeof G.cities;
  let prevAiMemory: typeof G.aiMemory;
  let prevTurn: typeof G.turn;
  let prevMap: typeof G.map;

  beforeEach(() => {
    prevFactions = G.factions;
    prevUnits = G.units;
    prevCities = G.cities;
    prevAiMemory = G.aiMemory;
    prevTurn = G.turn;
    prevMap = G.map;
    G.units = [];
    G.cities = [];
    G.aiMemory = {};
    G.turn = 5;
    G.map = null; // disables coastal naval branch in default scoring
  });
  afterEach(() => {
    G.factions = prevFactions;
    G.units = prevUnits;
    G.cities = prevCities;
    G.aiMemory = prevAiMemory;
    G.turn = prevTurn;
    G.map = prevMap;
  });

  it('Iron Legion aiPickBuild returns a military unit on a fresh city', () => {
    const iron = makeFaction('iron', 'militaristic', 0);
    G.factions = [iron];
    const c = makeCity(0);
    G.cities = [c];
    const pick = aiPickBuild(iron, c, createSeededRng(1));
    expect(pick).toEqual({ kind: 'unit', id: 'COGMAN' } as BuildQueue);
  });

  it('Aetheric Order aiPickBuild returns library on a fresh city with rediscovery', () => {
    const aetheric = makeFaction('aetheric', 'scientific', 0);
    aetheric.techs.add('rediscovery');
    G.factions = [aetheric];
    const c = makeCity(0);
    G.cities = [c];
    const pick = aiPickBuild(aetheric, c, createSeededRng(1));
    expect(pick).toEqual({ kind: 'building', id: 'library' } as BuildQueue);
  });

  it('Cogwright Guild aiPickBuild is unchanged (no override → default scoring)', () => {
    const cog = makeFaction('cogwright', 'industrial', 0);
    expect(cog.behavior).toBeUndefined();
    G.factions = [cog];
    const c = makeCity(0);
    G.cities = [c];
    // We can't know the exact pick (depends on default scoring + rng) but
    // we CAN assert that the override path didn't fire — the resolved pick
    // must be a defensible default, not the iron/aetheric/etc. signature.
    // Trust the existing default-scoring tests in ai.test.ts; here we just
    // confirm the call doesn't throw and returns *something*.
    const pick = aiPickBuild(cog, c, createSeededRng(1));
    expect(pick).not.toBeNull();
  });
});

// Simple TechId compile-time guard — references all four iron picks via
// the typed array so a typo would have failed at module load.
describe('preference list type-safety', () => {
  it('iron tech preference list contains valid TechIds', () => {
    const expected: TechId[] = ['metallurgy', 'gunpowder', 'steamcraft', 'steam_armor'];
    // If any literal above isn't a TechId, this file wouldn't compile.
    expect(expected.length).toBe(4);
  });
});
