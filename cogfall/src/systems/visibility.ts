// Fog of war. Each turn, tiles previously 'visible' to a faction degrade to
// 'seen' (still painted, but darkened); then cities and units re-mark tiles
// within their sight radius as 'visible'. Tiles never seen stay 'unseen'.
//
// O(tiles × factions) per recompute — fine for the prototype's map sizes
// (max 42×28 ≈ 1200 tiles × 5 factions). If we ever scale up, this is an
// obvious target for spatial partitioning, but premature for now.
//
// Phase 2h-1 adds a per-tile *edge distance* (BFS hops outward from any
// 'visible' tile, capped at FOG_MAX_DISTANCE) used by the renderer to lerp
// fog opacity smoothly between fresh-memory and deep-fog. Cached only for
// the player faction since AI factions never render. Rebuilt each
// recomputeVisibility() pass.

import { G } from '../core/state';
import { HEX_DIRS, hexDistance, hexKey, type TileKey } from '../core/hex';
import { UNIT_TYPES } from '../data/units';
import type { Tile } from '../core/types';

const CITY_SIGHT_RADIUS = 2;

/** Max BFS depth for the seen-fog edge-distance ramp. d=0 means the tile
 * sits adjacent to a 'visible' tile (light fog); d≥FOG_MAX_DISTANCE means
 * deep fog and renders at the existing flat-darkening alpha. */
export const FOG_MAX_DISTANCE = 3;

const playerEdgeDistance = new Map<TileKey, number>();

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
  rebuildPlayerEdgeDistance();
}

export function setVisibleAround(factionIdx: number, q: number, r: number, sight: number): void {
  if (!G.map) return;
  for (const tile of G.map.tiles.values()) {
    if (hexDistance({ q, r }, tile) <= sight) tile.visibility[factionIdx] = 'visible';
  }
}

/** Edge-distance for a single 'seen' tile, in BFS hops to the nearest
 * 'visible' tile of the player faction. Returns FOG_MAX_DISTANCE for tiles
 * past the cap or with no path. Visible tiles return 0 (caller should
 * usually skip them — they don't render under fog). */
export function getFogEdgeDistance(tile: Tile): number {
  return playerEdgeDistance.get(hexKey(tile.q, tile.r)) ?? FOG_MAX_DISTANCE;
}

/** Lerp between `near` (at the visible boundary) and `far` (deep fog) using
 * the cached edge-distance for `tile`. Used by the renderer for the seen
 * darkening overlay and seen-glyph alphas, so the boundary stays visually
 * consistent between layers. */
export function fogLerp(tile: Tile, near: number, far: number): number {
  const t = Math.min(getFogEdgeDistance(tile) / FOG_MAX_DISTANCE, 1);
  return near + (far - near) * t;
}

function rebuildPlayerEdgeDistance(): void {
  playerEdgeDistance.clear();
  if (!G.map) return;
  const playerIdx = G.playerFactionIdx;
  const frontier: { q: number; r: number; d: number }[] = [];
  for (const tile of G.map.tiles.values()) {
    if (tile.visibility[playerIdx] === 'visible') {
      playerEdgeDistance.set(hexKey(tile.q, tile.r), 0);
      frontier.push({ q: tile.q, r: tile.r, d: 0 });
    }
  }
  let head = 0;
  while (head < frontier.length) {
    const { q, r, d } = frontier[head++];
    if (d >= FOG_MAX_DISTANCE) continue;
    for (const dir of HEX_DIRS) {
      const nq = q + dir.q;
      const nr = r + dir.r;
      const nk = hexKey(nq, nr);
      if (playerEdgeDistance.has(nk)) continue;
      const nt = G.map.tiles.get(nk);
      if (!nt || nt.visibility[playerIdx] !== 'seen') continue;
      playerEdgeDistance.set(nk, d + 1);
      frontier.push({ q: nq, r: nr, d: d + 1 });
    }
  }
}
