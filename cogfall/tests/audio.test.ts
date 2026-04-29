// Phase 2h-3: SFX trigger-site invariants. The audio module records each
// playSfx() call into a process-local log, so we can drive each trigger
// site (player end-turn, build complete, combat, victory) and assert the
// right event fired — without instantiating a real AudioContext or
// listening for sound under jsdom.
//
// Mute persistence and AudioContext-absence safety belong here too: the
// same playSfx() must record an event but not throw under jsdom.

import { describe, expect, it, beforeEach } from 'vitest';
import { G } from '../src/core/state';
import {
  clearSfxLog,
  getRecentSfxEvents,
  isAudioMuted,
  playSfx,
  setAudioMuted,
} from '../src/systems/audio';
import { combat } from '../src/systems/combat';
import { processCity } from '../src/systems/city';
import { endTurn, triggerVictory } from '../src/systems/turn';
import { hexKey } from '../src/core/hex';
import { FACTIONS } from '../src/data/factions';
import { UNIT_TYPES } from '../src/data/units';
import type { City, Faction, FactionIdx, Unit } from '../src/core/types';

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
    resources: { gold: 100, aether: 0 },
    science: 0,
    researchProgress: 0,
    techs: new Set(tpl.startTechs),
    currentResearch: null,
    score: 0,
    diplo: {},
  };
}

function buildPlainsMap(half = 4): void {
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

function makeUnit(id: number, factionIdx: number, q: number, r: number, typeId: keyof typeof UNIT_TYPES = 'COGMAN'): Unit {
  const t = UNIT_TYPES[typeId];
  return {
    id,
    typeId,
    factionIdx: factionIdx as FactionIdx,
    q,
    r,
    hp: t.hp,
    maxHp: t.hp,
    mp: t.mp,
    maxMp: t.mp,
    fortified: false,
  };
}

describe('audio module', () => {
  beforeEach(() => {
    clearSfxLog();
    setAudioMuted(false);
    G.map = null;
    G.units = [];
    G.cities = [];
    G.factions = [makeFaction(0, false), makeFaction(1, true)];
    G.playerFactionIdx = 0 as FactionIdx;
    G.currentFactionIdx = 0 as FactionIdx;
    G.gameOver = false;
    G.events = [];
    G.aiMemory = {};
    G.turn = 1;
    G.selected = null;
    G.moveTargets = [];
    G.attackTargets = [];
    G.sabotageTargets = [];
    G.goldHegemonyCounter = {};
    G.culturalHegemonyCounter = {};
    G.culturalHegemonyEnabled = false; // disable so endTurn doesn't trigger a victory
    G.goldHegemonyThreshold = 1_000_000;
  });

  it('records a playSfx call into the log', () => {
    playSfx('endTurn');
    expect(getRecentSfxEvents()).toEqual(['endTurn']);
  });

  it('is muteable; mute state persists across calls', () => {
    setAudioMuted(true);
    expect(isAudioMuted()).toBe(true);
    playSfx('combatHit');
    // Even when muted, the log records the intent — useful for testing
    // trigger sites without flipping mute state on every test.
    expect(getRecentSfxEvents()).toEqual(['combatHit']);
    setAudioMuted(false);
    expect(isAudioMuted()).toBe(false);
  });
});

describe('audio trigger sites', () => {
  beforeEach(() => {
    clearSfxLog();
    setAudioMuted(true); // silence the actual playback path; log still records
    G.map = null;
    G.units = [];
    G.cities = [];
    G.factions = [makeFaction(0, false), makeFaction(1, true)];
    G.playerFactionIdx = 0 as FactionIdx;
    G.currentFactionIdx = 0 as FactionIdx;
    G.gameOver = false;
    G.events = [];
    G.aiMemory = {};
    G.turn = 1;
    G.selected = null;
    G.moveTargets = [];
    G.attackTargets = [];
    G.sabotageTargets = [];
    G.goldHegemonyCounter = {};
    G.culturalHegemonyCounter = {};
    G.culturalHegemonyEnabled = false;
    G.goldHegemonyThreshold = 1_000_000;
  });

  it('endTurn fires the endTurn SFX when the player is the current faction', () => {
    buildPlainsMap();
    // Stub out the AI turn pipeline; otherwise endTurn → AI turn → setTimeout.
    // We just need the player-side SFX dispatch.
    G.factions[0].isAI = false;
    G.currentFactionIdx = 0 as FactionIdx;
    try {
      endTurn();
    } catch {
      // endTurn touches DOM bits in jsdom (#cur-turn etc.) that may not exist.
      // The SFX call happens at the very top before any DOM work.
    }
    expect(getRecentSfxEvents()).toContain('endTurn');
  });

  it('processCity fires buildComplete when a player city finishes a building', () => {
    buildPlainsMap();
    const city: City = {
      id: 1,
      factionIdx: 0 as FactionIdx,
      q: 0,
      r: 0,
      name: 'Cogspire',
      population: 1,
      foodStored: 0,
      foodNeeded: 10,
      productionStored: 1000, // way over any building cost
      buildings: new Set(),
      buildQueue: [{ kind: 'building', id: 'walls' }],
      isCapital: true,
      hp: 100,
      maxHp: 100,
    };
    G.cities = [city];
    G.map!.tiles.get(hexKey(0, 0))!.cityId = city.id;

    processCity(city);
    expect(getRecentSfxEvents()).toContain('buildComplete');
  });

  it('combat fires combatHit when the player is involved', () => {
    buildPlainsMap();
    const attacker = makeUnit(1, 0, 0, 0);
    const defender = makeUnit(2, 1, 1, 0);
    G.units = [attacker, defender];
    G.map!.tiles.get(hexKey(0, 0))!.unitId = 1;
    G.map!.tiles.get(hexKey(1, 0))!.unitId = 2;

    combat(attacker, { q: 1, r: 0, target: 'unit' });
    expect(getRecentSfxEvents()).toContain('combatHit');
  });

  it('combat is silent when the player is not involved', () => {
    // Reframe: AI vs AI scuffle — no player faction in the resolution.
    G.factions = [makeFaction(0, true), makeFaction(1, true)];
    G.playerFactionIdx = 99 as FactionIdx; // off-the-board observer
    buildPlainsMap();
    const attacker = makeUnit(1, 0, 0, 0);
    const defender = makeUnit(2, 1, 1, 0);
    G.units = [attacker, defender];
    G.map!.tiles.get(hexKey(0, 0))!.unitId = 1;
    G.map!.tiles.get(hexKey(1, 0))!.unitId = 2;

    combat(attacker, { q: 1, r: 0, target: 'unit' });
    expect(getRecentSfxEvents()).not.toContain('combatHit');
  });

  it('triggerVictory fires the victory SFX only when the player wins', () => {
    triggerVictory(0 as FactionIdx, 'domination');
    expect(getRecentSfxEvents()).toContain('victory');

    clearSfxLog();
    G.gameOver = false;
    triggerVictory(1 as FactionIdx, 'domination');
    expect(getRecentSfxEvents()).not.toContain('victory');
  });
});
