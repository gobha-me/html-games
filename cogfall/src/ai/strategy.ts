// AI top-level driver: aiPlayTurn() runs once per AI faction per turn and
// fans out into the sub-modules (tech, city, unit, diplo). The strategic
// phase ('expand' | 'fortify' | 'contest' | 'ascend') comes from
// updateAIStrategy() and biases everything downstream.

import { hexDistance } from '../core/hex';
import { G } from '../core/state';
import type { Faction, FactionIdx } from '../core/types';
import { UNIT_TYPES } from '../data/units';
import { PERSONALITIES } from '../data/personalities';
import { aiPickTech } from './techAI';
import { aiPickBuild } from './cityAI';
import { aiUnitTurn } from './unitAI';
import { aiDiplomacy, aiTelegraph } from './diploAI';

const EARLY_GAME_TURN = 25;
const EARLY_EXPAND_CITIES = 2;
const FORTIFY_STR_THRESHOLD = 0.2;
const FORTIFY_AGG_CEILING = 0.6;
const PIONEER_PRIORITY = 0;
const COMBAT_PRIORITY = 1;
const SCOUT_PRIORITY = 4;
const WORKER_PRIORITY = 5;

const CITY_STRENGTH_BASE = 5;
const CITY_STRENGTH_PER_POP = 2;

export function aiPlayTurn(faction: Faction): void {
  if (!faction.alive) return;
  updateAIStrategy(faction);
  if (!faction.currentResearch) {
    const c = aiPickTech(faction);
    if (c) faction.currentResearch = c;
  }
  for (const city of G.cities.filter((c) => c.factionIdx === faction.idx)) {
    if (!city.buildQueue) {
      const c = aiPickBuild(faction, city);
      if (c) city.buildQueue = c;
    }
  }
  const myUnits = G.units.filter((u) => u.factionIdx === faction.idx).slice();
  myUnits.sort((a, b) => aiUnitPriority(a) - aiUnitPriority(b));
  for (const unit of myUnits) aiUnitTurn(faction, unit);
  aiDiplomacy(faction);
  aiTelegraph(faction);
}

export function aiUnitPriority(u: { typeId: string }): number {
  if (u.typeId === 'PIONEER') return PIONEER_PRIORITY;
  if (u.typeId === 'WORKER') return WORKER_PRIORITY;
  if (u.typeId === 'SCOUT') return SCOUT_PRIORITY;
  return COMBAT_PRIORITY;
}

export function updateAIStrategy(faction: Faction): void {
  const mem = G.aiMemory[faction.idx];
  if (!mem) return;
  const myCities = G.cities.filter((c) => c.factionIdx === faction.idx).length;
  const myStr = aiFactionMilitaryStrength(faction.idx);
  const totalStr = G.factions.reduce(
    (s, f) => s + (f.alive ? aiFactionMilitaryStrength(f.idx) : 0),
    0
  );
  const myStrShare = totalStr > 0 ? myStr / totalStr : 0;

  if (myCities <= EARLY_EXPAND_CITIES && G.turn < EARLY_GAME_TURN) {
    mem.strategicPhase = 'expand';
  } else if (
    myStrShare < FORTIFY_STR_THRESHOLD &&
    PERSONALITIES[faction.personality].agg < FORTIFY_AGG_CEILING
  ) {
    mem.strategicPhase = 'fortify';
  } else if (faction.techs.has('aether_war') || faction.techs.has('steam_armor')) {
    mem.strategicPhase = 'ascend';
  } else {
    mem.strategicPhase = 'contest';
  }

  // Persistent conquest target: refresh only when missing, dead, or captured.
  // The strategic anchor is intentionally sticky — re-picking every turn would
  // make the AI thrash. aiMilitaryAction reads mem.targetCityId for assault
  // bias; aiDiplomacy reads mem.targetEnemy for war-trigger consistency later.
  const enemy = mem.targetEnemy != null ? G.factions[mem.targetEnemy] : null;
  if (!enemy || !enemy.alive) {
    mem.targetEnemy = pickTargetEnemy(faction);
    mem.targetCityId = null;
  }
  if (mem.targetEnemy != null) {
    const city = mem.targetCityId != null ? G.cities.find((c) => c.id === mem.targetCityId) : null;
    if (!city || city.factionIdx !== mem.targetEnemy) {
      mem.targetCityId = pickTargetCity(faction, mem.targetEnemy);
    }
  } else {
    mem.targetCityId = null;
  }
}

// Highest-grudge alive enemy; tiebreak by lowest military strength so the AI
// kicks the man already on the ground. Returns null when no grudges exist —
// that's the early-game state, where aiDiplomacy hasn't accumulated any
// resentment yet.
export function pickTargetEnemy(faction: Faction): FactionIdx | null {
  const mem = G.aiMemory[faction.idx];
  if (!mem) return null;
  let best: FactionIdx | null = null;
  let bestGrudge = 0;
  let bestStr = Infinity;
  for (const f of G.factions) {
    if (!f.alive) continue;
    if (f.idx === faction.idx) continue;
    const g = mem.grudges[f.idx] ?? 0;
    if (g <= 0) continue;
    const str = aiFactionMilitaryStrength(f.idx);
    if (g > bestGrudge || (g === bestGrudge && str < bestStr)) {
      best = f.idx;
      bestGrudge = g;
      bestStr = str;
    }
  }
  return best;
}

// Nearest city of `enemyIdx` to any of our cities. Tiebreak: prefer capitals,
// then prefer wounded cities (lower hp/maxHp). Returns null when the enemy has
// no cities or we have none — the strategic anchor falls back to `null` and
// aiMilitaryAction reverts to its existing distance-based scoring.
export function pickTargetCity(faction: Faction, enemyIdx: FactionIdx): number | null {
  const myCities = G.cities.filter((c) => c.factionIdx === faction.idx);
  const enemyCities = G.cities.filter((c) => c.factionIdx === enemyIdx);
  if (myCities.length === 0 || enemyCities.length === 0) return null;
  let best = enemyCities[0];
  let bestDist = Infinity;
  for (const ec of enemyCities) {
    let nearest = Infinity;
    for (const mc of myCities) {
      const d = hexDistance(mc, ec);
      if (d < nearest) nearest = d;
    }
    if (
      nearest < bestDist ||
      (nearest === bestDist && ec.isCapital && !best.isCapital) ||
      (nearest === bestDist &&
        ec.isCapital === best.isCapital &&
        ec.hp / ec.maxHp < best.hp / best.maxHp)
    ) {
      best = ec;
      bestDist = nearest;
    }
  }
  return best.id;
}

export function aiFactionMilitaryStrength(factionIdx: FactionIdx): number {
  let s = 0;
  for (const u of G.units) {
    if (u.factionIdx === factionIdx) {
      const t = UNIT_TYPES[u.typeId];
      s += (t.atk + t.def) * (u.hp / u.maxHp);
    }
  }
  for (const c of G.cities) {
    if (c.factionIdx === factionIdx) s += CITY_STRENGTH_BASE + c.population * CITY_STRENGTH_PER_POP;
  }
  return s;
}
