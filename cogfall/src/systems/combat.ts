// Combat, war declarations, city capture, faction elimination.
//
// Combat damage uses two random rolls per resolution (attacker damage and
// defender counter-attack); the prototype hardcodes Math.random(), but
// combat() takes an optional `rng` parameter so tests can pin damage. The
// numbers are tuned for the prototype's feel — don't touch them in Phase 1.

import { hexNeighbors } from '../core/hex';
import { log } from '../core/log';
import { defaultRng, shuffle, type Rng } from '../core/rng';
import { G, getCityAt, getTile, getUnitAt } from '../core/state';
import type { AttackTarget, City, FactionIdx, Unit } from '../core/types';
import { TERRAIN_TYPES } from '../data/terrain';
import { UNIT_TYPES } from '../data/units';
import { killUnit, moveUnit } from './movement';
import { playSfx } from './audio';
import { recordTelemetry } from './telemetry';
import { emit } from '../render/animations';

const FORTIFY_DEF_BONUS = 0.3;
const CITY_DEF_BONUS_BASE = 0.25;
const WALLS_DEF_BONUS = 0.5;
const CITADEL_DEF_BONUS = 1.0;
// Phase 2n-3: trimmed from 0.25 → 0.15. Verdant stacked three perks
// (multiplier + flat +15 + capital culture) vs other factions' 1-2.
// The multiplier is the worst offender because it compounds with walls
// (×1.5) and citadel (×2.0) on the same axis. Keep the flat +15 — it
// matters early when 25 base + 15 = 1.6× attacker effort and falls off
// naturally as walls/citadel come online.
const VERDANT_CITY_DEF_BONUS = 0.15;
const IRON_ATK_BONUS = 0.2;

const CITY_BASE_DEF = 25;
const CITY_WALLS_BONUS = 25;
const CITY_CITADEL_BONUS = 50;
const VERDANT_CITY_FLAT_BONUS = 15;
const CITY_ASSAULT_RECOIL = 3;

const GRUDGE_UNIT_DAMAGE = 30;
const GRUDGE_CITY_ASSAULT = 50;
const CAPTURE_LOOT_BASE = 50;
const CAPTURE_LOOT_PER_POP = 30;
const CAPTURE_HP_FLOOR = 20;
const SACK_FRACTION = 1 / 3;

// Damage preview for the UI tooltip. Mirrors the deterministic prefix of
// combat() — same faction/terrain/fortify/citadel/AI-bonus stack — but
// substitutes rng()=0 (min) and rng()→1 (max) into the damage formulas
// instead of rolling. Pure read; never calls rng() so replay parity is
// untouched even when the tooltip is up. Returns null when there's no
// valid target on the tile.
export type CombatPreview =
  | { kind: 'unit'; atkMin: number; atkMax: number; defMin: number; defMax: number }
  | { kind: 'city'; dmgMin: number; dmgMax: number };

export function previewCombat(attacker: Unit, target: AttackTarget): CombatPreview | null {
  const defender = getUnitAt(target.q, target.r);
  const defCity = getCityAt(target.q, target.r);
  const aTpl = UNIT_TYPES[attacker.typeId];

  if (defender) {
    const dTpl = UNIT_TYPES[defender.typeId];
    const defTile = getTile(defender.q, defender.r);
    const terrainDef = defTile ? TERRAIN_TYPES[defTile.terrain].defBonus : 0;
    const fortifyBonus = defender.fortified ? FORTIFY_DEF_BONUS : 0;

    let cityDef = 0;
    let factionDefBonus = 0;
    const cityHere = getCityAt(defender.q, defender.r);
    if (cityHere) {
      cityDef = CITY_DEF_BONUS_BASE;
      if (cityHere.buildings.has('walls')) cityDef += WALLS_DEF_BONUS;
      if (cityHere.buildings.has('citadel')) cityDef += CITADEL_DEF_BONUS;
      if (G.factions[defender.factionIdx].id === 'verdant') {
        factionDefBonus += VERDANT_CITY_DEF_BONUS;
      }
    }
    const aFac = G.factions[attacker.factionIdx];
    const ironBonus = aFac.id === 'iron' ? IRON_ATK_BONUS : 0;
    const aiBonus = getDifficultyAtkBonus(attacker.factionIdx);

    const atkPow = aTpl.atk * (1 + ironBonus + aiBonus) * (attacker.hp / attacker.maxHp);
    const defPow =
      dTpl.def *
      (1 + terrainDef + fortifyBonus + cityDef + factionDefBonus) *
      (defender.hp / defender.maxHp);
    const ratio = atkPow / Math.max(0.5, defPow);
    const atkMin = Math.max(2, Math.round(8 * ratio));
    const atkMax = Math.max(2, Math.round(8 * ratio + 4));
    const defMin = Math.max(1, Math.round(8 / ratio));
    const defMax = Math.max(1, Math.round(8 / ratio + 3));
    return { kind: 'unit', atkMin, atkMax, defMin, defMax };
  }

  if (defCity) {
    let cityDef = CITY_BASE_DEF;
    if (defCity.buildings.has('walls')) cityDef += CITY_WALLS_BONUS;
    if (defCity.buildings.has('citadel')) cityDef += CITY_CITADEL_BONUS;
    if (G.factions[defCity.factionIdx].id === 'verdant') cityDef += VERDANT_CITY_FLAT_BONUS;
    const aiBonus = getDifficultyAtkBonus(attacker.factionIdx);
    const atkPow = aTpl.atk * (attacker.hp / attacker.maxHp) * (1 + aiBonus);
    const dmg = Math.max(2, Math.round((atkPow * 60) / cityDef));
    return { kind: 'city', dmgMin: dmg, dmgMax: dmg };
  }

  return null;
}

export function combat(attacker: Unit, defenderQR: AttackTarget, rng: Rng = defaultRng): void {
  const defender = getUnitAt(defenderQR.q, defenderQR.r);
  const defCity = getCityAt(defenderQR.q, defenderQR.r);

  if (defender) autoDeclare(attacker.factionIdx, defender.factionIdx);
  else if (defCity) autoDeclare(attacker.factionIdx, defCity.factionIdx);

  // Player-audible combat. Fires once per resolution regardless of which
  // side the player is on; AI-vs-AI scuffles in the fog stay silent.
  const playerInvolved =
    attacker.factionIdx === G.playerFactionIdx ||
    defender?.factionIdx === G.playerFactionIdx ||
    defCity?.factionIdx === G.playerFactionIdx;
  if (playerInvolved) playSfx('combatHit');

  if (defender) {
    const aTpl = UNIT_TYPES[attacker.typeId];
    const dTpl = UNIT_TYPES[defender.typeId];
    const defTile = getTile(defender.q, defender.r);
    const terrainDef = defTile ? TERRAIN_TYPES[defTile.terrain].defBonus : 0;
    const fortifyBonus = defender.fortified ? FORTIFY_DEF_BONUS : 0;

    let cityDef = 0;
    let factionDefBonus = 0;
    const cityHere = getCityAt(defender.q, defender.r);
    if (cityHere) {
      cityDef = CITY_DEF_BONUS_BASE;
      if (cityHere.buildings.has('walls')) cityDef += WALLS_DEF_BONUS;
      if (cityHere.buildings.has('citadel')) cityDef += CITADEL_DEF_BONUS;
      if (G.factions[defender.factionIdx].id === 'verdant') {
        factionDefBonus += VERDANT_CITY_DEF_BONUS;
      }
    }
    const aFac = G.factions[attacker.factionIdx];
    const dFac = G.factions[defender.factionIdx];
    const ironBonus = aFac.id === 'iron' ? IRON_ATK_BONUS : 0;
    const aiBonus = getDifficultyAtkBonus(attacker.factionIdx);

    const atkPow = aTpl.atk * (1 + ironBonus + aiBonus) * (attacker.hp / attacker.maxHp);
    const defPow =
      dTpl.def *
      (1 + terrainDef + fortifyBonus + cityDef + factionDefBonus) *
      (defender.hp / defender.maxHp);
    const ratio = atkPow / Math.max(0.5, defPow);
    const atkDmg = Math.max(2, Math.round(8 * ratio + rng() * 4));
    const defDmg = Math.max(1, Math.round(8 / ratio + rng() * 3));

    defender.hp -= atkDmg;
    attacker.hp -= defDmg;
    attacker.mp = 0;
    // Phase 2n-2 — combat juice. Gated by playerInvolved so AI-vs-AI
    // scuffles in the fog don't shake the player's screen mysteriously.
    // Pure render-side; no game-state mutation, no seeded-RNG calls.
    // Phase 3 S1: emitted through render/animations bus; combatEffects
    // subscribes in main.ts.
    emit({
      type: 'combatHit',
      attackerId: attacker.id,
      defenderUnitId: defender.id,
      playerInvolved,
    });
    recordTelemetry({
      kind: 'combat',
      turn: G.turn,
      attacker: attacker.factionIdx,
      defender: defender.factionIdx,
      dmg: atkDmg,
      vsCity: false,
    });
    log(
      `${aFac.name}'s ${aTpl.name} attacks ${dFac.name}'s ${dTpl.name}: ${atkDmg} dealt, ${defDmg} taken.`,
      'combat',
      attacker.factionIdx === G.playerFactionIdx || defender.factionIdx === G.playerFactionIdx
    );
    if (defender.hp <= 0) killUnit(defender);
    if (attacker.hp <= 0) {
      killUnit(attacker);
      return;
    }
    const dMem = G.aiMemory[defender.factionIdx];
    if (dMem) {
      dMem.grudges[attacker.factionIdx] =
        (dMem.grudges[attacker.factionIdx] || 0) + GRUDGE_UNIT_DAMAGE;
    }
  } else if (defCity) {
    const aTpl = UNIT_TYPES[attacker.typeId];
    let cityDef = CITY_BASE_DEF;
    if (defCity.buildings.has('walls')) cityDef += CITY_WALLS_BONUS;
    if (defCity.buildings.has('citadel')) cityDef += CITY_CITADEL_BONUS;
    if (G.factions[defCity.factionIdx].id === 'verdant') cityDef += VERDANT_CITY_FLAT_BONUS;
    const aiBonus = getDifficultyAtkBonus(attacker.factionIdx);
    const atkPow = aTpl.atk * (attacker.hp / attacker.maxHp) * (1 + aiBonus);
    const dmg = Math.max(2, Math.round((atkPow * 60) / cityDef));

    defCity.hp -= dmg;
    attacker.hp -= CITY_ASSAULT_RECOIL;
    attacker.mp = 0;
    emit({
      type: 'combatHit',
      attackerId: attacker.id,
      defenderUnitId: null,
      playerInvolved,
    });
    recordTelemetry({
      kind: 'combat',
      turn: G.turn,
      attacker: attacker.factionIdx,
      defender: defCity.factionIdx,
      dmg,
      vsCity: true,
    });
    log(
      `${G.factions[attacker.factionIdx].name} assaults ${defCity.name}: ${dmg} damage.`,
      'combat',
      true
    );
    if (defCity.hp <= 0) {
      captureCity(defCity, attacker.factionIdx);
      moveUnit(attacker, defCity.q, defCity.r);
    }
    if (attacker.hp <= 0) killUnit(attacker);
    const cMem = G.aiMemory[defCity.factionIdx];
    if (cMem) {
      cMem.grudges[attacker.factionIdx] =
        (cMem.grudges[attacker.factionIdx] || 0) + GRUDGE_CITY_ASSAULT;
    }
  }
}

export function getDifficultyAtkBonus(factionIdx: FactionIdx): number {
  if (factionIdx === G.playerFactionIdx) return 0;
  if (G.difficulty === 'easy') return -0.15;
  if (G.difficulty === 'hard') return 0.15;
  return 0;
}

export function autoDeclare(a: FactionIdx, b: FactionIdx): void {
  const fa = G.factions[a];
  const fb = G.factions[b];
  if (fa.diplo[b] !== 'war') {
    fa.diplo[b] = 'war';
    fb.diplo[a] = 'war';
    log(
      `${fa.name} and ${fb.name} are at war!`,
      'warning',
      a === G.playerFactionIdx || b === G.playerFactionIdx
    );
  }
}

export function captureCity(city: City, newFactionIdx: FactionIdx): void {
  const oldFac = G.factions[city.factionIdx];
  const newFac = G.factions[newFactionIdx];
  log(`${city.name} falls to ${newFac.name}!`, 'warning', true);
  city.factionIdx = newFactionIdx;
  city.hp = Math.max(CAPTURE_HP_FLOOR, Math.floor(city.maxHp / 2));
  city.population = Math.max(1, city.population - 1);
  city.buildQueue = [];

  // Sack a third of the buildings (insertion order preserved by Set; matches
  // prototype's [...city.buildings] iteration).
  const blds = [...city.buildings];
  shuffle(blds);
  for (let i = 0; i < Math.floor(blds.length * SACK_FRACTION); i++) {
    city.buildings.delete(blds[i]);
  }

  const loot = CAPTURE_LOOT_BASE + city.population * CAPTURE_LOOT_PER_POP;
  newFac.resources.gold += loot;

  if (G.map) {
    for (const t of G.map.tiles.values()) {
      if (t.cityId === city.id) t.owner = newFactionIdx;
    }
  }
  for (const n of hexNeighbors(city.q, city.r)) {
    const t = getTile(n.q, n.r);
    if (t && t.owner === oldFac.idx) t.owner = newFactionIdx;
  }

  if (city.isCapital) {
    const remaining = G.cities.filter((c) => c.factionIdx === oldFac.idx);
    if (remaining.length === 0) eliminateFaction(oldFac.idx);
    else remaining[0].isCapital = true;
  }
}

export function eliminateFaction(factionIdx: FactionIdx): void {
  const f = G.factions[factionIdx];
  if (!f.alive) return;
  f.alive = false;
  log(`${f.name} has been wiped from the map!`, 'warning', true);
  G.units = G.units.filter((u) => u.factionIdx !== factionIdx);
  if (G.map) {
    for (const t of G.map.tiles.values()) {
      if (t.unitId != null) {
        const u = G.units.find((uu) => uu.id === t.unitId);
        if (!u) t.unitId = null;
      }
    }
  }
}
