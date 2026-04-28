// Research progression. processResearch() returns a flag indicating whether
// the ascension tech (grand_apparatus) was completed; the caller decides
// whether to trigger a victory. Returning a flag keeps research.ts free of
// a backward dependency on the turn loop's victory triggers (which live in
// systems/turn.ts, extracted in step 6).

import { log } from '../core/log';
import type { Faction } from '../core/types';
import { TECHS } from '../data/techs';

export interface ResearchResult {
  ascensionTriggered: boolean;
}

export function getAvailableTechs(faction: Faction): Array<{ id: string } & (typeof TECHS)[keyof typeof TECHS]> {
  return Object.entries(TECHS)
    .filter(([id, tech]) => {
      if (faction.techs.has(id as keyof typeof TECHS)) return false;
      return tech.prereqs.every((p) => faction.techs.has(p as keyof typeof TECHS));
    })
    .map(([id, tech]) => ({ id, ...tech }));
}

export function processResearch(faction: Faction): ResearchResult {
  if (!faction.currentResearch) {
    faction.science = 0;
    return { ascensionTriggered: false };
  }
  const tech = TECHS[faction.currentResearch];
  faction.researchProgress = (faction.researchProgress || 0) + faction.science;
  let ascensionTriggered = false;
  if (faction.researchProgress >= tech.cost) {
    faction.techs.add(faction.currentResearch);
    log(`${faction.name} has rediscovered ${tech.name}!`, 'tech', true);
    faction.researchProgress = 0;
    const completed = faction.currentResearch;
    faction.currentResearch = null;
    if (completed === 'grand_apparatus') ascensionTriggered = true;
  }
  faction.science = 0;
  return { ascensionTriggered };
}
