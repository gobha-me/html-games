# RE-EVAL Tier-0 → Tier-1 — paper + code-aware session

**Slot:** [`../roadmap.md`](../roadmap.md) line 38 — *"Tier-0 → Tier-1 gate ·
full code-aware + paper · Promote arc framework to strong. Tighten Herald +
Observer specs. Author ICDs 08+ for branch bureaus, switchboard, archive."*
**Scope:** [`../METHODOLOGY.md`](../METHODOLOGY.md) §3 both halves
(structural + code-aware) plus the **forward ICD presence check** for the
first Tier-1 window (PRE-1.0 / 1.0), plus the band-tier transition gate
(Tier-0 → Tier-1 is the transition this slot exists to authorize).
**Output:** band movements, scheduled paper slot, roadmap label updates,
discussion-doc status, one Gitea ticket for the next paper slot. No JS.

This is the fifth paper-session entry in the changelog (v0.1.1 PRE-0.2 ·
v0.3.1 RE-EVAL after 0.3 · v0.6.1 RE-EVAL after 0.6 · v0.9.2 RE-EVAL
after 0.9 are the prior four). It runs after 0.10.0 / 0.10.1 / 0.10.2
shipped (the PR-C substrate + PR-C onboarding + PR-D visual feedback
sequence the post-0.9 re-eval ordered) and before the first Tier-1
code session can open.

## 1. Code-aware pass

Read against the seven authored ICDs:

| ICD | Version | Latest implementing files |
|---|---|---|
| ICD-01 (World ↔ Renderer) | v0.6.2 — `UnitView.stats` · `LeadView.district` · `WorldFrame.rivals: RivalStatusView[]` · `FxEvent` union (PRE-0.10) · `rain.intensity` range-comment widen (0.10.2) | [`../js/sim/world-state.js`](../js/sim/world-state.js) `snapshot()` + emit sites, [`../js/render/renderer.js`](../js/render/renderer.js) `_consumeEffects` + rain `setDrawRange` + fog `near` lerp |
| ICD-02 (Rival ↔ World) | v0.2.2 — Evening Star SCAVENGE/RAID state machine + `RivalStatusView` posture + `raid_succeeded`/`raid_wiped` §Notes (PR-A in-PR bump) | [`../js/sim/evening-star.js`](../js/sim/evening-star.js), [`../js/sim/world-state.js`](../js/sim/world-state.js) `_reconcileIntent` · `_pruneDeadUnits` |
| ICD-03 (Unit ↔ Pathfinder) | v0.2 — unchanged | [`../js/sim/pathfinder.js`](../js/sim/pathfinder.js) |
| ICD-04 (Save Schema) | v0.1.1 — `rng_seed` live PRNG state · `lead_spawner` block · `run_stats` block · `'late-edition.scores.v1'` separate key + `HighScoreBlobV1` (0.10.0) | [`../js/sim/save.js`](../js/sim/save.js), [`../js/sim/lead-spawner.js`](../js/sim/lead-spawner.js) `snap()` + `fromSnap` |
| ICD-05 (Story Lifecycle) | v0.4.1 — `AUTO_PLATE_SENTINEL` + ink plate-time gate §Notes (PRE-0.7) | [`../js/sim/world-state.js`](../js/sim/world-state.js) `_handleArrival`, `_fireDebrief` |
| ICD-06 (Print Cycle) | v0.4 — 30 s minimum debrief wording (PRE-0.10) | [`../js/sim/cycle-clock.js`](../js/sim/cycle-clock.js), [`../js/sim/world-state.js`](../js/sim/world-state.js) `subscribeCycle` |
| ICD-07 (Audio Bus) | v0.1 — channels + ducking + press-silence beat + FxEvent ↔ SFX cue-table (PRE-0.10) | no consumer yet (first caller is Tier-1's audio milestone) |

Findings keyed to METHODOLOGY §3.1.1 classification — only for items
introduced/affected by 0.10.0 / 0.10.1 / 0.10.2 (the three shipped
milestones since the post-0.9 re-eval). Earlier-milestone findings were
classified in [`re-eval-after-0.9.md`](re-eval-after-0.9.md) §1; this
section does not re-litigate them.

### Drift (interface, code-from-arch, arch-silent)

**None at the contract level.** All seven ICDs survived 0.10.x
code-aware re-read with zero interface drift. Constraint #4 was honored
across the three shipped milestones:

- 0.10.0 bumped ICD-01 v0.6 → v0.6.1 in-PR (`BuildingKind` widens for
  `'branch_bureau'`) and ICD-04 v0.1 → v0.1.1 in-PR (`rng_seed` semantics
  + `lead_spawner` + `run_stats` + `'late-edition.scores.v1'` key).
- 0.10.1 — no ICD bumps (onboarding was carried by `tutorial.js` + the
  renderer-local pan/zoom and the real-time slow-mo state, all derived
  from existing `WorldFrame` fields).
- 0.10.2 bumped ICD-01 v0.6.1 → v0.6.2 in-PR (`rain.intensity` range
  comment widen; §Notes pin of the sim-side rain + fog ramp).

Spot-check evidence:

- **`WorldFrame.effects` end-to-end (ICD-01 v0.6 `FxEvent` union).** Five
  of six vocabulary kinds wire at 0.10.2 — `pickup` / `verify` / `print`
  / `death` / `raid_warning` all emit from the five named sim sites
  ([`../js/sim/world-state.js`](../js/sim/world-state.js) `_handleArrival`
  for `pickup` and `verify`, `_fireDebrief` for `print`, `_pruneDeadUnits`
  for `death`, `_reconcileIntent` for `raid_warning`). Renderer drains
  the queue per-frame in [`../js/render/renderer.js`](../js/render/renderer.js)
  `_consumeEffects`. The sixth kind (`'flash'`) is the documented
  reserved slot for future photog FX — the union shape stays correct;
  the producer wires when a Tier-1 caller wants it (no ICD bump needed,
  the kind is already in the union per ICD-01 v0.6).
- **`BuildingKind` ∋ `'branch_bureau'` (ICD-01 v0.6.1).** Branch Bureau
  spawns at the Hillside spawn rect in
  [`../js/sim/world-state.js`](../js/sim/world-state.js); the
  `isBureauFamily()` predicate gates both Bureau kinds for the
  reporter-drop / photog-pickup grammar; branch destruction is silent on
  `CYCLE_GAME_OVER` per the single-fail-state strong-band line.
- **ICD-04 v0.1.1 `lead_spawner` + `run_stats` blocks.** Round-trip via
  [`../js/sim/save.js`](../js/sim/save.js) (`world.leadSpawner?.snap()` +
  `runStats` blob); `LeadSpawner.fromSnap` restores the per-district
  accumulators so the spawn cadence survives reloads. The separate
  `SCORES_KEY = 'late-edition.scores.v1'` is read/written outside
  `SaveBlobV1` so high scores persist across runs even on a fresh save
  reset. Tested under [`../tests/high-scores.test.mjs`](../tests/high-scores.test.mjs)
  and [`../tests/save-load.test.mjs`](../tests/save-load.test.mjs).
- **`LeadSpawner` ↔ ICD-04 §Notes determinism.** The spawner draws from
  a `SeededRng` owned by `World`; ICD-04 v0.1.1's `rng_seed` carries the
  live PRNG state per the PRE-0.10 amendment, and headlines synthesize
  deterministically because [`../js/sim/headlines.js`](../js/sim/headlines.js)
  takes the same rng instance handed through. Save round-trip preserves
  the rng state — the §Notes determinism contract is honored end-to-end.
- **`FxEvent` queue lifecycle.** [`../tests/world-frame.test.mjs`](../tests/world-frame.test.mjs)
  asserts the drain semantics (queue empties post-snapshot); the five
  new effects test files at 0.10.2 cover producers; the renderer's
  `_consumeEffects` covers consumers. The drained-queue rule (one-frame
  lifetime) from ICD-01 v0.6 §Notes is the binding contract — both
  sides comply.
- **CycleClock vocabulary unchanged at 0.10.x.** No new event kinds; the
  ramps (rain + fog) compute sim-side from `cycle.remainingMs` per the
  PRE-0.10 §Notes paragraph (audit C-06 resolved without a new
  `CycleEvent`).

### Drift below the ICD layer (design-doc-to-code, acknowledged)

Two carried forward from the post-0.9 audit; both are deferred work
flagged with §Notes coverage already.

1. **`UnitView.stats` and `LeadView.district` authored but not yet
   projected.** ICD-01 v0.6 (PRE-0.10) authored both fields; the
   `snapshot()` projection at [`../js/sim/world-state.js`](../js/sim/world-state.js)
   omits them at 0.10.x because no HUD region consumes them yet. The
   v0.6 contract permits `undefined` for `UnitView.stats`
   (only Reporter carries the trio); for `LeadView.district` the field
   is "lifted from sim-layer `Story.district`" — sim has the value,
   projection is the trivial step. **Both pending fields ship the first
   time a Tier-1 HUD surface (named Reporters or per-district Story
   queue) needs them.** Not a contract violation — the render-only
   projection rule's near-horizon allowance (ICD-01 v0.5 §Notes) covers
   this exactly. Pin to milestone 1.x.
2. **30 s minimum debrief gate not yet wired.** ICD-06 v0.4 specifies
   *"30 s minimum debrief animation; dismissable after the minimum
   elapses (Design Doc §19)"* (audit C-05). The wording bump shipped at
   PRE-0.10; the code-side gate in [`../js/debrief-panel.js`](../js/debrief-panel.js)
   + the matching unmount logic in [`../js/main.js`](../js/main.js)
   was deferred from 0.10.2 (the PR-D scope was visual feedback, not
   pacing). **Pin to milestone 1.0 as a mechanical-line item** —
   ICD-06 v0.4 is the binding spec, the gate is the missing implementer.

### Decision-embedded-in-comments

Three observations from 0.10.x. None require extraction — all are
absorbed by an existing ICD or §Notes paragraph.

1. **`flash` FxEvent reserved slot** — [`../js/render/renderer.js`](../js/render/renderer.js)
   carries the *"reserved for future co-emit with `verify` — no Tier-0
   visual"* comment near the FX-mesh dispatch. The ICD-01 v0.6 union
   already lists all six kinds, so the comment is just a navigation aid
   for the next reader. No promotion needed.
2. **Branch Bureau fail-state exclusion** —
   [`../js/sim/world-state.js`](../js/sim/world-state.js)
   `_checkPressDestroyed` documents that only the main Bureau drives
   `CYCLE_GAME_OVER`; branch destruction is silent. This is the
   strong-band single-fail-state commitment (overview line 28) made
   concrete in code; the comment cites the line. No promotion needed.
3. **Rain + fog ramp sim-side sourcing** —
   [`../js/sim/world-state.js`](../js/sim/world-state.js) `snapshot()`
   comments the ramp computations as cycle-time projections rather than
   new `CycleEvent` kinds. This is the substance of the ICD-01 v0.6.2
   §Notes paragraph (audit C-06); the code comment mirrors the spec.
   No promotion needed.

### Missing-test-for-arch-claim

All Tier-0 strong-band claims have coverage at the 0.10.x level:

| Claim | Status after 0.10.x | Evidence |
|---|---|---|
| Single fail-state — Press @ 90 HP | **Tested at 0.10.0** | [`../tests/branch-bureau.test.mjs`](../tests/branch-bureau.test.mjs) confirms branch destruction does NOT trigger `CYCLE_GAME_OVER`; [`../tests/press-hp.test.mjs`](../tests/press-hp.test.mjs) confirms main Bureau HP=0 does. The PR-A repair rule shipped per the post-0.9 audit. |
| HUD corkboard layout | **Tested.** | [`../tests/hud.test.mjs`](../tests/hud.test.mjs) covers the three region projectors; 0.10.x added no new HUD layout shape. |
| Lead → Story lifecycle | **Tested at 0.10.0** | [`../tests/lead-spawn.test.mjs`](../tests/lead-spawn.test.mjs) covers the spawner; rows 1-5 of ICD-05 stay lit. |
| Save = single localStorage JSON | **Tested at 0.10.0** | [`../tests/save-load.test.mjs`](../tests/save-load.test.mjs) round-trips the v0.1.1 fields including `lead_spawner` accumulators + `run_stats` deltas. |

No demotions warranted on the strong-band table.

### Arch-silent-on-code

One pattern from 0.10.x worth a documented home.

1. **"Authored-but-deferred-projection" pattern.** Both `UnitView.stats`
   and `LeadView.district` exist in ICD-01 v0.6 but don't surface from
   `snapshot()` at 0.10.x because no current HUD region reads them. The
   render-only projection rule's near-horizon allowance (ICD-01 v0.5
   §Notes) was tightened post-0.3 to *"…within the next-N window"* —
   these two fields trip a borderline case where the *contract* is
   authored ahead of the *projector* by exactly one milestone window.
   This is fine (and was the point of PRE-0.10's forward-author
   discipline), but the pattern deserves a single sentence in ICD-01's
   §Notes so the next reader doesn't read the empty fields as drift.
   **Action: schedule a one-line ICD-01 v0.6.2 → v0.6.3 §Notes
   addition into PRE-1.0**, alongside the `UnitView.stats` projector
   wiring (the gate that makes the rule un-borderline). Not a re-eval
   deliverable.

## 2. Structural pass

Reviewed [`00-overview.md`](00-overview.md) against shipped 0.7–0.10.2
reality. The post-0.9 re-eval already covered 0.7–0.9; this pass focuses
on the band-tier transition itself.

### The Tier-0 → Tier-1 gate fires

Per METHODOLOGY §3.2, the band-tier transition slot is the moment to:
(a) confirm Tier-0 strong-band claims are fully covered in code +
tests, (b) promote any Tier-1-load-bearing commitments out of medium /
fuzzy ahead of their first caller, (c) refresh the discussion-doc
status, (d) schedule the first Tier-1 paper slot.

**Tier-0 strong-band claims:** all ten lines in `00-overview.md`
§Strong have a shipped + tested caller at 0.10.2. The vertical slice is
closed. The gate condition is met.

### Strong band — one new promotion

| Commitment | Status after 0.10.x |
|---|---|
| The print cycle (12 min/edition) | Tested. Unchanged. |
| Five resources | Tested. Unchanged. |
| Single fail-state — Press @ 90 HP | Tested at 0.10.0 (branch exclusion). Repair rule shipped at PR-A. |
| Cel-shaded toon pipeline | Preserved byte-for-byte through 0.10.x. |
| Camera + input model | Full §13 surface lit at 0.10.1 (WASD pan + Block zoom + slow-mo). |
| Reporter unit core | Unchanged. |
| Lead → Story lifecycle | All five rows tested; spawner now produces leads continuously. |
| Save = single localStorage JSON | v0.1.1 fields round-tripped; high-score key separate. |
| Browser-only single-player MVP | Preserved. No netcode/auth/backend. |
| HUD corkboard layout | Tested. Unchanged (promoted at post-0.9). |

**One band-table edit this re-eval:**

- **Arc framework (story engine — three-tier shape · slot grammar · spawn
  engine)** — currently sits in [`00-overview.md`](00-overview.md) line
  54 as Fuzzy (*"8 authored arcs · Framework is medium (§18 spec);
  actual arc content (headlines, branches) is fuzzy until late-T1/T2"*).
  **Promote the framework to strong.** The three Tier-0 substrate
  modules ([`../js/sim/headlines.js`](../js/sim/headlines.js) §18 slot
  grammar · [`../js/sim/districts.js`](../js/sim/districts.js) §16
  district-as-data · [`../js/sim/lead-spawner.js`](../js/sim/lead-spawner.js)
  §19 spawn rate + tier roll + decay) implement the three-tier
  arc-framework shape end-to-end at the Whisper level. The
  **Investigation 3-step chain** and the **eight authored Arcs** stay
  medium / fuzzy respectively — those are Tier-1 / Tier-2 content
  authoring, not framework. The Whisper substrate is the *framework
  that the chains and arcs hang off of*, and it is now load-bearing for
  every Tier-1 story milestone (Investigation chain wiring, Arc trigger
  conditions, Observer counter-narrative slots).

  Per the N=3 horizon rule, strong applies through milestone 1.2 (or
  whatever the third Tier-1 milestone numbers as).

  *The "Story slot grammar" medium line at [`00-overview.md`](00-overview.md)
  line 44 is subsumed by this promotion* — the grammar is part of the
  framework, and the framework is now strong. Strike-through the
  medium row in the same edit.

### Medium band

| Line | Decision |
|---|---|
| Full 8-building catalogue (line 41) | **Tighten — 3 of 8 lit (Bureau, Branch Bureau, Darkroom).** Switchboard is the next Tier-1 implementer (Design Doc §10 line-of-sight intel), scheduled for ICD-08 at PRE-1.0. Stay medium until the switchboard milestone enters the N-window. |
| Full 6 unit types (line 42) | Stay medium. Five of six lit (Reporter, Photog, Editor, Goon, Fixer); Tipster/Stringer are Tier-1+ (audit G-02 carried forward). |
| Rival AI state machines (line 43) | **Tighten — partial promotion confirmed.** Evening Star is strong (since 0.6.1 re-eval). **Herald + Observer enter the N-window** with the Tier-1 opener — schedule ICD-02 v0.3 at PRE-1.0 per §3 below. |
| Story slot grammar (line 44) | **Subsumed by arc-framework promotion** (see Strong band above). Strike-through the medium row. |
| First-pass balancing numbers (line 45) | Stay medium. Promotion gate is playtest, not implementation. The 0.10.x shipped numbers are the §19 starting points; they will move during the playtest pass that runs alongside Tier-1 content authoring. |
| Heat economy thresholds 40/60/80 (line 47) | Stay medium. Same reasoning as line 45. |

### Fuzzy band

The Tier-1 entry pulls three lines closer:

- **18+ districts of the canonical city** (line 53) — two of 18 lit at
  0.10.0 (Docks, Hillside). Stay fuzzy; per-district content authoring is
  Tier-1 / Tier-2 content work, not architecture.
- **8 authored arcs** (line 54) — **content** stays fuzzy. The
  **framework** is promoted to strong (above). Re-word the line:
  *"Eight hand-written arcs · authoring content stays fuzzy until late
  T1/T2 · framework promoted to strong post-Tier-0 RE-EVAL."* The framework
  promotion is the relevant near-term gate.
- **Tech tree branches (Yellow / Establishment)** (line 55) — stay
  fuzzy. Branch-detection heuristic is parked in
  [`../discussion/yellow-establishment-branch.md`](../discussion/yellow-establishment-branch.md);
  Tier-1 promotion gates the heuristic when an end-arc milestone enters
  the N-window. No movement at this re-eval.
- **Audio system at large** (line 59) — ICD-07 v0.1 authored at PRE-0.10.
  Stay fuzzy on engine selection + asset pipeline; the contract surface
  is now in hand for the first Tier-1 caller.

### Discussion docs

Two status changes this re-eval:

1. **[`observer-violence.md`](../discussion/observer-violence.md)** —
   moves from `parked behind first-consumer milestone (Tier-1+)` to
   `pre-PRE-1.0 input · Observer state-machine authoring will settle
   the "fund-the-Observer" question per discussion §03`. The Observer's
   §DESPERATE state in [`../design/rival-ai-spec.html`](../design/rival-ai-spec.html)
   line 750 (`PARTNER_REQUEST` for $500 keeping the Observer alive)
   is the design-doc precedent the discussion doc should reconcile with
   at PRE-1.0.
2. **[`yellow-establishment-branch.md`](../discussion/yellow-establishment-branch.md)**
   — stays `parked behind first-consumer milestone`. Tech-tree branch
   detection is not Tier-1 opener scope; the heuristic lands when an
   end-arc milestone enters the N-window. No movement.

The four discussion docs settled at prior re-evals (tutorial /
difficulty / rival-state visibility / accessibility) stay where they
landed.

## 3. Forward ICD presence check (next-N window: PRE-1.0 / 1.0)

Per METHODOLOGY §3.1, every `[strong]` milestone inside the next-N
window must have its ICDs authored to the level the band claims.

| Milestone | Required ICDs | Status | Action |
|---|---|---|---|
| **PRE-1.0** | Itself the paper slot — authors ICD-02 v0.3 + ICD-08 + ICD-09 + ICD-10 + the one-line ICD-01 §Notes addition from §1.5 above. | Slot is the action. | Schedule below. |
| **1.0** — Tier-1 opener (Herald + Observer first-pass · Switchboard line-of-sight intel · Archive / inter-edition story state · `UnitView.stats` projector for named Reporters · 30 s debrief gate) | ICD-02 v0.3 (Herald + Observer state machines lifted from [`../design/rival-ai-spec.html`](../design/rival-ai-spec.html) §03 + §05), ICD-08 (Switchboard contract), ICD-09 (Archive / inter-edition story state), ICD-10 (Arc framework formalization), ICD-01 v0.6.3 §Notes (authored-but-deferred-projection rule), ICD-06 v0.4 gate (already authored — code-side ships at 1.0) | **Not code-ready.** Four new contract surfaces authored only at design-HTML depth; ICD-02 v0.2.2 covers Evening Star only; the projection rule's borderline case has no §Notes home yet. | **Schedule PRE-1.0.** Authors the four-plus bumps below. |

### Scheduled paper slot — PRE-1.0

A single architecture session, paper-only, no code. Authors:

1. **ICD-02 v0.2.2 → v0.3** — Herald + Observer state machines lifted
   from [`../design/rival-ai-spec.html`](../design/rival-ai-spec.html)
   §03 (Herald FIG. H1, five states `LURK`/`COURT`/`WIRED`/`PUNISH`/
   `BUYOUT`) and §05 (Observer FIG. O1, five states `WATCH`/
   `INVESTIGATE`/`WARN`/`DESPERATE`/`SILENCED`). Mirror the Evening
   Star pattern at v0.2.2: transition table, tick rate (Herald
   1/edition · Observer 1/2 editions per rival-ai-spec.html line 382),
   intent vocabulary additions (`COURT_WIRE_DEAL` · `PUBLISH_COUNTER`
   · `PARTNER_REQUEST` · `INVESTIGATE_LEAD`), `RivalView` past-intents
   coverage, `RivalStatusView` posture mapping (Herald's
   `LURK`/`COURT`/`WIRED` → calm; `PUNISH`/`BUYOUT` → scheming;
   Observer's `WATCH`/`INVESTIGATE` → calm; `WARN`/`DESPERATE` →
   scheming; `SILENCED` → calm). The interaction matrix (rival-ai-spec.html
   §06) becomes the §Notes paragraph for inter-rival event handling.
2. **ICD-08 (new) — Switchboard contract**. Authors the line-of-sight
   intel surface from Design Doc §10 line 1088 (*"Goons appear from
   district edges, walk to the bureau, and try to enter. You see them
   on the map only if you have a switchboard with line-of-sight,
   otherwise the first you know is a window breaking. Information about
   the threat is itself a defense resource."*). Contract shape:
   - `Switchboard` is a `BuildingKind` widening of ICD-01 (`'switchboard'`).
   - **Visibility projection rule:** the existing `WorldFrame.units`
     filter at the snapshot layer becomes posture-driven —
     `RivalIntentView.eta_ms` + goon-spawn `pos` surfaces only when at
     least one `'switchboard'` building's LoS rect contains the goon's
     tile. **No new top-level WorldFrame field** — extends the existing
     unit-filter rule. Defensive default: when no switchboard exists,
     `RivalIntentView.eta_ms` is `undefined` (intent visible to sim,
     not to player) until the goon enters the Bureau's 1-tile radius
     (the "window breaking" beat).
   - **LoS shape:** rectangular projection from switchboard tile per
     line-of-sight radius (medium-band number; calibrate at PRE-1.0
     against §19). Pure data computation in
     [`../js/sim/world-state.js`](../js/sim/world-state.js); no
     pathfinding cost.
   - **Save surface:** switchboard buildings round-trip via `SaveBlobV1.buildings[]`
     (existing array; ICD-04 widening is value-level only).
3. **ICD-09 (new) — Archive / inter-edition story state**. Authors the
   story persistence contract from Design Doc §05 (*"Stories live in
   your archive until you commit them to the next edition"*) + §17
   (save spec names archive as one of the seven blob fields). The
   current ICD-05 v0.4.1 §Purpose explicitly defers archive
   (*"a separate archive state out of scope for the vertical slice"*);
   the Tier-1 opener needs the deferral lifted. Contract shape:
   - **New `Story.state` value:** `'archived'`. Transition rule:
     `verified → archived` (player explicit hold; Editor skips during
     ink-gate plating) and `archived → verified` (player explicit
     release, re-enters plating queue next edition). Distinct from
     `verified` because archived stories are pinned across editions
     and do not count toward the deadline plating queue.
   - **HUD surface:** the dossier's "Story queue" region grows an
     `archived` count alongside `verified` (single-line addition; no
     new dossier region). Visible per-edition; no separate archive
     screen.
   - **Save surface:** existing `SaveBlobV1.stories[]` array already
     round-trips story state — value-level widening only; ICD-04 v0.1.1
     §Per-record §Story value-set carries the new `'archived'` enum
     value.
   - **Lifecycle decay:** archived stories age but do not auto-expire
     at 180 s like leads do. Cap on archive size: TBD at PRE-1.0
     (Design Doc §05 silent; balance-band).
4. **ICD-10 (new) — Arc framework formalization**. Lifts the §18 spec
   into a code-ready contract now that the substrate is shipping. Shape:
   - **`StoryArc` record:** trigger conditions (world-state predicate
     against districts / heat / rival posture), episode list (ordered),
     per-episode branch table (2-3 way choice → next-episode-id or
     terminal-state). Pure data shape; engine binding lives in the
     spawner.
   - **`Investigation` (3-step chain) shape:** Tier-1's
     mid-game-bread-and-butter mechanic from Design Doc §18 line 1370.
     Story spawned with `tier: 'investigation'` may emit a follow-up
     `Story` on verification (deterministic per the spawner's rng) —
     the §Per-story `parent_story_id` field links the chain. The
     authored-but-deferred `tier: 'arc'` collapse to `'investigation'`
     in [`../js/sim/lead-spawner.js`](../js/sim/lead-spawner.js) line
     101 reads as the placeholder for ICD-10's `'arc'` value.
   - **Arc trigger condition vocabulary:** small reusable predicates
     (`heat_above`, `district_uncovered`, `observer_silent_n_editions`,
     `rival_state`). Per the rival-ai-spec.html §07 interaction matrix,
     rivals can read each others' state — arc triggers can too.
   - **§18 line 1397-1407 example (THE LONGSHOREMAN STRIKE)** is the
     spec-validation reference; ICD-10 ships the shape, the first
     authored arc lands at milestone 1.1 or 1.2 (content slot).
5. **ICD-01 v0.6.2 → v0.6.3 — single §Notes addition** for the
   "authored-but-deferred-projection" pattern (§1.5 above). One sentence
   pinning the rule's borderline case to the next-N window.

Plus two roadmap-shape commitments folded into the same slot:

6. **Confirm Tier-1 opener (milestone 1.0) scope.** The PRE-1.0 session
   ratifies whether milestone 1.0 ships Herald or Observer first (or
   both) — §3.5 Q1 below frames the choice. Mileage 1.0's scope is the
   first-Tier-1-code-session-worth of contracts authored at PRE-1.0;
   PRE-1.0 picks.
7. **Open one Gitea ticket** for PRE-1.0 paper (`docs` label). Milestone
   1.0 ticket is held until PRE-1.0 closes and ratifies the opener's
   scope — don't pre-commit to a code-session ticket shape PRE-1.0 will
   decide.

PRE-1.0 ships at v0.10.4 paper-only patch following the PRE-0.7 /
PRE-0.8 / PRE-0.10 precedents. This PR (the one that lands this re-eval
doc + the band-table edit + the roadmap rewire + the one ticket) is
**v0.10.3 — re-eval landing**, not PRE-1.0 itself. PRE-1.0 is the *next*
paper PR; this one is its scheduler. (Same pattern as v0.9.2 re-eval
landing → v0.9.4 PRE-0.10 → v0.10.0 milestone 0.10 code.)

## 3.5 Open questions

Two questions surfaced by the Tier-1 entry — both rivals-shaped (the
Tier-1 opener's load-bearing content is the second + third rivals
coming online), one arc-shaped.

### Q1: Tier-1 opener — Herald first, Observer first, or both?

The post-0.9 audit and the design HTMLs are ambiguous on the order. The
rival-ai-spec.html §08 arc graph (lines 855-867) describes a phased
arrival:

> "Editions 1–5. Only the Evening Star is meaningfully present. …
> Editions 6–12. … Herald appears in COURT if player heat climbs.
> Observer makes first appearance around Ed. 10, quiet at first."

That phasing is *in-run* (the rivals appear at different in-game
deadlines), not *across-milestones*. Both Herald and Observer code
need to ship at the same milestone for the in-run phasing to land.

Three readings:

- **(a) Herald only at 1.0; Observer at 1.1.** Lighter per-session
  scope. Lets ICD-02 v0.3 author Herald's five states alone, defer
  Observer to v0.4. But Herald's COURT state is the only
  Herald→player interaction surface; without Observer the player has
  no second-rival pressure beyond Evening Star raids, and the rival-
  AI-spec's "triangle" reading collapses to a "raid + offer" mechanic.
- **(b) Observer only at 1.0; Herald at 1.1.** Observer is more
  mechanically rich at first contact (counter-narratives published
  next to player's, Tier-IV "Frame the Observer" arc). But Observer
  doesn't trigger until Ed. 10 in-run; opening 1.0 with a rival that
  takes 10 editions to first-appear means the milestone's verifiable
  beats are all at the long-run end of testing.
- **(c) Both at 1.0.** Bigger scope but the rivals share infrastructure
  (the v0.3 §RivalView projection, the §RivalStatusView posture map,
  the §Per-tick contract vocabulary). Authoring both at PRE-1.0
  duplicates state-machine wireframes; shipping both at 1.0 means
  one code session against ICD-02 v0.3's full shape instead of two
  half-sessions against v0.3 / v0.4.

**Verdict: (c) both at 1.0**, with split-into-1.0.0 / 1.0.1 at session
open if scope creeps (0.7 / 0.10 precedents). The triangle is the
design's load-bearing rival shape; shipping it half-formed means
playtesting against a wrong-shape adversarial ring for an entire
milestone window. PRE-1.0 authors ICD-02 v0.3 with both rivals'
state machines; milestone 1.0 wires both.

The §3.5 Q2 carryover from the post-0.9 re-eval (the `raid_succeeded` /
`raid_wiped` vocabulary addition that shipped at PR-A as ICD-02 v0.2.2)
is the precedent: when a rival's contract enters the N-window, the full
state machine ships in one paper slot.

### Q2: Switchboard ICD-08 — first caller alongside the rivals, or a later 1.x slot?

The switchboard is the *intel* defense (Design Doc §10) that gates
visibility of goon raids. Herald + Observer don't raid (only Evening
Star does), so switchboard's first-caller is **Evening Star's existing
raid loop**, not the two new rivals. The switchboard contract can ship
at PRE-1.0 alongside ICD-02 v0.3 without milestone 1.0 needing to wire
it — the building becomes available, the visibility rule extends to
include LoS-from-switchboard, but the player can ignore it for the
opener.

Three readings:

- **(a) ICD-08 ships at PRE-1.0; switchboard building ships at 1.0
  alongside the rivals.** Bundled. Most natural — the rival entries
  and the intel-defense building are the same Tier-1 opener "the
  adversarial ring matures" beat.
- **(b) ICD-08 ships at PRE-1.0; switchboard building ships at 1.1 or
  later.** Decoupled. Lets 1.0 stay focused on rivals; the building
  arrives when its caller (a player who wants raid ETA visibility)
  arrives.
- **(c) Defer ICD-08 entirely** to a later paper slot.

**Verdict: (a) bundled.** Per the design HTML's framing — *"Information
about the threat is itself a defense resource"* — the switchboard *is*
the player's response to a maturing adversarial ring. Shipping rivals
without the visibility surface means the opener tests against the
"first you know is a window breaking" defaults, which is the harder
read; bundling switchboard gives the player the contract surface to
respond. PRE-1.0 authors ICD-08; milestone 1.0 wires both.

### Q3: Archive ICD-09 — opener scope or post-opener scope?

The current ICD-05 v0.4.1 §Purpose defers archive explicitly. The
Tier-1 opener doesn't *strictly* need archive — players can keep
verified stories indefinitely under the existing ink-gate retry rule
(rejected stories stay `verified` and try again next edition). But the
ink-gate retry rule is a *defensive* archive (the story can't print
this edition), not an *intentional* archive (player explicitly holds
the story).

Two readings:

- **(a) ICD-09 ships at PRE-1.0; archive UI ships at 1.0.** The
  intentional-archive beat is design-load-bearing — *"Stories live in
  your archive until you commit them to the next edition"* (§05) is
  one of the lines that distinguishes Late Edition from a tower
  defense.
- **(b) ICD-09 defers to PRE-1.x; archive UI defers to 1.x.** Tier-1
  opener stays focused on rivals + switchboard; archive arrives when
  its caller (an authored arc that *requires* multi-edition holds)
  arrives.

**Verdict: (a) ICD-09 ships at PRE-1.0, archive UI ships at 1.0** —
because the *Investigation chain* (ICD-10's 3-step mechanic) requires
inter-edition story state to chain. Without ICD-09, ICD-10's
investigation-spawned follow-up leads have no place to live between
parent verification and child resolution. Bundling archive + arc
framework at PRE-1.0 makes the Tier-1 story-engine surface complete.

## 4. Roadmap label updates

1. **Tick** the "RE-EVAL Tier-0 → Tier-1" row ([`../roadmap.md`](../roadmap.md) line 38).
2. **Insert** a new `PRE-1.0` row above the post-Tier-0 future entries:
   `PRE-1.0 | Author **ICD-02 v0.3** (Herald + Observer state machines · intent vocabulary · posture mapping) + **ICD-08** (Switchboard line-of-sight contract, new) + **ICD-09** (Archive / inter-edition story state, new) + **ICD-10** (Arc framework formalization, new) + ICD-01 v0.6.3 §Notes addition | Architecture session · paper-only · gates milestone 1.0 | strong`.
3. **Insert** a `1.0` sketch row below PRE-1.0:
   `1.0 | Tier-1 opener — Herald + Observer wired · Switchboard building · Archive UI · `UnitView.stats` projector for named Reporters · 30 s debrief gate (ICD-06 v0.4 code-side) | Couples to PRE-1.0 contract authoring; split 1.0.0/1.0.1 at session open per 0.7/0.10 precedent | strong`.
4. **Advance** the "Current status" block: v0.10.2 shipped; v0.10.3 ships
   the re-eval (this PR); PRE-1.0 is the next paper slot.
5. **Append** a `- [x] **RE-EVAL Tier-0 → Tier-1**` history entry below
   the v0.10.2 entry, mirroring the v0.9.2 entry's shape, citing this
   document.

## 5. Out of scope (preserved boundaries)

- **No JS / test changes** in this session — strict paper-only per
  [`../AGENTS.md`](../AGENTS.md) §Hard rules and METHODOLOGY §3.2. The
  pending Tier-1 implementation items (30 s debrief gate · `UnitView.stats`
  projector · `LeadView.district` projector · Herald + Observer wiring ·
  switchboard building · archive UI) all wait on their milestone tickets.
- **ICD-02 v0.3 / ICD-08 / ICD-09 / ICD-10 authoring** — surfaced here,
  scheduled to PRE-1.0 (paper-only) per the surface-and-schedule
  pattern.
- **ICD-01 v0.6.2 → v0.6.3 §Notes addition** — surfaced here,
  scheduled to PRE-1.0 as a folded-in edit.
- **Milestone 1.0 Gitea ticket** — held until PRE-1.0 ratifies the
  opener's scope. This PR opens only the PRE-1.0 paper ticket.
- **Tech tree branches (Yellow / Establishment)** — stay fuzzy. The
  detection heuristic is parked in
  [`../discussion/yellow-establishment-branch.md`](../discussion/yellow-establishment-branch.md);
  promotion gates on a Tier-1+ end-arc milestone, not the Tier-1
  opener.
- **Procedural city generation, MP, accounts, cloud saves** — stay
  fuzzy at Tier-1. Post-MVP; architecture's job is still to not
  foreclose, not to author.
- **Audio system at large** — stay fuzzy on engine selection + asset
  pipeline. ICD-07 v0.1 is the contract surface; first caller is
  Tier-1's audio milestone (TBD scheduling against the rival opener).

## 6. Summary

- **Seven ICDs intact.** Fifteen code milestones in (0.1 → 0.10.2,
  counting 0.7.0/0.7.1 and 0.10.0/0.10.1/0.10.2 as separate sessions),
  zero interface drift. Constraint #4 honored every time including
  the 0.10.0 (ICD-01 v0.6.1, ICD-04 v0.1.1) and 0.10.2 (ICD-01 v0.6.2)
  in-PR bumps. The methodology continues to work.
- **Two design-doc-to-code drifts carried forward** from the post-0.9
  audit: `UnitView.stats` / `LeadView.district` authored-but-deferred
  projections (ship at milestone 1.0 alongside named Reporters + the
  per-district Story queue dossier surface), and the 30 s minimum
  debrief gate (ICD-06 v0.4 wording shipped; code-side gate ships at
  milestone 1.0).
- **One pattern surfaced** — "authored-but-deferred-projection" —
  borderline case in the render-only projection rule's near-horizon
  allowance. One-line §Notes addition scheduled to PRE-1.0 as ICD-01
  v0.6.3.
- **One band promotion:** arc framework Fuzzy → Strong (overview line
  54 → §Strong; line 44 "Story slot grammar" subsumed and struck). The
  three Tier-0 substrate modules (`headlines.js` + `districts.js` +
  `lead-spawner.js`) are the load-bearing evidence; Investigation
  chains + the eight authored Arcs remain medium / fuzzy as content
  authoring rather than framework.
- **One band tightening:** "Rival AI state machines" (line 43) —
  Herald + Observer enter the N-window with the Tier-1 opener;
  ICD-02 v0.3 scheduled to PRE-1.0 authors both.
- **One discussion-doc move:** [`observer-violence.md`](../discussion/observer-violence.md)
  becomes a pre-PRE-1.0 input (Observer §DESPERATE state from
  rival-ai-spec.html line 750 is the design-doc precedent to reconcile).
- **One scheduled paper slot — PRE-1.0** — authors ICD-02 v0.3
  (Herald + Observer state machines) + ICD-08 (Switchboard, new) +
  ICD-09 (Archive, new) + ICD-10 (Arc framework, new) + the one-line
  ICD-01 §Notes addition. Gates milestone 1.0. Ships at v0.10.4.
- **Tier-1 opener scope ratified directionally:** Herald + Observer
  + Switchboard + Archive UI + the two deferred projectors + the
  30 s debrief gate, all at milestone 1.0; split 1.0.0/1.0.1 at
  session open per 0.7 / 0.10 precedent if scope creeps. PRE-1.0
  ratifies the exact contract surface.
- **1.0 is gated by PRE-1.0.** Once PRE-1.0 ships, milestone 1.0
  opens as a code session with all required ICD bumps in hand.

The contracts carried the Tier-0 vertical slice with zero drift. The
gap between the codebase and the design package today is **rival
texture** (Herald + Observer) plus **intel + persistence surfaces**
(switchboard + archive) plus **arc engine** (the framework that hangs
the eight authored arcs and the Investigation chains off the Whisper
substrate). PRE-1.0 hands milestone 1.0 the four contract surfaces
that turn *the loop reads as a game* into *the city reads as a
newspaper noir RTS.*
