// Espionage actions. Resolved with the seeded game rng so replay parity
// holds (decision-log #2). The only action this phase is steal_tech;
// sabotage-building and counter-spy defer to a 2f follow-up.

import { hexNeighbors } from '../core/hex';
import { log } from '../core/log';
import { getGameRng } from '../core/rng';
import { G, getCityAt } from '../core/state';
import type { City, TechId, Unit } from '../core/types';
import { TECHS } from '../data/techs';
import { killUnit } from './movement';

export function adjacentSabotageTargets(unit: Unit): { q: number; r: number }[] {
  const out: { q: number; r: number }[] = [];
  for (const n of hexNeighbors(unit.q, unit.r)) {
    const c = getCityAt(n.q, n.r);
    if (!c || c.factionIdx === unit.factionIdx) continue;
    out.push({ q: n.q, r: n.r });
  }
  return out;
}

export function stealableTechs(thiefIdx: number, victimIdx: number): TechId[] {
  const thief = G.factions[thiefIdx];
  const victim = G.factions[victimIdx];
  const pool: TechId[] = [];
  for (const techId of victim.techs) {
    if (thief.techs.has(techId)) continue;
    const t = TECHS[techId];
    if ('isVictory' in t && t.isVictory) continue;
    pool.push(techId);
  }
  return pool;
}

export function stealTech(saboteur: Unit, victimCity: City): void {
  const thief = G.factions[saboteur.factionIdx];
  const pool = stealableTechs(saboteur.factionIdx, victimCity.factionIdx);
  if (pool.length === 0) {
    log(
      `${thief.name} saboteur slipped into ${victimCity.name} but found nothing worth taking.`,
      'warning'
    );
    killUnit(saboteur);
    return;
  }
  const rng = getGameRng();
  const idx = Math.floor(rng() * pool.length);
  const stolen = pool[idx];
  thief.techs.add(stolen);
  log(`${thief.name} stole ${TECHS[stolen].name} from ${victimCity.name}!`, 'tech');
  killUnit(saboteur);
}
