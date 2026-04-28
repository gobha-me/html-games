// City build-queue selection. Scores buildings and unit options with a
// personality-weighted formula similar to techAI, then returns the top
// scorer (with a 15% chance of picking the second-best for variety).

import { defaultRng, type Rng } from '../core/rng';
import { G, getTile } from '../core/state';
import type { BuildQueue, City, Faction, UnitTypeId } from '../core/types';
import { BUILDING_TYPES } from '../data/buildings';
import { UNIT_TYPES, isNaval, isSpy } from '../data/units';
import { PERSONALITIES } from '../data/personalities';
import { isCoast } from '../systems/mapgen';

const SECOND_BEST_VARIATION_CHANCE = 0.15;
const PIONEER_LATE_PENALTY_TURN = 30;

export function aiPickBuild(
  faction: Faction,
  city: City,
  rng: Rng = defaultRng
): BuildQueue | null {
  const p = PERSONALITIES[faction.personality];
  const phase = G.aiMemory[faction.idx]?.strategicPhase;
  const myCityCount = G.cities.filter((c) => c.factionIdx === faction.idx).length;
  const myUnits = G.units.filter((u) => u.factionIdx === faction.idx);
  const myMilUnits = myUnits.filter((u) => UNIT_TYPES[u.typeId].atk > 0);
  const myPioneers = myUnits.filter((u) => u.typeId === 'PIONEER').length;
  const atWar = G.factions.some((_, i) => i !== faction.idx && faction.diplo[i] === 'war');
  const garrison = myUnits.find(
    (u) => u.q === city.q && u.r === city.r && UNIT_TYPES[u.typeId].atk > 0
  );

  type Option = BuildQueue & { score: number };
  const options: Option[] = [];

  for (const [bid, b] of Object.entries(BUILDING_TYPES)) {
    if (city.buildings.has(bid as keyof typeof BUILDING_TYPES)) continue;
    if ('requires' in b && b.requires && !faction.techs.has(b.requires)) continue;
    let score = 30;
    if (bid === 'workshop') score += 50;
    if (bid === 'granary') score += 30 + (city.population < 3 ? 30 : 0);
    if (bid === 'walls') score += 30 + (atWar ? 40 : 0) + p.defenseFocus * 30;
    if (bid === 'foundry') score += 50 * p.econ;
    if (bid === 'bank') score += 60 * p.econ;
    if (bid === 'library') score += 60 * p.sci;
    if (bid === 'spire') score += 70 * p.sci;
    if (bid === 'academy') score += 80 * p.sci;
    if (bid === 'citadel') score += 50 * p.defenseFocus + (atWar ? 30 : 0);
    // 2g-5: culture buildings — peacetime priorities. Weights tuned so
    // a defensive faction (p.culture=0.65) at peace, with a settled
    // garrison and full military bench, will reliably reach for
    // opera_house ahead of more COGMAN. The atWar penalty flips the
    // priority back toward walls / military, then slides back once
    // fighting eases. Low-culture personalities (militaristic 0.20)
    // never get a meaningful score even at peace — the bias is real.
    if (bid === 'printing_press') score += 60 * p.culture - (atWar ? 30 : 0);
    if (bid === 'opera_house') score += 85 * p.culture - (atWar ? 40 : 0);
    score -= b.cost * 0.15;
    options.push({ kind: 'building', id: bid as keyof typeof BUILDING_TYPES, score });
  }

  const milTypes: UnitTypeId[] = (
    ['AETHERMECH', 'STEAMTANK', 'MUSKETEER', 'COGMAN'] as const
  ).filter((t) => {
    const tpl = UNIT_TYPES[t];
    return !('requires' in tpl) || !tpl.requires || faction.techs.has(tpl.requires);
  });
  const bestMil = milTypes[0];
  if (bestMil) {
    let score = 30 + p.mil * 60;
    if (atWar) score += 80;
    if (!garrison) score += 50;
    if (myMilUnits.length < myCityCount * 2) score += 30;
    if (phase === 'contest') score += 25;
    score -= UNIT_TYPES[bestMil].cost * 0.1;
    options.push({ kind: 'unit', id: bestMil, score });
  }

  const cityTile = getTile(city.q, city.r);
  const coastal = !!(cityTile && G.map && isCoast(cityTile, G.map));
  if (coastal) {
    const navalTypes: UnitTypeId[] = (
      ['AETHER_FRIGATE', 'IRONCLAD', 'STEAMSHIP'] as const
    ).filter((t) => {
      const tpl = UNIT_TYPES[t];
      return !('requires' in tpl) || !tpl.requires || faction.techs.has(tpl.requires);
    });
    const bestNaval = navalTypes[0];
    if (bestNaval) {
      let score = 28 + p.mil * 40;
      if (atWar) score += 40;
      const myNaval = myUnits.filter((u) => isNaval(u.typeId)).length;
      if (myNaval < myCityCount) score += 20;
      score -= UNIT_TYPES[bestNaval].cost * 0.1;
      options.push({ kind: 'unit', id: bestNaval, score });
    }
  }

  if (faction.techs.has('espionage')) {
    const ownedSaboteurs = myUnits.filter((u) => isSpy(u.typeId)).length;
    if (ownedSaboteurs < 1) {
      let score = 22 + p.agg * 35;
      if (atWar) score += 25;
      score -= UNIT_TYPES.SABOTEUR.cost * 0.1;
      options.push({ kind: 'unit', id: 'SABOTEUR', score });
    }
  }

  if (phase === 'expand' && myPioneers < 1 && myCityCount < 5) {
    let score = 80 + p.expand * 40;
    if (G.turn > PIONEER_LATE_PENALTY_TURN) score -= 20;
    if (myCityCount >= 4) score -= 40;
    options.push({ kind: 'unit', id: 'PIONEER', score });
  }

  const scouts = myUnits.filter((u) => u.typeId === 'SCOUT').length;
  if (G.turn < 20 && scouts < 1) {
    options.push({ kind: 'unit', id: 'SCOUT', score: 50 });
  }

  const workers = myUnits.filter((u) => u.typeId === 'WORKER').length;
  if (myCityCount >= 2 && workers < myCityCount) {
    options.push({ kind: 'unit', id: 'WORKER', score: 40 + p.econ * 30 });
  }

  if (!options.length) return null;
  options.sort((a, b) => b.score - a.score);
  const pick = options.length > 1 && rng() < SECOND_BEST_VARIATION_CHANCE ? options[1] : options[0];
  // Strip score before returning.
  return { kind: pick.kind, id: pick.id } as BuildQueue;
}
