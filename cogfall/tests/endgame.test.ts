// Phase 3 S10 — endgame derivation unit tests. Covers the three pure
// helpers in src/systems/endgame.ts: computeScoreBreakdown,
// computeRetroStats, findReplayHighlights.

import { beforeEach, describe, expect, it } from 'vitest';
import { G } from '../src/core/state';
import {
  computeScoreBreakdown,
  computeRetroStats,
  findReplayHighlights,
} from '../src/systems/endgame';
import { computeFactionScore } from '../src/systems/turn';
import type { TelemetryEvent } from '../src/systems/telemetry';
import type { ReplayDump } from '../src/systems/replay';
import type { SerializedGameState } from '../src/core/save';
import { FACTIONS } from '../src/data/factions';
import { UNIT_TYPES } from '../src/data/units';
import type { City, Faction, FactionIdx, Unit } from '../src/core/types';

function makeFaction(idx: number, gold = 0, aether = 0): Faction {
  const tpl = FACTIONS[idx];
  return {
    idx: idx as FactionIdx,
    id: tpl.id,
    name: tpl.name,
    color: tpl.color,
    glyph: tpl.glyph,
    personality: tpl.personality,
    desc: tpl.desc,
    isAI: idx !== 0,
    alive: true,
    resources: { gold, aether },
    science: 0,
    researchProgress: 0,
    techs: new Set(tpl.startTechs),
    currentResearch: null,
    score: 0,
    diplo: {},
  };
}

function makeCity(id: number, factionIdx: number, population: number, q = 0, r = 0): City {
  return {
    id,
    factionIdx: factionIdx as FactionIdx,
    q,
    r,
    name: 'Test',
    population,
    foodStored: 0,
    foodNeeded: 10,
    productionStored: 0,
    buildings: new Set(),
    buildQueue: [],
    isCapital: false,
    hp: 100,
    maxHp: 100,
  };
}

function makeUnit(id: number, factionIdx: number, q = 0, r = 0): Unit {
  const t = UNIT_TYPES['COGMAN'];
  return {
    id,
    typeId: 'COGMAN',
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

function resetWorld(): void {
  G.map = null;
  G.units = [];
  G.cities = [];
  G.factions = [makeFaction(0), makeFaction(1)];
  G.playerFactionIdx = 0 as FactionIdx;
  G.currentFactionIdx = 0 as FactionIdx;
  G.turn = 10;
  G.events = [];
  G.gameOver = false;
}

describe('computeScoreBreakdown', () => {
  beforeEach(() => {
    resetWorld();
  });

  it('rows sum to computeFactionScore for an empty faction', () => {
    const f = G.factions[0];
    const bd = computeScoreBreakdown(f);
    expect(bd.resources + bd.dominion + bd.lore).toBe(bd.total);
    expect(bd.total).toBe(computeFactionScore(f));
  });

  it('rows sum to computeFactionScore with cities, units, gold, aether', () => {
    G.cities = [makeCity(1, 0, 3), makeCity(2, 0, 1), makeCity(3, 1, 5)];
    G.units = [makeUnit(1, 0), makeUnit(2, 0), makeUnit(3, 1)];
    G.factions[0].resources = { gold: 200, aether: 50 };
    const f = G.factions[0];
    const bd = computeScoreBreakdown(f);
    // Score should equal turn.ts:computeFactionScore (within Math.round drift
    // of ±2 from three independent roundings vs one final rounding).
    expect(Math.abs(bd.total - computeFactionScore(f))).toBeLessThanOrEqual(2);
    expect(bd.dominion).toBeGreaterThan(0);
    expect(bd.lore).toBeGreaterThan(0);
    expect(bd.resources).toBeGreaterThan(0);
  });

  it('ignores cities and units belonging to other factions', () => {
    G.cities = [makeCity(1, 1, 5)];
    G.units = [makeUnit(1, 1), makeUnit(2, 1)];
    const bd = computeScoreBreakdown(G.factions[0]);
    expect(bd.dominion).toBe(0);
  });
});

describe('computeRetroStats', () => {
  beforeEach(() => {
    resetWorld();
  });

  it('reports turn, cities, units, techs derived from G + faction', () => {
    G.turn = 42;
    G.cities = [makeCity(1, 0, 1), makeCity(2, 0, 1)];
    G.units = [makeUnit(1, 0), makeUnit(2, 0), makeUnit(3, 0)];
    const f = G.factions[0];
    const stats = computeRetroStats(f, []);
    expect(stats.turnsPlayed).toBe(42);
    expect(stats.citiesHeld).toBe(2);
    expect(stats.unitsAfield).toBe(3);
    expect(stats.techsMastered).toBe(f.techs.size);
    expect(stats.battlesJoined).toBe(0);
    expect(stats.blowsStruck).toBe(0);
    expect(stats.blowsBorne).toBe(0);
  });

  it('accumulates combat events by attacker / defender', () => {
    const log: TelemetryEvent[] = [
      { kind: 'combat', turn: 3, attacker: 0, defender: 1, dmg: 5, vsCity: false },
      { kind: 'combat', turn: 4, attacker: 0, defender: 1, dmg: 3, vsCity: false },
      { kind: 'combat', turn: 5, attacker: 1, defender: 0, dmg: 7, vsCity: false },
      { kind: 'aiTurn', turn: 6, faction: 1, durationMs: 12 },
      { kind: 'combat', turn: 7, attacker: 1, defender: 2, dmg: 9, vsCity: false },
    ];
    const stats = computeRetroStats(G.factions[0], log);
    // Faction 0 attacked twice (5+3=8) and was attacked once (7); the last
    // combat between 1 and 2 doesn't touch faction 0.
    expect(stats.battlesJoined).toBe(3);
    expect(stats.blowsStruck).toBe(8);
    expect(stats.blowsBorne).toBe(7);
  });
});

describe('findReplayHighlights', () => {
  function makeSerializedFaction(idx: number, techs: string[] = [], diplo: Record<number, 'peace' | 'war' | 'unmet'> = {}, alive = true, score = 0) {
    const tpl = FACTIONS[idx];
    return {
      idx: idx as FactionIdx,
      id: tpl.id,
      name: tpl.name,
      color: tpl.color,
      glyph: tpl.glyph,
      personality: tpl.personality,
      desc: tpl.desc,
      isAI: idx !== 0,
      alive,
      resources: { gold: 0, aether: 0 },
      science: 0,
      researchProgress: 0,
      techs: techs as never,
      currentResearch: null,
      score,
      diplo,
    } as never;
  }

  function makeSnap(turn: number, opts: {
    playerCities?: number;
    playerTechs?: string[];
    enemyTechs?: string[];
    playerWar?: boolean;
    gameOver?: boolean;
    playerAlive?: boolean;
    enemyAlive?: boolean;
    playerScore?: number;
    enemyScore?: number;
  } = {}): SerializedGameState {
    const cities = opts.playerCities
      ? Array.from({ length: opts.playerCities }, (_, i) => ({
          id: i + 1,
          factionIdx: 0 as FactionIdx,
          q: 0,
          r: 0,
          name: 'Hearth',
          population: 1,
          foodStored: 0,
          foodNeeded: 10,
          productionStored: 0,
          buildings: [] as never,
          buildQueue: [],
          isCapital: i === 0,
          hp: 100,
          maxHp: 100,
        }))
      : [];
    return {
      map: null,
      factions: [
        makeSerializedFaction(
          0,
          opts.playerTechs ?? [],
          opts.playerWar ? { 1: 'war' } : {},
          opts.playerAlive ?? true,
          opts.playerScore ?? 0
        ),
        makeSerializedFaction(1, opts.enemyTechs ?? [], {}, opts.enemyAlive ?? true, opts.enemyScore ?? 0),
      ],
      units: [],
      cities: cities as never,
      turn,
      currentFactionIdx: 0 as FactionIdx,
      playerFactionIdx: 0 as FactionIdx,
      difficulty: 'medium',
      goldHegemonyThreshold: 5000,
      goldHegemonyRequired: 3,
      goldHegemonyCounter: {},
      events: [],
      cameraX: 0,
      cameraY: 0,
      zoom: 1,
      nextUnitId: 1,
      nextCityId: 1,
      gameOver: opts.gameOver ?? false,
      aiMemory: {},
      seed: 1,
      rngState: 0,
    };
  }

  it('returns empty when replay has no turns', () => {
    const replay: ReplayDump = { version: 1, seed: 1, factionName: 'X', turns: [] };
    expect(findReplayHighlights(replay)).toEqual([]);
  });

  it('detects firstCity, firstWar, firstTech, victory in order', () => {
    const replay: ReplayDump = {
      version: 1,
      seed: 1,
      factionName: 'Player',
      turns: [
        makeSnap(1, {}),
        makeSnap(2, { playerCities: 1 }), // firstCity at idx 1
        makeSnap(3, { playerCities: 1, playerWar: true }), // firstWar at idx 2
        makeSnap(4, { playerCities: 1, playerWar: true, playerTechs: ['x'] }), // firstTech at idx 3
        makeSnap(5, { playerCities: 1, playerWar: true, playerTechs: ['x'], gameOver: true, playerAlive: true, enemyAlive: false, playerScore: 100 }), // victory at idx 4
      ],
    };
    const hl = findReplayHighlights(replay);
    expect(hl.map((h) => h.kind)).toEqual(['firstCity', 'firstWar', 'firstTech', 'victory']);
    expect(hl.map((h) => h.snapshotIdx)).toEqual([1, 2, 3, 4]);
    expect(hl.map((h) => h.turn)).toEqual([2, 3, 4, 5]);
    // Victory faction picked as highest-score alive faction.
    expect(hl[3].factionIdx).toBe(0);
    // Labels render the literary register with the turn number suffix.
    expect(hl[0].label).toBe('First Hearth — turn 2');
    expect(hl[3].label).toBe('The Banner Settles — turn 5');
  });

  it('only records the first occurrence of each kind', () => {
    const replay: ReplayDump = {
      version: 1,
      seed: 1,
      factionName: 'Player',
      turns: [
        makeSnap(1, { playerCities: 1 }),
        makeSnap(2, { playerCities: 2 }),
        makeSnap(3, { playerCities: 3 }),
      ],
    };
    const hl = findReplayHighlights(replay);
    expect(hl.length).toBe(1);
    expect(hl[0]).toMatchObject({ kind: 'firstCity', snapshotIdx: 0 });
  });

  it('treats starting techs as the baseline (firstTech fires only on a NEW tech)', () => {
    const replay: ReplayDump = {
      version: 1,
      seed: 1,
      factionName: 'Player',
      turns: [
        makeSnap(1, { playerTechs: ['startA', 'startB'] }),
        makeSnap(2, { playerTechs: ['startA', 'startB'] }),
        makeSnap(3, { playerTechs: ['startA', 'startB', 'new1'] }),
      ],
    };
    const hl = findReplayHighlights(replay);
    expect(hl.length).toBe(1);
    expect(hl[0]).toMatchObject({ kind: 'firstTech', snapshotIdx: 2, turn: 3 });
  });
});
