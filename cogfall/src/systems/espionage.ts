// Espionage actions. Resolved with the seeded game rng so replay parity
// holds (decision-log #2). Phase 2e introduced steal_tech; Phase 2f-4 added
// sabotage-building (industrial espionage — excludes walls and citadel);
// Phase 2f-5 adds detection rolls (counter-spy).
//
// Replay-parity note: rollSpyDetection runs *after* the empty-pool early
// return inside stealTech / sabotageBuilding, so empty-pool actions remain
// cursor-stable. Non-empty-pool actions consume one extra rng draw (the
// detection roll) before the resolution rng — pre-2f-5 saves loaded with
// in-flight saboteurs may produce different specific outcomes, but the
// system as a whole stays seed-deterministic going forward.

import { hexNeighbors } from '../core/hex';
import { log } from '../core/log';
import { getGameRng } from '../core/rng';
import { G, getCityAt } from '../core/state';
import type { BuildingId, City, TechId, Unit } from '../core/types';
import { PERSONALITIES } from '../data/personalities';
import { TECHS } from '../data/techs';
import { killUnit } from './movement';

const SABOTAGE_EXCLUDED: ReadonlySet<BuildingId> = new Set<BuildingId>(['walls', 'citadel']);

// Detection-roll constants. Tuned so even the worst attacker/defender
// matchup keeps detection ∈ [5%, 65%] — there is always *some* risk and
// cunning isn't a wall. Defender weight > attacker weight so the action
// favors home turf — an espionage gameplay choice we may revisit.
const DETECTION_BASE = 0.2;
const DETECTION_DEFENDER_WEIGHT = 0.3;
const DETECTION_ATTACKER_WEIGHT = 0.2;
const DETECTION_MIN = 0.05;
const DETECTION_MAX = 0.65;
const DETECTION_GRUDGE = 30;

export interface SpyDetection {
  detected: boolean;
  chance: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function rollSpyDetection(saboteur: Unit, victimCity: City): SpyDetection {
  const attacker = G.factions[saboteur.factionIdx];
  const defender = G.factions[victimCity.factionIdx];
  const a = PERSONALITIES[attacker.personality].cunning;
  const d = PERSONALITIES[defender.personality].cunning;
  const chance = clamp(
    DETECTION_BASE + d * DETECTION_DEFENDER_WEIGHT - a * DETECTION_ATTACKER_WEIGHT,
    DETECTION_MIN,
    DETECTION_MAX
  );
  const detected = getGameRng()() < chance;
  return { detected, chance };
}

function applyDetectionConsequences(saboteur: Unit, victimCity: City): void {
  const attacker = G.factions[saboteur.factionIdx];
  const defender = G.factions[victimCity.factionIdx];
  const defMem = G.aiMemory[defender.idx];
  if (defMem) {
    defMem.grudges[attacker.idx] = (defMem.grudges[attacker.idx] ?? 0) + DETECTION_GRUDGE;
  }
  log(`${attacker.name} spy caught in ${victimCity.name}!`, 'warning', true);
  killUnit(saboteur);
}

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
  // Detection roll runs only when there is something to steal — keeps the
  // empty-pool path rng-cursor-stable across the 2f-5 upgrade boundary.
  if (rollSpyDetection(saboteur, victimCity).detected) {
    applyDetectionConsequences(saboteur, victimCity);
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
  // Detection roll runs only when there is something to wreck — same
  // cursor-stability invariant as stealTech.
  if (rollSpyDetection(saboteur, victimCity).detected) {
    applyDetectionConsequences(saboteur, victimCity);
    return;
  }
  const rng = getGameRng();
  const idx = Math.floor(rng() * pool.length);
  const target = pool[idx];
  victimCity.buildings.delete(target);
  log(`${thief.name} sabotaged ${target} in ${victimCity.name}!`, 'tech');
  killUnit(saboteur);
}
