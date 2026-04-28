// Tech selection. Score every available tech with a personality-weighted
// formula plus a small jitter; return the top scorer's id. The jitter is
// rng-injectable so tests can pin selection given a personality.

import { defaultRng, type Rng } from '../core/rng';
import type { Faction, TechId } from '../core/types';
import { PERSONALITIES } from '../data/personalities';
import { getAvailableTechs } from '../systems/research';

export function aiPickTech(faction: Faction, rng: Rng = defaultRng): TechId | null {
  const avail = getAvailableTechs(faction);
  if (!avail.length) return null;
  const p = PERSONALITIES[faction.personality];

  const scored = avail.map((t) => {
    let score = 100 - t.cost * 0.1;
    if (t.branch === p.prefBranch) score += 60;
    if (t.branch === 'science') score += p.sci * 30;
    if (t.branch === 'industry') score += (p.mil + p.econ) * 20;
    if (t.branch === 'economy') score += p.econ * 30;
    if (t.branch === 'expansion') score += p.expand * 25;
    // 2g-5: culture branch is gated on the dim added in 2g-1. Linear
    // weight matches the 'science'/'economy' branches above; high-
    // culture personalities (defensive 0.65, scientific 0.55, economic
    // 0.5) drift toward lithography/salons over more contested
    // industry picks.
    if (t.branch === 'culture') score += p.culture * 30;
    if ('unlocks' in t && t.unlocks) score += 40 * p.mil;
    if (t.id === 'grand_apparatus') score += 120 + p.sci * 60;
    if (t.id === 'gunpowder' && p.mil > 0.6) score += 50;
    if (t.id === 'steam_armor') score += 35 * p.mil;
    if (t.id === 'aether_war') score += 30 * p.sci;
    score += rng() * 8;
    return { id: t.id, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].id as TechId;
}
