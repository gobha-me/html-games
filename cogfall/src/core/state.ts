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
//     render/pixi.ts. NO movement cost, NO defense bonus, NO yield change
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
//
//  8. UI transients on G (selected / moveTargets / attackTargets /
//     sabotageTargets / hoveredHex / showThreatRange) are *never*
//     serialized. SerializedGameState must omit them and load must
//     reset them to fresh defaults so a saved game doesn't carry
//     stale cursor / toggle state across reloads or human handoffs.
//     New UI flags follow this precedent without bumping SAVE_VERSION.
//
//  9. Production queue (Phase 2n-3) is FIFO over `City.buildQueue:
//     BuildQueue[]`. processCity completes queue[0] and `.shift()`s it
//     when `productionStored >= cost`; the early-return refund branches
//     (naval no-water, garrison-blocked) leave the queue untouched so a
//     deferred build retries next turn. Player edits (push, ↑/↓, ×) in
//     ui/cityPanel.ts mutate the array in place, with cap at
//     MAX_BUILD_QUEUE_LEN and dedupe on push. AI continues to use
//     length-1 queues (aiPickBuild fires only when queue.length === 0)
//     — byte-identical to pre-2n-3. City capture clears via `= []`,
//     mirroring the building-sack semantic. Replay parity unchanged:
//     no new RNG calls, queue is part of the serialized snapshot, and
//     the v4→v5 save migration wraps legacy single-or-null values into
//     arrays at load.
//
// 10. Animation event bus (Phase 3 S1) lives in render/animations.ts.
//     systems/{combat,movement,turn,research,city} emit typed AnimEvents;
//     render-side subscribers (combatEffects, unitTweens, future
//     turn-transition / tech-pop / death modules) wire in main.ts at
//     boot via subscribe* fns. The bus stays pixi-free so it remains
//     test-importable (the 2n-1 boundary). Fan-out is synchronous so
//     emit + handler runs in the same tick a direct call would have —
//     byte-identical behavior preserved. Don't bypass with a direct
//     `render/...` import from systems/; extend AnimEvent and add a
//     subscriber instead. Scaffolded events (turnEnd, techComplete,
//     cityBuilt, unitKilled, victoryReached) ship without subscribers
//     in S1 — S4/S6 wire them.
//
// 11. Per-faction AI behavior (Phase 3 S2) is resolved through
//     `ai/behavior.ts`'s `resolveBehavior(faction)` — never via direct
//     `PERSONALITIES[faction.personality]` reads. `Faction.behavior?:
//     AIBehavior` is an *opt-in* override layer: scalar fields overlay
//     the personality template (Partial<PersonalityDef>); optional
//     hooks (pickTech, pickBuild, unitPriority) short-circuit default
//     AI logic when they return a non-null value, and fall through to
//     the existing scoring on null. The scaffold ships with zero
//     overrides — Faction.behavior is undefined for all 5 default
//     factions, so resolveBehavior returns the unmodified PERSONALITIES
//     row and the hook accessors return null. Behavior is byte-
//     identical to pre-S2 (290-test suite proves it). `behavior` is
//     *not* serialized: it's bound at game start from the static
//     FACTIONS data table, so saves stay v5 with no migration. Don't
//     add direct `PERSONALITIES[...]` reads in new AI code — go through
//     the resolver so S5 (per-faction AI variety) and S7 (faction-
//     flavored victories) can plug in overrides without re-wiring
//     every call site.
//
// 12. Scenario system (Phase 3 S3) lives in `data/scenarios.ts`. The
//     SCENARIOS registry ships *empty* in S3 — only "Random map" appears
//     in the setup dropdown — so the random-map code path stays in
//     charge on every code path until Session 8 authors entries.
//     `getScenario(id)` returns null on null/empty/unknown so the
//     setup-flow caller branches uniformly with `if (scenario)`.
//     `resolveScenarioStarts` is pure (no G access, no RNG draws) and
//     throws on off-map / unwalkable coords so authoring bugs surface
//     at setup. `setupGame()` lets `mapGenOverrides` fall through
//     field-by-field over the form picks, forces controlMode='single',
//     and validates the player's faction is in scenario.factions BEFORE
//     any state mutation. Per-faction `startTechs` append to the default
//     FactionDef techs after createFaction — they don't replace.
//     `G.scenarioId: string | null` persists additively in
//     SerializedGameState (precedent: item 8 — pre-S3 v5 saves load
//     with scenarioId coalesced to null). Two ScenarioDef fields are
//     intentionally *type-only* in S3: `startBuildings` (S8 wires when
//     its scenario content needs pre-placed improvements) and
//     `victoryOverrides` (S7 designs the concrete shape when faction-
//     flavored victories land). Don't add consumers for either without
//     a real scenario need — the type stub keeps the shape stable
//     across S7/S8 without dead code paths.
//
// 13. Replay log cap (post-S3 crash fix). `recordReplaySnapshot` in
//     `systems/replay.ts` appends a full SerializedGameState every
//     game-turn boundary; without a cap the array grew unbounded and
//     long campaigns OOM-killed the tab (~100-200 KB per snapshot on a
//     medium map; default-on). `MAX_REPLAY_TURNS = 200` bounds the log
//     at ~30 MB via FIFO ring-buffer semantics — the oldest snapshot
//     shifts off when length crosses the cap. The replay modal's slider
//     labels by `snapshot.turn` not array index, so the rolling window
//     scrolls correctly without UI changes; `isReplayLogCapped()`
//     surfaces the cap state to the modal so the player sees a
//     "showing last 200 turns" hint when relevant. **Don't** remove
//     the cap or raise it without a fresh memory budget — and keep
//     `recordReplaySnapshot` calling `serializeGameState` so the
//     snapshot format stays byte-equal to the save format (the cap
//     is purely a length bound, not a shape change). G.events is
//     separately capped at MAX_LOG_ENTRIES=100 in `core/log.ts`, so
//     each snapshot's embedded event slice is bounded too.
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
  controlMode: 'single',
  humanFactionIdxs: [0 as FactionIdx],
  passoverActive: false,
  difficulty: 'medium',
  goldHegemonyThreshold: 5000,
  goldHegemonyRequired: 3,
  goldHegemonyCounter: {},
  culturalHegemonyThreshold: 0.4,
  culturalHegemonyRequired: 5,
  culturalHegemonyCounter: {},
  culturalHegemonyEnabled: true,
  selected: null,
  hoveredHex: null,
  showThreatRange: false,
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
  scenarioId: null,
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
