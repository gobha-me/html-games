// Research progression. processResearch() returns a flag indicating whether
// the ascension tech (grand_apparatus) was completed; the caller decides
// whether to trigger a victory. Returning a flag keeps research.ts free of
// a backward dependency on the turn loop's victory triggers (which live in
// systems/turn.ts, extracted in step 6).

import { log } from '../core/log';
import type { Faction } from '../core/types';
import { TECHS } from '../data/techs';
import { getVictoryProfile } from '../data/factions';
import { emit } from '../render/animations';

export interface ResearchResult {
  ascensionTriggered: boolean;
}

/**
 * S7: per-faction tech-cost override. Currently only grand_apparatus is
 * overridable (Aetheric Order's 320-vs-360 ascension discount), but the
 * lookup is keyed on tech id so adding more is just another field on
 * VictoryProfile. Returns the default tech.cost when no override applies,
 * so Cogwright (and every faction × non-Apparatus tech) stays byte-equal.
 */
function getTechCost(faction: Faction, techId: keyof typeof TECHS): number {
  const baseCost = TECHS[techId].cost;
  if (techId === 'grand_apparatus') {
    return getVictoryProfile(faction.idx)?.grandApparatusCost ?? baseCost;
  }
  return baseCost;
}

// S7: cost is widened from each tech's literal (e.g. `cost: 30`) to `number`
// because getAvailableTechs may now substitute a faction-specific override
// (Aetheric's grand_apparatus 320 vs default 360). Other fields keep their
// narrow literal types so AI scoring (`t.branch === 'science'`) and the
// tech modal continue to compile against the union.
export type AvailableTech = { id: string; cost: number } & Omit<
  (typeof TECHS)[keyof typeof TECHS],
  'cost'
>;

export function getAvailableTechs(faction: Faction): AvailableTech[] {
  return Object.entries(TECHS)
    .filter(([id, tech]) => {
      if (faction.techs.has(id as keyof typeof TECHS)) return false;
      return tech.prereqs.every((p) => faction.techs.has(p as keyof typeof TECHS));
    })
    .map(([id, tech]) => ({ id, ...tech, cost: getTechCost(faction, id as keyof typeof TECHS) }));
}

export function processResearch(faction: Faction): ResearchResult {
  if (!faction.currentResearch) {
    faction.science = 0;
    return { ascensionTriggered: false };
  }
  const tech = TECHS[faction.currentResearch];
  const cost = getTechCost(faction, faction.currentResearch);
  faction.researchProgress = (faction.researchProgress || 0) + faction.science;
  let ascensionTriggered = false;
  if (faction.researchProgress >= cost) {
    faction.techs.add(faction.currentResearch);
    log(`${faction.name} has rediscovered ${tech.name}!`, 'tech', true);
    faction.researchProgress = 0;
    const completed = faction.currentResearch;
    faction.currentResearch = null;
    emit({ type: 'techComplete', factionIdx: faction.idx, techId: completed });
    if (completed === 'grand_apparatus') ascensionTriggered = true;
  }
  faction.science = 0;
  return { ascensionTriggered };
}
