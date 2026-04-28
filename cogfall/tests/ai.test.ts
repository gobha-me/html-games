import { describe, expect, it } from 'vitest';
import { aiPickTech } from '../src/ai/techAI';
import { createSeededRng } from '../src/core/rng';
import type { Faction, FactionIdx } from '../src/core/types';
import { TECHS } from '../src/data/techs';

function makeFaction(personality: Faction['personality']): Faction {
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
  };
}

describe('aiPickTech', () => {
  it('returns null when no techs are available', () => {
    const f = makeFaction('scientific');
    // Mark every tech as researched.
    for (const id of Object.keys(TECHS)) f.techs.add(id as keyof typeof TECHS);
    expect(aiPickTech(f, createSeededRng(1))).toBeNull();
  });

  it('returns a deterministic choice for a fixed seed and personality', () => {
    const a = aiPickTech(makeFaction('scientific'), createSeededRng(42));
    const b = aiPickTech(makeFaction('scientific'), createSeededRng(42));
    expect(a).toBe(b);
    expect(a).not.toBeNull();
  });

  it('biases scientific personalities toward science-branch picks at turn 0', () => {
    // The scientific personality has prefBranch='science' and a +60 score
    // boost for that branch; with the small ±0..8 jitter, the first pick
    // should fall in the science branch a strong majority of the time.
    let scienceCount = 0;
    const trials = 50;
    for (let seed = 1; seed <= trials; seed++) {
      const f = makeFaction('scientific');
      const pick = aiPickTech(f, createSeededRng(seed));
      if (!pick) continue;
      if (TECHS[pick].branch === 'science') scienceCount++;
    }
    expect(scienceCount).toBeGreaterThan(trials * 0.7);
  });

  it('biases industrial personalities toward industry-branch picks', () => {
    let industryCount = 0;
    const trials = 50;
    for (let seed = 1; seed <= trials; seed++) {
      const f = makeFaction('industrial');
      const pick = aiPickTech(f, createSeededRng(seed));
      if (!pick) continue;
      if (TECHS[pick].branch === 'industry') industryCount++;
    }
    expect(industryCount).toBeGreaterThan(trials * 0.5);
  });
});
