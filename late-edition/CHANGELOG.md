# Changelog — Late Edition

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
