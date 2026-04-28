// Cultural pressure and soft tile-claim (Phase 2g-3).
//
// Each city radiates its per-turn `culture` yield outward to a fixed
// radius with a linear falloff. The faction with the highest per-tile
// pressure wins the soft claim — ties (or zero pressure) leave the tile
// unclaimed. Soft means: `tile.claim` is a parallel field next to
// `tile.owner`, and the claim system MUST NOT mutate owner. See
// decision-log item 7 in core/state.ts for the why.
//
// Replay parity: pure & deterministic — no rng draws, integer-only
// pressure math. Called from endTurn after processCity (so this turn's
// new buildings count) and before the victory check (so 2g-4 reads
// fresh shares).

import { hexDistance, hexKey } from '../core/hex';
import { G } from '../core/state';
import { TERRAIN_TYPES } from '../data/terrain';
import { cityYields } from './city';
import type { FactionIdx } from '../core/types';

export const CLAIM_RADIUS = 3;

export function computeCulturalClaim(): void {
  if (!G.map) return;
  const factionCount = G.factions.length;
  // Per-tile pressure totals, keyed by hexKey. Number[] indexed by
  // factionIdx — fastest path with no Map overhead in the inner loop.
  const pressure = new Map<string, number[]>();

  for (const city of G.cities) {
    const fac = G.factions[city.factionIdx];
    if (!fac.alive) continue;
    const culture = cityYields(city).culture;
    if (culture <= 0) continue;
    for (let dq = -CLAIM_RADIUS; dq <= CLAIM_RADIUS; dq++) {
      for (let dr = -CLAIM_RADIUS; dr <= CLAIM_RADIUS; dr++) {
        const q = city.q + dq;
        const r = city.r + dr;
        const dist = hexDistance({ q: city.q, r: city.r }, { q, r });
        if (dist > CLAIM_RADIUS) continue;
        const tile = G.map.tiles.get(hexKey(q, r));
        if (!tile) continue;
        // Linear falloff: full pressure at the city itself, 1 unit at
        // the outer ring (CLAIM_RADIUS), zero past it (skipped above).
        const p = (CLAIM_RADIUS + 1 - dist) * culture;
        const key = hexKey(q, r);
        let arr = pressure.get(key);
        if (!arr) {
          arr = new Array(factionCount).fill(0);
          pressure.set(key, arr);
        }
        arr[city.factionIdx] += p;
      }
    }
  }

  for (const tile of G.map.tiles.values()) {
    // Owned tiles never receive a claim. owner is the source of truth
    // for combat / movement / yields; mixing claim into those paths
    // would silently shift behavior.
    if (tile.owner != null) {
      tile.claim = undefined;
      continue;
    }
    // Non-walkable terrain (water, mountains) sits outside the claim
    // map. Naval / amphibious culture is a 2h polish question.
    if (!TERRAIN_TYPES[tile.terrain].walkable) {
      tile.claim = undefined;
      continue;
    }
    const arr = pressure.get(hexKey(tile.q, tile.r));
    if (!arr) {
      tile.claim = undefined;
      continue;
    }
    let best = 0;
    let bestIdx = -1;
    let secondBest = 0;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (p > best) {
        secondBest = best;
        best = p;
        bestIdx = i;
      } else if (p > secondBest) {
        secondBest = p;
      }
    }
    // Strict inequality — tied factions cancel out, leaving the tile
    // contested (visually unclaimed). Avoids flicker on equidistant
    // border cities of equal culture output.
    if (best > 0 && best > secondBest) {
      tile.claim = bestIdx as FactionIdx;
    } else {
      tile.claim = undefined;
    }
  }
}

/**
 * Returns claimed-tile counts per faction plus the global total. Used by
 * the cultural-hegemony victory check in 2g-4 and by the HUD share
 * readout in 2g-6. O(map.tiles) walk; fine for the map sizes in play.
 */
export function tallyClaimedTiles(): { perFaction: number[]; total: number } {
  const perFaction = new Array(G.factions.length).fill(0);
  let total = 0;
  if (!G.map) return { perFaction, total };
  for (const tile of G.map.tiles.values()) {
    if (tile.claim == null) continue;
    perFaction[tile.claim]++;
    total++;
  }
  return { perFaction, total };
}
