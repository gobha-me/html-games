# ICD-04 · Save Schema

**Status:** v0.1.2 (milestone 1.0.0 — `RivalsSnap` widens to include `herald` + `observer` per Tier-1 opener; in-blob version bumps to `"1.1"`; `migrate_1_0_to_1_1` synthesizes default Herald + Observer state on load)
**Prior:** v0.1.1 (milestone 0.10.0 — `rng_seed` semantics settled (carries live PRNG state, not initial seed) · `lead_spawner` snap block added · `run_stats` block added · `'late-edition.scores.v1'` key documented)
**Band:** strong (Design Doc §17 locks "single localStorage JSON · versioned · migrations defined")
**First caller:** milestone 0.8 (save / load · resume mid-edition · version field)
**Source:** [`../design/design-doc.html`](../design/design-doc.html) §17 (save) ·
[`../design/phase-0-roadmap.html`](../design/phase-0-roadmap.html) §03 + §04 (ICD sketch +
roadmap row)

## Purpose

Define the on-disk shape of a Late-Edition save. One versioned `localStorage`
JSON blob captures the entire authoritative sim state — enough to resume
mid-edition with no observable change in the run's trajectory. Migration-aware
from v0.1 so the schema can evolve without breaking saves already in the wild
(Design Doc §17 — "once a save exists, breaking it is a player-trust event").

The save is **sim-state only**. The renderer rebuilds three.js scene graph,
mesh instances, and HUD DOM from the post-load `WorldFrame` (ICD-01 §HudState).
The save is also **authoritative-server-shaped** — every field captured here
could be the server's row at post-MVP cloud-save lift
([`../architecture/00-overview.md`](../architecture/00-overview.md) — fuzzy
band "post-MVP multiplayer / cloud saves").

## Storage key

```ts
const SAVE_KEY   = 'late-edition.save.v1';
const SCORES_KEY = 'late-edition.scores.v1';  // v0.1.1 — high-score persistence (audit G-13)
```

```ts
interface HighScoreBlobV1 {
  version: 1;
  scores: HighScoreEntry[];   // sorted desc by editions_survived, then total_revenue; capped at 10
}
interface HighScoreEntry {
  editions_survived: number;
  total_revenue:     number;
  ended_at_ms:       number;                          // wall-clock for display
  cause:             'game_over' | 'arc_end';
}
```

- **Single blob, single key.** All save state lives at this key. No sharded
  per-subsystem keys (a partial-write torn save is worse than no save).
- The `.v1` suffix in the key is the **storage-key generation**, distinct from
  the in-blob `version` field. Generation changes only on breaking-incompatible
  rewrites (none planned for Tier-0); the in-blob `version` carries every
  ordinary schema bump.
- High-score persistence (milestone 0.10) lives under a **separate key**
  (`'late-edition.scores.v1'`) and is not part of `SaveBlobV1`. The save blob
  is the in-progress run; scores are cross-run.

## Core shape

```ts
type SaveVersion = string; // semver-ish "MAJOR.MINOR" — v0.1 emits "1.0"

interface SaveBlobV1 {
  version:      SaveVersion;        // "1.1" at v0.1.2 (was "1.0" at v0.1)
  saved_at_ms:  number;             // Date.now() at write — wall-clock, for UI
  sim_time_ms:  number;             // absolute sim clock (World.sim_time_ms)
  rng_seed:     number;             // v0.1.1: the spawner stream's live PRNG state (renamed semantics — see §Notes)
  world_rng:    { state: number };  // v0.1.1: same value as rng_seed under the clearer key; both written for compat
  lead_spawner: LeadSpawnerSnap | null; // v0.1.1: per-district spawn accumulators (audit C-04 first caller of the rng slot)
  id_mint:      { next: number };   // module-scoped mkId counter — next value to mint

  cycle:        CycleSnap;          // CycleClock state
  resources:    { cash: number, ink: number, heat: number };
  grid:         GridSnap;           // baked pathfinding grid (static post-city-gen but captured for safety)

  buildings:    BuildingSnap[];     // every building in this.buildings (incl. branch_bureau at 0.10.0)
  units:        UnitSnap[];         // every unit in this.units (including goons spawned mid-edition)
  stories:      StorySnap[];        // every story in this.stories regardless of state

  rivals:       RivalsSnap;         // per-rival state machine + RNG snapshot
  edition_history: EditionDigestSnap[];   // World.editionHistory ring (cap 10)
  pending_rival_events: RivalEventDigest[]; // World._pendingRivalEvents (this-edition accumulator)

  game_over:    boolean;            // World.gameOver — terminal state captured for round-trip integrity
  debrief_open: boolean;            // World.debriefOpen — saves taken during the debrief pause restore the paused state

  run_stats:    RunStatsSnap;       // v0.1.1: rolling run totals for the run-end summary + high-score write (audit G-13)
}

interface LeadSpawnerSnap {
  accum_by_district: { [districtId: string]: number };  // ms accumulated toward next spawn per district
}

interface RunStatsSnap {
  total_revenue:     number;
  editions_survived: number;
  top_story:         { headline: string, cash: number } | null;
}

interface CycleSnap {
  edition:               number;
  remaining_ms:          number;
  edition_duration_ms:   number;    // tunable constructor value (default 720_000)
  warning_offset_ms:     number;    // tunable constructor value (default 30_000)
  warning_fired:         boolean;   // CycleClock._warningFired (don't double-emit on load)
  fire_fired:            boolean;   // CycleClock._fireFired
}

interface GridSnap {
  width:    number;
  height:   number;
  walkable: boolean[][];            // row-major, [y][x] — matches World.grid.walkable
}

interface BuildingSnap {
  id:     BuildingId;
  kind:   'bureau' | 'darkroom';    // v0.1 vocabulary — branches/switchboard at Tier-1 widen this
  tile:   { x: number, y: number };
  hp:     number;
  hp_max: number;
  tier:   number;
}

interface UnitSnap {
  id:        UnitId;
  kind:      'reporter' | 'photog' | 'fixer' | 'editor' | 'goon';
  tile:      { x: number, y: number };       // discrete tile
  pos:       { x: number, y: number, z: number }; // continuous world-pos (mid-step preserved)
  facing:    number;                          // radians
  state:     'idle' | 'walking' | 'carrying';
  carrying:  null | 'lead';                   // the carry channel — see ICD-01 §UnitView
  carrying_story_id: StoryId | null;          // back-pointer to held Story
  path:      { x: number, y: number }[];      // remaining A* cells (cleared on arrival)
  path_idx:  number;
  hp?:       number;                          // present on goon + fixer (combat-bearing kinds)
  hp_max?:   number;                          // same
  // `selected` intentionally omitted — UI state, not sim state. Resets on load.
}

interface StorySnap {
  id:               StoryId;
  version:          number;                   // per-record schema version (see §Notes — Story.version)
  state:            'lead' | 'verified' | 'plated' | 'printed';
  district:         DistrictId;
  flavor:           'vice' | 'violence' | 'money' | 'labor';
  tier:             'whisper' | 'investigation' | 'arc';
  truthful:         boolean;
  spawned_at_ms:    number;
  tile:             { x: number, y: number };
  picked_up_by:     UnitId | null;
  held_by_building: BuildingId | null;
  verified_by?:     UnitId;                   // populated at lead → verified
  plated_by?:       UnitId;                   // populated at verified → plated (Editor's UnitId per ICD-05 v0.4 §Notes)
  printed_in?:      number;                   // edition number
  cash_yield?:      number;                   // frozen at plated step (ICD-05 §Notes)
  heat_yield?:      number;                   // same
  ink_cost?:        number;                   // same
}

interface RivalsSnap {
  // v0.1.2 (1.0.0): Tier-1 roster — Evening Star + Herald + Observer.
  evening_star: EveningStarSnap;
  herald:       HeraldSnap;
  observer:     ObserverSnap;
}

interface EveningStarSnap {
  id:                  'evening_star';
  bureau_id:           BuildingId;            // the bureau the rival targets
  tick_interval_ms:    number;                // 20_000 at v0.1 (ICD-02 §Tick cadence)
  state:               'SCAVENGE' | 'RAID' | 'BRIBE' | 'RUSH' | 'PANIC' | 'BURNOUT';
  editions_since_raid: number;
  past_intents:        Intent[];              // RingBuffer<Intent, 20> contents (ICD-02 §RivalView past-intents — storage cap)
  tick_accum_ms:       number;                // EveningStar._tickAccumMs — preserves sub-tick fractional progress
  rng:                 { state: number };     // SeededRng.state — the Mulberry32 32-bit integer
}

// v0.1.2 (1.0.0): Herald snap. Ticks 1/EDITION (no _tickAccumMs needed —
// edition-cadence rivals dispatch at the EDITION_DEBRIEF_END boundary).
interface HeraldSnap {
  id:                              'herald';
  state:                           'IDLE' | 'COURT' | 'WIRED' | 'PUNISH' | 'BUYOUT';
  consecutive_high_heat_editions:  number;    // counter for IDLE → COURT predicate
  editions_in_court:               number;    // counter for COURT → IDLE timeout
  editions_in_punish:              number;    // counter for PUNISH → IDLE cooldown
  is_wired:                        boolean;   // sticky flag: set on COURT → WIRED, cleared on exit from WIRED
  past_intents:                    Intent[];
  rng:                             { state: number };
}

// v0.1.2 (1.0.0): Observer snap. Ticks 1/2 EDITIONS — _edition_tick gates the
// state-machine pass at the EDITION_DEBRIEF_END boundary.
interface ObserverSnap {
  id:                  'observer';
  state:               'INVESTIGATE' | 'PUBLISH' | 'WARN' | 'DESPERATE' | 'SILENCED';
  cash:                number;                // Observer's internal cash (start $500; +$80/edition; -$150 per PUBLISH)
  observing_lead_id:   string | null;         // the lead Observer is currently investigating (null when idle)
  editions_in_state:   number;                // counter for SILENCED → INVESTIGATE timeout
  edition_tick:        number;                // internal cadence counter (1/2 editions gate)
  past_intents:        Intent[];
  rng:                 { state: number };
}

interface EditionDigestSnap {
  edition:           number;
  player_cash_delta: number;
  raids_attempted:   number;
  raids_succeeded:   number;
}
```

`Intent` and `RivalEventDigest` reuse the shapes defined in ICD-02 §Per-tick
contract and ICD-06 §`EditionSummary` respectively — the save serializes them
verbatim. `UnitId` / `BuildingId` / `StoryId` / `DistrictId` are the same id
types those ICDs export.

## Notes (load-bearing decisions)

- **Single blob, atomic write.** `saveNow(world)` produces one `SaveBlobV1`
  and writes it in a single `localStorage.setItem` call. Partial writes are
  not a concern in `localStorage` (the platform serializes the write) but
  the all-or-nothing shape stays load-bearing for the eventual cloud-save
  path.
- **Migration policy.** `loadSave(raw)` parses JSON, reads `raw.version`,
  and runs the chain `migrate_1_0_to_1_1 → migrate_1_1_to_1_2 → …` until the
  blob is at the current version. Each migration is a pure function
  `(SaveBlob_vN) → SaveBlob_vN+1`. v0.1 ships **no migrations** — `"1.0"` is
  the floor. The first schema change after 0.8 ships authors `migrate_1_0_to_1_1`
  in the same PR (Constraint #4).
- **Unknown future version → graceful refusal.** If `raw.version` is newer
  than the current code knows, `loadSave` refuses to load and surfaces a
  player-facing message (no silent data loss, no best-effort field
  truncation). The current run is discarded only by explicit player action.
- **Determinism contract.** Every RNG owner serializes its `state` field.
  At v0.1 there is exactly one — the Evening Star's `SeededRng`
  ([`../js/sim/seeded-rng.js`](../js/sim/seeded-rng.js) — Mulberry32 32-bit
  state). On load, the rival's RNG resumes from this state. Combined with the
  captured `_tickAccumMs`, this is load-bearing for telemetry, replay, and
  bug repro — a saved run reloaded produces the same Evening Star decisions
  the original run would have. Future rivals (Herald, Observer at Tier-1)
  add their own RNG state to `RivalsSnap`; the World-level RNG is reserved
  for systems that don't have a per-rival owner (lead spawn jitter at
  milestone 0.9+ is the first plausible caller).
- **Mid-edition resume.** Saves may be taken at any sim frame. On load:
  `CycleClock.remainingMs` resumes the deadline counter without re-firing
  `DEADLINE_WARNING` / `DEADLINE_FIRE` (the `warning_fired` / `fire_fired`
  flags suppress duplicate emissions). Unit motion resumes from `pos` /
  `tile` / `path` / `path_idx` — partial-tile progress is preserved by
  the continuous `pos`. Carried leads reattach via `carrying_story_id`.
  No edition-boundary requirement.
- **Saves during debrief pause.** A save taken while `debriefOpen === true`
  restores the pause: the loaded `World.debriefOpen` is true, `tick()`
  short-circuits, the renderer paints the last snapshot, and `ackDebrief()`
  resumes normal flow. The pending `EDITION_DEBRIEF_BEGIN` event itself is
  **not** re-emitted on load — the player has already seen it. The debrief
  panel's mount-on-load behavior is the 0.8 code session's concern (likely
  re-mounting from the captured `summary` on the cycle subscriber's next
  `CYCLE_BEGIN` cancellation, but that's renderer-side).
- **Saves after `CYCLE_GAME_OVER`.** A terminal save (`game_over === true`)
  reloads into the same terminal state — the renderer mounts the
  "THE PRESS BURNS" overlay, `tick()` short-circuits, and the only valid
  next action is "new run." This is round-trip integrity, not a feature
  (a player who closes the tab on the fail screen sees the same screen on
  return).
- **Story `version` field — closes ICD-05 v0.4 §Open-Q-1.** Every Story
  carries `version: 1` from v0.1 of this schema. The field is **per-record**
  and migrates independently of the blob-level `version` — a future Story
  shape change (say, splitting `flavor` into `flavor` + `sub_flavor`) bumps
  `Story.version` and adds a `migrate_story_1_to_2` pure function called by
  the corresponding blob migration. This keeps Story-level migrations local
  and avoids cascading bumps across the entire blob version every time one
  sub-shape changes. ICD-05 v0.4.1 §Notes records the close.
- **What's NOT in the save.** three.js scene graph, mesh instances, HUD
  DOM, `World.cycleSubscribers` (function references — runtime-only),
  `World.effects` (transient queue — drained per snapshot),
  `Unit.selected` (UI state — resets on load). The renderer rebuilds from
  the post-load `WorldFrame`. The `effects` queue is empty across save
  boundaries because saves cannot be taken mid-snapshot (saves run between
  ticks).
- **Id minting after load.** `id_mint.next` captures the module-scoped
  counter ([`../js/sim/world-state.js`](../js/sim/world-state.js) `nextId`)
  so post-load `mkId('b' | 'u' | 's')` continues to mint unique ids that
  don't collide with anything in the loaded blob. The constructor's
  `nextId = 1` reset must be skipped on the load path. This is the one
  load-time module-state mutation the 0.8 code session must wire.
- **Grid persistence rationale.** `grid.walkable` is currently static
  post-construction (the constructor closes building tiles and never
  re-opens them). It's captured anyway because the Tier-1 procedural city
  generator (overview fuzzy band) will mutate `walkable` per-run, and
  capturing it from v0.1 keeps the schema stable when that lands.
- **Roster expansion is a schema bump.** Adding a unit `kind`
  (`'tipster'` at Tier-1, `'street_kid'` at Tier-1), a building `kind`
  (`'branch'`, `'switchboard'`), a story state (`'killed'`), or a rival
  (`'herald'`, `'observer'`) widens the corresponding union and bumps
  `SaveBlobV1` → `SaveBlobV2` with a migration that defaults the new
  fields. Not a deviation — this is normal schema evolution.

## Save trigger surface (recommendation, not commitment)

The save trigger surface is the 0.8 code session's concern; this ICD
**recommends** the following defaults but does not lock them. The 0.8
code session may settle on a different cadence without an ICD-04 bump
(the trigger surface is sim-external — calling `saveNow(world)` from
anywhere is shape-equivalent).

- **Recommended:** save on `EDITION_DEBRIEF_END` (every edition boundary,
  the natural quiescent point) **and** on `CYCLE_GAME_OVER` (terminal
  integrity).
- **Recommended against (v0.1):** save on every `CYCLE_TICK` (excessive),
  manual-only (loss risk on tab-close).
- **Open for 0.8:** autosave-every-N-seconds during play, debounced;
  pre-`DEADLINE_FIRE` save so a crashed plate step doesn't lose the
  edition.

## Open questions

- **Save cadence** (autosave-every-N-frames vs. on-`EDITION_DEBRIEF_END`
  only vs. manual button). The 0.8 code session settles this; v0.1 of
  this ICD ships shape-only.
- **Compression.** Uncompressed JSON is the v0.1 default. If real-game
  playtest blobs exceed ~1 MB (the rough `localStorage` per-key practical
  ceiling on older browsers), wrap the write/read pair in `CompressionStream`
  / `DecompressionStream` (`gzip`). Defer until the size shows up.
- **Multi-slot saves.** The supplement and design doc both speak in the
  singular ("the save"). v0.1 ships single-slot. A future multi-slot UI
  is a renderer change with the same `SAVE_KEY` pattern (suffix by slot
  id); not a schema concern.
- **Schema-version policy on field-only additions.** Adding an optional
  field to an existing interface is currently treated as a bump
  (`migrate_1_0_to_1_1` adds the default). The alternative — letting
  optional fields fall through without a migration — is faster but loses
  the "every blob has a known shape" property. v0.1 commits to the
  bump-and-migrate path; the 0.8 code session may revisit if migrations
  become noisy.

## Deviation policy

Constraint #4 (METHODOLOGY §3.2): any code that diverges from this ICD
updates the ICD in the same PR. The 0.8 code session is expected to lift
v0.1 verbatim; if any field has to change shape (rename, retype, or
new-mandatory-field), the session stops and amends ICD-04 in the same PR
the deviation lands.

**Architecture-session-required (not a deviation):**

- Adding a new top-level key to `SaveBlobV1`.
- Adding a new rival sub-shape to `RivalsSnap`.
- Widening any union in `BuildingSnap.kind` / `UnitSnap.kind` /
  `StorySnap.state` (these are roster expansions — see §Notes "Roster
  expansion is a schema bump").
- Changing the migration policy (e.g., dropping the bump-on-optional-add
  rule from §Open questions).

## Revision history

- **v0.1.2** (milestone 1.0.0, 2026-05-22) — In-PR Constraint #4 bump
  alongside the Tier-1 opener code session that wires Herald + Observer.
  `RivalsSnap` widens to `{ evening_star, herald, observer }`; new
  `HeraldSnap` + `ObserverSnap` interfaces authored against the rival
  modules' internal-state fields (state, counters, RNG, past_intents).
  In-blob `version` field bumps from `"1.0"` to `"1.1"`. New migration
  step `migrate_1_0_to_1_1` synthesizes default Herald + Observer snaps
  when loading a pre-1.0.0 save (counters at zero, RNG seeded fresh,
  cash at start value); the rest of the blob is untouched. Documented
  consequence: pre-1.0.0 runs that resume lose any adversarial-counter
  history Herald + Observer might have accumulated had they existed
  pre-1.0.0 — which is none, by definition. Storage key
  (`'late-edition.save.v1'`) unchanged.

- **v0.1.1** (milestone 0.10.0, 2026-05-21) — Lead-spawn engine (audit
  C-04) is the first concrete caller of the `rng_seed` slot v0.1 reserved
  ("first plausible caller: lead spawn jitter at milestone 0.9+"). The
  semantics settle here: the field carries the spawner stream's **live
  PRNG state** (not just the initial seed), so a post-load run resumes the
  cadence at the exact byte the pre-save run was at. The clearer `world_rng:
  { state }` key is written alongside for forward-compat readers; both
  point at the same number. New `lead_spawner` block carries the per-
  district accumulator map (`{ [districtId]: ms_toward_next_spawn }`) so
  the spawn cadence resumes mid-edition without rounding. New `run_stats`
  block carries the rolling totals (`total_revenue`, `editions_survived`,
  `top_story`) that the run-end summary + high-score writer read at
  `CYCLE_GAME_OVER` (audit G-13). New sibling key `'late-edition.scores.v1'`
  hosts the cross-run `HighScoreBlobV1` (10-entry sorted cap; schema
  declared above in §Storage key). `BuildingKind` union widens to include
  `'branch_bureau'` per ICD-01 v0.6.1 (audit G-01). No migration is needed
  — the v0.1 → v0.1.1 transition adds only optional fields to existing
  blobs, and `_loadFromSnap` reads each via `??` fallback. `runMigrations`
  still routes `'1.0'` blobs through the identity path; the in-blob
  `version` stays at `"1.0"` until the next breaking change. Constraint
  #4 in-PR bump alongside the milestone 0.10.0 substrate code session.
- **v0.1** (PRE-0.8, 2026-05-21) — Authored. Single-blob `localStorage`
  schema with explicit version, migration policy, determinism contract
  (per-rival RNG state captured), mid-edition resume rules, Story
  per-record `version` field (closes ICD-05 v0.4 §Open-Q-1), and recommended
  save trigger surface. Shape derived from the supplement §03 sketch
  ([`../design/phase-0-roadmap.html`](../design/phase-0-roadmap.html) §03
  ICD-04 panel) refined against the v0.7.1 World / CycleClock / EveningStar
  / SeededRng surfaces. No prior version — this is the first ICD-04.
