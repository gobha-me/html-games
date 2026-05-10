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
import { clearAllAnimSubscribers, emit, on } from '../src/render/animations';
import { subscribeTurnEndAnim } from '../src/render/turnEndAnims';
import { subscribeTechCompleteAnim } from '../src/render/techCompleteAnims';
import {
  clearUnitKilledAnims,
  getActiveDeaths,
  subscribeUnitKilledAnim,
} from '../src/render/unitKilledAnims';
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
  document.body.innerHTML = '';
  clearUnitKilledAnims();
});

afterEach(() => {
  clearAllAnimSubscribers();
  clearUnitKilledAnims();
  document.body.innerHTML = '';
});

function mockReducedMotion(matches: boolean): () => void {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

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

describe('Phase 3 S4 — turnEndAnims subscriber', () => {
  it('shows the toast for the human player turn-end', () => {
    subscribeTurnEndAnim();
    endTurn();
    const el = document.getElementById('cogfall-turn-toast');
    expect(el).not.toBeNull();
    expect(el!.textContent ?? '').toMatch(/End of Turn 3/);
    expect(el!.classList.contains('show')).toBe(true);
  });

  it('suppresses the toast on AI faction turn-end', () => {
    subscribeTurnEndAnim();
    G.currentFactionIdx = 1 as FactionIdx;
    G.factions[1].alive = true;
    emit({ type: 'turnEnd', factionIdx: 1 as FactionIdx, turn: G.turn });
    const el = document.getElementById('cogfall-turn-toast');
    expect(el === null || !el.classList.contains('show')).toBe(true);
  });

  it('suppresses the toast during the hot-seat curtain', () => {
    subscribeTurnEndAnim();
    G.passoverActive = true;
    emit({ type: 'turnEnd', factionIdx: 0 as FactionIdx, turn: G.turn });
    const el = document.getElementById('cogfall-turn-toast');
    expect(el === null || !el.classList.contains('show')).toBe(true);
  });

  it('skips the show class when prefers-reduced-motion is set', () => {
    const restore = mockReducedMotion(true);
    try {
      subscribeTurnEndAnim();
      emit({ type: 'turnEnd', factionIdx: 0 as FactionIdx, turn: G.turn });
      const el = document.getElementById('cogfall-turn-toast');
      expect(el).not.toBeNull();
      expect(el!.textContent ?? '').toMatch(/End of Turn/);
      expect(el!.classList.contains('show')).toBe(false);
    } finally {
      restore();
    }
  });
});

describe('Phase 3 S4 — techCompleteAnims subscriber', () => {
  it('shows a tech-pop for the human player', () => {
    subscribeTechCompleteAnim();
    emit({ type: 'techComplete', factionIdx: 0 as FactionIdx, techId: 'metallurgy' });
    const el = document.getElementById('cogfall-tech-pop');
    expect(el).not.toBeNull();
    expect(el!.textContent ?? '').toMatch(/Discovery: Metallurgy/);
    expect(el!.classList.contains('show')).toBe(true);
  });

  it('suppresses the tech-pop for non-human factions', () => {
    subscribeTechCompleteAnim();
    emit({ type: 'techComplete', factionIdx: 1 as FactionIdx, techId: 'metallurgy' });
    const el = document.getElementById('cogfall-tech-pop');
    expect(el === null || !el.classList.contains('show')).toBe(true);
  });

  it('skips the show class when prefers-reduced-motion is set', () => {
    const restore = mockReducedMotion(true);
    try {
      subscribeTechCompleteAnim();
      emit({ type: 'techComplete', factionIdx: 0 as FactionIdx, techId: 'currency' });
      const el = document.getElementById('cogfall-tech-pop');
      expect(el).not.toBeNull();
      expect(el!.textContent ?? '').toMatch(/Discovery: Currency/);
      expect(el!.classList.contains('show')).toBe(false);
    } finally {
      restore();
    }
  });
});

describe('Phase 3 S6 — unitKilledAnims subscriber', () => {
  it('records an active death when a unit is killed', () => {
    subscribeUnitKilledAnim();
    const unit = createUnit('SCOUT', 0 as FactionIdx, 0, 0);
    killUnit(unit);
    const active = getActiveDeaths();
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ factionIdx: 0, q: 0, r: 0 });
    expect(active[0].t).toBeGreaterThanOrEqual(0);
    expect(active[0].t).toBeLessThan(1);
  });

  it('staggers multi-kill so consecutive deaths start at different times', () => {
    subscribeUnitKilledAnim();
    const u1 = createUnit('SCOUT', 0 as FactionIdx, 0, 0);
    const u2 = createUnit('SCOUT', 0 as FactionIdx, 1, 0);
    killUnit(u1);
    killUnit(u2);
    const active = getActiveDeaths();
    expect(active).toHaveLength(2);
    // Second death is staggered later, so its t is smaller (or zero
    // before its start time elapses).
    const tFirst = active.find((d) => d.q === 0)!.t;
    const tSecond = active.find((d) => d.q === 1)!.t;
    expect(tFirst).toBeGreaterThanOrEqual(tSecond);
  });

  it('skips death entries when prefers-reduced-motion is set', () => {
    const restore = mockReducedMotion(true);
    try {
      subscribeUnitKilledAnim();
      const unit = createUnit('SCOUT', 0 as FactionIdx, 0, 0);
      killUnit(unit);
      expect(getActiveDeaths()).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it('clearUnitKilledAnims drops in-flight deaths (passover curtain)', () => {
    subscribeUnitKilledAnim();
    const unit = createUnit('SCOUT', 0 as FactionIdx, 0, 0);
    killUnit(unit);
    expect(getActiveDeaths()).toHaveLength(1);
    clearUnitKilledAnims();
    expect(getActiveDeaths()).toHaveLength(0);
  });
});
