// Phase 3 S7: per-faction tech-cost overrides via getVictoryProfile.
//
// processResearch and getAvailableTechs route grand_apparatus cost reads
// through getTechCost, which prefers the faction's VictoryProfile override
// when present. Aetheric Order is the only faction with an override
// (grandApparatusCost: 320); every other faction reads TECHS.grand_apparatus.cost
// (360) and stays byte-equal to pre-S7.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { processResearch, getAvailableTechs } from '../src/systems/research';
import { FACTIONS, getVictoryProfile } from '../src/data/factions';
import { TECHS } from '../src/data/techs';
import type { Faction, FactionIdx } from '../src/core/types';

function makeFaction(idx: number): Faction {
  const tpl = FACTIONS[idx];
  return {
    idx: idx as FactionIdx,
    id: tpl.id,
    name: tpl.name,
    color: tpl.color,
    glyph: tpl.glyph,
    personality: tpl.personality,
    desc: tpl.desc,
    isAI: false,
    alive: true,
    resources: { gold: 0, aether: 0 },
    science: 0,
    researchProgress: 0,
    techs: new Set(tpl.startTechs),
    currentResearch: null,
    score: 0,
    diplo: {},
  };
}

describe('S7: per-faction grand_apparatus cost override', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('declares Aetheric override at 320 and leaves the four other factions unset', () => {
    expect(getVictoryProfile(1 as FactionIdx)?.grandApparatusCost).toBe(320);
    expect(getVictoryProfile(0 as FactionIdx)?.grandApparatusCost).toBeUndefined();
    expect(getVictoryProfile(2 as FactionIdx)?.grandApparatusCost).toBeUndefined();
    expect(getVictoryProfile(3 as FactionIdx)?.grandApparatusCost).toBeUndefined();
    expect(getVictoryProfile(4 as FactionIdx)?.grandApparatusCost).toBeUndefined();
  });

  it('Aetheric completes grand_apparatus at 320 science (40 cheaper than default)', () => {
    const aetheric = makeFaction(1); // idx 1 → Aetheric Order
    // Stock the prereqs so currentResearch is legal — the cost branch is
    // what we're exercising, not the prereq filter.
    for (const p of TECHS.grand_apparatus.prereqs) {
      aetheric.techs.add(p as keyof typeof TECHS);
    }
    aetheric.currentResearch = 'grand_apparatus';
    aetheric.researchProgress = 0;
    aetheric.science = 320;

    const result = processResearch(aetheric);

    expect(result.ascensionTriggered).toBe(true);
    expect(aetheric.techs.has('grand_apparatus')).toBe(true);
    expect(aetheric.currentResearch).toBeNull();
  });

  it('Cogwright (no override) does NOT complete grand_apparatus at 320 — needs 360', () => {
    const cogwright = makeFaction(0); // idx 0 → Cogwright (byte-equal control)
    for (const p of TECHS.grand_apparatus.prereqs) {
      cogwright.techs.add(p as keyof typeof TECHS);
    }
    cogwright.currentResearch = 'grand_apparatus';
    cogwright.researchProgress = 0;
    cogwright.science = 320; // mid-progress, well short of 360

    const result = processResearch(cogwright);

    expect(result.ascensionTriggered).toBe(false);
    expect(cogwright.techs.has('grand_apparatus')).toBe(false);
    expect(cogwright.currentResearch).toBe('grand_apparatus');
    expect(cogwright.researchProgress).toBe(320);
  });

  it('Cogwright completes grand_apparatus at 360 — byte-equal to pre-S7', () => {
    const cogwright = makeFaction(0);
    for (const p of TECHS.grand_apparatus.prereqs) {
      cogwright.techs.add(p as keyof typeof TECHS);
    }
    cogwright.currentResearch = 'grand_apparatus';
    cogwright.researchProgress = 0;
    cogwright.science = TECHS.grand_apparatus.cost;

    const result = processResearch(cogwright);

    expect(result.ascensionTriggered).toBe(true);
    expect(cogwright.techs.has('grand_apparatus')).toBe(true);
  });

  it('getAvailableTechs reports adjusted cost so the AI/UI see Aetheric paying 320', () => {
    const aetheric = makeFaction(1);
    for (const p of TECHS.grand_apparatus.prereqs) {
      aetheric.techs.add(p as keyof typeof TECHS);
    }

    const avail = getAvailableTechs(aetheric);
    const apparatus = avail.find((t) => t.id === 'grand_apparatus');
    expect(apparatus).toBeDefined();
    expect(apparatus!.cost).toBe(320);

    // Other techs keep their default costs (no override is keyed on them).
    const others = avail.filter((t) => t.id !== 'grand_apparatus');
    for (const t of others) {
      expect(t.cost).toBe(TECHS[t.id as keyof typeof TECHS].cost);
    }
  });

  it('getAvailableTechs leaves Cogwright at default 360 — byte-equal to pre-S7', () => {
    const cogwright = makeFaction(0);
    for (const p of TECHS.grand_apparatus.prereqs) {
      cogwright.techs.add(p as keyof typeof TECHS);
    }

    const avail = getAvailableTechs(cogwright);
    const apparatus = avail.find((t) => t.id === 'grand_apparatus');
    expect(apparatus).toBeDefined();
    expect(apparatus!.cost).toBe(TECHS.grand_apparatus.cost);
    expect(apparatus!.cost).toBe(360);
  });

  it('non-apparatus techs are unaffected by the override (Aetheric pays default for everything else)', () => {
    // Even though Aetheric has a VictoryProfile, getTechCost only branches on
    // techId === 'grand_apparatus'. Pin this so a future override field for
    // another tech can't silently land here.
    const aetheric = makeFaction(1);
    const avail = getAvailableTechs(aetheric);
    for (const t of avail) {
      if (t.id === 'grand_apparatus') continue;
      expect(t.cost).toBe(TECHS[t.id as keyof typeof TECHS].cost);
    }
  });
});
