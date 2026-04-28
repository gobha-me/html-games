// Fog of war. Each turn, tiles previously 'visible' to a faction degrade to
// 'seen' (still painted, but darkened); then cities and units re-mark tiles
// within their sight radius as 'visible'. Tiles never seen stay 'unseen'.
//
// O(tiles × factions) per recompute — fine for the prototype's map sizes
// (max 42×28 ≈ 1200 tiles × 5 factions). If we ever scale up, this is an
// obvious target for spatial partitioning, but premature for now.

import { G } from '../core/state';
import { hexDistance } from '../core/hex';
import { UNIT_TYPES } from '../data/units';

const CITY_SIGHT_RADIUS = 2;

export function recomputeVisibility(): void {
  if (!G.map) return;
  for (const tile of G.map.tiles.values()) {
    for (const f of G.factions) {
      if (tile.visibility[f.idx] === 'visible') tile.visibility[f.idx] = 'seen';
    }
  }
  for (const c of G.cities) setVisibleAround(c.factionIdx, c.q, c.r, CITY_SIGHT_RADIUS);
  for (const u of G.units) {
    const sight = UNIT_TYPES[u.typeId].sight;
    setVisibleAround(u.factionIdx, u.q, u.r, sight);
  }
}

export function setVisibleAround(
  factionIdx: number,
  q: number,
  r: number,
  sight: number
): void {
  if (!G.map) return;
  for (const tile of G.map.tiles.values()) {
    if (hexDistance({ q, r }, tile) <= sight) tile.visibility[factionIdx] = 'visible';
  }
}
