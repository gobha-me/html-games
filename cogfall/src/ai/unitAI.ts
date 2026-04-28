// Per-unit AI dispatch. aiUnitTurn() routes by unit type to a specialized
// handler. Each handler may move (via moveUnit), attack (via combat), or
// terminate the turn (set unit.mp = 0). aiMoveToward picks the move target
// closest to the destination.

import { hexDistance, hexNeighbors } from '../core/hex';
import { log } from '../core/log';
import { G, getCityAt, getTile, getUnitAt } from '../core/state';
import { getGameRng } from '../core/rng';
import type { Faction, Unit } from '../core/types';
import { TERRAIN_TYPES } from '../data/terrain';
import { UNIT_TYPES, isNaval } from '../data/units';
import { PERSONALITIES } from '../data/personalities';
import { combat } from '../systems/combat';
import { computeAttackTargets, computeMoveTargets, killUnit, moveUnit } from '../systems/movement';
import { createCity, pickCityName } from '../systems/city';
import { isCoast } from '../systems/mapgen';
import { recomputeVisibility } from '../systems/visibility';

const PIONEER_MAX_SCAN_RANGE = 14;
const PIONEER_MIN_DIST_FROM_OTHER_CITY = 4;
const PIONEER_NEAR_OWN_CITY_BONUS = 20;
const PIONEER_ENEMY_TERRITORY_PENALTY = 50;
const FORTIFY_NEAREST_CITY_RADIUS = 2;
const NON_WAR_ATTACK_PENALTY_AGGRO = 50;
const NON_WAR_ATTACK_PENALTY_TIMID = 200;
const HIGH_AGG_THRESHOLD = 0.7;
const ASSAULT_VISIBLE_REQUIRED = true;

export function aiUnitTurn(faction: Faction, unit: Unit): void {
  if (unit.mp <= 0) return;
  if (unit.typeId === 'PIONEER') {
    aiPioneerAction(faction, unit);
    return;
  }
  if (unit.typeId === 'WORKER') {
    aiWorkerAction(faction, unit);
    return;
  }
  if (unit.typeId === 'SCOUT') {
    aiScoutAction(faction, unit);
    return;
  }
  if (isNaval(unit.typeId)) {
    aiNavalAction(faction, unit);
    return;
  }
  aiMilitaryAction(faction, unit);
}

export function aiPioneerAction(faction: Faction, unit: Unit): void {
  if (!G.map) return;
  let best: { q: number; r: number } | null = null;
  let bestScore = -Infinity;

  for (const t of G.map.tiles.values()) {
    if (!TERRAIN_TYPES[t.terrain].walkable) continue;
    if (t.cityId) continue;
    const tt = TERRAIN_TYPES[t.terrain];
    if ('isAether' in tt || 'isRuin' in tt) continue;
    const dist = hexDistance({ q: unit.q, r: unit.r }, t);
    if (dist > PIONEER_MAX_SCAN_RANGE) continue;
    let tooClose = false;
    let myDist = Infinity;
    for (const c of G.cities) {
      const d = hexDistance({ q: c.q, r: c.r }, t);
      if (d < PIONEER_MIN_DIST_FROM_OTHER_CITY) tooClose = true;
      if (c.factionIdx === faction.idx) myDist = Math.min(myDist, d);
    }
    if (tooClose) continue;

    let score = -dist * 2;
    if (myDist < 8) score += PIONEER_NEAR_OWN_CITY_BONUS;
    let yieldSum = 0;
    for (const n of hexNeighbors(t.q, t.r)) {
      const nt = getTile(n.q, n.r);
      if (!nt) continue;
      const ntt = TERRAIN_TYPES[nt.terrain];
      yieldSum += ntt.food + ntt.prod * 0.8 + ntt.gold * 0.6;
      if (nt.terrain === 'AETHER') yieldSum += 5;
      if (nt.terrain === 'RUINS' && !nt.improvement) yieldSum += 3;
    }
    score += yieldSum * 4;
    if (t.owner != null && t.owner !== faction.idx) score -= PIONEER_ENEMY_TERRITORY_PENALTY;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }

  if (!best) {
    const targets = computeMoveTargets(unit);
    if (targets.length) {
      const t = targets[Math.floor(getGameRng()() * targets.length)];
      moveUnit(unit, t.q, t.r);
    } else unit.mp = 0;
    return;
  }

  if (best.q === unit.q && best.r === unit.r) {
    const name = pickCityName();
    const c = createCity(faction.idx, unit.q, unit.r, name);
    if (G.cities.filter((cc) => cc.factionIdx === faction.idx).length === 1) c.isCapital = true;
    log(`${faction.name} founds ${name}.`, 'good', faction.idx === G.playerFactionIdx);
    killUnit(unit);
    recomputeVisibility();
    return;
  }
  aiMoveToward(unit, best.q, best.r);
}

export function aiWorkerAction(faction: Faction, unit: Unit): void {
  if (!G.map) return;
  const t = getTile(unit.q, unit.r);
  if (
    t &&
    t.owner === faction.idx &&
    !t.improvement &&
    !t.cityId &&
    (t.terrain === 'PLAINS' || t.terrain === 'HILLS' || t.terrain === 'FOREST')
  ) {
    if (t.terrain === 'PLAINS') t.improvement = 'farm';
    else if (t.terrain === 'HILLS') t.improvement = 'mine';
    else t.improvement = 'road';
    unit.mp = 0;
    return;
  }
  let best: { q: number; r: number } | null = null;
  let bestDist = Infinity;
  for (const tile of G.map.tiles.values()) {
    if (tile.owner !== faction.idx || tile.improvement || tile.cityId) continue;
    if (!(tile.terrain === 'PLAINS' || tile.terrain === 'HILLS' || tile.terrain === 'FOREST')) {
      continue;
    }
    const d = hexDistance({ q: unit.q, r: unit.r }, tile);
    if (d < bestDist) {
      bestDist = d;
      best = tile;
    }
  }
  if (best) aiMoveToward(unit, best.q, best.r);
  else unit.mp = 0;
}

export function aiScoutAction(faction: Faction, unit: Unit): void {
  if (!G.map) return;
  let best: { q: number; r: number } | null = null;
  let bestScore = -Infinity;
  for (const t of G.map.tiles.values()) {
    if (!TERRAIN_TYPES[t.terrain].walkable) continue;
    const vis = t.visibility[faction.idx];
    if (vis === 'visible') continue;
    const d = hexDistance({ q: unit.q, r: unit.r }, t);
    let score = -d;
    if (!vis || vis === 'unseen') score += 10;
    if ('isRuin' in TERRAIN_TYPES[t.terrain] && !t.improvement) score += 30;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  if (best) aiMoveToward(unit, best.q, best.r);
  else unit.mp = 0;
}

export function aiMilitaryAction(faction: Faction, unit: Unit): void {
  const p = PERSONALITIES[faction.personality];
  const phase = G.aiMemory[faction.idx]?.strategicPhase;
  const atkTargets = computeAttackTargets(unit);

  if (atkTargets.length) {
    let best: (typeof atkTargets)[number] | null = null;
    let bestScore = -Infinity;
    for (const t of atkTargets) {
      let score = 20;
      const enemy = getUnitAt(t.q, t.r);
      const enemyCity = getCityAt(t.q, t.r);
      const targetFac = (enemy || enemyCity)!.factionIdx;
      if (faction.diplo[targetFac] !== 'war' && p.agg < HIGH_AGG_THRESHOLD) {
        score -= NON_WAR_ATTACK_PENALTY_TIMID;
      } else if (faction.diplo[targetFac] !== 'war') {
        score -= NON_WAR_ATTACK_PENALTY_AGGRO;
      }
      if (enemy) {
        const eTpl = UNIT_TYPES[enemy.typeId];
        const myTpl = UNIT_TYPES[unit.typeId];
        const myPow = myTpl.atk * (unit.hp / unit.maxHp);
        const enPow = eTpl.def * (enemy.hp / enemy.maxHp);
        score += (myPow - enPow) * 5;
        if (enemy.hp / enemy.maxHp < 0.4) score += 30;
      }
      if (enemyCity) {
        score += 80;
        if (enemyCity.hp / enemyCity.maxHp < 0.4) score += 60;
      }
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    if (best && bestScore > 0) {
      combat(unit, best);
      return;
    }
  }

  const warEnemies = G.factions
    .filter((f) => f.alive && faction.diplo[f.idx] === 'war')
    .map((f) => f.idx);
  if (
    warEnemies.length &&
    (phase === 'contest' || phase === 'ascend' || p.agg > HIGH_AGG_THRESHOLD)
  ) {
    let best: { q: number; r: number } | null = null;
    let bestScore = -Infinity;
    for (const c of G.cities) {
      if (!warEnemies.includes(c.factionIdx)) continue;
      const t = getTile(c.q, c.r);
      if (
        ASSAULT_VISIBLE_REQUIRED &&
        (!t || t.visibility[faction.idx] === 'unseen' || !t.visibility[faction.idx])
      ) {
        continue;
      }
      const d = hexDistance({ q: unit.q, r: unit.r }, c);
      let score = -d * 1.5 + (c.maxHp - c.hp) * 0.5 - c.population * 4;
      if (c.isCapital) score += 30;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (best) {
      aiMoveToward(unit, best.q, best.r);
      return;
    }
  }

  const myCities = G.cities.filter((c) => c.factionIdx === faction.idx);
  if (myCities.length) {
    let nearest: { q: number; r: number } | null = null;
    let ndist = Infinity;
    for (const c of myCities) {
      const d = hexDistance({ q: unit.q, r: unit.r }, c);
      if (d < ndist) {
        ndist = d;
        nearest = c;
      }
    }
    if (ndist <= FORTIFY_NEAREST_CITY_RADIUS) {
      unit.fortified = true;
      unit.mp = 0;
      return;
    }
    if (nearest) {
      aiMoveToward(unit, nearest.q, nearest.r);
      return;
    }
  }
  unit.mp = 0;
}

export function aiNavalAction(faction: Faction, unit: Unit): void {
  if (!G.map) return;
  const p = PERSONALITIES[faction.personality];
  const atkTargets = computeAttackTargets(unit);

  if (atkTargets.length) {
    let best: (typeof atkTargets)[number] | null = null;
    let bestScore = -Infinity;
    for (const t of atkTargets) {
      let score = 20;
      const enemy = getUnitAt(t.q, t.r);
      const enemyCity = getCityAt(t.q, t.r);
      const targetFac = (enemy || enemyCity)!.factionIdx;
      if (faction.diplo[targetFac] !== 'war' && p.agg < HIGH_AGG_THRESHOLD) {
        score -= NON_WAR_ATTACK_PENALTY_TIMID;
      } else if (faction.diplo[targetFac] !== 'war') {
        score -= NON_WAR_ATTACK_PENALTY_AGGRO;
      }
      if (enemy) {
        const eTpl = UNIT_TYPES[enemy.typeId];
        const myTpl = UNIT_TYPES[unit.typeId];
        const myPow = myTpl.atk * (unit.hp / unit.maxHp);
        const enPow = eTpl.def * (enemy.hp / enemy.maxHp);
        score += (myPow - enPow) * 5;
        if (enemy.hp / enemy.maxHp < 0.4) score += 30;
      }
      if (enemyCity) {
        score += 60;
        if (enemyCity.hp / enemyCity.maxHp < 0.4) score += 60;
      }
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    if (best && bestScore > 0) {
      combat(unit, best);
      return;
    }
  }

  // Hunt enemy coastal cities — naval can't reach inland cities, so we
  // bias toward cities adjacent to water.
  const warEnemies = G.factions
    .filter((f) => f.alive && faction.diplo[f.idx] === 'war')
    .map((f) => f.idx);
  if (warEnemies.length) {
    let best: { q: number; r: number } | null = null;
    let bestScore = -Infinity;
    for (const c of G.cities) {
      if (!warEnemies.includes(c.factionIdx)) continue;
      const t = getTile(c.q, c.r);
      if (!t || !isCoast(t, G.map)) continue;
      const d = hexDistance({ q: unit.q, r: unit.r }, c);
      let score = -d * 1.5 + (c.maxHp - c.hp) * 0.5 - c.population * 3;
      if (c.isCapital) score += 30;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (best) {
      aiMoveToward(unit, best.q, best.r);
      return;
    }
  }

  // Patrol home — pick a coast tile near my nearest coastal city.
  const myCoastalCities = G.cities.filter((c) => {
    if (c.factionIdx !== faction.idx) return false;
    const ct = getTile(c.q, c.r);
    return !!(ct && G.map && isCoast(ct, G.map));
  });
  if (myCoastalCities.length) {
    let nearest = myCoastalCities[0];
    let ndist = hexDistance({ q: unit.q, r: unit.r }, nearest);
    for (const c of myCoastalCities) {
      const d = hexDistance({ q: unit.q, r: unit.r }, c);
      if (d < ndist) {
        ndist = d;
        nearest = c;
      }
    }
    aiMoveToward(unit, nearest.q, nearest.r);
    return;
  }

  unit.mp = 0;
}

export function aiMoveToward(unit: Unit, tq: number, tr: number): void {
  const targets = computeMoveTargets(unit);
  if (!targets.length) {
    unit.mp = 0;
    return;
  }
  let best: { q: number; r: number } | null = null;
  let bestDist = Infinity;
  for (const t of targets) {
    const d = hexDistance({ q: t.q, r: t.r }, { q: tq, r: tr });
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  if (best) moveUnit(unit, best.q, best.r);
  else unit.mp = 0;
}
