// Phase 3 S1 — bus integration smoke. Drives each system path that the
// roadmap names as an emit site and asserts the event reaches a
// subscriber. These events are scaffolding (no runtime subscribers ship
// in S1) — this test is the seam-guard against a future commit silently
// removing the emit call. S4/S6 will replace this with subscriber-side
// behavioral tests.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { G } from '../src/core/state';
import { generateMap } from '../src/systems/mapgen';
import { createSeededRng, initGameRng } from '../src/core/rng';
import { FACTIONS } from '../src/data/factions';
import { processResearch } from '../src/systems/research';
import { processCity } from '../src/systems/city';
import { createCity } from '../src/systems/city';
import { createUnit, killUnit } from '../src/systems/movement';
import { endTurn, triggerVictory } from '../src/systems/turn';
import { clearAllAnimSubscribers, on } from '../src/render/animations';
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

function resetGame(): void {
  G.map = generateMap('small', createSeededRng(7));
  G.factions = [makeFaction(0, false), makeFaction(1, true)];
  G.units = [];
  G.cities = [];
  G.events = [];
  G.aiMemory = {};
  G.gameOver = false;
  G.turn = 3;
  G.nextUnitId = 1;
  G.nextCityId = 1;
  G.currentFactionIdx = 0 as FactionIdx;
  G.playerFactionIdx = 0 as FactionIdx;
  G.controlMode = 'single';
  G.humanFactionIdxs = [0 as FactionIdx];
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
  G.culturalHegemonyEnabled = false;
  G.selected = null;
  G.moveTargets = [];
  G.attackTargets = [];
  initGameRng(7);
}

beforeEach(() => {
  localStorage.clear();
  resetGame();
});

afterEach(() => {
  clearAllAnimSubscribers();
});

describe('animation bus — scaffolding emit sites', () => {
  it('endTurn emits turnEnd', () => {
    const handler = vi.fn();
    on('turnEnd', handler);
    endTurn();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({
      type: 'turnEnd',
      factionIdx: 0,
    });
  });

  it('triggerVictory emits victoryReached', () => {
    const handler = vi.fn();
    on('victoryReached', handler);
    triggerVictory(0 as FactionIdx, 'domination');
    expect(handler).toHaveBeenCalledWith({
      type: 'victoryReached',
      factionIdx: 0,
      victoryType: 'domination',
    });
  });

  it('processResearch emits techComplete on completion', () => {
    const handler = vi.fn();
    on('techComplete', handler);
    const fac = G.factions[0];
    fac.currentResearch = 'rediscovery';
    fac.researchProgress = 0;
    fac.science = 999;
    processResearch(fac);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({
      type: 'techComplete',
      factionIdx: 0,
      techId: 'rediscovery',
    });
  });

  it('processCity emits cityBuilt when a queued item completes', () => {
    const handler = vi.fn();
    on('cityBuilt', handler);
    const city = createCity(0 as FactionIdx, 0, 0, 'TestTown');
    city.buildQueue = [{ kind: 'building', id: 'walls' }];
    city.productionStored = 9999;
    processCity(city);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({
      type: 'cityBuilt',
      cityId: city.id,
      factionIdx: 0,
      buildKind: 'building',
      buildId: 'walls',
    });
    expect(city.buildQueue).toHaveLength(0);
  });

  it('killUnit emits unitKilled', () => {
    const handler = vi.fn();
    on('unitKilled', handler);
    const unit = createUnit('SCOUT', 0 as FactionIdx, 0, 0);
    killUnit(unit);
    expect(handler).toHaveBeenCalledWith({
      type: 'unitKilled',
      unitId: unit.id,
      factionIdx: 0,
      q: 0,
      r: 0,
    });
  });
});
