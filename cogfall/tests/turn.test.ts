// Phase 2m hot-seat handoff dispatch + multi-human victory rule tests.
//
// turn.ts is heavy on DOM (AI thinking spinner, victory banner, curtain
// modal). jsdom returns null for missing IDs and the call sites are all
// guarded with `if (el)`, so endTurn runs cleanly under vitest. We don't
// mock openPassover — the real implementation sets G.passoverActive=true
// synchronously before any DOM work, which is the observable signal the
// test pins.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { G } from '../src/core/state';
import { endTurn } from '../src/systems/turn';
import { generateMap } from '../src/systems/mapgen';
import { createSeededRng, initGameRng } from '../src/core/rng';
import { FACTIONS } from '../src/data/factions';
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
    resources: { gold: 0, aether: 0 },
    science: 0,
    researchProgress: 0,
    techs: new Set(),
    currentResearch: null,
    score: 0,
    diplo: {},
  };
}

function buildScenario(opts: {
  controlMode: 'single' | 'hotseat';
  humanIdxs: FactionIdx[];
  factions: Faction[];
  currentIdx: FactionIdx;
  playerIdx: FactionIdx;
}): void {
  G.map = generateMap('small', createSeededRng(42));
  G.factions = opts.factions;
  G.units = [];
  G.cities = [];
  G.events = [];
  G.aiMemory = {};
  G.gameOver = false;
  G.turn = 5;
  G.nextUnitId = 1;
  G.nextCityId = 1;
  G.currentFactionIdx = opts.currentIdx;
  G.playerFactionIdx = opts.playerIdx;
  G.controlMode = opts.controlMode;
  G.humanFactionIdxs = opts.humanIdxs;
  G.passoverActive = false;
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
  G.culturalHegemonyEnabled = false; // suppress cultural-victory side effect
  initGameRng(42);
}

function clearGameState(): void {
  G.map = null;
  G.factions = [];
  G.units = [];
  G.cities = [];
  G.events = [];
  G.aiMemory = {};
  G.controlMode = 'single';
  G.humanFactionIdxs = [0 as FactionIdx];
  G.passoverActive = false;
  G.gameOver = false;
}

describe('Phase 2m: hot-seat handoff dispatch', () => {
  beforeEach(() => {
    localStorage.clear();
    clearGameState();
  });
  afterEach(() => {
    localStorage.clear();
    clearGameState();
  });

  it('hot-seat human-to-different-human raises passoverActive', () => {
    // 2 humans (0, 1) + 1 AI (2). Faction 0 ends turn; next is human 1.
    // dispatchHandoff opens the curtain → G.passoverActive flips to true.
    buildScenario({
      controlMode: 'hotseat',
      humanIdxs: [0 as FactionIdx, 1 as FactionIdx],
      factions: [makeFaction(0, false), makeFaction(1, false), makeFaction(2, true)],
      currentIdx: 0 as FactionIdx,
      playerIdx: 0 as FactionIdx,
    });

    endTurn();

    expect(G.currentFactionIdx).toBe(1);
    expect(G.passoverActive).toBe(true);
    // Curtain hasn't been dismissed yet → playerFactionIdx still on 0.
    expect(G.playerFactionIdx).toBe(0);
  });

  it('hot-seat human-to-AI does NOT raise passoverActive (AI runs straight away)', () => {
    // 2 humans (0, 2) + 1 AI (1). Faction 0 ends turn; next is AI 1.
    buildScenario({
      controlMode: 'hotseat',
      humanIdxs: [0 as FactionIdx, 2 as FactionIdx],
      factions: [makeFaction(0, false), makeFaction(1, true), makeFaction(2, false)],
      currentIdx: 0 as FactionIdx,
      playerIdx: 0 as FactionIdx,
    });

    endTurn();

    expect(G.currentFactionIdx).toBe(1);
    expect(G.passoverActive).toBe(false);
  });

  it('single-player human-to-AI does NOT raise passoverActive (pre-2m parity)', () => {
    // 1 human (0) + 1 AI (1). Single-player path — no controlMode dispatch.
    buildScenario({
      controlMode: 'single',
      humanIdxs: [0 as FactionIdx],
      factions: [makeFaction(0, false), makeFaction(1, true)],
      currentIdx: 0 as FactionIdx,
      playerIdx: 0 as FactionIdx,
    });

    endTurn();

    expect(G.currentFactionIdx).toBe(1);
    expect(G.passoverActive).toBe(false);
  });

  it('hot-seat AI-to-human (different) raises passoverActive', () => {
    // Rotation: AI 1 ends turn, next is human 2 (different from current
    // playerFactionIdx 0). Curtain fires.
    buildScenario({
      controlMode: 'hotseat',
      humanIdxs: [0 as FactionIdx, 2 as FactionIdx],
      factions: [makeFaction(0, false), makeFaction(1, true), makeFaction(2, false)],
      currentIdx: 1 as FactionIdx,
      playerIdx: 0 as FactionIdx,
    });

    endTurn();

    expect(G.currentFactionIdx).toBe(2);
    expect(G.passoverActive).toBe(true);
  });
});

describe('Phase 2m: multi-human victory rule (last human standing)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearGameState();
  });
  afterEach(() => {
    localStorage.clear();
    clearGameState();
  });

  it('hot-seat 2H+1A: AI dies first, both humans alive → no victory yet', () => {
    // Game continues — humans must outlast each other after the AI falls.
    const factions = [makeFaction(0, false), makeFaction(1, false), makeFaction(2, true)];
    factions[2].alive = false; // AI dead
    buildScenario({
      controlMode: 'hotseat',
      humanIdxs: [0 as FactionIdx, 1 as FactionIdx],
      factions,
      currentIdx: 0 as FactionIdx,
      playerIdx: 0 as FactionIdx,
    });

    endTurn();

    expect(G.gameOver).toBe(false);
  });

  it('hot-seat 2H+1A: AI dead + one human dead → surviving human wins (domination)', () => {
    // Last human standing: humansAlive.length===1 AND aliveTotal===1.
    const factions = [makeFaction(0, false), makeFaction(1, false), makeFaction(2, true)];
    factions[1].alive = false; // human 1 dead
    factions[2].alive = false; // AI dead
    buildScenario({
      controlMode: 'hotseat',
      humanIdxs: [0 as FactionIdx, 1 as FactionIdx],
      factions,
      currentIdx: 0 as FactionIdx,
      playerIdx: 0 as FactionIdx,
    });

    endTurn();

    expect(G.gameOver).toBe(true);
    // Defeat triggerDefeat doesn't render but flips gameOver too — only
    // check that game ended; victory vs defeat banner is DOM and skipped
    // here (covered visually in 2m-5 preview verification).
  });

  it('hot-seat 2H+1A: all humans dead → defeat regardless of AI alive', () => {
    const factions = [makeFaction(0, false), makeFaction(1, false), makeFaction(2, true)];
    factions[0].alive = false;
    factions[1].alive = false;
    // AI 2 alive — the AI taking the win triggers defeat for the whole table.
    buildScenario({
      controlMode: 'hotseat',
      humanIdxs: [0 as FactionIdx, 1 as FactionIdx],
      factions,
      currentIdx: 2 as FactionIdx, // AI's turn just ended
      playerIdx: 0 as FactionIdx,
    });

    endTurn();

    expect(G.gameOver).toBe(true);
  });

  it('single-player 1H+4A collapses to pre-2m domination (all opponents dead)', () => {
    const factions = [
      makeFaction(0, false),
      makeFaction(1, true),
      makeFaction(2, true),
      makeFaction(3, true),
      makeFaction(4, true),
    ];
    factions[1].alive = false;
    factions[2].alive = false;
    factions[3].alive = false;
    factions[4].alive = false;
    buildScenario({
      controlMode: 'single',
      humanIdxs: [0 as FactionIdx],
      factions,
      currentIdx: 0 as FactionIdx,
      playerIdx: 0 as FactionIdx,
    });

    endTurn();

    expect(G.gameOver).toBe(true);
  });

  it('single-player 1H+1A: human dies → defeat (pre-2m parity)', () => {
    const factions = [makeFaction(0, false), makeFaction(1, true)];
    factions[0].alive = false;
    buildScenario({
      controlMode: 'single',
      humanIdxs: [0 as FactionIdx],
      factions,
      currentIdx: 1 as FactionIdx,
      playerIdx: 0 as FactionIdx,
    });

    endTurn();

    expect(G.gameOver).toBe(true);
  });
});
