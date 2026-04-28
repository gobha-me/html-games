// Phase 2j: telemetry module unit tests + per-trigger-site invariants.
// The pure-module describe block lands in 2j-1; trigger-site describe
// blocks (aiTurn / combat / build) are appended as each hook ships.

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { G } from '../src/core/state';
import {
  clearTelemetryLog,
  dumpTelemetry,
  getTelemetryLog,
  isTelemetryEnabled,
  recordTelemetry,
  setTelemetryEnabled,
} from '../src/systems/telemetry';
import { runAITurn } from '../src/systems/turn';
import { hexKey } from '../src/core/hex';
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

function resetWorld(): void {
  clearTelemetryLog();
  setTelemetryEnabled(true);
  G.map = null;
  G.units = [];
  G.cities = [];
  G.factions = [makeFaction(0, false), makeFaction(1, true)];
  G.playerFactionIdx = 0 as FactionIdx;
  G.currentFactionIdx = 1 as FactionIdx;
  G.gameOver = false;
  G.events = [];
  G.aiMemory = {};
  G.turn = 5;
  G.selected = null;
  G.moveTargets = [];
  G.attackTargets = [];
  G.sabotageTargets = [];
  G.goldHegemonyCounter = {};
  G.culturalHegemonyCounter = {};
  G.culturalHegemonyEnabled = false;
  G.goldHegemonyThreshold = 1_000_000;
}

describe('telemetry module', () => {
  beforeEach(() => {
    clearTelemetryLog();
    setTelemetryEnabled(true);
    G.seed = 42;
    G.turn = 1;
  });

  it('records an event into the log', () => {
    recordTelemetry({ kind: 'aiTurn', turn: 1, faction: 1, durationMs: 12.4 });
    expect(getTelemetryLog()).toEqual([
      { kind: 'aiTurn', turn: 1, faction: 1, durationMs: 12.4 },
    ]);
  });

  it('is a no-op when disabled', () => {
    setTelemetryEnabled(false);
    expect(isTelemetryEnabled()).toBe(false);
    recordTelemetry({
      kind: 'combat',
      turn: 1,
      attacker: 0,
      defender: 1,
      dmg: 5,
      vsCity: false,
    });
    expect(getTelemetryLog()).toEqual([]);
  });

  it('clearTelemetryLog wipes the log', () => {
    recordTelemetry({ kind: 'aiTurn', turn: 1, faction: 1, durationMs: 1 });
    recordTelemetry({ kind: 'aiTurn', turn: 1, faction: 2, durationMs: 2 });
    expect(getTelemetryLog().length).toBe(2);
    clearTelemetryLog();
    expect(getTelemetryLog()).toEqual([]);
  });

  it('dumpTelemetry produces version + seed + turn + events shape', () => {
    G.seed = 99;
    G.turn = 7;
    recordTelemetry({ kind: 'build', turn: 7, faction: 1, cityId: 3, pick: 'walls' });
    const dump = dumpTelemetry();
    expect(dump.version).toBe(1);
    expect(dump.seed).toBe(99);
    expect(dump.turn).toBe(7);
    expect(dump.events).toEqual([
      { kind: 'build', turn: 7, faction: 1, cityId: 3, pick: 'walls' },
    ]);
  });

  it('persists the enabled flag to localStorage', () => {
    setTelemetryEnabled(false);
    expect(localStorage.getItem('cogfall:telemetry:enabled')).toBe('0');
    setTelemetryEnabled(true);
    expect(localStorage.getItem('cogfall:telemetry:enabled')).toBe('1');
  });
});

describe('telemetry trigger sites: aiTurn', () => {
  beforeEach(() => {
    resetWorld();
  });

  it('runAITurn records one aiTurn event with faction idx, turn, and a non-negative duration', () => {
    vi.useFakeTimers();
    buildPlainsMap();
    try {
      runAITurn(G.factions[1]);
      // Outer setTimeout: AI_THINK_BASE_MS (450) + jitter up to AI_THINK_JITTER_MS (300).
      // Advancing 800ms fires that callback (where the hook lives) but leaves the
      // inner endTurn setTimeout pending, so test state stays clean.
      vi.advanceTimersByTime(800);
    } catch {
      // Defensive: aiPlayTurn could throw on minimal state in jsdom; the
      // log assertion below is the source of truth either way.
    }
    const events = getTelemetryLog().filter((e) => e.kind === 'aiTurn');
    expect(events.length).toBe(1);
    expect(events[0]).toMatchObject({ kind: 'aiTurn', turn: 5, faction: 1 });
    expect((events[0] as { durationMs: number }).durationMs).toBeGreaterThanOrEqual(0);
    vi.useRealTimers();
  });
});
