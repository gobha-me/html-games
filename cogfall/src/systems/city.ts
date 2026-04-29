// City production: yields, growth, garrison healing, build-queue resolution.
//
// pickCityName() / usedNames also live here since the name pool is closely
// tied to city creation. The prototype kept usedNames as a module-scope Set;
// we preserve that, but expose `resetCityNames()` so setupGame() can clear
// the pool when starting a new game (HMR survives module state, otherwise
// the second game would run out of names early).

import { hexNeighbors } from '../core/hex';
import { log } from '../core/log';
import { G, getTile, getUnitAt } from '../core/state';
import type { City, FactionIdx } from '../core/types';
import { BUILDING_TYPES } from '../data/buildings';
import { CITY_NAMES } from '../data/factions';
import { TERRAIN_TYPES } from '../data/terrain';
import { getResource } from '../data/resources';
import { UNIT_TYPES, isNaval } from '../data/units';
import { createUnit } from './movement';
import { playSfx } from './audio';

const BASE_CITY_FOOD = 2;
const BASE_CITY_PROD = 1;
const BASE_CITY_GOLD = 1;
const TILE_YIELD_FOOD_WEIGHT = 1.2;
const TILE_YIELD_PROD_WEIGHT = 1.0;
const TILE_YIELD_GOLD_WEIGHT = 0.7;
const FARM_FOOD_BONUS = 2;
const MINE_PROD_BONUS = 2;
const ROAD_GOLD_BONUS = 1;
const AETHER_VENT_AETHER_YIELD = 2;
const AETHERIC_AETHER_BONUS = 1;
const VERDANT_CAPITAL_CULTURE_BONUS = 1;
const FOOD_NEEDED_BASE = 10;
const FOOD_NEEDED_PER_POP = 6;
const HP_PER_POP = 10;
const CITY_HEAL_PER_TURN = 4;
const GARRISON_HEAL_PER_TURN = 3;
const POP_GROWTH_HEAL = 10;

export interface CityYields {
  food: number;
  prod: number;
  gold: number;
  sci: number;
  aether: number;
  culture: number;
}

export function createCity(factionIdx: FactionIdx, q: number, r: number, name: string): City {
  const c: City = {
    id: G.nextCityId++,
    factionIdx,
    q,
    r,
    name,
    population: 1,
    foodStored: 0,
    foodNeeded: FOOD_NEEDED_BASE,
    productionStored: 0,
    buildings: new Set(),
    buildQueue: [],
    isCapital: false,
    hp: 50,
    maxHp: 50,
  };
  G.cities.push(c);
  const tile = getTile(q, r);
  if (tile) {
    tile.cityId = c.id;
    tile.owner = factionIdx;
  }
  for (const n of hexNeighbors(q, r)) {
    const t = getTile(n.q, n.r);
    if (t && t.owner == null) t.owner = factionIdx;
  }
  return c;
}

export function cityYields(city: City): CityYields {
  const fac = G.factions[city.factionIdx];
  let food = BASE_CITY_FOOD;
  let prod = BASE_CITY_PROD;
  let gold = BASE_CITY_GOLD;
  let sci = 0;
  let aether = 0;
  let culture = 0;

  const candidates = hexNeighbors(city.q, city.r)
    .map((n) => getTile(n.q, n.r))
    .filter(
      (t): t is NonNullable<typeof t> =>
        !!t && t.owner === city.factionIdx && !t.cityId && TERRAIN_TYPES[t.terrain].walkable
    )
    .map((t) => {
      const tt = TERRAIN_TYPES[t.terrain];
      let f = tt.food;
      let p = tt.prod;
      let g = tt.gold;
      if (t.improvement === 'mine') p += MINE_PROD_BONUS;
      if (t.improvement === 'farm') f += FARM_FOOD_BONUS;
      if (t.improvement === 'road') g += ROAD_GOLD_BONUS;
      const res = getResource(t.resource);
      if (res) {
        f += res.food ?? 0;
        p += res.prod ?? 0;
        g += res.gold ?? 0;
      }
      return {
        f,
        p,
        g,
        score: f * TILE_YIELD_FOOD_WEIGHT + p * TILE_YIELD_PROD_WEIGHT + g * TILE_YIELD_GOLD_WEIGHT,
        terrain: t.terrain,
      };
    })
    .sort((a, b) => b.score - a.score);

  const numWorked = Math.min(city.population, candidates.length);
  for (let i = 0; i < numWorked; i++) {
    food += candidates[i].f;
    prod += candidates[i].p;
    gold += candidates[i].g;
    if (candidates[i].terrain === 'AETHER') aether += AETHER_VENT_AETHER_YIELD;
  }

  for (const b of city.buildings) {
    const bt = BUILDING_TYPES[b];
    if (!bt || !('yields' in bt) || !bt.yields) continue;
    const y = bt.yields as Partial<{
      food: number;
      prod: number;
      gold: number;
      science: number;
      aether: number;
      culture: number;
    }>;
    food += y.food || 0;
    prod += y.prod || 0;
    gold += y.gold || 0;
    sci += y.science || 0;
    aether += y.aether || 0;
    culture += y.culture || 0;
  }

  if (fac.id === 'aetheric') aether += AETHERIC_AETHER_BONUS;
  if (fac.id === 'verdant' && city.isCapital) culture += VERDANT_CAPITAL_CULTURE_BONUS;
  food -= city.population;

  if (fac.idx !== G.playerFactionIdx) {
    if (G.difficulty === 'hard') {
      // Phase 2n-3: per-turn compound trimmed (10/10/15 → 5/5/10).
      // The kickoff (+100g/+20sci) and combat +15% stay — they're a
      // one-shot and an iconic feel-knob respectively. The per-turn
      // multipliers were the actual snowball over 60+ turns.
      gold = Math.round(gold * 1.05);
      prod = Math.round(prod * 1.05);
      sci = Math.round(sci * 1.1);
    } else if (G.difficulty === 'easy') {
      gold = Math.round(gold * 0.9);
      prod = Math.round(prod * 0.9);
      sci = Math.round(sci * 0.85);
    }
  }

  return { food, prod, gold, sci, aether, culture };
}

export function processCity(city: City): void {
  const y = cityYields(city);
  const fac = G.factions[city.factionIdx];
  fac.resources.gold += y.gold;
  fac.resources.aether += y.aether;
  fac.science += y.sci;
  city.foodStored += y.food;
  if (city.foodStored < 0) city.foodStored = 0;
  city.productionStored += y.prod;

  if (city.foodStored >= city.foodNeeded) {
    city.foodStored -= city.foodNeeded;
    city.population++;
    city.foodNeeded = FOOD_NEEDED_BASE + city.population * FOOD_NEEDED_PER_POP;
    city.maxHp = 50 + city.population * HP_PER_POP;
    city.hp = Math.min(city.maxHp, city.hp + POP_GROWTH_HEAL);
    log(
      `${city.name} grows to size ${city.population}.`,
      'good',
      city.factionIdx === G.playerFactionIdx
    );
  }

  if (city.hp < city.maxHp) city.hp = Math.min(city.maxHp, city.hp + CITY_HEAL_PER_TURN);
  for (const u of G.units.filter(
    (u) => u.factionIdx === city.factionIdx && u.q === city.q && u.r === city.r
  )) {
    u.hp = Math.min(u.maxHp, u.hp + GARRISON_HEAL_PER_TURN);
  }

  if (city.buildQueue.length > 0) {
    const item = city.buildQueue[0];
    let cost = 0;
    if (item.kind === 'unit') cost = UNIT_TYPES[item.id].cost;
    else if (item.kind === 'building') cost = BUILDING_TYPES[item.id].cost;
    if (city.productionStored >= cost) {
      city.productionStored -= cost;
      if (item.kind === 'unit') {
        let spawnQ = city.q;
        let spawnR = city.r;
        if (isNaval(item.id)) {
          // Naval units spawn on a free WATER neighbor (cities sit on land).
          const spot = hexNeighbors(city.q, city.r).find((n) => {
            const t = getTile(n.q, n.r);
            return t && t.terrain === 'WATER' && !getUnitAt(n.q, n.r);
          });
          if (!spot) {
            city.productionStored += cost;
            return;
          }
          spawnQ = spot.q;
          spawnR = spot.r;
        } else {
          const occupant = getUnitAt(city.q, city.r);
          if (occupant) {
            if (occupant.factionIdx !== city.factionIdx) return;
            const spot = hexNeighbors(city.q, city.r).find((n) => {
              const t = getTile(n.q, n.r);
              return t && TERRAIN_TYPES[t.terrain].walkable && !getUnitAt(n.q, n.r);
            });
            if (spot) {
              spawnQ = spot.q;
              spawnR = spot.r;
            } else {
              // Defer: refund production so the unit can spawn next turn.
              city.productionStored += cost;
              return;
            }
          }
        }
        createUnit(item.id, city.factionIdx, spawnQ, spawnR);
        log(
          `${city.name} musters a ${UNIT_TYPES[item.id].name}.`,
          'good',
          city.factionIdx === G.playerFactionIdx
        );
        if (city.factionIdx === G.playerFactionIdx) playSfx('buildComplete');
      } else if (item.kind === 'building') {
        city.buildings.add(item.id);
        log(
          `${city.name} completes ${BUILDING_TYPES[item.id].name}.`,
          'good',
          city.factionIdx === G.playerFactionIdx
        );
        if (city.factionIdx === G.playerFactionIdx) playSfx('buildComplete');
      }
      city.buildQueue.shift();
    }
  }
}

// City names ----------------------------------------------------------------
// Module-scope so the pool persists across calls within a game. Reset at the
// start of each new game via resetCityNames().

const usedNames = new Set<string>();

export function pickCityName(): string {
  const avail = CITY_NAMES.filter((n) => !usedNames.has(n));
  let name: string;
  if (avail.length) name = avail[Math.floor(Math.random() * avail.length)];
  else name = 'Outpost ' + (G.cities.length + 1);
  usedNames.add(name);
  return name;
}

export function resetCityNames(): void {
  usedNames.clear();
}
