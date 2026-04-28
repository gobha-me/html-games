// Game state singleton.
//
// The prototype kept everything on a global `G`; we preserve the same shape
// and singleton pattern (plain object exported from this module — no Redux,
// no Zustand) so systems peeled out of legacy.ts can mutate state in place
// without churn. A typed GameState interface (in core/types.ts) gives us the
// compile-time guarantees a global lacked.
//
// ─── Decision log (kept-on-purpose-from-prototype choices) ───────────────────
//
//  1. Map<TileKey, Tile> not flat array: zero call sites iterate by index;
//     flat-array switch is a perf win only and the prototype isn't
//     perf-bound. Defer to a focused Phase 2c commit so we can A/B properly.
//
//  2. Math.random not yet replaced with rng.next() everywhere: Phase 1 only
//     adds the seeded factory (core/rng.ts) for tests. Full replacement and
//     setup-UI seed surfacing is Phase 2b.
//
//  3. computeMoveTargets uses frontier.sort() per step instead of a real
//     priority queue — O(n² log n) but n is small (single unit's MP cone).
//     Not currently a bottleneck.
//
//  4. No z-sorting in render — units always paint on top of cities. Stable
//     visual order is fine; defer dynamic z to a polish pass.
// ─────────────────────────────────────────────────────────────────────────────

import type { GameState, FactionIdx, Tile, Unit, City } from './types';
import { hexKey } from './hex';

export const G: GameState = {
  map: null,
  factions: [],
  units: [],
  cities: [],
  turn: 1,
  currentFactionIdx: 0 as FactionIdx,
  playerFactionIdx: 0 as FactionIdx,
  difficulty: 'medium',
  goldHegemonyThreshold: 5000,
  goldHegemonyRequired: 3,
  goldHegemonyCounter: {},
  selected: null,
  moveTargets: [],
  attackTargets: [],
  events: [],
  cameraX: 0,
  cameraY: 0,
  zoom: 1,
  isDragging: false,
  dragStart: null,
  nextUnitId: 1,
  nextCityId: 1,
  gameOver: false,
  aiMemory: {},
};

// Lookup helpers — read-only views into state, used by every system.
// Accept the prototype's "undefined when nothing's there" convention for
// getTile (Map.get); normalize to null for entity lookups so callers can
// rely on `=== null` checks instead of mixed undefined/null.

export function getTile(q: number, r: number): Tile | undefined {
  return G.map?.tiles.get(hexKey(q, r));
}

export function getUnitAt(q: number, r: number): Unit | null {
  const t = getTile(q, r);
  if (!t || t.unitId == null) return null;
  return G.units.find((u) => u.id === t.unitId) ?? null;
}

export function getCityAt(q: number, r: number): City | null {
  const t = getTile(q, r);
  if (!t || t.cityId == null) return null;
  return G.cities.find((c) => c.id === t.cityId) ?? null;
}
