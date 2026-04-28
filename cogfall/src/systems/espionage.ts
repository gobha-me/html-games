// Espionage actions. Resolved with the seeded game rng so replay parity
// holds (decision-log #2). Phase 2e introduced steal_tech; Phase 2f-4 adds
// sabotage-building (industrial espionage — excludes walls and citadel).
// Counter-spy / detection rolls land in 2f-5.

import { hexNeighbors } from '../core/hex';
import { log } from '../core/log';
import { getGameRng } from '../core/rng';
import { G, getCityAt } from '../core/state';
import type { BuildingId, City, TechId, Unit } from '../core/types';
import { TECHS } from '../data/techs';
import { killUnit } from './movement';

const SABOTAGE_EXCLUDED: ReadonlySet<BuildingId> = new Set<BuildingId>(['walls', 'citadel']);

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

// Phase 2f-4: industrial-espionage variant. Returns the buildings that a
// saboteur is allowed to wreck — walls and citadels are off-limits because
// breaching fortifications is a siege act, not a spy act. The exclusion is
// codified in SABOTAGE_EXCLUDED so future buildings inherit the rule by
// default unless explicitly added.
export function sabotageableBuildings(victimCity: City): BuildingId[] {
  const out: BuildingId[] = [];
  for (const b of victimCity.buildings) {
    if (SABOTAGE_EXCLUDED.has(b)) continue;
    out.push(b);
  }
  return out;
}

export function sabotageBuilding(saboteur: Unit, victimCity: City): void {
  const thief = G.factions[saboteur.factionIdx];
  const pool = sabotageableBuildings(victimCity);
  if (pool.length === 0) {
    log(
      `${thief.name} saboteur slipped into ${victimCity.name} but found nothing worth wrecking.`,
      'warning'
    );
    killUnit(saboteur);
    return;
  }
  const rng = getGameRng();
  const idx = Math.floor(rng() * pool.length);
  const target = pool[idx];
  victimCity.buildings.delete(target);
  log(`${thief.name} sabotaged ${target} in ${victimCity.name}!`, 'tech');
  killUnit(saboteur);
}
