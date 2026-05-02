import { describe, expect, it } from 'vitest';
import {
  pickBuildOverride,
  pickTechOverride,
  resolveBehavior,
  unitPriorityOverride,
  type AIBehavior,
} from '../src/ai/behavior';
import { createSeededRng } from '../src/core/rng';
import { asFactionIdx } from '../src/core/types';
import type { BuildQueue, Faction, FactionIdx, Unit } from '../src/core/types';
import { PERSONALITIES } from '../src/data/personalities';

function makeFaction(personality: Faction['personality'], behavior?: AIBehavior): Faction {
  return {
    idx: 0 as FactionIdx,
    id: 'cogwright',
    name: 'Test',
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
    behavior,
  };
}

describe('resolveBehavior', () => {
  it('returns the unmodified PERSONALITIES row when no behavior is set', () => {
    const f = makeFaction('industrial');
    expect(resolveBehavior(f)).toEqual(PERSONALITIES.industrial);
  });

  it('overlays scalar overrides on top of the personality template', () => {
    const f = makeFaction('industrial', { mil: 0.99, agg: 0.88 });
    const r = resolveBehavior(f);
    expect(r.mil).toBe(0.99);
    expect(r.agg).toBe(0.88);
    expect(r.sci).toBe(PERSONALITIES.industrial.sci);
    expect(r.prefBranch).toBe(PERSONALITIES.industrial.prefBranch);
  });

  it('strips hooks from the merged scalars (hooks live alongside scalars on AIBehavior)', () => {
    const f = makeFaction('scientific', {
      mil: 0.5,
      pickTech: () => 'metallurgy',
    });
    const r = resolveBehavior(f);
    expect(r).not.toHaveProperty('pickTech');
    expect(r.mil).toBe(0.5);
  });
});

describe('hook accessors', () => {
  it('return null when no behavior is set', () => {
    const f = makeFaction('industrial');
    const u = { id: 1, typeId: 'COGMAN', factionIdx: asFactionIdx(0) } as Unit;
    expect(pickTechOverride(f, createSeededRng(1))).toBeNull();
    expect(pickBuildOverride(f, {} as never, createSeededRng(1))).toBeNull();
    expect(unitPriorityOverride(f, u)).toBeNull();
  });

  it('return null when behavior is set but the specific hook is absent', () => {
    const f = makeFaction('industrial', { mil: 0.9 });
    const u = { id: 1, typeId: 'COGMAN', factionIdx: asFactionIdx(0) } as Unit;
    expect(pickTechOverride(f, createSeededRng(1))).toBeNull();
    expect(pickBuildOverride(f, {} as never, createSeededRng(1))).toBeNull();
    expect(unitPriorityOverride(f, u)).toBeNull();
  });

  it('return the hook result when configured', () => {
    const f = makeFaction('industrial', {
      pickTech: () => 'metallurgy',
      pickBuild: () => ({ kind: 'building', id: 'walls' }) as BuildQueue,
      unitPriority: () => 7,
    });
    const u = { id: 1, typeId: 'COGMAN', factionIdx: asFactionIdx(0) } as Unit;
    expect(pickTechOverride(f, createSeededRng(1))).toBe('metallurgy');
    expect(pickBuildOverride(f, {} as never, createSeededRng(1))).toEqual({
      kind: 'building',
      id: 'walls',
    });
    expect(unitPriorityOverride(f, u)).toBe(7);
  });

  it('treat a hook returning null as "defer to default" — accessor returns null', () => {
    const f = makeFaction('industrial', { pickTech: () => null });
    expect(pickTechOverride(f, createSeededRng(1))).toBeNull();
  });
});
