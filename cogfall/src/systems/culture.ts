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
import { getVictoryProfile } from '../data/factions';
import { cityYields } from './city';
import type { Faction, FactionIdx } from '../core/types';

export const CLAIM_RADIUS = 3;

/**
 * Per-tile pressure sums, keyed by hexKey. Each entry is a Number[]
 * indexed by factionIdx — fastest path with no Map overhead in the
 * inner loop. Pure / deterministic; reads only G.factions, G.cities,
 * G.map. Used by computeCulturalClaim and exposed for the Phase 2L
 * debug overlay's culture-pressure mode.
 */
export function computeCulturalPressureMap(): Map<string, number[]> {
  const pressure = new Map<string, number[]>();
  if (!G.map) return pressure;
  const factionCount = G.factions.length;
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
  return pressure;
}

export function computeCulturalClaim(): void {
  if (!G.map) return;
  const pressure = computeCulturalPressureMap();

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
 * Returns claimed-tile counts per faction plus the global claim count and
 * the total walkable-tile count. Walkable is the denominator for cultural
 * share — see getCulturalShare for why "of claimed" was the wrong choice.
 * O(map.tiles) walk; fine for the map sizes in play.
 */
export function tallyClaimedTiles(): { perFaction: number[]; total: number; walkable: number } {
  const perFaction = new Array(G.factions.length).fill(0);
  let total = 0;
  let walkable = 0;
  if (!G.map) return { perFaction, total, walkable };
  for (const tile of G.map.tiles.values()) {
    if (TERRAIN_TYPES[tile.terrain].walkable) walkable++;
    if (tile.claim == null) continue;
    perFaction[tile.claim]++;
    total++;
  }
  return { perFaction, total, walkable };
}

/**
 * Faction's share of all walkable land in [0, 1]. Returns 0 on a map with
 * no walkable tiles (avoids NaN). Pre-2m the denominator was *claimed*
 * tiles, which gave the only culture-generating faction (Verdant on turn 1)
 * a 100% share trivially and a free hegemony win in 5 turns. Walkable as
 * the denominator forces a faction to actually dominate the map.
 *
 * Used by the 2g-4 cultural-hegemony victory check and the 2g-6 topbar
 * share readout — both surface the new "% of walkable land" semantics.
 */
export function getCulturalShare(factionIdx: FactionIdx): number {
  const { perFaction, walkable } = tallyClaimedTiles();
  return walkable > 0 ? perFaction[factionIdx] / walkable : 0;
}

/**
 * Per-faction cultural-hegemony counter step. Mirrors the inline gold-
 * hegemony block in turn.ts: hold ≥ threshold share for `required`
 * consecutive end-turns to win. Mutates G.culturalHegemonyCounter and
 * returns { victory: true } when the counter crosses the threshold —
 * caller is expected to fire triggerVictory(idx, 'cultural'). When
 * G.culturalHegemonyEnabled is false the counter resets to 0 and no
 * victory is reported, which matches the user toggling cultural
 * victory off mid-game without losing replay parity (the field is
 * persisted in saves).
 */
export function processCulturalHegemony(cur: Faction): { victory: boolean } {
  if (!G.culturalHegemonyEnabled) {
    G.culturalHegemonyCounter[cur.idx] = 0;
    return { victory: false };
  }
  const share = getCulturalShare(cur.idx);
  // S7: faction-local override beats G.culturalHegemonyThreshold even when
  // mods or save-loaded scenarios have rewritten the global. Verdant Pact
  // sits at 0.35; the others fall through to the global default (0.40).
  const threshold =
    getVictoryProfile(cur.idx)?.culturalHegemonyThreshold ?? G.culturalHegemonyThreshold;
  if (share >= threshold && share > 0) {
    G.culturalHegemonyCounter[cur.idx] = (G.culturalHegemonyCounter[cur.idx] || 0) + 1;
    if ((G.culturalHegemonyCounter[cur.idx] || 0) >= G.culturalHegemonyRequired) {
      return { victory: true };
    }
  } else {
    G.culturalHegemonyCounter[cur.idx] = 0;
  }
  return { victory: false };
}
