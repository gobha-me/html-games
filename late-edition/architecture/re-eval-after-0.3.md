# RE-EVAL after 0.3 — paper session

**Slot:** roadmap.md line 21 — *"After 0.3 · paper session"*.
**Scope:** [`../METHODOLOGY.md`](../METHODOLOGY.md) §3 both halves
(structural + code-aware) plus the **forward ICD presence check** for
the next-N (0.4–0.6) window.
**Output:** band movements, scheduled paper slots, roadmap label
updates, no JS.

This is the second paper-session entry in the changelog (v0.1.1 was
the first — PRE-0.2). It runs after 0.1, 0.2, 0.3 shipped and before
0.4 can open as a code session.

## 1. Code-aware pass

Read against the three ICDs whose first caller has shipped:

| ICD | Status before re-eval | Implementing files |
|---|---|---|
| ICD-01 (World ↔ Renderer) | v0.4 — LeadView filter tightened | [`../js/sim/world-state.js`](../js/sim/world-state.js) (`snapshot()`), [`../js/render/renderer.js`](../js/render/renderer.js) (`apply()`, `noteTick()`), [`../js/main.js`](../js/main.js) (fixed-step loop) |
| ICD-03 (Unit ↔ Pathfinder) | v0.2 — `GridCell`/`cost`/heuristic locked | [`../js/sim/pathfinder.js`](../js/sim/pathfinder.js) |
| ICD-05 (Story Lifecycle) | v0.2 — `held_by_building` + `lead → lead` carrier-drop row | [`../js/sim/world-state.js`](../js/sim/world-state.js) (`stories`, `_handleArrival`) |

Findings keyed to METHODOLOGY §3.1.1 classification:

### Drift (interface, code-from-arch, arch-silent)

**None at the contract level.** The three ICDs and their implementations
agree on field sets, transitions, request/response shapes, and filter
rules.

Spot-check evidence:

- ICD-01 v0.4 LeadView filter — `!picked_up_by && !held_by_building` —
  matches [`../js/sim/world-state.js:173-175`](../js/sim/world-state.js)
  exactly. Under test in
  [`../tests/world-frame.test.mjs:70-77`](../tests/world-frame.test.mjs)
  ("`frame.leads excludes Stories held by a building`") and
  [`../tests/story-pickup.test.mjs:53-55`](../tests/story-pickup.test.mjs)
  ("picked-up lead leaves frame.leads").
- ICD-05 v0.2 drop-at-bureau transition — sets `held_by_building`,
  clears `picked_up_by`, state stays `'lead'` —
  [`../js/sim/world-state.js:146-160`](../js/sim/world-state.js).
  Under test in
  [`../tests/story-pickup.test.mjs:58-86`](../tests/story-pickup.test.mjs)
  with the load-bearing `'Story id must not change on drop'`
  assertion.
- ICD-03 v0.2 `PathResponse` — `{found, cells, cost, recomputeOn}` on
  every return path including not-found and same-from-to —
  [`../js/sim/pathfinder.js:17,20,39,58`](../js/sim/pathfinder.js).
  `recomputeOn` always `[]`, `unitKind` accepted but unused (line 14),
  Manhattan heuristic (line 62).
- ICD-01 v0.3 renderer interpolation rule — linear lerp of `pos`/`facing`
  between fixed 30 Hz sim ticks —
  [`../js/render/renderer.js:113-141`](../js/render/renderer.js) +
  [`../js/main.js:30-41`](../js/main.js).
- Renderer never reaches back into sim state —
  [`../js/render/renderer.js:11`](../js/render/renderer.js) imports
  `TILE` only (a constant, not state).
- WorldFrame projection rule enforced by
  [`../tests/world-frame.test.mjs`](../tests/world-frame.test.mjs) —
  exact top-level keys (line 16-20), exact View field sets (lines
  22-67), sim-only fields actively rejected by name (lines 46-55:
  `path`, `tile`, `pathIdx`, `carryingStoryId`).

Constraint #4 (in-PR ICD update on deviation) was honored in both
shipped milestones: 0.2 bumped ICD-01 v0.2→v0.3 and ICD-03 draft→v0.2;
0.3 bumped ICD-05 v0.1→v0.2 and ICD-01 v0.3→v0.4. No bare CHANGELOG
deviations.

### Decision-embedded-in-comments

Three observations. All near-trivial, none warrant a fix in this
session — flagged for PRE-0.5 inclusion (§3 below) so they're picked
up alongside the planned ICD-01 v0.5 work.

1. **`age_ms` on LeadView vs the render-only projection rule.**
   [`../js/render/renderer.js:152`](../js/render/renderer.js) comments
   *"the renderer never reads `age_ms` for 0.3 — that field is plumbed
   for future decay/pulse FX."* ICD-01 v0.4 §Notes asserts the
   render-only projection rule: *"no field on a View carries information
   the renderer doesn't use this frame."* The field's presence on
   LeadView is justified by a near-horizon caller (decay/pulse FX, not
   yet on the roadmap) but the rule's wording forbids it. Resolution
   options:
   - **Tighten the rule wording** to *"…no field…the renderer doesn't
     use within the next-N window"* and cite `age_ms` as the canonical
     allowed-because-near-horizon example. **Preferred** — paper-only,
     keeps the field set stable across 0.3 → 0.4 → 0.5.
   - Drop `age_ms` from LeadView and re-add at the consuming milestone
     under Constraint #4. Cleaner against the current rule, but
     introduces a transient field churn that the rule's stable-shape
     intent argues against.
   Action: **schedule into PRE-0.5** (the same ICD-01 v0.5 session that
   authors HudState).

2. **At-rest state convention.**
   [`../js/sim/world-state.js:161-165`](../js/sim/world-state.js)
   comments that idle is the at-rest state regardless of `carrying`,
   citing ICD-01 §UnitView. The decision is documented in the ICD
   (lines 87-89 of ICD-01). No extraction needed — the comment is a
   local navigation aid, not a load-bearing decision capture.

3. **Pickup is a sim-internal consequence of arrival, not a new Intent
   kind.** [`../js/sim/world-state.js:126-130`](../js/sim/world-state.js)
   plus [`../tests/story-pickup.test.mjs:88-98`](../tests/story-pickup.test.mjs)
   (test name: *"pickup is auto on arrival — no Intent kind added to
   dispatch surface"*). This is the right framing — ICD-02 v0.1's intent
   vocabulary (medium-band) didn't get a new entry, and the test asserts
   the negative space. No extraction needed.

### Missing-test-for-arch-claim

Three strong-band claims in
[`00-overview.md`](00-overview.md) have no current test enforcing them.
For each, the claim's first testable caller hasn't shipped yet, so
the gap is *aligned* (the test will arrive with the milestone) rather
than *open* (the test should already exist).

| Claim (overview line) | First testable milestone | Status |
|---|---|---|
| The print cycle (12 min/edition) | 0.5 | Aligned. ICD-06 promotion gates this — see §3. |
| Single fail-state — Press @ 90 HP | 0.7 (first damage source) | Aligned. `hp`/`hp_max` exposed today on BuildingView, no consumer. |
| Five resources (Leads/Stories/Ink/Cash/Heat) — names locked | 0.6 | Aligned. Resource bag at [`../js/sim/world-state.js:82-86`](../js/sim/world-state.js) uses the locked names; no test asserts the names because no production code reads them yet. |

No demotions warranted — each claim is load-bearing for a milestone
inside the N+M (=10) horizon.

### Arch-silent-on-code

Three sub-load-bearing facts live in code without architecture
mention. None are big enough to promote into a standalone
architecture line; the natural home is an "implementation notes"
section on ICD-01 v0.5.

- `TILE = 6` world-units (grid pitch) and the world-space origin
  offset of -27 — [`../js/sim/world-state.js:14,22,27`](../js/sim/world-state.js).
  The 6-unit pitch matches the design doc's renderer rhythm but isn't
  pinned in the markdown architecture or any ICD.
- `nextId` id-minting convention (monotonic counter, reset per `World`)
  — [`../js/sim/world-state.js:32-33`](../js/sim/world-state.js).
  ICD-05 commits *"the same `id` flows end-to-end"* but doesn't say
  who mints them.
- The 30 Hz sim tick rate — [`../js/main.js:9-10`](../js/main.js).
  ICD-01 v0.3 §UnitView locks the *interpolation* rule against fixed
  30 Hz; the **30 Hz value itself** is in code, not in the ICD.

Action: **schedule all three into PRE-0.5's ICD-01 v0.5 implementation
notes** — they're the kind of constants a future code session would
need to know but won't find in any current doc.

## 2. Structural pass

Reviewed [`00-overview.md`](00-overview.md) against shipped 0.1–0.3
reality. No band movements warranted.

- **Strong band.** All nine commitments survive contact:
  - "Print cycle (12 min/edition)" — heartbeat, not yet implemented, gated by ICD-06 (see §3).
  - "Five resources" — names locked match code ([`../js/sim/world-state.js:85`](../js/sim/world-state.js)); shape locked via the HudState gap (see §3).
  - "Single fail-state — the Press" — HP fields wired in BuildingView; no damage source yet.
  - "Cel-shaded toon pipeline" — preserved byte-for-byte from 0.1; ICD-01 carries the strong-band parameters.
  - "Camera + input model" — orthographic isometric + click-to-dispatch live since 0.2.
  - "Reporter unit core" — walk 3.5 u/s tested; HP 2 awaiting consumer.
  - "Lead → Story lifecycle" — ICD-05 v0.2; tested end-to-end at the carrier level.
  - "Save = single localStorage JSON" — deferred to 0.8; ICD-04 PRE-0.8 slot locks it.
  - "Browser-only single-player MVP" — preserved; no foreclosure in shipped code.
- **Medium band.** No promotions of the catalogue lines (Darkroom +
  Photog stay listed under "Full 8-building catalogue" / "Full 6 unit
  types"). The catalogue claim is *all* buildings/units, which stays
  medium-band into Tier-1; the *shapes* for 0.4's Darkroom and Photog
  are already strong-band via ICD-01 BuildingView (kind: `'darkroom'`
  in the enum, ICD-01 line 47) and UnitView (kind: `'photog'`, line 76)
  and ICD-05 transition row (`lead → verified`, line 44). No new entry
  needed.
- **Fuzzy band.** No precondition triggered. The Tier-1 → Tier-2 RE-EVAL
  slot (roadmap line 32) is the next opportunity for fuzzy-to-medium
  movement (procedural city, MP, audio asset list).
- **Discussion docs.** All six parked since Phase 0 bootstrap. The
  post-0.6 RE-EVAL slot already commits to revisiting
  [`../discussion/tutorial-first-edition.md`](../discussion/tutorial-first-edition.md)
  and
  [`../discussion/difficulty-selector.md`](../discussion/difficulty-selector.md);
  no early promotion warranted. ICD-06's deadline non-visual cue
  already cites
  [`../discussion/accessibility.md`](../discussion/accessibility.md) —
  fine as a cited-from-architecture reference; the doc itself stays
  pre-architectural.

## 3. Forward ICD presence check (next-N window: 0.4 / 0.5 / 0.6)

Per METHODOLOGY §3.1, every `[strong]` milestone inside the next-N
window must have its ICD authored to the level the band claims.

| Milestone | Required ICDs | Status | Action |
|---|---|---|---|
| **0.4** — Photog · Darkroom · `lead → verified` | ICD-01 (BuildingView+UnitView kind enums already include `'darkroom'` / `'photog'`); ICD-03 (pathfind generic over `unitKind`); ICD-05 v0.2 (`lead → verified` transition row, line 44) | **Code-ready.** All three at v0.2+ with first-caller-shipped status. | None — 0.4 unblocks. |
| **0.5** — Print cycle · deadline events · debrief panel | ICD-06 | **Not code-ready.** ICD-06 v0.1 is still labeled *"draft (Phase 0 / PRE-0.1)"* and its own §Open questions defers `EditionSummary` shape with the note *"Sketch in ICD-06 v0.2 before milestone 0.5."* | **Schedule PRE-0.5 paper slot.** |
| **0.6** — Cash + Ink + Heat resources | ICD-01 references `HudState` (line 24) in `WorldFrame` but `HudState` shape is unauthored; Design Doc §06 + §19 numbers are medium-band by design ([`00-overview.md:44`](00-overview.md)) | **Partially ready.** Numbers staying medium is correct (architecture line 44 explicit); the gap is `HudState` shape. | **Fold `HudState` authoring into the same PRE-0.5 slot.** |

### Scheduled paper slot — PRE-0.5

A single architecture session, paper-only, no code. Authors:

1. **ICD-06 v0.2** — `EditionSummary` shape (the debrief panel's data
   contract). Closes ICD-06 v0.1's open question about summary
   composition. Resolves the pause-during-debrief question (default
   "yes" per ICD-06 v0.1 §Open questions).
2. **ICD-01 v0.5** — `HudState` shape (`edition: number`, `deadline_ms: number`,
   `resources: { leads, stories, ink, cash, heat }` matching the
   strong-band locked names). Tightens the render-only projection rule
   wording to permit near-horizon use ("renderer doesn't use within the
   next-N window") with `age_ms` as the cited example. Adds an
   "implementation notes" section for the three arch-silent constants
   (TILE=6, world-space origin offset -27, 30 Hz tick rate, id-minting).

Both ICDs share the HUD subsystem so they belong in one paper slot,
matching the PRE-0.2 precedent (a single slot authored view-struct
field sets across ICD-01 ahead of milestones 0.2 + 0.3). Per
METHODOLOGY §3.2, this re-eval *surfaces* the gap and schedules the
slot; it does not author the contracts itself.

## 4. Roadmap label updates

No band changes to the 0.4 / 0.5 / 0.6 milestones — they remain
`[strong]` by the dependency-band rule:

- 0.4's weakest dependency is ICD-05 v0.2 (strong) → milestone stays strong.
- 0.5's weakest dependency is ICD-06 draft (strong-band content not yet
  authored to that level — but the *band* on the section is strong; the
  forward ICD check addresses the *presence* gap, not the band).
  Milestone stays strong; the PRE-0.5 slot is its forward-ICD trigger.
- 0.6's weakest dependency is the HudState shape (same situation).
  Stays strong; PRE-0.5 closes the gap.

Roadmap edits:

1. **Tick** the "RE-EVAL after 0.3" row (line 21).
2. **Insert** a new `PRE-0.5` row above the existing 0.5 row:
   `PRE-0.5 | Author ICD-06 v0.2 (EditionSummary) + ICD-01 v0.5 (HudState
   + projection-rule tightening + implementation notes) | Architecture
   session · paper-only · gates milestone 0.5 | strong`.
3. **Advance** the "Current status" block: re-eval shipped; 0.4 is
   ICD-ready and unblocks immediately for a code session; 0.5 waits
   for PRE-0.5 to ship first.

## 5. Out of scope (preserved boundaries)

- **No JS / test / index.html changes** in this session — strict
  paper-only per AGENTS.md:88 (*"Do not open 0.4 in the same session
  as the re-eval — paper output only."*) and METHODOLOGY §3.2.
- **ICD-04** (save schema) — explicitly deferred to PRE-0.8 by the
  supplement; not touched.
- **ICD-02** (rival intent vocabulary) — medium-band, first caller is
  0.7; no movement warranted now. Post-0.6 RE-EVAL (roadmap line 25)
  is the scheduled promotion slot.
- **`EditionSummary` and `HudState` authoring** — surfaced here, work
  scheduled to PRE-0.5; not done in this session.

## 6. Summary

- **Three implemented ICDs survived contact with code.** No interface
  drift; Constraint #4 honored in both shipped milestones.
- **No band movements** in the architecture overview. Strong-band claims
  with no current test (Press HP, 12-min cycle, 5-resource names) are
  aligned to the milestone that lights up the consumer — gap is
  scheduled, not open.
- **One scheduled paper slot — PRE-0.5** — authors ICD-06 v0.2 and
  ICD-01 v0.5 together (debrief + HUD are one subsystem). Folds in the
  three minor decision-in-comments observations from §1.
- **0.4 is unblocked.** ICD-01 v0.4 + ICD-03 v0.2 + ICD-05 v0.2 cover
  Photog, Darkroom, and the `lead → verified` transition without
  further paper work.
