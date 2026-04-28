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
//  2. Math.random replaced with the seeded game rng for everything that
//     mutates persisted state (combat, mapgen, ruin loot, AI unit picks,
//     AI diplomacy). Phase 2b done. Cosmetic sites — AI thinking spinner
//     line + jitter (turn.ts), city-name flavor (city.ts), player-initiated
//     peace-accept roll (diploModal.ts) — intentionally stay on Math.random
//     and are documented in core/rng.ts. Don't "helpfully" convert them or
//     replay parity breaks via a side-channel.
//
//  3. computeMoveTargets uses frontier.sort() per step instead of a real
//     priority queue — O(n² log n) but n is small (single unit's MP cone).
//     Not currently a bottleneck.
//
//  4. No z-sorting in render — units always paint on top of cities. Stable
//     visual order is fine; defer dynamic z to a polish pass.
//
//  5. Rivers (Phase 2c) are visual + bookkeeping only — Tile.riverEdges is a
//     6-bit bitmask over HEX_DIRS, drawn as pale-blue strokes in
//     render/canvas.ts. NO movement cost, NO defense bonus, NO yield change
//     this phase. A "river crossing penalty" or "river adjacency food
//     bonus" is a candidate for Phase 2f (better AI / balance) or 2h
//     (polish), not a 2c smuggle. Don't "helpfully" wire river logic into
//     movement.ts, combat.ts, or city yields mid-2c — replay parity and
//     scope discipline both depend on this staying inert.
//
//  6. Espionage (Phase 2e) — saboteur actions resolve with the seeded game
//     rng (getGameRng) so replay parity holds. sabotageTargets is a UI
//     transient (parallel to moveTargets / attackTargets) — populated when
//     the player clicks "Steal Tech", consumed on the follow-up click,
//     never persisted. No new shape on Faction or City; outcomes write
//     directly to Faction.techs.
//
//  7. Culture (Phase 2g) — `tile.claim` is a *soft* parallel field next
//     to `tile.owner`. The claim system reads cityYields().culture and
//     writes claim; it MUST NOT mutate `tile.owner`. cityYields filters
//     worked tiles by `tile.owner === city.factionIdx`, so a hard transfer
//     would silently shift food/prod/gold and break replay parity. Claim
//     is recomputed in endTurn after processCity and before the victory
//     check — order matters for byte-equal save reproduction.
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
  culturalHegemonyThreshold: 0.4,
  culturalHegemonyRequired: 5,
  culturalHegemonyCounter: {},
  culturalHegemonyEnabled: true,
  selected: null,
  moveTargets: [],
  attackTargets: [],
  sabotageTargets: [],
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
  seed: 0,
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
