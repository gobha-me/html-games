// Movement, attack-target computation, and unit lifecycle.
//
// `computeMoveTargets` is the prototype's flood fill: a frontier sorted by
// cost on each pop (not a real priority queue — see core/state.ts decision
// log). For typical MP cones (≤ 4 hops) this is fast enough.

import { hexKey, hexNeighbors } from '../core/hex';
import type { TileKey } from '../core/hex';
import { G, getCityAt, getTile, getUnitAt } from '../core/state';
import { log } from '../core/log';
import { getGameRng } from '../core/rng';
import type { AttackTarget, FactionIdx, MoveTarget, Tile, Unit, UnitTypeId } from '../core/types';
import { TERRAIN_TYPES } from '../data/terrain';
import { UNIT_TYPES, isNaval } from '../data/units';
import { recomputeVisibility } from './visibility';
import { emit } from '../render/animations';

const RUIN_GOLD_THRESHOLD = 0.35;
const RUIN_SCIENCE_THRESHOLD = 0.65;
const RUIN_AETHER_THRESHOLD = 0.85;

// Entity lifecycle ----------------------------------------------------------

export function createUnit(typeId: UnitTypeId, factionIdx: FactionIdx, q: number, r: number): Unit {
  const tpl = UNIT_TYPES[typeId];
  const u: Unit = {
    id: G.nextUnitId++,
    typeId,
    factionIdx,
    q,
    r,
    hp: tpl.hp,
    maxHp: tpl.hp,
    mp: tpl.mp,
    maxMp: tpl.mp,
    fortified: false,
  };
  G.units.push(u);
  const tile = getTile(q, r);
  if (tile) tile.unitId = u.id;
  return u;
}

export function killUnit(unit: Unit): void {
  G.units = G.units.filter((u) => u.id !== unit.id);
  const t = getTile(unit.q, unit.r);
  if (t && t.unitId === unit.id) t.unitId = null;
  emit({
    type: 'unitKilled',
    unitId: unit.id,
    factionIdx: unit.factionIdx,
    q: unit.q,
    r: unit.r,
  });
}

// Pathing -------------------------------------------------------------------

export function computeMoveTargets(unit: Unit): MoveTarget[] {
  const start = { q: unit.q, r: unit.r };
  const naval = isNaval(unit.typeId);
  const visited = new Map<TileKey, { cost: number }>();
  visited.set(hexKey(start.q, start.r), { cost: 0 });
  const frontier: { q: number; r: number; cost: number }[] = [{ q: start.q, r: start.r, cost: 0 }];

  while (frontier.length) {
    frontier.sort((a, b) => a.cost - b.cost);
    const cur = frontier.shift()!;
    for (const n of hexNeighbors(cur.q, cur.r)) {
      const t = getTile(n.q, n.r);
      if (!t) continue;
      const tt = TERRAIN_TYPES[t.terrain];
      const passable = naval ? 'isWater' in tt : tt.walkable;
      if (!passable) continue;
      const stepCost = naval ? 1 : tt.moveCost;
      const newCost = cur.cost + stepCost;
      if (newCost > unit.mp) continue;
      const occupant = getUnitAt(n.q, n.r);
      if (occupant && occupant.factionIdx !== unit.factionIdx) continue;
      if (occupant && occupant.factionIdx === unit.factionIdx) {
        const c = getCityAt(n.q, n.r);
        if (!(c && c.factionIdx === unit.factionIdx)) continue;
      }
      const key = hexKey(n.q, n.r);
      const prev = visited.get(key);
      if (!prev || prev.cost > newCost) {
        visited.set(key, { cost: newCost });
        frontier.push({ q: n.q, r: n.r, cost: newCost });
      }
    }
  }

  visited.delete(hexKey(start.q, start.r));
  const result: MoveTarget[] = [];
  for (const [k, v] of visited.entries()) {
    const [q, r] = k.split(',').map(Number);
    result.push({ q, r, cost: v.cost });
  }
  return result;
}

export function computeAttackTargets(unit: Unit): AttackTarget[] {
  if (UNIT_TYPES[unit.typeId].atk === 0) return [];
  const result: AttackTarget[] = [];
  for (const n of hexNeighbors(unit.q, unit.r)) {
    const t = getTile(n.q, n.r);
    if (!t) continue;
    const enemy = getUnitAt(n.q, n.r);
    const enemyCity = getCityAt(n.q, n.r);
    if (enemy && enemy.factionIdx !== unit.factionIdx) {
      result.push({ q: n.q, r: n.r, target: 'unit' });
    } else if (enemyCity && enemyCity.factionIdx !== unit.factionIdx) {
      result.push({ q: n.q, r: n.r, target: 'city' });
    }
  }
  return result;
}

// Movement ------------------------------------------------------------------

export function moveUnit(unit: Unit, q: number, r: number): boolean {
  const targets = computeMoveTargets(unit);
  const target = targets.find((t) => t.q === q && t.r === r);
  if (!target) return false;
  const fromQ = unit.q;
  const fromR = unit.r;
  const oldTile = getTile(unit.q, unit.r);
  const newTile = getTile(q, r);
  if (oldTile && oldTile.unitId === unit.id) oldTile.unitId = null;
  unit.q = q;
  unit.r = r;
  if (newTile) newTile.unitId = unit.id;
  unit.mp -= target.cost;
  if (unit.mp < 0) unit.mp = 0;
  unit.fortified = false;
  recomputeVisibility();
  if (newTile && 'isRuin' in TERRAIN_TYPES[newTile.terrain] && !newTile.improvement) {
    handleRuinDiscovery(unit, newTile);
  }
  emit({ type: 'unitMoved', unitId: unit.id, fromQ, fromR });
  return true;
}

export function handleRuinDiscovery(unit: Unit, tile: Tile): void {
  tile.improvement = 'looted';
  const f = G.factions[unit.factionIdx];
  const rng = getGameRng();
  const roll = rng();
  const visibleToPlayer = unit.factionIdx === G.playerFactionIdx;
  if (roll < RUIN_GOLD_THRESHOLD) {
    const g = 30 + Math.floor(rng() * 50);
    f.resources.gold += g;
    log(`${f.name} sifted ${g} gold from Old World ruins.`, 'good', visibleToPlayer);
  } else if (roll < RUIN_SCIENCE_THRESHOLD) {
    const s = 30 + Math.floor(rng() * 40);
    f.science += s;
    log(`${f.name} recovered ancient blueprints (${s} science).`, 'tech', visibleToPlayer);
  } else if (roll < RUIN_AETHER_THRESHOLD) {
    const a = 5 + Math.floor(rng() * 10);
    f.resources.aether += a;
    log(`${f.name} pried ${a} aether crystals from a sealed vault.`, 'tech', visibleToPlayer);
  } else {
    log(`${f.name} found only dust and broken cogs in the ruin.`, 'flavor', visibleToPlayer);
  }
}
