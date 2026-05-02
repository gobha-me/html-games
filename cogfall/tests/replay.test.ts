// Phase 2k replay module unit tests.
// Pure-module describe blocks land in 2k-1; trigger-site invariants
// (endTurn snapshot hook) are appended in 2k-2.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { G } from '../src/core/state';
import {
  MAX_REPLAY_TURNS,
  ReplayValidationError,
  applyReplayTurn,
  clearReplayLog,
  dumpReplay,
  getReplayLog,
  isReplayEnabled,
  isReplayLogCapped,
  loadReplay,
  recordReplaySnapshot,
  setReplayEnabled,
} from '../src/systems/replay';
import {
  clearTelemetryLog,
  recordTelemetry,
  setTelemetryEnabled,
} from '../src/systems/telemetry';
import { generateMap } from '../src/systems/mapgen';
import { createSeededRng } from '../src/core/rng';
import { endTurn } from '../src/systems/turn';
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
  G.units = [];
  G.cities = [];
  G.turn = 1;
  G.currentFactionIdx = 0 as FactionIdx;
  G.playerFactionIdx = 0 as FactionIdx;
  G.difficulty = 'medium';
  G.cameraX = 0;
  G.cameraY = 0;
  G.zoom = 1;
  G.events = [];
  G.aiMemory = {};
  G.gameOver = false;
  G.nextUnitId = 1;
  G.nextCityId = 1;
  G.goldHegemonyCounter = {};
  G.goldHegemonyThreshold = 5000;
  G.goldHegemonyRequired = 3;
  G.culturalHegemonyCounter = {};
  G.culturalHegemonyEnabled = true;
  G.seed = 42;
}

function resetForReplay(): void {
  localStorage.clear();
  clearReplayLog();
  setReplayEnabled(true);
  clearTelemetryLog();
  setTelemetryEnabled(true);
  buildSmallScenario();
}

describe('replay module', () => {
  beforeEach(() => {
    resetForReplay();
  });

  it('records a snapshot on demand', () => {
    expect(getReplayLog()).toEqual([]);
    recordReplaySnapshot();
    expect(getReplayLog().length).toBe(1);
    expect(getReplayLog()[0].turn).toBe(1);
    expect(getReplayLog()[0].seed).toBe(42);
  });

  it('records nothing when disabled', () => {
    setReplayEnabled(false);
    expect(isReplayEnabled()).toBe(false);
    recordReplaySnapshot();
    expect(getReplayLog()).toEqual([]);
  });

  it('clearReplayLog wipes the log', () => {
    recordReplaySnapshot();
    recordReplaySnapshot();
    expect(getReplayLog().length).toBe(2);
    clearReplayLog();
    expect(getReplayLog()).toEqual([]);
  });

  it('persists the enabled flag to localStorage', () => {
    setReplayEnabled(false);
    expect(localStorage.getItem('cogfall:replay:enabled')).toBe('0');
    setReplayEnabled(true);
    expect(localStorage.getItem('cogfall:replay:enabled')).toBe('1');
  });

  it('captures distinct snapshots across mutating turn state', () => {
    G.turn = 3;
    recordReplaySnapshot();
    G.turn = 7;
    recordReplaySnapshot();
    const log = getReplayLog();
    expect(log[0].turn).toBe(3);
    expect(log[1].turn).toBe(7);
  });
});

describe('replay dumpReplay', () => {
  beforeEach(() => {
    resetForReplay();
  });

  it('produces version + seed + factionName + turns shape', () => {
    G.seed = 7;
    G.turn = 3;
    recordReplaySnapshot();
    const dump = dumpReplay();
    expect(dump.version).toBe(1);
    expect(dump.seed).toBe(7);
    expect(dump.factionName).toBe(G.factions[0].name);
    expect(dump.turns.length).toBe(1);
    expect(dump.turns[0].turn).toBe(3);
    expect(dump.telemetry).toBeUndefined();
  });

  it('omits telemetry field when no telemetry events recorded', () => {
    recordReplaySnapshot();
    const dump = dumpReplay();
    expect('telemetry' in dump).toBe(false);
  });

  it('bundles telemetry when telemetry log has events', () => {
    recordReplaySnapshot();
    recordTelemetry({ kind: 'aiTurn', turn: 1, faction: 0, durationMs: 5 });
    const dump = dumpReplay();
    expect(dump.telemetry).toEqual([
      { kind: 'aiTurn', turn: 1, faction: 0, durationMs: 5 },
    ]);
  });
});

describe('replay loadReplay validation', () => {
  it('rejects non-object', () => {
    expect(() => loadReplay(null)).toThrow(ReplayValidationError);
    expect(() => loadReplay(42)).toThrow(ReplayValidationError);
    expect(() => loadReplay('nope')).toThrow(ReplayValidationError);
  });

  it('rejects wrong version', () => {
    expect(() => loadReplay({ version: 2 })).toThrow(ReplayValidationError);
    expect(() => loadReplay({ version: 'one' })).toThrow(ReplayValidationError);
  });

  it('rejects missing seed', () => {
    expect(() => loadReplay({ version: 1 })).toThrow(ReplayValidationError);
    expect(() => loadReplay({ version: 1, seed: 'x' })).toThrow(ReplayValidationError);
  });

  it('rejects missing factionName', () => {
    expect(() => loadReplay({ version: 1, seed: 1 })).toThrow(ReplayValidationError);
  });

  it('rejects non-array turns', () => {
    expect(() =>
      loadReplay({ version: 1, seed: 1, factionName: 'X', turns: 'not-array' })
    ).toThrow(ReplayValidationError);
  });

  it('rejects empty turns array', () => {
    expect(() =>
      loadReplay({ version: 1, seed: 1, factionName: 'X', turns: [] })
    ).toThrow(ReplayValidationError);
  });

  it('rejects non-array telemetry when present', () => {
    expect(() =>
      loadReplay({
        version: 1,
        seed: 1,
        factionName: 'X',
        turns: [{}],
        telemetry: 'no',
      })
    ).toThrow(ReplayValidationError);
  });

  it('accepts a valid minimal replay', () => {
    const r = loadReplay({
      version: 1,
      seed: 1,
      factionName: 'X',
      turns: [{}],
    });
    expect(r.version).toBe(1);
    expect(r.turns.length).toBe(1);
  });
});

describe('replay applyReplayTurn', () => {
  beforeEach(() => {
    resetForReplay();
  });

  it('mutates G to the snapshot state', () => {
    G.turn = 2;
    recordReplaySnapshot();
    G.turn = 9;
    recordReplaySnapshot();

    const dump = dumpReplay();
    applyReplayTurn(dump, 0);
    expect(G.turn).toBe(2);
    applyReplayTurn(dump, 1);
    expect(G.turn).toBe(9);
  });

  it('throws on out-of-range index', () => {
    recordReplaySnapshot();
    const dump = dumpReplay();
    expect(() => applyReplayTurn(dump, -1)).toThrow(ReplayValidationError);
    expect(() => applyReplayTurn(dump, 99)).toThrow(ReplayValidationError);
  });

  it('round-trips through JSON.parse(JSON.stringify(...))', () => {
    G.turn = 4;
    recordReplaySnapshot();
    const dump = dumpReplay();
    const json = JSON.parse(JSON.stringify(dump));
    const loaded = loadReplay(json);
    expect(loaded.turns.length).toBe(1);
    G.turn = 99;
    applyReplayTurn(loaded, 0);
    expect(G.turn).toBe(4);
  });

  it('preserves the live RNG cursor (no side effect on apply)', () => {
    // Snapshot embeds rngState, but applyReplayTurn must not touch the
    // live RNG. This guards against future "helpfully" calling
    // setGameRngState inside applySerializedStateToG.
    recordReplaySnapshot();
    const dump = dumpReplay();
    const before = G.seed;
    applyReplayTurn(dump, 0);
    expect(G.seed).toBe(before);
  });

  it('preserves the in-memory telemetry log on apply', () => {
    // Replay scrubbing is read-only — telemetry must NOT be cleared by
    // applyReplayTurn (loadGameState clears it; applyReplayTurn doesn't).
    recordReplaySnapshot();
    recordTelemetry({ kind: 'aiTurn', turn: 1, faction: 0, durationMs: 5 });
    const dump = dumpReplay();
    applyReplayTurn(dump, 0);
    // The telemetry log should still hold the event we recorded.
    expect(dump.telemetry).toEqual([
      { kind: 'aiTurn', turn: 1, faction: 0, durationMs: 5 },
    ]);
  });
});

describe('replay trigger site: endTurn', () => {
  beforeEach(() => {
    resetForReplay();
    // Short-circuit cultural-hegemony in the empty fixture so the
    // counter logic doesn't gate on city culture share.
    G.culturalHegemonyEnabled = false;
  });

  it('records a snapshot when the AI rotation wraps back to faction 0', () => {
    G.currentFactionIdx = 1 as FactionIdx;
    expect(getReplayLog().length).toBe(0);

    vi.useFakeTimers();
    try {
      endTurn();
    } finally {
      vi.useRealTimers();
    }

    expect(G.currentFactionIdx).toBe(0);
    expect(getReplayLog().length).toBe(1);
    expect(getReplayLog()[0].turn).toBe(G.turn);
  });

  it('does not record when rotation lands on a non-zero faction', () => {
    // 3 factions; rotating from 1 to 2 stays mid-cycle (no G.turn++).
    G.factions.push({
      ...makeFaction(2, true),
      idx: 2 as FactionIdx,
    });
    G.currentFactionIdx = 1 as FactionIdx;

    vi.useFakeTimers();
    try {
      endTurn();
    } finally {
      vi.useRealTimers();
    }

    expect(G.currentFactionIdx).toBe(2);
    expect(getReplayLog().length).toBe(0);
  });
});

describe('replay log cap (MAX_REPLAY_TURNS)', () => {
  beforeEach(() => {
    resetForReplay();
    buildSmallScenario();
  });

  it('isReplayLogCapped is false until the cap is reached', () => {
    expect(isReplayLogCapped()).toBe(false);
    for (let i = 0; i < MAX_REPLAY_TURNS - 1; i++) {
      G.turn = i + 1;
      recordReplaySnapshot();
    }
    expect(getReplayLog().length).toBe(MAX_REPLAY_TURNS - 1);
    expect(isReplayLogCapped()).toBe(false);
  });

  it('caps length at MAX_REPLAY_TURNS and isReplayLogCapped flips true', () => {
    for (let i = 0; i < MAX_REPLAY_TURNS; i++) {
      G.turn = i + 1;
      recordReplaySnapshot();
    }
    expect(getReplayLog().length).toBe(MAX_REPLAY_TURNS);
    expect(isReplayLogCapped()).toBe(true);
  });

  it('FIFO drops the oldest snapshot when pushing past the cap', () => {
    // Stamp G.turn into each snapshot so we can identify which were kept.
    for (let i = 0; i < MAX_REPLAY_TURNS + 50; i++) {
      G.turn = i + 1;
      recordReplaySnapshot();
    }
    const log = getReplayLog();
    expect(log.length).toBe(MAX_REPLAY_TURNS);
    // The oldest 50 snapshots (turns 1..50) were evicted; the surviving
    // window is turns 51..(MAX+50) in order.
    expect(log[0].turn).toBe(51);
    expect(log[log.length - 1].turn).toBe(MAX_REPLAY_TURNS + 50);
  });

  it('clearReplayLog resets cap state', () => {
    for (let i = 0; i < MAX_REPLAY_TURNS; i++) {
      G.turn = i + 1;
      recordReplaySnapshot();
    }
    expect(isReplayLogCapped()).toBe(true);
    clearReplayLog();
    expect(getReplayLog().length).toBe(0);
    expect(isReplayLogCapped()).toBe(false);
  });
});
