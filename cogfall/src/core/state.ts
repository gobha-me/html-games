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
//     the existing scoring on null. Phase 3 S5 wired four overlays in
//     `data/factionBehaviors.ts` (iron, aetheric, verdant, coin);
//     cogwright remains the byte-equal control. `behavior` is *not*
//     serialized — JSON.stringify can't carry hook closures — so it's
//     bound deterministically from FactionId at game start (setup.ts
//     `createFaction`) AND re-bound on load
//     (save.ts `applySerializedStateToG`) via `getFactionBehavior`.
//     `SerializedFaction` Omits the field to make this contract loud.
//     pickBuild call site (cityAI.ts:21) returns the override
//     UNCONDITIONALLY: hook bodies MUST self-guard
//     `city.buildings.has(id)` AND any `requires` tech, otherwise an
//     already-built or prereq-missing return wastes a turn of city
//     production. pickTech is gentler — techAI.ts:14 filters via
//     `avail.some(...)`, so unmet-prereq returns fall through cleanly.
//     Don't add direct `PERSONALITIES[...]` reads in new AI code — go
//     through the resolver so S7 (faction-flavored victories) can plug
//     in overrides without re-wiring every call site.
//
// 12. Scenario system (Phase 3 S3 scaffold, S8 content) lives in
//     `data/scenarios.ts`. S8 populated the registry with three named
//     scenarios — Aether Ascendancy, Steamguild Civil War, Coastal
//     Conquest — each with a pinned `seed: number` so hand-picked start
//     coords stay walkable across machines and replays. The typedef
//     keeps `seed?` for test fixtures, but every shipped scenario sets
//     it. `getScenario(id)` returns null on null/empty/unknown so the
//     setup-flow caller branches uniformly with `if (scenario)`.
//     `resolveScenarioStarts` is pure (no G access, no RNG draws) and
//     throws on off-map / unwalkable coords so authoring bugs surface
//     at setup; a per-scenario test in `tests/scenarios.test.ts` runs
//     this check across SCENARIOS so a future mapgen drift fails CI
//     loudly with the scenario id rather than at runtime. `setupGame()`
//     lets `mapGenOverrides` fall through field-by-field over the form
//     picks, uses `scenario.seed` over the form seed when present,
//     forces controlMode='single', and validates the player's faction
//     is in scenario.factions BEFORE any state mutation. Per-faction
//     `startTechs` append to the default FactionDef techs after
//     createFaction — they don't replace. `G.scenarioId: string | null`
//     persists additively in SerializedGameState (precedent: item 8 —
//     pre-S3 v5 saves load with scenarioId coalesced to null).
//
//     S8 also added three optional cosmetic-overlay fields on
//     `ScenarioFactionStart` — `nameOverride`, `colorOverride`,
//     `glyphOverride` — so two entries can share an `idx` while
//     rendering distinctly. Steamguild Civil War uses this to seat two
//     Cogwright factions; the underlying FactionDef is unchanged, so
//     AI behavior, victoryProfile, and base startTechs all flow
//     through to both. When a scenario seats duplicate FactionIdx
//     values, the *first* scenario.factions entry whose `idx` matches
//     the player's pick becomes the human seat; subsequent matches
//     force AI (deterministic tiebreak — see systems/setup.ts).
//
//     `prologue: string` is required on every shipped scenario. It's
//     emitted via `log(prologue, 'flavor')` before
//     `recordReplaySnapshot` so the opening narration is captured in
//     the turn-1 snapshot. A test asserts prologue length ≥ 80 chars
//     as a cheap voice floor — placeholder one-liners fail.
//
//     `startBuildings` and `victoryOverrides` remained type-only
//     through S8 — S7 routed faction-flavored victory work through
//     `factions.ts:victoryProfile` instead, and none of the three
//     scenarios needed pre-placed improvements. Don't add consumers
//     for either without a real scenario need; the type stubs keep
//     the shape stable for future work.
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
//
// 14. Per-faction victory profiles (Phase 3 S7) are pure data on the
//     `FACTIONS` const (`data/factions.ts`), not a runtime overlay. Unlike
//     S5's `Faction.behavior` (item 11), which carries closures and must
//     be re-bound at load, `victoryProfile` is plain scalars + strings
//     keyed off FactionId — so it's read directly via the
//     `getVictoryProfile(factionIdx)` accessor at every call site
//     (turn.ts banner + gold-hegemony, culture.ts cultural-hegemony,
//     research.ts grand_apparatus cost) and never serialized. The
//     accessor exists because `FACTIONS as const` narrows each entry
//     separately, so a plain `FACTIONS[idx].victoryProfile` trips
//     TS2339 on Cogwright (the entry that intentionally lacks the
//     field). Cogwright Guild has no profile and is the byte-equal
//     control for replay parity — every default code path reads
//     identically to pre-S7. Precedence at threshold call-sites:
//     `getVictoryProfile(idx)?.X ?? G.X` — the faction override wins
//     over the mod-mutable / save-persisted global, so a Coin player
//     always wins economically at 4500 even if a mod has raised
//     `G.goldHegemonyThreshold` to 8000. Mods still affect the four
//     factions that don't override that field. Don't bypass the
//     accessor with a direct const read; the cast lives in one place
//     and call sites stay strict-typed.
//
// 15. One-shot diplomacy (Phase 3 S9a) — gold-for-tech trades,
//     gold-for-aether trades, and gold-tribute demands resolve through
//     `systems/diplomacy.ts` pure functions. Evaluation is split from
//     application: `evaluateTrade` / `evaluateTribute` take Faction
//     refs + strength scalars + an rng and return a `{accept, refusal,
//     score}` decision; `applyTrade` / `applyTribute` mutate the two
//     factions when the caller decides to apply. AI callers
//     (`ai/diploAI.ts`'s `aiConsiderTrade` / `aiConsiderTribute`) pass
//     `getGameRng()` so AI-initiated rolls stay on the seeded stream;
//     player callers (`ui/diploModal.ts`) pass `Math.random` because
//     player-initiated rolls must not consume the seeded RNG (item 2
//     precedent — converting them breaks replay parity via a
//     side-channel). The only durable state these mechanics produce is
//     a grudge bump on refusal — both directions, both magnitudes
//     exported as constants (`TRADE_REFUSAL_GRUDGE = 5`,
//     `TRIBUTE_DEFIANCE_GRUDGE = 20`) so the AI ladder back to war
//     stays observable from tests. **No new persistent state landed
//     in S9a:** no `treaties` array on G, no SAVE_VERSION bump, no
//     new Faction field. Per-faction voice for every player-facing log
//     line lives in `data/diplomacyVoice.ts`, keyed by FactionId with
//     a `genericVoice` fallback so a future sixth faction stays
//     readable without a code change. S9b lands the `treaties` array
//     (item 16 below) for alliances + ongoing trade agreements.
//
// 16. Persistent diplomacy treaties (Phase 3 S9b) — `G.treaties: Treaty[]`
//     is a flat array of discriminated-union entries (`alliance` or
//     `trade_agreement`), each carrying a stable `id` from
//     `G.nextTreatyId`. Lifecycle lives in `systems/diplomacy.ts`:
//     `evaluateAlliance` / `applyAlliance` and `evaluateTradeAgreement`
//     / `applyTradeAgreement` mirror the S9a eval/apply split (item 15).
//     `tickTreaties(G, faction)` runs once per faction turn in
//     `systems/turn.ts:endTurn`, immediately after the rotation to
//     `next` and before MP reset / visibility recompute (the "wake-up"
//     view). It is the **only** site that mutates faction resources for
//     trade agreements or decrements `turnsRemaining` — mirroring
//     item-10's "one bus, one fan-out site" discipline. Provider-side
//     tick gating (`faction.idx === provider`) prevents a treaty from
//     firing twice per game-turn when both parties take turns.
//     Alliances are passive: not ticked, just sit until broken by
//     peace, war, faction death, or player cancellation.
//
//     Three break seams cover every dissolution path:
//       - `breakAlliancesOnPeace(G, faction, otherIdx)` — called by
//         every site that flips `diplo[x] = 'peace'` (diploAI.ts
//         sue-for-peace; diploModal.ts player peace-accept). Removes
//         alliances where faction is a party AND named-enemy matches.
//       - `breakTradeAgreementsOnWar(G, a, b)` — called by every site
//         that flips `diplo[x] = 'war'` (diploAI.ts war-trigger;
//         combat.ts autoDeclare; diploModal.ts player declareWar).
//         Removes trade agreements between the two parties. Alliances
//         survive war declarations against parties OUTSIDE the pact —
//         the mutual-pact seam is intentional.
//       - `dissolveTreatiesOnDeath(G, idx)` — called by
//         combat.ts:eliminateFaction. Removes every treaty involving
//         the dead faction in any role (alliance partyA/partyB/enemy,
//         agreement provider/consumer). Vocalised through the
//         surviving party (or partyA when the dead faction was the
//         alliance's named enemy and both allies remain).
//
//     Alliance is *also* a joint war declaration: `applyAlliance`
//     flips `proposer.diplo[enemy]` and `target.diplo[enemy]` to 'war'
//     if either was at peace — matches the roadmap "mutual war"
//     phrasing — and bumps `enemy.aiMemory.grudges` against both new
//     allies by `ALLIANCE_FORMATION_GRUDGE` so the enemy's retaliation
//     scoring updates next turn.
//
//     Save format: `treaties?: Treaty[]` and `nextTreatyId?: number`
//     are additive optional fields on SerializedGameState. Pre-S9b v5
//     saves load with `treaties = []` and `nextTreatyId = 1`.
//     SAVE_VERSION stays at 5 — same precedent as mapSeed (2L),
//     controlMode (2m), scenarioId (S3). Each treaty is shallow-cloned
//     on serialize/deserialize so caller mutations don't bleed into
//     replay snapshots.
//
//     AI rolls in `aiConsiderAlliance` / `aiConsiderTradeAgreement`
//     draw `getGameRng()` so replay parity holds; both pre-check their
//     structural guards (peace state, gold/aether floors, eligible-
//     enemy search) BEFORE the rng draw so seeded streams that pre-
//     date S9b stay byte-identical when there's nothing actionable to
//     consider (this is why the `ai.test.ts` seed-3 / seed-7 cases
//     still pass — burning rng on dead-end iterations would shift the
//     cursor under them). Player-initiated rolls
//     (`submitAllianceProposal` / `submitAgreementProposal` /
//     `cancelMyTreaty` / `cancelTreaty`) stay on `Math.random`
//     (item-2 precedent — don't convert them).
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
  treaties: [],
  nextTreatyId: 1,
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
