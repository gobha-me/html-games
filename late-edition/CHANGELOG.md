# Changelog — Late Edition

## v0.10.3 — 2026-05-22 — RE-EVAL Tier-0 → Tier-1 (paper + code-aware)

Paper-only, no code. The **fourth and final re-eval** in the original
Tier-0 plan, mirroring re-eval-after-0.3 (v0.3.1) · re-eval-after-0.6
(v0.6.1) · re-eval-after-0.9 (v0.9.2). METHODOLOGY §3 both halves ran —
structural pass + code-aware pass against the seven authored ICDs —
plus the **forward ICD presence check** for the next-N window (PRE-1.0
/ 1.0), plus the **band-tier transition gate** (Tier-0 → Tier-1 is the
transition this slot exists to authorize).

This is the fifth paper-only changelog entry (v0.1.1 PRE-0.2 · v0.3.1
RE-EVAL after 0.3 · v0.4.1 PRE-0.5 · v0.6.1 RE-EVAL after 0.6 · v0.7.2
PRE-0.8 · v0.9.2 RE-EVAL after 0.9 · v0.9.4 PRE-0.10 are the prior
paper sessions).

Headline outputs:

- **Seven ICDs intact.** ICDs 01 v0.6.2 / 02 v0.2.2 / 03 v0.2 / 04
  v0.1.1 / 05 v0.4.1 / 06 v0.4 / 07 v0.1 survived 0.10.0 / 0.10.1 /
  0.10.2 code-aware re-read with **zero interface drift**. Constraint
  #4 honored across the three 0.10.x milestones — ICD-01 v0.6 → v0.6.1
  → v0.6.2 + ICD-04 v0.1 → v0.1.1 all in-PR bumps. The methodology
  continues to work.
- **Two design-doc-to-code drifts carried forward** from the post-0.9
  audit: `UnitView.stats` + `LeadView.district` authored-but-deferred
  projections (ship at 1.0 alongside named Reporters + per-district
  Story queue), and the 30 s minimum debrief gate (ICD-06 v0.4 wording
  shipped at PRE-0.10; code-side gate ships at 1.0).
- **One band promotion:** **arc framework Fuzzy → Strong**
  ([`architecture/00-overview.md`](architecture/00-overview.md) — added
  to §Strong; the "8 authored arcs" §Fuzzy row re-worded to separate
  *framework* (now Strong) from *content* (stays fuzzy); the "Story
  slot grammar" §Medium row subsumed and struck). The three 0.10.0
  substrate modules ([`js/sim/headlines.js`](js/sim/headlines.js) +
  [`js/sim/districts.js`](js/sim/districts.js) +
  [`js/sim/lead-spawner.js`](js/sim/lead-spawner.js)) implement the §18
  three-tier shape + slot grammar + §19 spawn engine end-to-end at the
  Whisper level. New §Medium line added: "Investigation chains (3-step)"
  — the §18 line 1370 mid-game mechanic; framework substrate ready,
  chain wiring lands at 1.x.
- **One band tightening:** "Rival AI state machines" (overview line
  43) — Herald + Observer enter the N-window with the Tier-1 opener.
  No status edit yet; the v0.3 shape work is scheduled to PRE-1.0
  alongside the three new ICDs.
- **One discussion-doc move:**
  [`discussion/observer-violence.md`](discussion/observer-violence.md)
  status line moves from `open · pre-architecture · not a commitment`
  to `pre-PRE-1.0 input · Observer milestone in the N-window · paper
  session settles the "partner-fund" question against the design HTML's
  §DESPERATE state`. The Observer's `PARTNER_REQUEST` for $500 keeping
  the Observer alive (rival-ai-spec.html line 750) is the design-doc
  precedent the discussion doc reconciles with at PRE-1.0.
- **Forward ICD check schedules PRE-1.0.** Single architecture session
  authors **ICD-02 v0.3** (Herald + Observer state machines lifted
  from [`design/rival-ai-spec.html`](design/rival-ai-spec.html) §03 +
  §05) + **ICD-08** (Switchboard line-of-sight contract, new — Design
  Doc §10 *"Information about the threat is itself a defense resource"*)
  + **ICD-09** (Archive / inter-edition story state, new — Design Doc
  §05 + §17; current ICD-05 v0.4.1 explicitly defers archive) + **ICD-10**
  (Arc framework formalization, new — §18 `StoryArc` record + Investigation
  3-step chain + arc trigger predicates) + ICD-01 v0.6.2 → v0.6.3
  §Notes addition (authored-but-deferred-projection rule).
- **Tier-1 opener direction confirmed:** rivals + switchboard + archive
  UI + the two deferred projectors + the 30 s debrief gate, all at
  milestone 1.0; split 1.0.0/1.0.1 at session open per the 0.7 / 0.10
  precedent if scope creeps. PRE-1.0 ratifies the exact contract
  surface.
- **One Gitea ticket opened** for PRE-1.0 paper (`docs` label).
  Milestone 1.0 ticket is held until PRE-1.0 ratifies the opener's
  scope.

### Added

- [`architecture/re-eval-tier-0-to-1.md`](architecture/re-eval-tier-0-to-1.md)
  — the session document. Records the code-aware pass against the seven
  ICDs at 0.10.x, classifies findings per METHODOLOGY §3.1.1, promotes
  the arc framework, schedules PRE-1.0 with its specific deliverables
  (ICD-02 v0.3 + ICDs 08 / 09 / 10 in one paper slot), and pins three
  open-question verdicts (§3.5 Q1 Herald + Observer both at 1.0 · Q2
  Switchboard bundled at PRE-1.0 / 1.0 · Q3 Archive bundled at PRE-1.0
  / 1.0 because Investigation chains need it).
- New `Tier 1 — content + adversarial maturation` table in
  [`roadmap.md`](roadmap.md) with PRE-1.0 and 1.0 rows.

### Changed

- [`architecture/00-overview.md`](architecture/00-overview.md) —
  **arc framework added to §Strong** (single new row citing the three
  0.10.0 substrate modules + Design Doc §18 + §19). §Medium "Story slot
  grammar" row struck-through (subsumed). §Medium grew new "Investigation
  chains (3-step)" row. §Fuzzy "8 authored arcs" row re-worded to
  separate framework (Strong) from content (Fuzzy).
- [`roadmap.md`](roadmap.md) — "RE-EVAL Tier-0 → Tier-1" row ticked
  with v0.10.3 summary; new `Tier 1` table inserted with PRE-1.0 + 1.0
  rows; "Current status" block rewritten to lead with the Tier-0 →
  Tier-1 re-eval ship; "Out of scope until called" section updated to
  strike the Tier-1-architecture line and note Tier-2 (procedural city
  · MP · audio asset pipeline · tech-tree branches) as the new
  outermost out-of-scope band; checklist updated with the v0.10.3
  entry; ratio paragraph below the table updated (4 → 5 architecture-
  only items, PRE-1.0 added).
- [`AGENTS.md`](AGENTS.md) — "Current state" and "Next" paragraphs
  rewritten to reflect: re-eval shipped, arc framework promoted, PRE-1.0
  scheduled, observer-violence discussion-doc moved. "Don't commit code"
  hard rule updated — all seven ICDs authored; next slot is PRE-1.0.
- [`discussion/observer-violence.md`](discussion/observer-violence.md)
  — status line moved from `open · pre-architecture · not a commitment`
  to `pre-PRE-1.0 input · Observer milestone in the N-window · paper
  session settles the "partner-fund" question against the design HTML's
  §DESPERATE state`. Body unchanged.

### Not changed

- No file under [`js/`](js), [`tests/`](tests), or [`index.html`](index.html)
  was touched. METHODOLOGY §3.2 forbids code in a re-evaluation session.
- All seven ICDs **unchanged at the shape level** — the bands moved,
  the contracts did not. v0.3 (ICD-02), new ICDs 08 / 09 / 10, and
  ICD-01 v0.6.3 §Notes are all explicitly scheduled to PRE-1.0 per the
  §3.2 surface-and-schedule pattern (the same pattern v0.3.1 → PRE-0.5
  · v0.6.1 → PRE-0.7 · v0.9.2 → PRE-0.10 followed).
- Design HTMLs in [`design/`](design) — immutable per AGENTS.md hard
  rule. The Tier-1 opener's rival state machines (Herald FIG. H1 ·
  Observer FIG. O1) are lifted *from* the design HTMLs *into* ICD-02
  v0.3 at PRE-1.0 — the HTMLs themselves stay untouched.

### Verification

- `node --test tests/*.test.mjs` — 199 / 199 pass (baseline, unchanged
  from v0.10.2).
- `git diff` touches only `architecture/`, `roadmap.md`, `CHANGELOG.md`,
  `AGENTS.md`, and `discussion/observer-violence.md`. Zero diff under
  `js/`, `tests/`, `index.html`, `design/`, the seven ICDs, or
  `deferred/`.

## v0.10.2 — 2026-05-22 — Visual feedback (rain ramp · FxEvent wiring · newspaper debrief · lit windows + fog)

PR-D from the post-0.9 re-eval — the closing Tier-0 polish PR. With PR-C
(0.10.0 substrate + 0.10.1 onboarding) shipped, the simulation now plays
end-to-end; this PR turns the surface from *tech demo with a deadline*
into *newspaper noir RTS*. Four audit-named items land together against
ICD-01 v0.6 + v0.6.2 (one-line range-comment widen for `rain.intensity`).
Closes Gitea issue #299.

Headline changes:

- **C-06 — Rain ramp at deadline.** [`js/sim/world-state.js`](js/sim/world-state.js)
  `snapshot()` now dials `frame.rain.intensity` from 1 → 2 across the last
  30 s of an edition, derived from `cycle.remainingMs` (Design Doc §15).
  [`js/render/renderer.js`](js/render/renderer.js) scales the rain line-
  draw range by intensity (`setDrawRange`), capped at the 1500-line ceiling
  per Design Doc §15. Boot-time rain buffer is sized to the cap so the
  ramp is a draw-range tweak, not a geometry reallocation.
- **C-07 — `WorldFrame.effects` wired end-to-end.** Five sim emit sites
  feed the `FxEvent` queue authored at ICD-01 v0.6:
  - `pickup` — reporter lands on a lead (`_handleReporterArrival`)
  - `verify` — photog drops the held lead at the Darkroom (`_handlePhotogArrival`)
  - `print` — one per admitted story at `DEADLINE_FIRE` (`_fireDebrief`)
  - `death` — goon / fixer hits HP 0 (`_pruneDeadUnits`; reporter/photog death
    stays silent at Tier-0 per the existing prune filter)
  - `raid_warning` — once per RAID_BUREAU intent at the reconciler
    (`_reconcileIntent`)
  Renderer-side `_consumeEffects` drains the queue every frame and spawns
  ephemeral noir-palette meshes (yellow ring · white camera-flash quad ·
  rising newspaper sprite · red X · pulsing exclamation). TTLs are
  200–1000 ms; the active set is small and disposed in place.
- **D-07 — Debrief panel as newspaper pages.** [`js/debrief-panel.js`](js/debrief-panel.js)
  now mounts a `<div class="debrief-card is-fresh">` with a masthead
  (kicker · *Late Edition* nameplate · edition number) and a two-column
  `.np-pages` grid of `<article class="np-page">` per `StoryDigest`.
  Slap-down `@keyframes` (translateY + slight rotation, 320 ms ease-out)
  fires on mount. Drop-cap rule (`::first-letter`) on every headline.
  Reuses the existing Bodoni Moda + JetBrains Mono stack. ~150 LOC of
  CSS + DOM, no JS shape change.
- **D-09 — Lit windows + fog-on-deadline.** Per-building emissive
  `MeshBasicMaterial` quads attached as children of each Bureau / Branch
  Bureau / Darkroom group on first mount. Each window flicks lit ↔ dark on
  a 4–14 s random period; convergence is ~40% lit at any moment. Fog
  `near` plane lerps 22 → 14 across the last 60 s of the edition, sim-
  side per the same `cycle.remainingMs` pattern as rain (no ICD shape
  change — `WorldFrame.fog.{near, far, color}` was already authored at
  ICD-01 v0.5).

Tests: 179 → 199 cases (+20). New [`tests/effects-pickup-verify.test.mjs`](tests/effects-pickup-verify.test.mjs)
(3) · [`tests/effects-print.test.mjs`](tests/effects-print.test.mjs) (2)
· [`tests/effects-death-raid.test.mjs`](tests/effects-death-raid.test.mjs)
(4) · [`tests/rain-ramp.test.mjs`](tests/rain-ramp.test.mjs) (5) ·
[`tests/fog-ramp.test.mjs`](tests/fog-ramp.test.mjs) (6). Existing
[`tests/world-frame.test.mjs`](tests/world-frame.test.mjs) effects-drain
assertion (line 116) continues to cover the queue lifecycle. No regression
in the 0.10.1 onboarding / 0.10.0 substrate / pre-Tier-0 areas.

ICDs: [`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md)
→ **v0.6.2** (Constraint #4 in-PR bump). `WorldFrame.rain.intensity`
inline comment widened from `0-1` to `0+ unbounded; 1 = baseline, ~2 at
deadline (PR-D)`. §Notes gains a one-paragraph note pinning the rain +
fog ramps as sim-side computations (in `World.snapshot()` from
`cycle.remainingMs`), not new `CycleEvent` kinds — `raid_warning`
(FxEvent) remains the only discrete pre-raid trigger. No shape change.

Out of scope (Tier-1):

- Halftone print pass on the debrief panel (Design Doc §03).
- ICD-07 audio cue-table implementation (channels + assets land at
  Tier-1's first audio milestone).
- `flash` FxEvent co-emit with `verify` — `verify` carries the camera-
  flash visual itself in 0.10.2; the separate `flash` kind is reserved
  for future use.

## v0.10.1 — 2026-05-22 — Onboarding (WASD pan · Block zoom · slow-mo · diegetic tutorial)

The coupled remainder of PR-C, deferred at the authorized 0.10.0/0.10.1
split. The minimum control surface and the first edition's diegetic
tutorial are coupled by design — the player needs to know WASD / `[`/`]` /
Space exist, and the first note from the old man is the only diegetic
surface that names them. The substrate from 0.10.0 (lead-spawner,
districts, branch bureau) is now reachable: fresh runs walk a new player
through reporter → darkroom → plate → first edition with four pinned
notes; experienced players keep the same map but with a 2.2× zoom step,
camera pan, and a 5-second deadline cushion on a 30-second cooldown.

Headline changes:

- **G-07 — Minimum control surface (WASD pan · Block zoom · slow-mo).**
  [`js/input.js`](js/input.js) gains keyboard handlers: WASD pans the
  camera (axis-aligned XZ ground plane, `TILE × 4 = 24` world units/sec,
  normalized so diagonals don't outpace cardinals); `[` and `]` step
  between City (frustum 22) and Block (frustum 10) zoom — Design Doc §12
  "two steps … 250 ms ease-out cubic"; Space triggers slow-mo (Design Doc
  §19: 0.5× sim speed for 5 real seconds, 30 s cooldown, never pause).
  Pan + zoom state live on the Renderer ([`js/render/renderer.js`](js/render/renderer.js))
  with a new `_updateView()` per-frame integrator; `setPanVelocity(vx, vz)`
  + `setZoom('city' | 'block')` are the input-side surface. Pan clamps to
  `±27` world units (half the grid extent) so the player cannot lose the
  bureau. Camera position and lookAt translate together — the isometric
  angle is preserved.
- **G-09 — Diegetic tutorial (notes from the old man).** New pure module
  [`js/sim/tutorial.js`](js/sim/tutorial.js) derives a beat
  (`'send-reporter' | 'verify' | 'plate' | 'welcome' | null`) from existing
  `WorldFrame` fields — `hud.edition`, `hud.deadline_ms`,
  `hud.resources.stories`, and `units[].kind/.carrying`. No persistence: a
  mid-tutorial save/load lands on the correct beat by re-derivation. New
  `TutorialNote` projector inside [`js/hud.js`](js/hud.js) mirrors the
  TopCards diff-cache pattern; new `<aside id="hud-tutorial-note">` pinned
  above the resource cards reads as a fifth index card with a red left
  border. Beat 1 ("Send a reporter to The Docks, kid.") carries the control
  hint paren — the one place where the diegesis names WASD / `[`/`]` /
  Space. Welcome window: first 30 s of edition 2, then the note vacates
  the corkboard forever. Copy lifts the four-note spine settled in
  [`discussion/tutorial-first-edition.md`](discussion/tutorial-first-edition.md).
- **Slow-mo controller.** New pure module [`js/slow-mo.js`](js/slow-mo.js)
  owns the state shape + transitions (`triggerSlowMo`, `speedFactor`,
  `activeRemainingMs`) — `js/main.js`'s loop multiplies `TICK_DT` by
  `speedFactor(slowMo, performance.now())` before passing to `world.tick`,
  so the deadline counts at half-speed and unit movement halves
  proportionally during the active window. Loop cadence stays at 30 Hz
  real-time so the renderer interpolation pipeline is undisturbed.

Tests: 159 → 179 cases. New [`tests/tutorial.test.mjs`](tests/tutorial.test.mjs)
covers all four beats + the null sentinels (edition ≥ 3, welcome-window
expiry) + the `verify`-over-`plate` precedence rule. New
[`tests/slow-mo.test.mjs`](tests/slow-mo.test.mjs) exercises the trigger /
cooldown / speed-factor cycle against synthetic monotonic clocks. New
[`tests/tutorial-integration.test.mjs`](tests/tutorial-integration.test.mjs)
runs the projection against a real `World` snapshot for the
`send-reporter` / `verify` / `plate` transitions. No ICD bumps —
`cameraTarget` already exists in `WorldFrame` from ICD-01 v0.5 (stays at
origin; pan/zoom live renderer-side), and the tutorial beat is derived
from existing projection fields.

## v0.10.0 — 2026-05-21 — PR-C substrate (lead-spawn engine · districts · Branch Bureau · grammar · scores)

PR-C from the post-0.9 re-eval — the substrate half of the Tier-0 closer.
Five of the seven audit-named items land here; the remaining two (G-09
diegetic tutorial copy · G-07 minimum control surface) defer to
**milestone 0.10.1 (onboarding)** per the roadmap's authorized
0.10.0/0.10.1 split (precedent: 0.7.0 / 0.7.1). The substrate makes the
loop **read as a game**: leads spawn continuously, districts have
identity, the dossier shows real headlines, the second bureau-family
building lights up, and a run ends with a numbered place on the
high-score board.

Headline changes:

- **C-04 — Lead-spawn engine.** New pure module
  [`js/sim/lead-spawner.js`](js/sim/lead-spawner.js) mirrors the
  [`js/sim/resources.js`](js/sim/resources.js) pattern. Owns the per-tick
  cadence (Design Doc §19 line 1436: 1 lead per ~90 s per covered
  district, ×0.5 if uncovered), the tier roll (70/25/5 Whisper /
  Investigation / Arc — Arc remaps to Investigation at Tier-0 per
  §18 line 1354), and the 180 s decay rule (§19 line 887). The
  cross-tick state is one accumulator per district plus a `SeededRng`
  stream (`World.spawnerRng`); both round-trip through the save blob.
  Wired into [`World.tick`](js/sim/world-state.js) after the rival tick
  and before `cycle.advance`. The 0.3-era hardcoded single-lead spawn
  remains as a starter seed (same tile, hand-written headline
  *"DOCKHAND TIPS THE WIRE"*) so the first 90 s of a fresh run is
  never an empty world.
- **G-04 — Districts as data.** New pure module
  [`js/sim/districts.js`](js/sim/districts.js) ships two records at
  Tier-0 — **The Docks** (vice/violence leaning · SW spawn rect) and
  **Hillside** (money-heavy · NE spawn rect). Each carries a `spawnRect`,
  a `coveredByKind` bureau-family tag (`'bureau'` for Docks · `'branch_bureau'`
  for Hillside per Design Doc §15 *"a bureau in a district produces
  leads there"*), per-district `flavorWeights` (the §19 HEAT_BY_FLAVOR
  table is the receiver), and an `actorPool` (the §18 slot-grammar's
  first slot). Legacy saves carrying the `'d-default'` district literal
  resolve to the Docks via `resolveDistrictId` (no migration needed —
  the projector folds at the boundary). `DistrictId` becomes a real
  union per ICD-01 v0.6's `LeadView.district` projection.
- **G-01 — Branch Bureau.** Second bureau-family building, at tile
  `(8, 3)` inside the Hillside spawn rect. HP 20 (Design Doc §15
  *"squishy: 1 goon takes them out in 20s"* @ 1 dmg/s) — distinct from
  the main Bureau's 90. Reporters drop at either bureau-family building
  (`_handleReporterArrival` widens the destination check via the new
  `isBureauFamily` helper); photogs likewise pick up from either. Branch
  destruction does NOT trigger `CYCLE_GAME_OVER` — only the main Bureau
  drives the §17 single fail-state. ICD-01 → v0.6.1 in the same PR
  (Constraint #4) widens the `BuildingKind` vocabulary. Renderer adds a
  small tan-bodied mesh with a red awning so the silhouette reads as
  "newsstand-scale office" against the central Bureau.
- **G-05 — Slot-grammar headlines.** New pure module
  [`js/sim/headlines.js`](js/sim/headlines.js) implements the Design
  Doc §18 line 1359+ grammar: actor (from district pool) + verb (tagged
  by flavor — vice / violence / money / labor) + object (district pool ∪
  shared civic-target pool). Tier prefix register: whisper bare,
  investigation *"EXCLUSIVE · "*, arc *"FRONT PAGE · "*. Story shape
  gains an optional `headline` field set at spawn time (deterministic
  via the spawner rng); `storyDigest` reads it directly for the
  EditionSummary digest + the run-summary top-headline readout. The
  legacy `${flavor} ${tier} HITS WIRE` line stays as a defensive
  fallback only.
- **G-13 — Run-end summary + high-score persistence.** New `World.runStats`
  rolls `total_revenue` / `editions_survived` / `top_story` across the
  run (updated in `_buildEditionSummary`, persisted in the save blob).
  [`js/sim/save.js`](js/sim/save.js) adds a second storage key
  `'late-edition.scores.v1'` (per ICD-04 v0.1.1 §Storage) with a sorted-
  desc, capped-at-10 list. [`js/game-over-overlay.js`](js/game-over-overlay.js)
  extends to render the run summary (editions · revenue · top headline
  · rank · top-5 board) inside the existing game-over card on
  `CYCLE_GAME_OVER`; the "Start a new run" button still clears the save
  blob and reloads — but the score blob persists so the player's
  history accumulates across runs.

ICD bumps (Constraint #4 in-PR):

- **ICD-01 → v0.6.1** ([`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md))
  — `BuildingKind` widens to include `'branch_bureau'`. Value-level
  addition under the open-vocabulary slot; no shape change.
- **ICD-04 → v0.1.1** ([`icds/ICD-04-save-schema.md`](icds/ICD-04-save-schema.md))
  — `rng_seed` semantics settled (live PRNG state, not initial seed),
  `world_rng: { state }` sibling key written for clarity, new
  `lead_spawner: LeadSpawnerSnap` block carrying per-district
  accumulators, new `run_stats: RunStatsSnap` block, new `SCORES_KEY`
  documented with full `HighScoreBlobV1` schema. Backward-compatible
  via optional-field reads — no migration.

Test count: 124 → 159 (+35 in 5 new files —
[`tests/districts.test.mjs`](tests/districts.test.mjs),
[`tests/lead-spawn.test.mjs`](tests/lead-spawn.test.mjs),
[`tests/branch-bureau.test.mjs`](tests/branch-bureau.test.mjs),
[`tests/headlines.test.mjs`](tests/headlines.test.mjs),
[`tests/high-scores.test.mjs`](tests/high-scores.test.mjs)). Existing
`tests/world-frame.test.mjs` updated for the v0.6 / v0.6.1 contract
(LeadView.district, WorldFrame.rivals, branch_bureau in the kind enum).

Out of scope for 0.10.0 (lands at 0.10.1):

- **G-09** diegetic tutorial copy — coupled to G-07 (controls the
  tutorial copy needs to reference).
- **G-07** minimum control surface — WASD pan + Block zoom + slow-mo
  (Design Doc §12).

After 0.10.1: **0.10.x (PR-D)** visual feedback — rain ramp at deadline
(C-06), `WorldFrame.effects` producer/consumer wiring (C-07; the
contract authored at PRE-0.10 still has no callers), debrief panel as
newspaper pages (D-07), lit windows + fog-on-deadline (D-09).

## v0.9.4 — 2026-05-21 — PRE-0.10 paper session (ICD-01 v0.6 · ICD-06 v0.4 · ICD-07 v0.1)

PR-B from the post-0.9 re-eval — paper-only architecture session that
authors the ICD bumps milestone 0.10 needs. ICD-01 lifts to v0.6 with
four field-set additions, ICD-06 lifts to v0.4 with a single §Cycle
timing wording change, and ICD-07 lands at v0.1 from scratch as the
audio bus contract. Same PR carries the HUD corkboard band promotion
(medium → strong) in [`architecture/00-overview.md`](architecture/00-overview.md)
line 45 (formally moved in the table; the medium row is struck through
with a *moved → strong* note for trail-of-edits readability). Milestone
0.10 (Tier-0 closer · PR-C) is now legal to open as a code session
with every required contract in hand.

METHODOLOGY §3.2 forbids code in a paper slot — verified by the
byte-zero diff under [`js/`](js), [`tests/`](tests),
[`index.html`](index.html), and [`design/`](design).

Headline outputs:

- **ICD-01 → v0.6.** Four field-set additions ahead of milestone 0.10
  (Tier-0 closer):
  - **`UnitView.stats: {nerve: number, nose: number, legs: number} |
    undefined`** (audit G-10). Reporter trio per Design Doc §08
    (*"three substats: nerve (resists intimidation), nose (lead
    quality), legs (move speed)"*) and rendered in the §13 HUD mock
    under Selected · Reporter (*"M. Calloway / Nerve 6 · Nose 8 ·
    Legs 4"*). The field is `undefined` for every non-Reporter kind
    at Tier-0 (Photog, Editor, Fixer, Goon) — their stat surfaces
    are deferred to their own follow-on slots when the §13 mock asks
    for them. Numbers stay medium-band per overview §"First-pass
    balancing numbers"; the *projection shape* is locked at v0.6.
  - **`LeadView.district: DistrictId`** (audit G-11). Lifts the
    sim-layer `Story.district` field (live since milestone 0.3) into
    the projection so the §13 Story-queue dossier can render
    per-district headlines (*"Docks: Strike Threat · Hillside:
    Mayor's Mistress · Diamond Row: Empty Vault"*) without the HUD
    reaching back into sim state. Couples to G-04 (districts-as-data,
    milestone 0.10 / PR-C) — the concrete `DistrictId` union
    enumerates at PR-C when district records become first-class.
  - **`WorldFrame.rivals: RivalStatusView[]`** top-level key (audit
    G-12). Resolves the post-0.6 re-eval §3.5 Q5 carryover: the HUD
    surface for the `{calm, scheming, hostile}` posture lands as a
    top-level `WorldFrame` field, not nested inside `hud`. The
    `RivalStatusView` *type itself* stays owned by ICD-02 v0.2 — this
    ICD authors only the projection surface (the array on
    `WorldFrame`). Per-entry shape extensions (raid ETA / goon count
    / source direction for the §13 mock's *"ETA 02:40 · 3 GOONS ·
    FROM SW"* substring) live under ICD-02 §Open questions, deferred
    to milestone 0.10's Threats-dossier surfacing.
  - **`FxEvent` union** under `WorldFrame.effects` (audit C-07). Six-
    kind vocabulary: `'flash' | 'print' | 'death' | 'pickup' | 'verify'
    | 'raid_warning'`. Drained queue — events live for one frame, the
    renderer consumes them and never sees them again. Every kind
    carries `at: Vec3`; `verify` and `pickup` carry `story_id` (ICD-05
    correlate); `raid_warning` carries `rival: RivalId` (ICD-02
    correlate); `death` carries `unit_kind: UnitKind`; `print` carries
    `edition: number`. Producers (sim emit sites) and consumers
    (renderer FX layer + ICD-07 audio bus SFX channel) wire at PR-D /
    milestone 0.10.x — this slot authors the contract only.
- **ICD-06 → v0.4.** Single-line wording change in §Cycle timing
  (audit C-05). Replaced *"Duration is player-controlled (click to
  dismiss)"* with *"30 s minimum debrief animation; dismissable after
  the minimum elapses"*, citing Design Doc §19 (*"Between-edition
  pause: 30s · cannot be skipped · debrief animation"*) and §05
  (*"The first 30 seconds of every new edition are a debrief"*). No
  shape change, no new event kind, no `EditionSummary` / `StoryDigest`
  / `RivalEventDigest` change, no subscriber-table change. The
  code-side gate (minimum-elapsed clamp on the dismiss handler in
  the corkboard debrief panel) lands at milestone 0.10 alongside
  the newspaper-pages debrief render (PR-D scope).
- **ICD-07 → v0.1 (new).** Audio bus contract authored from scratch
  (audit G-08). Channel vocabulary locked at four channels:
  `'ambient'` (city beds, weather, press heartbeat), `'music'` (six
  cool-jazz stems for adaptive mixing), `'sfx'` (discrete one-shots
  including the `FxEvent` co-emit channel), `'vo'` (single radio
  announcer character). §Ducking rules table authored from Design
  Doc §14 — VO ducks music (−9 dB / 250 ms) and ambient (−3 dB /
  250 ms); SFX never ducks anything; music adaptive ramp at T-30s
  thins to bass + rain; print-fire crossfades to the MUS-06 tag;
  debrief-open ambient pull-back lets the newspaper-page-flip foley
  sit on top. §The press-silence beat lifts Design Doc §14's *"the
  first time the press goes silent is the first time the player
  notices it was there"* commitment as a one-way `−∞ dB` mute on the
  press-heartbeat bed (AMB-04 / AMB-05) tied to `CYCLE_GAME_OVER`;
  no re-arm within a run. §FxEvent ↔ SFX cue-table maps ICD-01 v0.6's
  six `FxEvent` kinds to Supplement-C cue ids (SFX-01 folder rustle,
  SFX-02 camera shutter, SFX-06 press fire, SFX-08..10 goon combat,
  SFX-14 klaxon). §Asset reference points at
  [`design/audio-manifest.html`](design/audio-manifest.html) —
  96-prompt manifest (6 beds · 6 music stems · 24 SFX · 60 VO
  lines), phase-tagged T0 / T1 / T2 for the Tier-1 audio milestone
  to record against. §Subscriber expectations table empty — no
  caller until the audio milestone enters the N-window (band stays
  medium until then).
- **HUD corkboard band promotion — medium → strong.** The §13
  pixel-honest layout shipped at milestone 0.9 is now load-bearing
  for ICD-01 v0.6's `UnitView.stats` · `LeadView.district` ·
  `WorldFrame.rivals` additions (post-0.9 re-eval §2). PRE-0.10
  carries the [`architecture/00-overview.md`](architecture/00-overview.md)
  line 45 edit — row moved from §Medium to §Strong; the medium-band
  row is struck through with a *moved → strong* breadcrumb so the
  history reads cleanly.
- **roadmap.md current status + checklist.** PRE-0.10 row marked
  *shipped v0.9.4*; "Current status" block updated to describe the
  shipped paper slot and point forward at **Milestone 0.10**; new
  `- [x] **PRE-0.10**` checklist entry added after the v0.9 re-eval
  entry, enumerating every ICD edit and the band promotion.
- **What's NOT in this PR.** No JS / tests / `index.html` / asset
  changes (paper-only per AGENTS.md §Hard rules + METHODOLOGY §3.2).
  No `FxEvent` producer or consumer wiring — PR-D / milestone 0.10.x
  scope. No code-side debrief-minimum gate — lands at PR-C / PR-D
  code session alongside the newspaper-pages debrief render. No
  audio engine selection — parked in ICD-07 §Open questions, defers
  to first caller. No concrete `DistrictId` union — lands at PR-C
  (G-04 districts-as-data). The four-issue Gitea triage opened at
  v0.9.2 (#291 prod-slug · #297 PR-B paper [this] · #298 PR-C closer
  · #299 PR-D visual feedback) carries forward — #297 closes with
  this PR; #298 and #299 stay open against their gated milestones.

## v0.9.3 — 2026-05-21 — PR-A polish (audit C-01 · C-02 · C-03 · D-01 · D-02 · D-04 · D-06)

Audit-PR-A from the post-0.9 re-eval — seven mechanical fixes plus a one-line
ICD-02 §Notes vocabulary addition (Constraint #4 in-PR). No new contracts;
the bumps that PR-B will author at PRE-0.10 stay parked. Ships in parallel to
PR-B / PR-C ordering.

Headline outputs:

- **C-01 — Press HP repair between editions.** [`World.ackDebrief`](js/sim/world-state.js)
  rebuilds the Bureau press to `hp_max` after the heat-decay step provided
  the Bureau survived (`bureau.hp > 0`). A destroyed Bureau stays at 0 —
  the run is already in game-over. Two new cases in
  [`tests/press-hp.test.mjs`](tests/press-hp.test.mjs) (repair path, no-resurrection
  path).
- **C-02 — `raid_succeeded` / `raid_wiped` emission with ICD-02 §Notes patch.**
  Every goon spawned by `_reconcileIntent(RAID_BUREAU)` carries a `raid_id`
  tag (audit-recommended "cheapest" shape from re-eval §3.5 Q2). World gains a
  short-lived `_activeRaids: Map<raid_id, {rivalId, damageDealt}>` — populated
  on raid commit, mutated by `_goonDamageTick` (first damage flips
  `damageDealt` and emits `raid_succeeded` once), drained by `_pruneDeadUnits`
  (last goon of a raid with no damage → `raid_wiped`). The map is intentionally
  ephemeral (ICD-04 §Notes — cadence vs. raid lifetime); a save mid-raid loses
  the outcome event but keeps the `raid_attempted` digest already flushed.
  [`icds/ICD-02-rival-world.md`](icds/ICD-02-rival-world.md) bumps **v0.2.1 → v0.2.2**:
  one-line §Notes addition enumerating the `RivalEventDigest.kind` vocabulary
  for Evening Star scope (`raid_attempted` · `raid_succeeded` · `raid_wiped`).
  Six new test cases in [`tests/goon.test.mjs`](tests/goon.test.mjs)
  (raid_id share, distinct mints across intents, single-emit on damage,
  fixer-cleanup → `raid_wiped`, no `raid_wiped` after `raid_succeeded`).
- **C-03 — "Start a new run" button on the game-over overlay.**
  [`js/game-over-overlay.js`](js/game-over-overlay.js) gains a single
  interactive element — a button that clears `SAVE_KEY` from `localStorage`
  and reloads. Until now, refreshing dropped the player back into the burnt
  save. Noir-palette CSS lives alongside the existing `.gameover-card` block
  in [`index.html`](index.html).
- **D-01 — Photog walk speed 3.5 → 2.5 u/s** (Design Doc §17). The 0.4
  carryover comment in [`js/sim/world-state.js`](js/sim/world-state.js)
  flagged this re-tune; PR-A is the re-tune. No test breaks.
- **D-02 — HP fields on Reporter / Photog / Editor.** Reporter 2, Photog 1,
  Editor 2 (Fixer was already 3). Sim-internal only — `UnitView` intentionally
  omits the field at 0.9.3; the stat-badge surface lands at ICD-01 v0.6 in
  PRE-0.10. Save round-trip already protected (optional fields, no migration).
- **D-04 — Heat decay §19 nuances.** [`js/sim/resources.js`](js/sim/resources.js)
  gains two named constants alongside `HEAT_DECAY_PER_EDITION = 8`:
  `HEAT_DECAY_QUIET_EDITION = 12` (no controversial story this edition →
  bonus decay) and `HEAT_DECAY_STALL_THRESHOLD = 80` (heat > 80 pre-decay →
  decay stalls at 0). [`World.ackDebrief`](js/sim/world-state.js) branches on
  `summary.heat_applied > 0` against the pre-decay heat reading; the decay
  comment block — previously a "scheduled for 0.7+" deferral — is replaced
  with a §19 citation. Four new cases in [`tests/resources.test.mjs`](tests/resources.test.mjs).
- **D-06 — HUD warning threshold T-60s → T-30s.** [`js/hud.js`](js/hud.js)
  `WARNING_MS` aligns with the `DEADLINE_WARNING` event already firing at
  T-30s ([`js/sim/cycle-clock.js`](js/sim/cycle-clock.js)). The optional
  `CRITICAL_MS` tighter pulse stays at 10s — the locked Late Edition tension
  beat.

Tests at **124 cases** (113 → 124; +11 across press-hp, goon, resources).
No ICD-04 / ICD-05 / ICD-06 bumps. Closes [#296](https://git.gobha.me/xcaliber/HTML-Games/issues/296).

## v0.9.1 — 2026-05-21 — webgl-crash fallback (#293)

Production bug fix between 0.9 and the post-0.9 re-eval. When the browser
can't create a WebGL context — Linux Chrome on Mesa llvmpipe, hardware
acceleration disabled, WebGL-context-limit-per-browser exceeded, iOS Lockdown
Mode, embedded WebViews — the entry-point script previously threw out of
[`new Renderer(root)`](js/render/renderer.js#L22) and the page stayed blank
with no user-facing indication of what went wrong.

Two layers:

- **Pre-flight probe.** [`hasWebGL()`](js/webgl-unavailable.js) in the new
  [`js/webgl-unavailable.js`](js/webgl-unavailable.js) module attempts
  `canvas.getContext('webgl2') || getContext('webgl')` before
  [`js/main.js`](js/main.js) constructs the renderer. On `null` the
  fallback card mounts and module execution halts before THREE is touched.
- **Last-resort catch.** [`new Renderer(root)`](js/main.js) is now wrapped
  in a `try / catch` — failures that get past the pre-flight (e.g. a driver
  crash inside `new THREE.WebGLRenderer({ antialias: true })`) still surface
  the same fallback card, and the underlying error is rethrown so the
  console keeps the full THREE stack trace for debugging.

The fallback card uses the parchment + ink palette already defined on
`:root` in [`index.html`](index.html) (CSS vars `--paper-2`, `--ink`,
`--red`, `--mid`, `--rule`, fonts `--serif` / `--mono`) with inline-style
fallbacks so it survives loading before the page stylesheet, and inlines a
`<details>` block carrying the error message via `textContent` (not
`innerHTML`) so the renderer's diagnostic can't inject markup.

No ICD bumps, no test count change (renderer construction is not exercised
by the node test suite). Issue [#293](https://git.gobha.me/xcaliber/HTML-Games/issues/293).

## v0.9 — 2026-05-21 — HUD corkboard · deadline ticker · dossier

Code milestone. The HUD lifts from a single-line ticker to the corkboard
the design doc §13 always called for: seven pinned index cards along the
top (Edition / Deadline / Leads / Stories / Ink / Cash / Heat), a
typewriter-ribbon deadline strip across the top of the 3D viewport
(red at ≤60s, pulsing red at ≤10s), and three dossier panels along the
bottom — Selected (kind / state / carrying), Story queue (active leads
+ tier and flavor histograms + in-flight Story count), and Threats
(goon count + Press HP). Pure renderer-side reorganization on top of
the already-locked HudState / UnitView / BuildingView / LeadView
projections. **Zero ICD changes** (Constraint #4 honored by zero
deviation).

Headline outputs:

- **CSS Grid layout in [`index.html`](index.html).** `<body>` becomes
  a four-row grid (masthead · top cards · viewport+deadline-strip ·
  dossier row). `#world` keeps its full-bleed canvas inside the `1fr`
  row; the renderer already reads `root.clientWidth/Height`
  ([`js/render/renderer.js`](js/render/renderer.js) lines 19-20,
  250-251) so the resize story is free. The arcade back-link folds
  into the masthead so no chrome floats over the dossier.
- **`HudCorkboard` facade in [`js/hud.js`](js/hud.js).** Single
  `apply(frame)` entry kept (`main.js` change is one line); three
  sibling region projectors (`TopCards`, `DeadlineStrip`, `Dossier`)
  each diff their own DOM at their natural change cadence. Projection
  helpers (`pickSelected`, `countByKind`, `tierHistogram`, `formatMs`,
  `formatEdition`) are named exports so node tests exercise them
  without jsdom.
- **Deadline emphasis.** Class toggles drive visual state on
  `#hud-deadline-strip`: `.is-warning` (≤60s, red) and `.is-critical`
  (≤10s, red + 2Hz opacity pulse via CSS `@keyframes`). Both classes
  clear at zero so the cycle transition doesn't strobe through the
  fire-debrief frame.
- **Selected-unit dossier.** Reads `frame.units.find(u => u.selected)`
  per `UnitView.selected` (ICD-01 v0.5 §UnitView). Kind label
  (Reporter / Photog / Fixer / Editor / Goon) + state label (Idle /
  Walking / Carrying) + "Carrying lead" annotation when applicable.
  Empty state: "No selection". Reporter stat badges (Nerve / Nose /
  Legs from the §13 mock) deferred — would need a `UnitView` field
  add (ICD-01 bump candidate, surfaced for the post-0.9 re-eval).
- **Story queue dossier.** Active leads count + tier histogram
  (whisper / investigation / arc) + flavor histogram (vice /
  violence / money / labor) — both derived directly from
  `frame.leads` per LeadView's locked `tier` + `flavor` fields —
  plus in-flight count from `frame.hud.resources.stories`. Per-
  district breakdown from the §13 mock deferred — `LeadView.district`
  isn't projected today (ICD-01 bump candidate).
- **Threats dossier.** Goon count from
  `frame.units.filter(u => u.kind === 'goon')` + Press HP from
  the Bureau BuildingView. Empty state "Streets quiet" + still-shows
  Press HP. Raid ETA / source-direction from the §13 mock deferred —
  needs a `WorldFrame.rivals` top-level key, which is an architecture
  session per [`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md)
  §Deviation policy. Surfaced for the post-0.9 re-eval.
- **Heat hot-state visual.** Top-card `.is-hot` class toggles when
  `heat >= 40` (design doc §19 first threshold — also the heat line
  that triggers raid eligibility). Numeral turns red.
- **Per-record change detection.** Each region caches its rendered
  state and writes DOM only on change. Top cards diff per-card;
  the deadline strip diffs val/edition/class triplet; the dossier
  diffs the selected-unit key + queue/threats text composites.
- **ICD activity.** None. ICD-01 v0.5 §HudState / §UnitView /
  §LeadView / §BuildingView all lifted as authored.
- **Tests.** 106 → 113 (seven new under
  [`tests/hud.test.mjs`](tests/hud.test.mjs)). Coverage: `formatMs`
  MM:SS padding (including negative-floor), `formatEdition` 3-digit
  zero-pad, `pickSelected` first-selected semantics + null-on-empty,
  `countByKind` tally (including miss-kind = 0), `tierHistogram`
  buckets with stable zero-defaults (filled + empty), and a
  `World.snapshot()` smoke check that the helpers still match
  what the corkboard sees.

Next: **post-0.9 re-eval** — paper + code-aware. ICD-01 bump
candidates surfaced by 0.9 (UnitView stat badges for the Selected
dossier · LeadView.district for per-district Story queue ·
WorldFrame.rivals for raid ETA / direction). HUD-spec pixel-perfect
promotion from medium→strong. Tier-0 exit criteria review before
milestone 0.10 (the Tier-0 closer).

## v0.8 — 2026-05-21 — save · load · resume mid-edition

Code milestone. Lifts ICD-04 v0.1 verbatim — single versioned
`localStorage` blob at key `'late-edition.save.v1'`, atomic write,
migration-chain stub (zero migrations at the floor), per-rival RNG
state captured for replay determinism, mid-edition resume via continuous
`pos` + remaining `path` + `CycleClock.remainingMs` with `_warningFired`
/ `_fireFired` guards. The §Save-trigger-surface Open Q settles: writes
fire on `CYCLE_BEGIN` (edition just opened with a fresh clock — the
ICD's recommended `EDITION_DEBRIEF_END` can't be used as-is because
`cycle.start()` inside `ackDebrief` runs AFTER that emit, so a save
taken on debrief-end would capture the cycle stuck at `fire_fired=true`
/ `remainingMs=0`) and on `CYCLE_GAME_OVER` (terminal integrity). The
trigger surface is sim-external per the ICD itself — no ICD bump.
The ICD §Open-questions defers autosave-every-N, multi-slot,
compression, and a pre-`DEADLINE_FIRE` checkpoint to later milestones.

Headline outputs:

- **`js/sim/save.js` (new).** Public surface:
  `SAVE_KEY` / `CURRENT_VERSION` / `STORY_VERSION` constants,
  `saveNow(world, storage?)` / `loadSave(storage?)` /
  `serialize(world)` / `deserialize(blob)` / `runMigrations(raw)`.
  Dependency-injected `storage` lets Node tests pass an in-memory
  `Map`-backed stub; browser path defaults to `globalThis.localStorage`.
  Size guard: `saveNow` `console.warn`s when the serialized blob
  exceeds 500 KB — surfaces the §Open-questions compression trigger
  when playtest blobs grow.
- **`World` restore path.** `new World({ snap })` (or
  `World.fromSnap(blob)`) skips fresh-construct seeding and rebuilds
  every authoritative field from the blob. Exported `setIdMint(n)` /
  `getIdMint()` plug the module-scoped `nextId` counter into both
  construct paths so post-load `mkId()` doesn't collide with anything
  in the loaded blob. `Unit.selected` resets on load (ICD §Notes — UI
  state).
- **`CycleClock.fromSnap` + `EveningStar.fromSnap`.** Bypass the
  constructor seeding paths so `_warningFired` / `_fireFired` (clock)
  and `rng.state` / `_tickAccumMs` / `pastIntents` (rival) survive
  the round-trip verbatim. Replay determinism: a saved run reloaded
  produces the same Evening Star decisions the original run would.
- **`main.js` wire-up.** Boot tries `loadSave()` first, falls through
  to `new World()` on no-save / parse-fail / unknown-future-version.
  Subscribes `saveNow(world)` to the two recommended triggers.
- **`Story.version` field — code side of the ICD-05 v0.4.1 close.**
  Every `StorySnap` carries `version: 1`; the live in-memory `Story`
  shape is byte-for-byte identical to v0.4 (no field added, no field
  removed). The `serialize` / `deserialize` projector is the bridge.
- **ICD activity.** None. ICD-04 v0.1 lifted verbatim; no deviation
  required. Constraint #4 (any code deviation updates the ICD in the
  same PR) is honored by virtue of zero deviation.
- **Tests.** 94 → 106 (twelve new cases under
  [`tests/save-load.test.mjs`](tests/save-load.test.mjs)). Coverage:
  round-trip identity, mid-edition resume (reporter mid-walk), duplicate-
  event suppression (warning fired pre-save → only fire emits post-load),
  EveningStar determinism (`rng.state` + `_tickAccumMs` round-trip),
  `Story.version` lives only on the snap, unknown future version refuses,
  `id_mint` round-trip, save during debrief pause, save after game over,
  missing-storage tolerance, blob-level `version` constant, and the
  size-guard stretch case.

## v0.7.2 — 2026-05-21 — PRE-0.8 paper session

Paper-only, no code. The last ICD the Phase-0 supplement deferred is
now authored: [`icds/ICD-04-save-schema.md`](icds/ICD-04-save-schema.md)
at v0.1. Milestone 0.8 (save/load · resume mid-edition · version field)
is legal to open as a code session — the strong-band single-localStorage-
JSON commitment (Design Doc §17 + overview line 33) has its contract.

This is the sixth paper-only changelog entry (v0.1.1 was PRE-0.2;
v0.3.1 was RE-EVAL after 0.3; v0.4.1 was PRE-0.5; v0.6.1 was RE-EVAL
after 0.6; v0.6.2 was PRE-0.7). METHODOLOGY §3.2 forbids code in a
paper slot — verified by the byte-zero diff under [`js/`](js),
[`tests/`](tests), [`index.html`](index.html), and [`design/`](design).

Headline outputs:

- **ICD-04 → v0.1.** The save schema authored from scratch — there was
  no prior version. Single versioned `localStorage` JSON blob under the
  key `'late-edition.save.v1'`. Top-level `SaveBlobV1` captures
  `sim_time_ms`, the `CycleClock` snapshot (edition + remaining_ms +
  tunable durations + `_warningFired` / `_fireFired` flags), running
  resources (cash/ink/heat), the baked pathfinding grid, every
  building / unit / story, the Evening Star's full state machine
  including its `SeededRng` 32-bit state and `tick_accum_ms` sub-tick
  accumulator, the edition-history ring, the per-edition rival-event
  digest accumulator, and the `game_over` / `debrief_open` flags for
  round-trip integrity through terminal and paused states.
- **Migration policy.** `loadSave(raw)` reads `raw.version` and runs a
  chain of `migrate_N_to_N+1` pure functions before returning a
  `SaveBlobV1` to the rest of the system. v0.1 ships **no migrations**
  — `"1.0"` is the floor. Unknown future versions refuse to load and
  surface a player-facing message (no silent data loss; no best-effort
  field truncation). Roster expansions (adding a unit kind, building
  kind, story state, or rival) bump the blob version and migrate the
  new fields with defaults — this is normal schema evolution, not a
  Constraint #4 deviation.
- **Determinism contract.** Every RNG owner serializes its `state`.
  At v0.1 there is exactly one — the Evening Star's `SeededRng`
  (Mulberry32, 32-bit state). Combined with the captured
  `tick_accum_ms`, this is load-bearing for telemetry, replay, and bug
  repro: a saved run reloaded produces the same Evening Star decisions
  the original run would have. Future rivals (Herald, Observer at
  Tier-1) add their own RNG state to `RivalsSnap`.
- **Mid-edition resume.** Saves may be taken at any sim frame. The
  continuous unit `pos`, remaining `path` + `path_idx`, and
  `CycleClock.remainingMs` with `_warningFired` / `_fireFired` flags
  preserve partial-tile motion and suppress duplicate deadline-event
  emissions on resume. Saves taken during the debrief pause restore
  the paused state; saves taken after `CYCLE_GAME_OVER` reload into
  the same terminal state (round-trip integrity, not a feature).
- **Story `version` field — closes ICD-05 §Open-Q-1.** ICD-05 v0.4
  flagged the question explicitly with "defer to ICD-04 (PRE-0.8)" —
  PRE-0.8 is now here, and the resolution is: every Story carries a
  per-record `version: 1` field at the persistence boundary, **not**
  on the live in-memory `Story`. Per-record versions migrate
  independently of the blob version so a future Story shape change
  doesn't cascade through the entire save. The 0.8 code session adds
  the tiny `serializeStory` / `deserializeStory` projector that
  bridges the two surfaces.
- **What's NOT locked.** Save trigger cadence is the 0.8 code
  session's concern; v0.1 recommends on `EDITION_DEBRIEF_END` + on
  `CYCLE_GAME_OVER` but does not commit. Compression, multi-slot
  saves, and the schema-bump-vs-fall-through policy for optional-field
  additions are also deferred (see ICD-04 §Open questions).

### Added

- [`icds/ICD-04-save-schema.md`](icds/ICD-04-save-schema.md) — new
  file. ~200 lines. Authored at v0.1.

### Changed

- [`icds/ICD-05-story-lifecycle.md`](icds/ICD-05-story-lifecycle.md)
  bumped to **v0.4.1**. §Open-questions paragraph rewritten to close
  the "should `Story` carry a `version` field" question deferred at
  v0.1 to PRE-0.8, cross-linking to ICD-04 v0.1 `StorySnap.version`.
  Revision history prepended with the v0.4.1 entry. **Shape
  unchanged** — `Story` interface, state-transition table, and §Notes
  paragraphs all byte-for-byte identical to v0.4. The version field
  lives in the save schema only; the in-memory `Story` is unchanged.
- [`roadmap.md`](roadmap.md) — PRE-0.8 row gains *"shipped v0.7.2"*
  marker; current-status block rewritten to reflect PRE-0.8 shipped
  and milestone 0.8 code-ready; new `- [x] **PRE-0.8**` history entry
  appended below the milestone-0.7.1 entry; "Out of scope" section
  strikes the "ICD-04 — explicitly deferred to PRE-0.8" line.
- [`AGENTS.md`](AGENTS.md) — "Current state" and "Next" paragraphs
  rewritten for v0.7.2: PRE-0.8 shipped, ICD-04 v0.1 + ICD-05 v0.4.1
  authored, milestone 0.8 unblocked. §Hard-rules paragraph that
  warned "do not touch persistence" rewritten — persistence is now
  legal to open at milestone 0.8.
- [`README.md`](README.md) — status paragraph rewritten for v0.7.2 /
  PRE-0.8; ICD list updated (now six authored ICDs: 01, 02, 03, 04,
  05, 06).

### Not changed

- No file under [`js/`](js), [`tests/`](tests), [`index.html`](index.html),
  or [`design/`](design) was touched. METHODOLOGY §3.2 forbids code in
  a paper slot; AGENTS.md §Hard rules forbids editing the design HTMLs.
- [`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md),
  [`icds/ICD-02-rival-world.md`](icds/ICD-02-rival-world.md),
  [`icds/ICD-03-unit-pathfinder.md`](icds/ICD-03-unit-pathfinder.md),
  [`icds/ICD-06-print-cycle.md`](icds/ICD-06-print-cycle.md) — no
  bumps. The 0.7.1 surfaces were ICD-stable; PRE-0.8 introduces no
  new dependencies on those four.
- Test counts unchanged at 94 cases — paper-only milestone, no JS
  touched and nothing to test in markdown.

## v0.7.1 — 2026-05-21 — Milestone 0.7.1: editor · ink hard gate

The inner three rings (lead → verified → plated → printed) close. The
roadmap's 0.7.1 row — split out of 0.7 at session open — ships the
Editor unit and the ink plate-time hard gate that ICD-05 v0.4 §Notes
authored at PRE-0.7. Both halves of the 0.7 split are now lit;
milestone 0.7 in aggregate (adversarial ring + Editor + ink gate) is
complete and the next slot is PRE-0.8 (architecture session for ICD-04
save schema).

The 0.7.1 slice is **code-only** — every ICD shape it relies on was
already authored at v0.4 (ICD-05) / v0.5 (ICD-01) / v0.2 (ICD-02) /
v0.3 (ICD-06). No ICD bumps in this PR; the §Notes paragraphs at
ICD-05 v0.4 specified the substitution path and the gate rule
verbatim, and the 0.7.1 implementation lifts both into code without
deviation.

The Editor (`kind: 'editor'`) spawns at
`EDITOR_SPAWN_TILE = (4, 5)` — Bureau-adjacent west, the remaining
cardinal slot after Reporter N, Photog S, Fixer E (Design Doc §17
"Stationed at the Bureau"). Its load-bearing role is plating: at
`DEADLINE_FIRE`, `_fireDebrief` substitutes the Editor's `UnitId` for
the placeholder `AUTO_PLATE_SENTINEL` on `Story.plated_by` (ICD-05
v0.4 §Notes — sentinel constant stays exported as the defensive
fallback for the no-Editor case). The Editor is non-controllable: it
has `speed 0` in the per-kind `UNIT_SPEED` table, the renderer omits
the selection ring, and `World.dispatch` rejects `kind === 'editor'`
early so a stray right-click is a silent no-op.

The ink hard gate (ICD-05 v0.4 §Notes) replaces the v0.6.0 medium-band
permissiveness ("HUD surfaces negative ink") with plate-time
enforcement: `_fireDebrief` walks the verified queue in order against
a `projectedInk = World.resources.ink` budget and admits only stories
whose `inkCostFor(story)` keeps the projection ≥ 0. Stories that fail
the check stay `state === 'verified'` and `held_by_building ===
darkroom.id` — untouched, ready to retry the next edition. The
admitted set then flips `verified → plated → printed` exactly as
before. `EditionSummary.ink_consumed` reflects the admitted total
only, so `World.resources.ink -= summary.ink_consumed` lands on a
non-negative balance every time.

Headline outputs:

- **Editor unit** — new `kind: 'editor'` constructor entry. Stationary
  at `EDITOR_SPAWN_TILE = (4, 5)`. `UNIT_SPEED.editor = 0` and
  `World.dispatch` rejects on `kind === 'editor'`. No HP — the Editor
  isn't a damage target at 0.7.1 (goons damage the Bureau building,
  not units; Fixer kills goons adjacent). Adding HP at this milestone
  would be speculative.
- **Editor mesh** — new `buildEditorMesh` in `js/render/renderer.js`.
  Shirt body (no coat) + dark vest + green eyeshade visor — the
  newsroom uniform reads against the trench-coated field units. No
  selection ring (follows the goon precedent — non-player units don't
  get rings).
- **`plated_by` substitution** — `_fireDebrief` looks up the Editor
  unit once per call and writes `editor.id` to every printed story's
  `plated_by`. The sentinel fallback covers the defensive case where
  the Editor is somehow absent (used by the new
  `editor.test.mjs:Sentinel falls back when no Editor exists` test
  case to lock the branch).
- **Ink plate-time hard gate** — the gate sits at the top of
  `_fireDebrief` and runs before the `verified → plated → printed`
  loop. Rejected stories are skipped without touching `Story.state`
  or `Story.plated_by`; `World.resources.ink` stays untouched for the
  rejected set. The HUD `INK` segment stays ≥ 0 across the print —
  the v0.6.0 changelog's negative-ink-allowed permissiveness is
  retired (the field can still go negative through future ink
  purchase failures or Tier-1+ rival actions per ICD-05 v0.4 §Notes;
  just not through plating).

### Added

- [`tests/editor.test.mjs`](tests/editor.test.mjs) — 5 new cases:
  Editor spawns at `EDITOR_SPAWN_TILE` (kind/state/speed); dispatch
  rejects; Editor appears in `WorldFrame.units`; `plated_by` ===
  editor's `UnitId` at print; sentinel fallback when no Editor.
- [`tests/ink-gate.test.mjs`](tests/ink-gate.test.mjs) — 4 new cases:
  insufficient ink → story stays verified, ink unchanged; sufficient
  ink → prints, ink decrements; partial budget → first prints, second
  stays verified; held-over story prints next edition when ink
  restocked.

### Changed

- [`js/sim/world-state.js`](js/sim/world-state.js) — Per-kind
  `UNIT_SPEED` gained `editor: 0`. New exported `EDITOR_SPAWN_TILE =
  { x: 4, y: 5 }`. `World` constructor spawns the Editor alongside
  Reporter/Photog/Fixer. `dispatch()` rejects `kind === 'editor'`
  before pathfinding. `_fireDebrief` rewritten: looks up the Editor,
  walks the verified queue against a projected ink budget admitting
  only fitting stories, sets `plated_by = editor.id` (or sentinel
  fallback) on the admitted set. Sentinel constant `AUTO_PLATE_SENTINEL`
  stays exported as the documented defensive fallback.
- [`js/render/renderer.js`](js/render/renderer.js) — `buildUnitMesh`
  dispatcher gained an `editor` branch. New `buildEditorMesh` —
  shirt + dark vest + green eyeshade visor, no select ring.
- [`tests/world-frame.test.mjs`](tests/world-frame.test.mjs) —
  Construction-roster kind assertion extended from `['fixer', 'photog',
  'reporter']` to `['editor', 'fixer', 'photog', 'reporter']`.
- [`tests/print-cycle.test.mjs`](tests/print-cycle.test.mjs) —
  Comment on the `plated_by` assertion updated to reflect that the
  field carries the Editor's UnitId at 0.7.1+ (still a string —
  assertion unchanged).

## v0.7.0 — 2026-05-21 — Milestone 0.7.0: adversarial ring · raid · fixer

The adversarial ring closes. The roadmap's milestone 0.7 row was split at
session open into 0.7.0 (this entry — Evening Star · Goon · Fixer · Press
HP + fail-state) and 0.7.1 (Editor + ink plate-time hard gate — next
session). Both halves are already ICD-ready at v0.2 (ICD-02) and v0.4
(ICD-05). The split keeps the adversarial loop **playable both ways** —
attack and defense lit in one PR — rather than shipping a one-sided "you
can only lose" state. Editor work is orthogonal to the adversarial loop
and ships clean in 0.7.1.

This is the first code session in three. The 0.7.0 slice runs the Evening
Star (Yellow rival per the design doc) on a 20 s state-machine tick:
SCAVENGE → emit PASS; SCAVENGE → RAID under `heat_noisy > 40 && cooldown
clear && rng.chance(0.18)` (seeded determinism per ICD-02 §Determinism).
RAID emits one `RAID_BUREAU` Intent with the heat-banded `goons = 1/2/3`
count. The World reconciler spawns Goon units at the NW grid edge
walking toward a Bureau-adjacent tile; adjacent goons damage the Press
at 1 dmg/s (Design Doc §17). The Fixer unit (HP 3, walk 3.0 u/s) is
dispatchable via the existing input model; on adjacency to a goon, it
1-hit kills the goon. If 2+ goons are adjacent to the fixer on the same
tick, the fixer dies — "two goons beat one fixer" (Design Doc §rivals).

Press HP at 0 emits the new `CYCLE_GAME_OVER` event (ICD-06 → v0.3);
the `GameOverOverlay` mounts the terminal "THE PRESS BURNS" screen and
the World short-circuits subsequent ticks the same way `debriefOpen`
pauses the sim. The HUD ticker gained an `X HP` segment derived from
`BuildingView.hp` already on ICD-01 v0.5 — no HudState shape change, no
ICD-01 bump.

Headline outputs:

- **Evening Star rival** — new pure module
  [`js/sim/evening-star.js`](js/sim/evening-star.js) hosting the
  ICD-02 v0.2 state machine (six states declared, two with bodies at
  0.7.0; the other four shape-committed and caller-triggered per the
  v0.2 §Caller-triggered scope). Backed by
  [`js/sim/seeded-rng.js`](js/sim/seeded-rng.js) (mulberry32, 32-bit
  state, deterministic per seed — load-bearing for replay, telemetry,
  bug repro, and the PRE-0.8 save schema).
- **Goon unit** — `kind: 'goon'`, HP 1, walk 2.5 u/s (Design Doc §17).
  Spawned by `RAID_BUREAU` reconciliation at
  `GOON_SPAWN_TILE = (0, 0)` with a path to a Bureau-adjacent tile;
  damages Bureau HP at `GOON_DAMAGE_PER_SECOND = 1` while idle adjacent.
- **Fixer unit** — `kind: 'fixer'`, HP 3, walk 3.0 u/s (Design Doc §17).
  Spawned at `FIXER_SPAWN_TILE = (6, 5)` (east of Bureau);
  click-to-dispatch via the existing input model (no new Intent kind
  needed — ICD-02 untouched on the player side). 1-hit kill on adjacent
  goon; dies if 2+ adjacent.
- **Press HP fail-state** — Bureau HP drains under goon damage; HP at 0
  emits `CYCLE_GAME_OVER` once and sets `World.gameOver = true`. Cycle
  clock, unit motion, and rival ticks all freeze in subsequent ticks.
- **Game-over overlay** — new
  [`js/game-over-overlay.js`](js/game-over-overlay.js) mirrors the
  `DebriefPanel` subscriber pattern. Terminal — no dismiss handler.

### Added

- [`js/sim/seeded-rng.js`](js/sim/seeded-rng.js) — **NEW.** Mulberry32
  PRNG. `SeededRng.next()` / `.chance(p)` / `.range(lo, hi)`. Deterministic
  per seed.
- [`js/sim/evening-star.js`](js/sim/evening-star.js) — **NEW.** The
  Evening Star rival. Exports `EveningStar`, `EVENING_STAR_TICK_INTERVAL_MS`
  (20 000), `PAST_INTENTS_BUFFER_CAP` (20), `PAST_INTENTS_PROJECTION_CAP`
  (8). State machine, `tick(rivalView, dt_ms) → Intent[]` contract,
  `onEditionEnd()` callback the world invokes on `EDITION_DEBRIEF_END`.
- [`js/game-over-overlay.js`](js/game-over-overlay.js) — **NEW.** DOM
  overlay subscribing to `CYCLE_GAME_OVER`. Mounts the "THE PRESS BURNS"
  card; no dismiss (terminal).
- [`tests/evening-star.test.mjs`](tests/evening-star.test.mjs) — 9 new
  cases: tick interval, SCAVENGE→PASS, SCAVENGE→RAID predicate firing,
  goon-count band table, `eta_ms` clamp, past-intents buffer cap,
  RAID→SCAVENGE on `onEditionEnd`, cooldown gate (`editionsSinceRaid > 1`),
  posture mapping.
- [`tests/rival-view.test.mjs`](tests/rival-view.test.mjs) — 8 new cases:
  RivalView field shape, cycle pass-through, heat noise bound, visible
  leads filter, visible reporters filter, own.state/posture, past_intents
  projection cap, edition_history bound.
- [`tests/goon.test.mjs`](tests/goon.test.mjs) — 7 new cases: spawn from
  `RAID_BUREAU`, walk-to-adjacency idle, 1-goon damage tick, no-damage
  at distance, 2-goon stacking, PRESS_HP / damage-rate constants, no
  pickup branch.
- [`tests/press-hp.test.mjs`](tests/press-hp.test.mjs) — 3 new cases:
  `CYCLE_GAME_OVER` fires exactly once, sim freezes on game-over, HP
  clamp non-negative.
- [`tests/fixer.test.mjs`](tests/fixer.test.mjs) — 5 new cases: spawn
  shape, dispatch via input model, 1-goon adjacency kill, 2-goon trade
  (fixer dies), goon walking into stationary fixer.

### Changed

- [`js/sim/world-state.js`](js/sim/world-state.js) — Per-kind speed
  table (`UNIT_SPEED = { reporter: 3.5, photog: 3.5, goon: 2.5,
  fixer: 3.0 }`); `stepAlongPath` looks up by `u.kind`. `REPORTER_SPEED`
  legacy export preserved as `UNIT_SPEED.reporter`. New exported
  constants: `GOON_DAMAGE_PER_SECOND`, `FIXER_SPAWN_TILE`,
  `GOON_SPAWN_TILE`. `World` constructor hosts `rivals[]`,
  `editionHistory`, `_pendingRivalEvents`, `gameOver` flag; spawns the
  Fixer alongside Reporter + Photog; mints `EveningStar` with
  constructor-overridable seed. `tick()` adds the goon-damage tick,
  fixer-intercept tick, dead-unit prune, fail-state check, and rival
  advance + intent reconcile (ordering: motion → combat → fail-state →
  rival → cycle). New methods: `_buildRivalView`, `_reconcileIntent`,
  `_goonDamageTick`, `_fixerInterceptTick`, `_pruneDeadUnits`,
  `_enterGameOver`, `_bureau`. `_buildEditionSummary` flushes
  `_pendingRivalEvents` into `EditionSummary.rival_events` and appends
  to `editionHistory` (cap 10). `ackDebrief` calls `rival.onEditionEnd()`
  on each rival.
- [`js/render/renderer.js`](js/render/renderer.js) — `buildUnitMesh`
  dispatcher gained `goon` and `fixer` branches. New
  `buildGoonMesh` (dark coat, low cap, no select ring — not a player
  unit) and `buildFixerMesh` (trench coat, brim hat, red kerchief accent,
  selection ring). No camera / fog / rain changes.
- [`js/hud.js`](js/hud.js) — Ticker line gained `X HP` segment derived
  from `frame.buildings[bureau].hp`. No HudState shape change — `hp` is
  already on `BuildingView` per ICD-01 v0.5.
- [`js/main.js`](js/main.js) — Instantiates `GameOverOverlay` alongside
  `DebriefPanel`. New `#gameover-overlay` root lookup.
- [`index.html`](index.html) — `<title>` and masthead caption rolled
  forward to "0.7.0 adversarial ring · raid · fixer". HUD initial text
  appended with " · 90 HP". New `<div id="gameover-overlay" hidden>`
  with the matching CSS (red kerchief border, paper-2 card, dark
  scrim).
- [`tests/world-frame.test.mjs`](tests/world-frame.test.mjs) — One
  amended case: `frame.units` at construction is now
  `['fixer', 'photog', 'reporter']` (was `['photog', 'reporter']`).
  Goons appear only when a raid is in flight.
- [`icds/ICD-02-rival-world.md`](icds/ICD-02-rival-world.md) —
  §Open questions resolutions only. Multi-edition goon transit deferred
  to Tier-1 (kept the v0.2 clamp); `RivalStatusView` HUD surface
  deferred to milestone 0.9's corkboard. Revision history gained the
  v0.2.1 entry. **No shape change** — v0.2's `RivalView`,
  `RivalStatusView`, Evening Star state machine, and `RAID_BUREAU`
  Intent all used as authored.
- [`icds/ICD-06-print-cycle.md`](icds/ICD-06-print-cycle.md) bumped to
  **v0.3**. New `CYCLE_GAME_OVER` event in the vocabulary; new
  `GameOverReason` union (`'press_destroyed'` initial value); terminal-
  event semantics pinned in vocabulary §Notes. Subscriber expectations
  table gained the Game-over overlay row (first milestone: 0.7.0).
  `EditionSummary`, `StoryDigest`, `RivalEventDigest`, cycle timing, and
  pause-during-debrief semantics unchanged from v0.2.
- [`roadmap.md`](roadmap.md) — 0.7 row split into 0.7.0 (this PR) and
  0.7.1 (next PR); 0.7.0 ticked. Current-status block rewritten;
  checklist appended with the v0.7.0 entry; ratio paragraph updated
  (11 → 12 code milestones).
- [`AGENTS.md`](AGENTS.md) — "Current state" and "Next" paragraphs
  rewritten for v0.7.0: adversarial ring shipped, ICD-06 bumped,
  ICD-02 open questions closed, 0.7.1 next.
- [`README.md`](README.md) — Status block bumped to v0.7.0; "How to
  navigate" updated to mention the goon spawn / fixer dispatch / fail-
  state and the new HP segment.

### Not changed

- [`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md) — no
  bump. Press HP exposure rides on existing `BuildingView.hp`; no new
  `HudState` field. The `RivalStatusView` HUD-surface decision settled
  to "defer to 0.9 corkboard" — option B of re-eval §3.5 Q5.
- [`icds/ICD-03-unit-pathfinder.md`](icds/ICD-03-unit-pathfinder.md) —
  no bump. Per-kind speeds live as code constants (`UNIT_SPEED` table
  in `world-state.js`); ICD-03's contract is the pathfinder shape, not
  the speed table. Future bump may tighten if speeds need to cross the
  pathfinder boundary.
- [`icds/ICD-05-story-lifecycle.md`](icds/ICD-05-story-lifecycle.md) —
  no bump at 0.7.0. Editor + ink gate work lands at 0.7.1; ICD-05 v0.4
  §Notes already covers them.
- [`icds/ICD-04`](icds) — still deferred to PRE-0.8.
- [`js/sim/cycle-clock.js`](js/sim/cycle-clock.js),
  [`js/sim/pathfinder.js`](js/sim/pathfinder.js),
  [`js/sim/resources.js`](js/sim/resources.js),
  [`js/input.js`](js/input.js),
  [`js/debrief-panel.js`](js/debrief-panel.js) — untouched. The 0.7.0
  surface lives entirely in the rival module, world-state's integration,
  the renderer's two new meshes, the HUD ticker extension, and the new
  overlay.
- Design HTMLs in [`design/`](design) — immutable per AGENTS.md hard rule.
- [`architecture/00-overview.md`](architecture/00-overview.md) — no band
  movements. ICD-02 was already strong-band post-0.6 re-eval; the v0.2
  shape work landed at PRE-0.7.

### ICD activity

- **ICD-06 v0.2 → v0.3** — `CYCLE_GAME_OVER` event added to the
  vocabulary. `GameOverReason` union introduced (single value
  `'press_destroyed'`). Subscriber row added.
- **ICD-02 v0.2 → v0.2.1** — Revision-history-only entry. §Open
  questions table got two in-PR resolutions (multi-edition transit;
  HUD pill). **No shape change**; first-callers and state machine
  identical to v0.2.

### Verification

- `node --test tests/*.test.mjs` — **85 / 85 pass.** 32 new cases since
  v0.6.2 (53 → 85). The `world-frame.test.mjs` `FRAME_KEYS` allowlist
  still passes — no top-level `WorldFrame` keys added.
- Browser smoke: load [`index.html`](index.html). Masthead reads
  "Milestone 0.7.0 · adversarial ring · raid · fixer". HUD ticker starts
  with `EDITION 1 · 12:00 · 1 LD · 0 ST · 20 INK · $0 · 0 HEAT · 90 HP`.
  Three units visible at spawn: Reporter (north of Bureau), Photog
  (south of Bureau), Fixer (east of Bureau, distinguishable by trench
  coat + brim + red kerchief). Manually raise heat above 40 by printing
  controversial stories; after a couple of editions of cooldown, the
  Evening Star fires a `RAID_BUREAU` intent and a Goon spawns at the
  NW grid edge walking south-east toward (4, 5). Right-click the goon's
  tile while the Fixer is selected; the Fixer walks to the goon and on
  contact the goon disappears. Repeat without the fixer; HP drains
  from 90 to 0 (visible in the ticker); the "THE PRESS BURNS" overlay
  mounts and the sim freezes (reporter / photog stop moving; HUD
  ticker stops counting down). Same seed → same goon spawn timing
  asserted in `tests/evening-star.test.mjs`.

## v0.6.2 — 2026-05-21 — PRE-0.7 paper session

Paper-only, no code. The forward-ICD gap the post-0.6 re-eval flagged
([`architecture/re-eval-after-0.6.md`](architecture/re-eval-after-0.6.md)
§3 "Scheduled paper slot — PRE-0.7") is now closed. Milestone 0.7
(Evening Star SCAVENGE + RAID · Goon unit · Editor unit · Fixer unit ·
Press HP + fail-state) is legal to open as a code session — every ICD
the 0.7 milestone depends on is now authored to the level the strong
band claims.

This is the fifth paper-only changelog entry (v0.1.1 was PRE-0.2;
v0.3.1 was RE-EVAL after 0.3; v0.4.1 was PRE-0.5; v0.6.1 was RE-EVAL
after 0.6). METHODOLOGY §3.2 forbids code in a paper slot — verified
by the byte-zero diff under [`js/`](js), [`tests/`](tests),
[`index.html`](index.html), and [`design/`](design).

Headline outputs:

- **ICD-02 → v0.2.** Strong-band rival contract authored ahead of its
  milestone-0.7 first caller:
  - **Evening Star SCAVENGE + RAID state machine** lifted from
    [`design/rival-ai-spec.html`](design/rival-ai-spec.html) §04 + §08
    into committed prose. Six states (`SCAVENGE | RAID | BRIBE | RUSH
    | PANIC | BURNOUT`), nine transitions with seeded-RNG predicates,
    20 s tick cadence. The 0.7 slice scope is SCAVENGE + RAID + PASS;
    the other four states are shape-committed (transition graph
    closes) but caller-triggered (their bodies fill in when their
    dependencies — reporter morale, lead-tier classifier,
    multi-edition raid counters — land at Tier-1).
  - **`RAID_BUREAU` Intent shape detail** — `goons` count banded by
    `player_heat` (1 at `[40, 60)`, 2 at `[60, 80)`, 3 at `≥ 80`);
    `eta_ms` clamped to `cycle.remaining_ms - 1000` for one-edition
    raids (multi-edition transit deferred to a 0.7 §Notes resolution);
    `target: BuildingId` always the Bureau at 0.7 (Branch + Switchboard
    fuzzy until Tier-1).
  - **`RivalView` projection** authored — `cycle` (edition +
    remaining_ms), `player` (heat ±20 noise, visibility-filtered leads
    and reporters), `own` (state, posture, past_intents bounded to
    last 8), and `edition_history` (last 10 editions' public deltas).
    Closes the v0.1 §Open-questions item on past-intent visibility:
    rivals **do** see their own past intents, bounded to the working
    set the cooldown predicates need.
  - **`RivalStatusView` posture projection** — medium-band vocabulary
    `'calm' | 'scheming' | 'hostile'` locked at the post-0.6 re-eval
    §3.5 Q5. Evening Star state→posture mapping committed
    (SCAVENGE/RUSH/BURNOUT → `calm`; BRIBE → `scheming`; RAID/PANIC →
    `hostile`); Herald + Observer mappings deferred to their
    first-caller milestones.
- **ICD-05 → v0.4.** §Notes-only amendment, no shape change. Two
  paragraphs added: (1) pre-Editor `AUTO_PLATE_SENTINEL` substitution
  path — captures the same-frame `verified → plated → printed`
  auto-fire at `DEADLINE_FIRE` that lived only in code comments
  before; names the sentinel as the marker the Editor swaps for its
  `UnitId` at milestone 0.7; (2) ink plate-time hard gate — pins the
  v0.6.0 "can't print if ink runs out" enforcement rule to plate-time
  rejection (verdict (a) of re-eval §3.5 Q6); the Editor's arrival
  logic enforces it at 0.7 and the `AUTO_PLATE_SENTINEL` path
  inherits the rule until then.
- **ICD-01 stays at v0.5.** The `RivalStatusView` HUD surface — does
  milestone 0.7 ship a `HudState.rival_status: RivalStatusView[]`
  pill (which would force an ICD-01 v0.6 in the 0.7 PR), or does the
  milestone-0.9 corkboard absorb it? — is flagged as an ICD-02 §Open
  question and decided at the 0.7 code session, not here. Per the
  post-0.6 re-eval §3.5 Q5, both branches are permitted; PRE-0.7
  declines to choose, keeping this paper slot scoped to the two
  ICDs it set out to author.

### Added

- (none — no new files)

### Changed

- [`icds/ICD-02-rival-world.md`](icds/ICD-02-rival-world.md) bumped to
  **v0.2**. Status header rewritten; new §`RivalView` projection (v0.2),
  §`RivalStatusView` projection (v0.2), §Evening Star state machine
  (v0.2), and §`RAID_BUREAU` Intent shape detail (v0.2) sections added;
  §Caller-triggered scope table gained a "v0.2 shape detail?" column;
  §Notes section added covering the 0.7 slice scope, the player-state
  inputs the state machine reads, the rival-internal state that lives
  on the rival object (not on `RivalView`), and the ICD-06 v0.2
  string-typed `RivalEventDigest.kind` interaction; §Open questions
  rewritten (past-intents item closed; multi-edition goon transit,
  HUD surface, and other rivals added); §Deviation policy tightened
  to call out the now-strong-band state machine; revision history
  prepended with the v0.2 entry.
- [`icds/ICD-05-story-lifecycle.md`](icds/ICD-05-story-lifecycle.md)
  bumped to **v0.4**. Status header updated; First-caller line
  extended to mention rows 4 + 5 (`verified → plated → printed`)
  auto-fired by milestone 0.5 via the pre-Editor
  `AUTO_PLATE_SENTINEL` path; §Notes gains two paragraphs (the
  sentinel substitution path and the ink plate-time hard gate);
  revision history prepended with the v0.4 entry. **Shape unchanged**
  — `Story` interface, state-transition table, and `lead → verified`
  field-delta paragraph all byte-for-byte identical to v0.3.
- [`roadmap.md`](roadmap.md) — PRE-0.7 row gains *"shipped v0.6.2"*
  marker; current-status block rewritten to reflect PRE-0.7 shipped
  and milestone 0.7 unblocked; new `- [x] **PRE-0.7**` history entry
  appended below the v0.6.1 RE-EVAL entry.
- [`AGENTS.md`](AGENTS.md) — "Current state" and "Next" paragraphs
  rewritten for v0.6.2: PRE-0.7 shipped, ICD-02 v0.2 + ICD-05 v0.4
  authored, milestone 0.7 unblocked.

### Not changed

- No file under [`js/`](js), [`tests/`](tests), [`index.html`](index.html),
  or [`design/`](design) was touched. METHODOLOGY §3.2 forbids code in
  a paper slot; AGENTS.md §Hard rules forbids editing the design HTMLs.
- [`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md) —
  no bump. The `RivalStatusView` HUD-surface decision (would force
  v0.5 → v0.6) is deliberately left open and decided at the 0.7 code
  session per re-eval §3.5 Q5.
- [`icds/ICD-03-unit-pathfinder.md`](icds/ICD-03-unit-pathfinder.md),
  [`icds/ICD-06-print-cycle.md`](icds/ICD-06-print-cycle.md) — post-0.6
  re-eval found no drift; no bump warranted at PRE-0.7.
  ICD-06's string-typed `RivalEventDigest.kind` stays string-typed —
  ICD-02's vocabulary is now strong-band but ICD-06's permissive shape
  is intentional and a future ICD-06 bump can tighten it without
  churning ICD-02 again.
- [`icds/ICD-04`](icds) — explicitly deferred to PRE-0.8 by the
  supplement; untouched.
- [`architecture/00-overview.md`](architecture/00-overview.md) — no
  band movements at PRE-0.7. The post-0.6 re-eval already moved
  ICD-02 medium → strong; no further movement triggered by the v0.2
  shape work.
- [`discussion/`](discussion) — three docs already settled at the
  re-eval (tutorial, difficulty, rival-state visibility); the three
  remaining (observer-violence, accessibility, yellow-establishment-branch)
  stay parked per the re-eval §2 finding.

### ICD activity

- **ICD-02 v0.1 → v0.2** — Evening Star SCAVENGE + RAID state machine
  authored; `RAID_BUREAU` goon-count + `eta_ms` policy authored;
  `RivalView` projection authored; `RivalStatusView` posture
  projection authored. Intent vocabulary unchanged from v0.1 — no
  kinds added or removed (the design HTML's `RAID_BRANCH` and other
  Tier-1+ kinds remain explicitly out of the v0.1 commitment and out
  of v0.2's scope).
- **ICD-05 v0.3 → v0.4** — §Notes-only amendment. `Story` interface
  + state-transition table + `lead → verified` field-delta paragraph
  unchanged.

### Verification

- `node --test tests/*.test.mjs` — 53 / 53 pass (baseline, unchanged).
- `git diff main -- late-edition/js late-edition/tests late-edition/index.html late-edition/design`
  produces empty output — paper-only boundary preserved.
- `git diff main --stat -- late-edition/` lists exactly five files:
  `icds/ICD-02-rival-world.md`, `icds/ICD-05-story-lifecycle.md`,
  `roadmap.md`, `AGENTS.md`, `CHANGELOG.md`.

## v0.6.1 — 2026-05-21 — RE-EVAL after 0.6 (paper + code-aware)

Paper-only, no code. The post-0.6 re-evaluation slot the roadmap called
for (line 26) is now closed. METHODOLOGY §3 both halves ran — structural
pass + code-aware pass + forward ICD presence check for the
0.7 / PRE-0.8 / 0.8 window — plus six open-question resolutions: the
three the roadmap scheduled (loop plays / ICD-02 promotion / tutorial
shape) and three folded in at session open (difficulty selector, rival-
state visibility, ink negative-balance enforcement).

This is the fourth paper-only changelog entry (v0.1.1 was PRE-0.2;
v0.3.1 was RE-EVAL after 0.3; v0.4.1 was PRE-0.5).

Headline outputs:

- **No interface drift.** ICDs 01 v0.5 / 03 v0.2 / 05 v0.3 / 06 v0.2 all
  survived contact with shipped 0.4–0.6 code. Constraint #4 honored:
  0.4 bumped ICD-05 v0.2→v0.3 in-PR; PRE-0.5 (v0.4.1) authored
  ICD-06 v0.2 + ICD-01 v0.5; 0.5/0.6 used everything as authored. Two
  strong-band claims (12-min cycle, five-resource names) moved from
  *aligned* (post-0.3 re-eval) to *tested*.
- **Loop status:** the inner three rings are closed (dispatch→pickup→
  verify→plate→print, the 12-minute cycle, the cash/ink/heat economy);
  the adversarial ring is entirely a 0.7 concern. No demotions
  warranted.
- **One band promotion:** ICD-02 medium → strong (overview line 42
  fires on the N=3-window rule with 0.7 entering scope). Status edited
  in-PR; v0.2 shape work scheduled to PRE-0.7.
- **Forward ICD check surfaces one gap, schedules PRE-0.7.**
  Single architecture session to author ICD-02 v0.2 (Evening Star
  SCAVENGE+RAID state machine, RAID_BUREAU policy, RivalView past-
  intents resolution, RivalStatusView posture projection) and the
  ICD-05 §Notes amendment (`AUTO_PLATE_SENTINEL` substitution path +
  ink plate-time hard gate rule).
- **Three discussion docs settled:**
  - `discussion/tutorial-first-edition.md` — diegetic frame locked;
    copy lands at 0.10.
  - `discussion/difficulty-selector.md` — frequency-scaling only;
    deferred to Tier-1 run-meta layer.
  - `discussion/rival-state-visibility.md` — partial-dossier locked;
    posture vocabulary `{calm, scheming, hostile}`; medium-band.
- **Ink negative-balance enforcement** — locked to **plate-time hard
  gate**; lands at 0.7 with the Editor unit.

### Added

- [`architecture/re-eval-after-0.6.md`](architecture/re-eval-after-0.6.md)
  — the session document. Records what code was read, classifies findings
  per METHODOLOGY §3.1.1, schedules PRE-0.7 with its specific
  deliverables (ICD-02 v0.2 + ICD-05 §Notes amendment in one paper slot),
  and pins six open-question verdicts (§3.5 Q1–Q6).

### Changed

- [`roadmap.md`](roadmap.md) — RE-EVAL-after-0.6 row ticked; new
  **PRE-0.7** row inserted before 0.7 (single architecture session to
  author ICD-02 v0.2 + ICD-05 §Notes amendment); 0.7's band column
  bumped `medium → strong at re-eval` → `strong`; current-status block
  advanced to v0.6.1; checklist updated with the v0.6.1 entry; the
  ratio paragraph below the table updated (3 → 4 architecture-only
  items).
- [`AGENTS.md`](AGENTS.md) — "Current state" and "Next" paragraphs
  rewritten to reflect: re-eval shipped, ICD-02 promoted, PRE-0.7
  scheduled, three discussion docs settled, ink rule pinned.
- [`icds/ICD-02-rival-world.md`](icds/ICD-02-rival-world.md) — **Band
  line only.** `medium (→ strong at the post-0.6 re-eval, before
  milestone 0.7)` → `strong (post-0.6 RE-EVAL promotion; v0.2 shape
  work scheduled to PRE-0.7)`. No shape change — v0.2 lands at PRE-0.7.
- [`discussion/tutorial-first-edition.md`](discussion/tutorial-first-edition.md)
  — status line moved from `open · needs a paper session before MVP
  polish` to `committed-direction · diegetic frame locked (notes from
  the old man) · copy lands at milestone 0.10`. Body unchanged.
- [`discussion/difficulty-selector.md`](discussion/difficulty-selector.md)
  — status line moved from `open · pre-architecture · deferred to
  post-MVP` to `committed-direction · frequency-scaling only ·
  deferred to Tier-1 run-meta layer`. Body unchanged.
- [`discussion/rival-state-visibility.md`](discussion/rival-state-visibility.md)
  — status line moved from `open · pre-architecture · not a commitment`
  to `committed-direction · partial dossier locked · posture vocabulary
  {calm, scheming, hostile}`. Body unchanged.

### Not changed

- No file under [`js/`](js), [`tests/`](tests), or [`index.html`](index.html)
  was touched. METHODOLOGY §3.2 forbids code in a re-evaluation session.
- ICD-02 **shape** is unchanged — the band moved, the contract did not.
  v0.2 shape work is explicitly scheduled to PRE-0.7 per the §3.2
  surface-and-schedule pattern (the same pattern v0.3.1 used to defer
  ICD-06 v0.2 + ICD-01 v0.5 authoring to PRE-0.5).
- No other ICD was bumped — no drift was found.
- Design HTMLs in [`design/`](design) — immutable per AGENTS.md hard rule.

### Verification

- `node --test tests/*.test.mjs` — 53 / 53 pass (baseline, unchanged).
- `git diff` touches only `architecture/`, `roadmap.md`, `CHANGELOG.md`,
  `AGENTS.md`, `icds/ICD-02-rival-world.md`, and three files under
  `discussion/`. Zero diff under `js/`, `tests/`, `index.html`,
  `design/`, the other ICDs, or `deferred/`.

## v0.6.0 — 2026-05-20 — Milestone 0.6: cash · ink · heat

The economy lights up. Each printed Story now carries a `cash_yield` /
`heat_yield` / `ink_cost` set at the verified→plated step from a new pure
module [`js/sim/resources.js`](js/sim/resources.js) (Design Doc §06 + §19
first-pass numbers — Whisper $165 / Investigation $800 / Arc $2000; ink
Whisper 1 / Investigation 3 / Arc 8; heat Vice 8 / Violence 12 / Money 15 /
Labor 4). `EditionSummary` aggregates the per-story deltas; `World.resources`
accumulates `{ ink, cash, heat }` across editions; `ackDebrief()` applies the
§19 baseline heat decay (`HEAT_DECAY_PER_EDITION = 8`, clamped non-negative).
`HudState.resources` now projects derived `leads` / `stories` counts plus the
live running balances. The HUD ticker grew four segments
(`X LD · X ST · X INK · $X · X HEAT`) inside the single masthead strip so the
milestone 0.9 corkboard can absorb them without churning `main.js`. Both
ICDs that PRE-0.5 authored (01 v0.5 + 06 v0.2) were used without deviation —
no ICD bumps this cycle.

### Added

- [`js/sim/resources.js`](js/sim/resources.js) — **NEW.** Pure module
  mirroring the [`cycle-clock.js`](js/sim/cycle-clock.js) shape. Exports
  `STARTING_INK = 20` (matches §19 "$200 per 20 units" Docks purchase
  scale → first-edition runway) and `HEAT_DECAY_PER_EDITION = 8` (§19
  baseline — the "−12 if no controversial" and "0 decay if heat>80"
  nuances are medium-band balance refinements scheduled for 0.7+). Three
  lookup tables (`CASH_BY_TIER`, `INK_BY_TIER`, `HEAT_BY_FLAVOR`) carry
  the single-representative midpoints of the §19 ranges; the three
  helpers `cashYieldFor` / `inkCostFor` / `heatYieldFor` accept a Story
  and return the lookup. Labor flavor has no §19 entry — assigned `4`
  (gentlest of the four) as a sane default until §19 expands.
- [`tests/resources.test.mjs`](tests/resources.test.mjs) — 8 new cases:
  fresh-World HUD reads `{ leads: 1, stories: 0, ink: 20, cash: 0, heat: 0 }`;
  picked-up lead leaves `frame.leads` and the count; photog-verified story
  ticks `stories` to 1; `DEADLINE_FIRE` writes per-story yields from the
  lookups; `EditionSummary` aggregates them; running balances accumulate;
  `ackDebrief` applies heat decay clamped at zero; `StoryDigest.cash`
  carries the non-zero yield to the debrief panel.

### Changed

- [`js/sim/world-state.js`](js/sim/world-state.js) — imports the new
  helpers; constructor seeds `this.resources = { ink: STARTING_INK, cash: 0, heat: 0 }`;
  `_fireDebrief` writes `story.cash_yield` / `story.heat_yield` /
  `story.ink_cost` at the verified→plated step from the lookups (replacing
  the v0.5 literal zeros) and applies the summary deltas to the running
  balances; `_buildEditionSummary` aggregates the `printed[]` reductions;
  `ackDebrief()` applies `HEAT_DECAY_PER_EDITION` clamped non-negative;
  `snapshot()` projects `hud.resources.leads` from the lead filter,
  `stories` from the verified+plated count, and `ink` / `cash` / `heat`
  from the running balances. Negative ink is allowed at 0.6 (HUD surfaces
  the number; the "can't print if ink runs out" enforcement is medium-band
  and lands at 0.7+).
- [`js/hud.js`](js/hud.js) — ticker line extended with four resource
  segments. Format: `EDITION N · MM:SS · X LD · X ST · X INK · $X · X HEAT`.
  No subscription, no DOM change, no CSS change.
- [`index.html`](index.html) — `<title>` and masthead meta caption rolled
  forward to "0.6 cash · ink · heat"; initial `<div id="hud-ticker">` text
  updated to match the new ticker format.
- [`tests/print-cycle.test.mjs`](tests/print-cycle.test.mjs) — three
  assertions amended in the same PR so the milestone-0.5 zero-state pins
  don't reject the 0.6 fills: fresh-HUD resources shape now reads
  `{ leads: 1, stories: 0, ink: 20, cash: 0, heat: 0 }`; the print-step
  `cash_yield` / `heat_yield` checks now assert "number, > 0" (the exact
  values are covered by [`tests/resources.test.mjs`](tests/resources.test.mjs)).
- [`roadmap.md`](roadmap.md) — milestone 0.6 row ticked; current-status
  block advanced to point at the post-0.6 RE-EVAL slot (first re-eval since
  v0.3.1).
- [`README.md`](README.md) — Status block bumped to v0.6.0; "How to
  navigate" updated to mention the new HUD ticker format and the resource
  reconciliation at deadline.
- [`AGENTS.md`](AGENTS.md) — "Current state" rewritten for v0.6.0;
  "Next" repointed at the post-0.6 RE-EVAL.

### Not changed

- ICDs — **no bumps.** ICD-01 v0.5 `HudState.resources` populated as
  authored. ICD-06 v0.2 `EditionSummary.cash_earned` / `ink_consumed` /
  `heat_applied` filled as authored. ICD-05 v0.3 §Notes already permits
  cash/heat yields to be set at the plated step ("computed at plated and
  frozen there") — 0.6 just populates non-zero values. `Story.ink_cost` is
  a new sim-internal field but is not on any View → no ICD touched.
  Constraint #4 doesn't trigger.
- [`js/sim/cycle-clock.js`](js/sim/cycle-clock.js),
  [`js/sim/pathfinder.js`](js/sim/pathfinder.js),
  [`js/render/renderer.js`](js/render/renderer.js),
  [`js/input.js`](js/input.js),
  [`js/main.js`](js/main.js),
  [`js/debrief-panel.js`](js/debrief-panel.js) — untouched. 0.6 lives
  entirely in the new `resources.js` module, the World's debrief plumbing,
  the HUD ticker text, and the two amended tests.
- Design HTMLs in [`design/`](design) — immutable per AGENTS.md hard rule.

### ICD activity

- **ICD-01 v0.5** — used as authored. `HudState.resources` filled.
- **ICD-06 v0.2** — used as authored. `EditionSummary` deltas filled.
- **ICD-05 v0.3** — used as authored. `Story.cash_yield` / `heat_yield`
  populated at the plated step per §Notes. New sim-internal
  `Story.ink_cost` is not a View field.

### Verification

- `node --test tests/*.test.mjs` — **53 / 53 pass.** 8 new cases since
  v0.5.0 (45 → 53). The existing `tests/world-frame.test.mjs` `FRAME_KEYS`
  allowlist still passes — no top-level `WorldFrame` keys added.
- Browser smoke: load [`index.html`](index.html). Masthead reads "Milestone
  0.6 · cash · ink · heat". HUD ticker shows
  `EDITION 1 · 12:00 · 1 LD · 0 ST · 20 INK · $0 · 0 HEAT` and counts down.
  Stage the ferry (reporter → lead → bureau; photog → bureau → darkroom).
  LD ticks to 0 on pickup; ST ticks to 1 on verify. At deadline the debrief
  panel mounts with a `VICE WHISPER HITS WIRE` row; click anywhere on the
  panel and the next edition opens at
  `EDITION 2 · 12:00 · 0 LD · 0 ST · 19 INK · $165 · 0 HEAT` (1 ink
  consumed, $165 cash earned, 8 heat applied and then decayed back to 0).

## v0.5.0 — 2026-05-20 — Milestone 0.5: print cycle · deadline · debrief

The heartbeat lights up. A 12-minute edition clock now ticks down inside the
sim, fires `DEADLINE_WARNING` at T-30s and `DEADLINE_FIRE` at T-0, walks each
verified-at-Darkroom Story through `verified → plated → printed` in the same
deadline frame, and surfaces an `EditionSummary` to a click-to-dismiss debrief
panel. The HUD ticker reads `frame.hud.{edition, deadline_ms}` every render
frame for the live countdown. Both ICDs that PRE-0.5 authored were used
without deviation — no ICD bumps this cycle.

### Added

- [`js/sim/cycle-clock.js`](js/sim/cycle-clock.js) — new pure module owning
  the 12-min clock. `CycleClock` accepts `{ editionDurationMs,
  warningOffsetMs }` (defaults `720_000` / `30_000` from ICD-06 v0.2 §Cycle
  timing; both tunable so tests don't have to chew through real time).
  `start(edition)` returns the `CYCLE_BEGIN` event for World to dispatch.
  `advance(dtMs)` returns the events emitted this step (`CYCLE_TICK`,
  optionally `DEADLINE_WARNING` on first cross of `warningOffsetMs`,
  optionally `DEADLINE_FIRE` on first cross of zero). After fire the clock
  idles at zero until `start()` opens the next edition.
- [`js/hud.js`](js/hud.js) — DOM ticker. Pure projection of
  `frame.hud.{edition, deadline_ms}` to a `"EDITION N · MM:SS TO DEADLINE"`
  caption every render frame. No event subscription, no sim reach-back. Lives
  next to the masthead so milestone 0.9's corkboard layout can grow it without
  churning `main.js`.
- [`js/debrief-panel.js`](js/debrief-panel.js) — DOM panel subscribed to
  `World.subscribeCycle`. Mounts on `EDITION_DEBRIEF_BEGIN` using the
  `summary` payload (header `EDITION N`, one row per `stories_printed`),
  dismisses on click via `world.ackDebrief()`, tears down on
  `EDITION_DEBRIEF_END`. Plain DOM; the full corkboard from Design Doc §13
  arrives at 0.9.
- [`tests/print-cycle.test.mjs`](tests/print-cycle.test.mjs) — 8 new cases:
  fresh-World HudState; 30s advance decrements deadline; `DEADLINE_WARNING`
  fires exactly once at T-30s crossing; `DEADLINE_FIRE` fires exactly once at
  T-0; `EDITION_DEBRIEF_BEGIN.summary` carries an `EditionSummary` whose
  `stories_printed[0].id` matches the original `Story.id` (the load-bearing
  ICD-05 §Purpose commitment); full sim pause during debrief (cycle clock +
  unit motion both freeze); `ackDebrief()` emits `EDITION_DEBRIEF_END` then
  `CYCLE_BEGIN(edition=2)` and printed stories stay out of `frame.leads`;
  `verified → plated → printed` fires same-frame at `DEADLINE_FIRE`.

### Changed

- [`js/sim/world-state.js`](js/sim/world-state.js) — `World` now owns the
  `CycleClock`. Constructor accepts `opts = { cycle?: {...} }` (default empty
  → strong-band defaults). Wires `cycleSubscribers`, `debriefOpen`, the
  `subscribeCycle(fn)` channel, the `ackDebrief()` exit, the `_fireDebrief()`
  / `_buildEditionSummary()` close-out path, and the new exported
  `AUTO_PLATE_SENTINEL` placeholder that stands in for `Story.plated_by`
  until the Editor unit lands (0.6/0.7). `World.tick()` early-returns when
  `debriefOpen` is true — that's the full sim pause (cycle + units) the
  milestone-0.5 reading of ICD-06 §"Pause-during-debrief" commits to.
  `snapshot().hud` reads live from `cycle` (`edition`, `remainingMs`);
  resource values stay zero — names + shape locked by ICD-01 v0.5, values
  land at 0.6.
- [`js/main.js`](js/main.js) — instantiates `HudTicker` and `DebriefPanel`
  alongside the existing `Renderer` / `World` / `input` wiring. The render
  loop now calls `hud.apply(frame)` after `renderer.apply(frame, alpha)`.
- [`index.html`](index.html) — added `<div id="hud-ticker">` and
  `<div id="debrief-panel" hidden>` plus the CSS for both. Masthead caption
  and `<title>` rolled forward from "0.4 photog · darkroom · verified" to
  "0.5 print cycle · deadline · debrief".
- [`roadmap.md`](roadmap.md) — milestone 0.5 row ticked; current-status block
  advanced to point at 0.6 (Cash + Ink + Heat resources).
- [`README.md`](README.md) — Status block bumped to v0.5.0; "How to navigate"
  mentions the deadline + debrief.
- [`AGENTS.md`](AGENTS.md) — "Current state" rewritten to reflect the live
  cycle; "Next" repoints at milestone 0.6.

### Not changed

- ICDs — **no bumps**. ICD-06 v0.2's event vocabulary and `EditionSummary`
  shape used as authored. ICD-01 v0.5's `HudState` populated as authored.
  ICD-05 v0.3's `verified → plated → printed` transitions fired as the table
  specifies (the `plated_by` sentinel preserves the contract until the
  Editor unit substitutes a real `EditorId`). No deviation, so Constraint #4
  doesn't trigger.
- [`js/render/renderer.js`](js/render/renderer.js), [`js/input.js`](js/input.js),
  [`js/sim/pathfinder.js`](js/sim/pathfinder.js) — untouched. 0.5 lives
  entirely in the sim's cycle layer and the renderer-adjacent DOM.
- Design HTMLs in [`design/`](design) — immutable per AGENTS.md hard rule.

### ICD activity

- **ICD-06 v0.2** — used as authored. `CycleEvent` kinds dispatched 1:1,
  `EditionSummary` shape produced exactly as defined, pause-during-debrief
  default honoured.
- **ICD-01 v0.5** — used as authored. `HudState { edition, deadline_ms,
  resources: { leads, stories, ink, cash, heat } }` populated; the four
  Implementation-notes (0.5) constants (TILE, origin offset, 30 Hz,
  id-minting) all observed.
- **ICD-05 v0.3** — used as authored. The `verified → plated → printed`
  two-step still fires at `DEADLINE_FIRE`; the milestone-0.5 collapse into
  the same frame is allowed by the ICD's "first milestone" column without
  changing the transition table.

### Verification

- `node --test tests/*.test.mjs` — 45 / 45 pass. 8 new cases since v0.4.1
  (37 → 45). The existing `tests/world-frame.test.mjs` `FRAME_KEYS`
  allowlist still passes — no top-level `WorldFrame` keys added (subscriber
  channel side-steps the projection so ICD-01 stays at v0.5).
- Browser smoke: load [`index.html`](index.html). Masthead reads "Milestone
  0.5 · print cycle". HUD ticker shows `EDITION 1 · 12:00 TO DEADLINE` and
  counts down. Stage the ferry (reporter → lead → bureau; photog → bureau
  → darkroom) — verified story rests at the Darkroom. At deadline the
  debrief panel mounts with a `VICE WHISPER HITS WIRE` row; click anywhere
  on the panel and the next edition opens at `EDITION 2 · 12:00`.

## v0.4.1 — 2026-05-20 — PRE-0.5 paper session

Paper-only, no code. The forward-ICD gap the post-0.3 re-eval flagged
([`architecture/re-eval-after-0.3.md`](architecture/re-eval-after-0.3.md) §3
"Scheduled paper slot — PRE-0.5") is now closed. Milestone 0.5 (print cycle
clock · deadline events · debrief panel) is legal to open as a code session;
milestone 0.6 (Cash + Ink + Heat resources) is also unblocked at the contract
level (numbers stay medium-band by design).

This is the third paper-only changelog entry (v0.1.1 was PRE-0.2; v0.3.1 was
the post-0.3 re-eval). METHODOLOGY §3.2 forbids code in a paper slot —
verified by the byte-zero diff under [`js/`](js), [`tests/`](tests), and
[`index.html`](index.html).

Headline outputs:

- **ICD-06 → v0.2.** `EditionSummary` shape authored — `edition`,
  `stories_printed: StoryDigest[]`, `cash_earned`, `ink_consumed`,
  `heat_applied`, `rival_events: RivalEventDigest[]`. Closes the open
  question deferred at v0.1. Pause-during-debrief resolved: `CYCLE_TICK`
  stops between `EDITION_DEBRIEF_BEGIN` and `EDITION_DEBRIEF_END`.
- **ICD-01 → v0.5.** `HudState` shape authored — `edition`, `deadline_ms`,
  `resources: { leads, stories, ink, cash, heat }` (strong-band locked names
  from [`architecture/00-overview.md`](architecture/00-overview.md)).
  Render-only projection rule tightened: *"the renderer doesn't use this
  frame"* → *"within the next-N window"*, with `LeadView.age_ms` as the
  cited near-horizon example. Implementation notes (0.5) section added,
  pinning four arch-silent constants the v0.4.0 code already runs on:
  `TILE = 6`, world-space origin offset `−27`, fixed 30 Hz sim tick, and the
  per-`World` monotonic id-minting convention.

### Changed

- [`icds/ICD-06-print-cycle.md`](icds/ICD-06-print-cycle.md) bumped to
  **v0.2**. New `EditionSummary` shape section after Event vocabulary;
  open-questions block resolved; revision history added.
- [`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md) bumped to
  **v0.5**. New `### HudState (v0.5)` subsection under "View struct field
  sets"; projection rule rewritten in §Notes; new `## Implementation notes
  (0.5)` section; v0.5 entry prepended to revision history. The "Open
  questions" and "Deviation policy" sections were re-worded to be
  milestone-agnostic; no contract change.
- [`roadmap.md`](roadmap.md) — PRE-0.5 checklist item ticked; current-status
  block advanced to point at milestone 0.5 (no longer paper-blocked).
- [`AGENTS.md`](AGENTS.md) — "Current state" and "Next" paragraphs rewritten
  to reflect PRE-0.5 shipped and milestone 0.5 unblocked.

### Not changed

- No file under [`js/`](js), [`tests/`](tests), or
  [`index.html`](index.html) was touched. METHODOLOGY §3.2 forbids code in
  a paper slot.
- [`icds/ICD-02-rival-world.md`](icds/ICD-02-rival-world.md),
  [`icds/ICD-03-unit-pathfinder.md`](icds/ICD-03-unit-pathfinder.md),
  [`icds/ICD-05-story-lifecycle.md`](icds/ICD-05-story-lifecycle.md) — the
  post-0.3 re-eval found no drift; no bump warranted in PRE-0.5.
- [`architecture/00-overview.md`](architecture/00-overview.md) — no band
  movements (the re-eval already concluded none).
- Design HTMLs in [`design/`](design) — immutable per AGENTS.md hard rule.

### ICD activity

- **ICD-06 v0.1 → v0.2** — authored `EditionSummary` + `StoryDigest` +
  `RivalEventDigest`; resolved pause-during-debrief default. Event
  vocabulary, cycle timing, and subscriber expectations unchanged.
- **ICD-01 v0.4 → v0.5** — authored `HudState`; tightened projection rule
  wording; added Implementation notes (0.5). No `WorldFrame` top-level
  field changes; no `BuildingView` / `UnitView` / `LeadView` field-set
  changes.

### Verification

- `node --test tests/*.test.mjs` — 37 / 37 pass (baseline, unchanged).
- `git diff` touches only `icds/`, `CHANGELOG.md`, `roadmap.md`, and
  `AGENTS.md`. Zero diff under `js/`, `tests/`, `index.html`, `design/`,
  `discussion/`, `deferred/`, `architecture/`.

## v0.4.0 — 2026-05-20 — Milestone 0.4: Photog · Darkroom · `lead → verified`

The second carrier ships. A Photog unit and a Darkroom building light up
ICD-05 v0.2's row 3: a held lead at the Bureau is picked up by the Photog,
ferried Bureau → Darkroom, and dropped with `state: 'lead' → 'verified'`.
The Story id is stable across the transition (ICD-05 Purpose still holds).
After 0.4 the verified Story sits dormant at the Darkroom waiting for the
Editor's 0.5 step.

### Added

- [`js/sim/world-state.js`](js/sim/world-state.js) — new exported
  `BUREAU_TILE` and `DARKROOM_TILE` constants. `World` constructor seeds two
  buildings (Bureau at (5,5), Darkroom at (7,7)) and two units (Reporter at
  (5,4), Photog at (5,6)). `_handleArrival` now dispatches to
  `_handleReporterArrival` or `_handlePhotogArrival` keyed on `u.kind`.
- [`js/render/renderer.js`](js/render/renderer.js) — `_syncBuildings()` and
  `_syncUnits()` route through new `buildBuildingMesh(kind)` /
  `buildUnitMesh(kind)` factories. Two new mesh builders ship:
  `buildDarkroomMesh()` (squatter than Bureau, dark-red body, red safelight
  on the roof) and `buildPhotogMesh()` (brown jacket, flat cap, chest-slung
  camera box as silhouette signal). Selection-ring construction extracted to
  `makeSelectRing()` to share between Reporter and Photog.
- [`tests/photog-verify.test.mjs`](tests/photog-verify.test.mjs) — 7 cases
  covering the photog ferry: spawn shape, Darkroom presence, Bureau pickup,
  Darkroom drop with verify transition, verified Story stays out of
  `frame.leads`, no-op when Bureau is empty, drop is sim-internal (no
  Intent kind added to ICD-02).
- [`tests/world-frame.test.mjs`](tests/world-frame.test.mjs) — 3 new
  cases: `frame.buildings` includes both kinds, `frame.units` includes
  both kinds, verified Stories are excluded from `frame.leads` via the
  state filter.
- [`tests/unit-step.test.mjs`](tests/unit-step.test.mjs) — 1 new case
  asserting Photog dispatch + arrival cycle mirrors Reporter.

### Changed

- [`icds/ICD-05-story-lifecycle.md`](icds/ICD-05-story-lifecycle.md) bumped
  to **v0.3**. Shape unchanged. §Notes spell out the field deltas the
  `lead → verified` transition sets (`verified_by`,
  `held_by_building = darkroom.id`, clear `picked_up_by`) so future readers
  don't reconstruct from `_handlePhotogArrival`.
- [`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md) —
  "Current caller" line updated to milestone 0.4. **Version not bumped**:
  BuildingView/UnitView kind enums already listed `'darkroom'`/`'photog'`
  from v0.2; LeadView filter at v0.4 already excludes verified-state
  Stories via the `state === 'lead'` clause. No deviation, so Constraint #4
  doesn't require a bump. v0.5 stays reserved for PRE-0.5.
- [`index.html`](index.html) — title and masthead caption bumped from "0.3
  first lead" to "0.4 photog · darkroom · verified".
- [`roadmap.md`](roadmap.md) — milestone 0.4 checkbox ticked; current-status
  paragraph advanced to point at PRE-0.5 as the next paper slot.
- [`AGENTS.md`](AGENTS.md) — "Current state" rewritten to reflect v0.4.0:
  two carriers, two buildings, the lead → verified transition lit.
  "Next" still points at PRE-0.5.
- [`README.md`](README.md) — Status block bumped to v0.4.0; "How to
  navigate" mentions the Photog and the Bureau → Darkroom ferry.

### Not changed

- [`js/sim/pathfinder.js`](js/sim/pathfinder.js) — A* is generic over
  `unitKind`; the channel was wired at 0.2 and 0.4 just exercises it with
  `'photog'`. Per-kind costs still land at 0.7 (ICD-03 v0.2 §Notes).
- [`js/input.js`](js/input.js) — selection and dispatch are already
  generic over `UnitView.kind`. Verified by test (Photog cycle case).
- [`js/main.js`](js/main.js) — entry shape unchanged.
- Design HTMLs in [`design/`](design) — immutable per AGENTS.md hard rule.

### ICD activity

- **ICD-05 v0.2 → v0.3** — status text + revision history + §Notes addition
  for the verify field deltas. Shape and transition table unchanged.
- **ICD-01** — no bump. Current-caller line updated; the v0.4 contract was
  already 0.4-ready, so Constraint #4 wasn't triggered. PRE-0.5 will take
  the v0.5 slot for HudState + projection-rule tightening.

### Verification

- `node --test tests/*.test.mjs` — 37 / 37 pass. 11 new cases since v0.3.0
  (26 → 37).
- Browser smoke: load [`index.html`](index.html). Reporter ferries lead
  from (2,2) to Bureau (5,5) as in 0.3; Photog ferries it from Bureau to
  Darkroom (7,7); story state flips to `verified` at the Darkroom; no lead
  mesh visible while held at either building.

## v0.3.1 — 2026-05-20 — RE-EVAL after 0.3 (paper)

Paper-only, no code. The post-0.3 re-evaluation slot the roadmap called
for (line 21) is now closed. METHODOLOGY §3 both halves ran —
structural pass + code-aware pass + forward ICD presence check for the
0.4–0.6 window.

Headline outputs:

- **No interface drift.** ICDs 01 / 03 / 05 all survived contact with
  shipped 0.1–0.3 code. Constraint #4 was honored in both milestones
  (0.2 bumped ICD-01 v0.2→v0.3 + ICD-03 draft→v0.2; 0.3 bumped ICD-05
  v0.1→v0.2 + ICD-01 v0.3→v0.4).
- **No band movements** in the architecture overview. Three strong-band
  claims without current test coverage (Press 90 HP, 12-min cycle,
  5-resource names) are aligned to their respective lighting-up
  milestone — gap is scheduled, not open.
- **Forward ICD check surfaced one gap:** ICD-06 is still draft (Phase 0)
  and ICD-01's `HudState` shape is unauthored. Both blocks milestone 0.5
  and 0.6 from being truly code-ready.
- **Milestone 0.4 unblocked.** ICD-01 v0.4 + ICD-03 v0.2 + ICD-05 v0.2
  cover Photog + Darkroom + `lead → verified` without further paper work.

### Added

- [`architecture/re-eval-after-0.3.md`](architecture/re-eval-after-0.3.md)
  — the session document. Records what code was read, classifies findings
  per METHODOLOGY §3.1.1, schedules PRE-0.5 with its specific deliverables
  (ICD-06 v0.2 + ICD-01 v0.5 in one paper slot), and folds in three minor
  decision-in-comments / arch-silent observations for PRE-0.5 to absorb.

### Changed

- [`roadmap.md`](roadmap.md) — RE-EVAL after 0.3 row ticked; new **PRE-0.5**
  row inserted before 0.5 (single architecture session to author ICD-06
  v0.2 + ICD-01 v0.5); current-status block advanced; checklist updated.
- [`AGENTS.md`](AGENTS.md) — "Current state" and "Next" paragraphs
  rewritten to reflect: re-eval shipped, 0.4 is ICD-ready and unblocks,
  PRE-0.5 is the next paper slot before 0.5 can open.

### Not changed

- No file under [`js/`](js), [`tests/`](tests), or [`index.html`](index.html)
  was touched. METHODOLOGY §3.2 forbids code in a re-evaluation session.
- No ICD was bumped — no drift was found and `EditionSummary` / `HudState`
  authoring is explicitly **out of scope** for this session (scheduled to
  PRE-0.5).
- Design HTMLs in [`design/`](design) — immutable per AGENTS.md hard rule.

### Verification

- `node --test tests/*.test.mjs` — 26 / 26 pass (baseline, unchanged).
- `git diff` touches only `architecture/`, `roadmap.md`, `CHANGELOG.md`,
  and `AGENTS.md`. Zero diff under `js/`, `tests/`, `index.html`,
  `design/`, `icds/`, `discussion/`, `deferred/`.

## v0.2.0 — 2026-05-20 — Milestone 0.2: first dispatch

The WorldFrame → renderer boundary materializes. Sim and renderer are now
distinct modules under [`js/sim/`](js/sim) and [`js/render/`](js/render);
the renderer never reaches back into world state. The first interactive
loop ships: a Reporter unit walks where you tell it.

### Added

- [`js/sim/pathfinder.js`](js/sim/pathfinder.js) — pure A* over a baked
  walkability grid, matching the [ICD-03](icds/ICD-03-unit-pathfinder.md)
  request/response shape exactly.
- [`js/sim/world-state.js`](js/sim/world-state.js) — `World` class owns
  the 10×10 grid, the Bureau (at tile (5,5), 90/90 HP), and the Reporter
  (spawns adjacent at (5,4), walks at 3.5 u/s). `tick(dt)` advances the
  Reporter along its path; `snapshot()` projects to a `WorldFrame`.
- [`js/render/renderer.js`](js/render/renderer.js) — owns three.js scene,
  camera, fog, rain, and meshes. `apply(frame, alpha)` consumes a
  `WorldFrame` and lerps unit positions between sim ticks per ICD-01 v0.3.
  Exposes `screenToGridCell(clientX, clientY, gridW, gridH)` so input can
  resolve clicks without poking the scene graph.
- [`js/input.js`](js/input.js) — left-click on Reporter selects (toggles
  `UnitView.selected`); left-click on empty ground deselects; right-click
  on a walkable cell with a Reporter selected dispatches. Context menu
  suppressed so right-click can serve as order. Per design doc §13 +
  decision §17 (input model locked).
- [`js/main.js`](js/main.js) — entry point. Fixed-step sim loop at 30 Hz
  with renderer interpolation; replaces `js/world.js` as the page script.
- [`tests/pathfinder.test.mjs`](tests/pathfinder.test.mjs) — 6 cases:
  straight path, detour around obstacle, unreachable, source=destination,
  blocked destination, `recomputeOn` is an array.
- [`tests/unit-step.test.mjs`](tests/unit-step.test.mjs) — 7 cases:
  Reporter spawn state, dispatch + step at 3.5 u/s, arrival + idle
  transition, dispatch-to-blocked rejection, in-flight dispatch overwrite
  (no queueing at 0.2), select/deselect, tile↔world conversion.
- [`tests/world-frame.test.mjs`](tests/world-frame.test.mjs) — 6 cases
  enforcing the ICD-01 v0.2 render-only projection: WorldFrame top-level
  keys exact, BuildingView/UnitView field sets exact, no sim-only fields
  leak (`path`, `tile`, `pathIdx` rejected by name), effects queue
  drains, fog color matches paper.

### Changed

- [`index.html`](index.html) — script src points at `js/main.js`; title
  bumped to "0.2 first dispatch"; masthead caption notes the input model.
- [`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md) bumped
  to **v0.3**. Closed both v0.2 open questions: animation playhead
  (renderer interpolates `pos`/`facing` linearly between fixed 30 Hz sim
  ticks) and `Vec3` precision (plain `{x,y,z}` object — packed typed-array
  pool deferred until profiling shows pressure). Implementation-notes
  section added.
- [`icds/ICD-03-unit-pathfinder.md`](icds/ICD-03-unit-pathfinder.md)
  promoted from draft to **v0.2**. Closed both v0.1 open questions:
  `GridCell` shape (`{x,y}` plain object) and `cost` units (tiles for
  now — revisits at 0.7 when Goons get per-kind costs). Heuristic
  noted as Manhattan (4-neighbor grid, no diagonals at 0.2).
  Implementation-notes section added.
- [`roadmap.md`](roadmap.md) — milestone 0.2 ticked; status block advanced.
- [`AGENTS.md`](AGENTS.md) — "Current state" rewritten to point at the
  module layout and the next milestone (0.3 — lead spawn, pickup,
  return-to-bureau).

### Removed

- [`js/world.js`](js/world.js) — its 0.1 body migrated into
  `js/render/renderer.js` byte-for-byte (toon pipeline, fog 22→60, 600-line
  rain, 6-unit grid pitch all preserved). The file was a scaffold marker;
  with sim+renderer now split, keeping it would have been dead code.

### ICD activity

- **ICD-01 v0.2 → v0.3** — both open questions closed in the same PR
  (Constraint #4). View struct field sets remained byte-stable; only the
  animation/precision questions resolved.
- **ICD-03 draft → v0.2** — both open questions closed in the same PR.
  Contract shape unchanged; representation locked.

### Verification

- `node --test tests/*.test.mjs` — 19 pass, 0 fail. Pure modules
  (pathfinder, sim) have zero three.js / DOM dependencies, so the test
  runner is node built-in — no new dev deps.
- Browser smoke: load [`index.html`](index.html). Left-click the Reporter
  (yellow ring appears); right-click a far cell (Reporter walks there);
  right-click during walk (path overwrites — no queueing at 0.2);
  left-click empty ground (ring fades).

## v0.1.1 — 2026-05-20 — PRE-0.2 paper session

Paper-only, no code. The methodology gate the v0.1.0 entry flagged
("View-struct field sets deferred to a PRE-0.2 paper session") is now closed.
Milestone 0.2 (A* pathfinding · Reporter unit · click-to-dispatch) is legal to
open as a code session.

### Changed

- [`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md) bumped to
  **v0.2**. Concrete `BuildingView` / `UnitView` / `LeadView` field sets
  authored, with per-field justification tracing each one back to a strong-band
  commitment or a near-horizon ICD. New "render-only projection rule" added:
  no field on a View carries information the renderer doesn't use this frame.
  LeadView ↔ UnitView.carrying handoff documented for the 0.3 pickup case.
  Animation-playhead open question retained (per its own v0.1 deferral logic);
  `Vec3` precision flagged as a new 0.2-decided open question.
- [`AGENTS.md`](AGENTS.md) — "Current state" and "Next milestone" paragraphs
  updated: PRE-0.2 done, 0.2 unblocked.
- [`roadmap.md`](roadmap.md) — PRE-0.2 paper-session checkbox ticked.

### Not changed

- `js/world.js` — paper session, no renderer code touched.
- `index.html`, `games.json` — unchanged.
- Design HTMLs in [`design/`](design) — immutable per AGENTS.md hard rule.

## v0.1.0 — 2026-05-20 — Milestone 0.1: world render scaffold

First playable code lands. The renderer-only scaffold from
[`design/phase-0-roadmap.html`](design/phase-0-roadmap.html) §04 row 0.1 is
now live: scene, camera, toon pipeline, fog, rain, ground grid. No game
logic. Touches ICD-01 only.

### Added

- [`js/world.js`](js/world.js) — three.js scene host. Orthographic isometric
  camera, MeshToonMaterial with a 3-step gradient, linear fog 22→60, 120×120
  ground plane, street grid at 6-unit pitch, 600-segment rain. `withOutline`
  helper carried forward for buildings/units arriving at 0.2/0.3.
- New top-level `index.html` — minimal scene host with masthead, footer
  arcade link, and an in-page link out to the Phase 0 + Roadmap supplement.

### Changed

- `index.html` is now the playable scene. The Phase 0 + Roadmap supplement
  page (previously the landing) is reached via the in-page link or directly
  at [`design/phase-0-roadmap.html`](design/phase-0-roadmap.html); the
  immutable copy in `design/` is unchanged.
- [`README.md`](README.md) — "How to navigate" updated; status bumped to
  v0.1.0.
- [`AGENTS.md`](AGENTS.md) — current state + next milestone re-pointed at
  0.2 (A* pathfinding, Reporter unit, click-to-dispatch).
- [`roadmap.md`](roadmap.md) — milestone 0.1 box ticked.

### Removed

- [`js/feel-test.js`](js/feel-test.js) — the lift source for 0.1. Now that
  the scaffold lives in `world.js`, keeping the feel test would invite drift
  (its game-logic sketches conflict with future milestones). The immutable
  design HTMLs in `design/` are the source of truth, not `feel-test.js`.

### ICD activity

- **ICD-01** — no deviation. Strong-band commitments (MeshToonMaterial,
  3-step gradient, EdgesGeometry @ 25°, linear fog 22→60, orthographic
  isometric camera) all preserved byte-equal from the feel test. The
  `WorldFrame → renderer` boundary is *not* materialized at 0.1; without a
  simulation it would be premature abstraction. Marker comment at the top
  of `world.js` notes where it lands at 0.2.
- View-struct field sets (ICD-01 open question) deferred to a PRE-0.2 paper
  session.

## v0.0.1 — 2026-05-20 — Phase 0 bootstrap

Phase 0 (architecture-only) lands. No game code yet — this PR executes the
"What To Do Monday" order of operations from
[`design/phase-0-roadmap.html`](design/phase-0-roadmap.html) §06.

### Added

- Design package preserved verbatim in [`design/`](design): Design Doc,
  Phase 0 + Roadmap, Rival AI Spec, Audio Manifest (all four HTMLs from the
  Claude Design handoff bundle).
- `index.html` — Phase 0 + Roadmap as the landing page (pixel-perfect copy,
  with a single arcade-integration addition: the required `← Back to Arcade`
  link).
- [`METHODOLOGY.md`](METHODOLOGY.md) — the LLM-assisted-development
  methodology doc, verbatim.
- [`roadmap.md`](roadmap.md) — markdown mirror of §04.
- [`architecture/00-overview.md`](architecture/00-overview.md) — markdown
  mirror of §02 (strong/medium/fuzzy banding).
- ICDs drafted from §03 sketches:
  - [`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md)
  - [`icds/ICD-02-rival-world.md`](icds/ICD-02-rival-world.md)
  - [`icds/ICD-03-unit-pathfinder.md`](icds/ICD-03-unit-pathfinder.md)
  - [`icds/ICD-05-story-lifecycle.md`](icds/ICD-05-story-lifecycle.md)
  - [`icds/ICD-06-print-cycle.md`](icds/ICD-06-print-cycle.md)
  - ICD-04 (save schema) intentionally deferred to PRE-0.8.
- [`discussion/`](discussion) seeded with the six files from §02:
  observer-violence, rival-state-visibility, difficulty-selector,
  tutorial-first-edition, accessibility, yellow-establishment-branch.
- [`deferred/`](deferred) directory created (empty; the directory itself
  signals the methodology to the next session).
- [`js/feel-test.js`](js/feel-test.js) — three.js cel-shaded feel-test
  copied from the design bundle. Slated for milestone 0.1 as the starting
  renderer.
- [`AGENTS.md`](AGENTS.md) — routing doc for the next code session.
- Arcade integration: registered in repo-root `games.json` and `index.html`
  with a `📰` icon and the *Strategy (Design Phase)* tag, following the
  Oregon Trail "scaffold phase" precedent.

### Next

- Milestone **0.1** in a separate code session: scene, camera, toon
  pipeline, fog, rain, ground grid. Lift from the feel test. ICD-01 only.
