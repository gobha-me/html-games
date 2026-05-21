# RE-EVAL after 0.6 — paper + code-aware session

**Slot:** [`../roadmap.md`](../roadmap.md) line 26 — *"After 0.6 · paper +
code-aware · Does the loop play? Promote rival AI contract to strong for
0.7–0.8. Decide tutorial shape."*
**Scope:** [`../METHODOLOGY.md`](../METHODOLOGY.md) §3 both halves
(structural + code-aware) plus the **forward ICD presence check** for
the next-N (0.7 / PRE-0.8 / 0.8) window, plus the three open questions
the roadmap scheduled for this slot, plus three additional questions
folded in at session open (difficulty selector direction, rival-state
visibility, ink negative-balance enforcement).
**Output:** band movements, scheduled paper slots, roadmap label
updates, discussion-doc status changes, no JS.

This is the third paper-session entry in the changelog (v0.1.1 was the
first — PRE-0.2; v0.3.1 was the second — RE-EVAL after 0.3). It runs
after 0.4, 0.5, 0.6 shipped (plus the PRE-0.5 paper slot at v0.4.1) and
before 0.7 can open as a code session.

## 1. Code-aware pass

Read against the five ICDs whose first caller has shipped:

| ICD | Version | Implementing files |
|---|---|---|
| ICD-01 (World ↔ Renderer) | v0.5 — `HudState` populated by 0.5/0.6 | [`../js/sim/world-state.js`](../js/sim/world-state.js) (`snapshot()`), [`../js/hud.js`](../js/hud.js) (`apply()`) |
| ICD-03 (Unit ↔ Pathfinder) | v0.2 — `unitKind` accepted at 0.4 photog dispatch | [`../js/sim/pathfinder.js`](../js/sim/pathfinder.js), [`../js/sim/world-state.js`](../js/sim/world-state.js) (`dispatch()`) |
| ICD-05 (Story Lifecycle) | v0.3 — `lead → verified → plated → printed` rows 3/4/5 lit; yields written at plated step | [`../js/sim/world-state.js`](../js/sim/world-state.js) (`_handlePhotogArrival`, `_fireDebrief`) |
| ICD-06 (Print Cycle) | v0.2 — full event vocabulary firing; `EditionSummary` populated with non-zero deltas | [`../js/sim/cycle-clock.js`](../js/sim/cycle-clock.js), [`../js/sim/world-state.js`](../js/sim/world-state.js) (`subscribeCycle`, `_buildEditionSummary`, `ackDebrief`) |
| ICD-02 (Rival ↔ World) | v0.1 draft | no caller yet — out of code-aware scope; in scope for §3 promotion check |

Findings keyed to METHODOLOGY §3.1.1 classification:

### Drift (interface, code-from-arch, arch-silent)

**None at the contract level.** The four implemented ICDs and their
0.4–0.6 callers agree on field sets, transitions, event vocabularies,
request/response shapes, and filter rules. Constraint #4 (in-PR ICD
update on deviation) was honored:

- 0.4 bumped ICD-05 v0.2 → v0.3 in-PR (§Notes field-deltas paragraph
  for the `lead → verified` transition); ICD-01 / ICD-03 used as
  authored. No bumps in 0.5 or 0.6.
- PRE-0.5 (v0.4.1) authored ICD-06 v0.2 and ICD-01 v0.5 ahead of their
  consumers — the gap-scheduling pattern this re-eval's predecessor
  produced.

Spot-check evidence:

- **`HudState` shape (ICD-01 v0.5 §HudState) matches `snapshot().hud`
  exactly.** [`../js/sim/world-state.js:379-392`](../js/sim/world-state.js)
  builds `{ edition, deadline_ms, resources: { leads, stories, ink,
  cash, heat } }` — the locked-name order and the five resource keys
  agree with ICD-01 v0.5 §HudState (lines 147-158 of the ICD).
  [`../js/hud.js:17-30`](../js/hud.js) consumes the projection without
  reaching into sim state. The 0.6 ticker grew four resource segments
  inside a single masthead strip per the PRE-0.5 implementation note
  *"the HUD is part of the renderer's draw surface — corkboard
  layout per design doc §13"* (ICD-01 v0.5 §HudState).
- **`EditionSummary` shape (ICD-06 v0.2 §EditionSummary) matches
  `_buildEditionSummary()` exactly.**
  [`../js/sim/world-state.js:262-271`](../js/sim/world-state.js)
  returns `{ edition, stories_printed, cash_earned, ink_consumed,
  heat_applied, rival_events }` — the five field names and types
  agree with ICD-06 v0.2 lines 35-42. `stories_printed[].id` carries
  the original `Story.id` (verified under
  [`../tests/print-cycle.test.mjs:120-126`](../tests/print-cycle.test.mjs)
  with the load-bearing *"StoryDigest.id must equal original Story.id
  (ICD-05 §Purpose)"* assertion).
- **CycleEvent vocabulary (ICD-06 v0.2 §Event vocabulary) matches the
  six event kinds emitted.**
  [`../js/sim/cycle-clock.js:23-50`](../js/sim/cycle-clock.js) emits
  `CYCLE_BEGIN`, `CYCLE_TICK`, `DEADLINE_WARNING`, `DEADLINE_FIRE`;
  [`../js/sim/world-state.js:243,257-259`](../js/sim/world-state.js)
  emits `EDITION_DEBRIEF_BEGIN` and `EDITION_DEBRIEF_END`. Tested in
  [`../tests/print-cycle.test.mjs`](../tests/print-cycle.test.mjs) —
  warning fires exactly once at T-30s
  ([`:77-85`](../tests/print-cycle.test.mjs)), DEADLINE_FIRE fires
  exactly once at T-0 ([`:87-94`](../tests/print-cycle.test.mjs)),
  ackDebrief emits END→CYCLE_BEGIN in order
  ([`:150-172`](../tests/print-cycle.test.mjs)).
- **Pause-during-debrief (ICD-06 v0.2 §Open questions — resolved at
  v0.2: `CYCLE_TICK` stops between `EDITION_DEBRIEF_BEGIN` and
  `EDITION_DEBRIEF_END`)** matches
  [`../js/sim/world-state.js:189-194`](../js/sim/world-state.js)
  (`tick()` early-return on `debriefOpen`). Tested in
  [`../tests/print-cycle.test.mjs:128-148`](../tests/print-cycle.test.mjs)
  *"debrief pause: cycle clock + unit motion both freeze while debrief
  is open"*.
- **ICD-05 v0.3 §Notes "computed at plated and frozen there"** matches
  [`../js/sim/world-state.js:221-233`](../js/sim/world-state.js):
  `cash_yield` / `heat_yield` / `ink_cost` assigned at the `state =
  'plated'` step from [`../js/sim/resources.js`](../js/sim/resources.js)
  lookups, then immediately flipped to `'printed'` (auto-plate same-frame
  per the v0.5 PR's `AUTO_PLATE_SENTINEL` arrangement).
- **`Story.id` stable across all transitions (ICD-05 §Purpose "same id
  flows end-to-end")** — verified under
  [`../tests/story-pickup.test.mjs`](../tests/story-pickup.test.mjs)
  (pickup/drop) and
  [`../tests/print-cycle.test.mjs:101,120-122`](../tests/print-cycle.test.mjs)
  (debrief).
- **Render-only projection rule (ICD-01 v0.5 §Notes — tightened to
  "within the next-N window")** still enforced.
  [`../tests/world-frame.test.mjs:9-12`](../tests/world-frame.test.mjs)
  asserts exact top-level keys (eight) and exact View field sets;
  [`:71-79`](../tests/world-frame.test.mjs) actively rejects the four
  named sim-only fields (`path`, `tile`, `pathIdx`, `carryingStoryId`).
  `story.ink_cost` (new at 0.6) is sim-internal and is **not** added to
  any View — a clean win against the rule.

### Decision-embedded-in-comments

Three observations from 0.4–0.6. All three deserve documented homes;
two are already scheduled by the v0.6.0 changelog (the third is the
new arch-silent finding this re-eval picks up).

1. **Negative ink is allowed at 0.6 — "can't print if ink runs out"
   enforcement is medium-band, 0.7+.**
   [`../js/sim/world-state.js:236-241`](../js/sim/world-state.js)
   comment + [`../CHANGELOG.md`](../CHANGELOG.md) v0.6.0 §Changed
   line *"Negative ink is allowed at 0.6 (HUD surfaces the number;
   the 'can't print if ink runs out' enforcement is medium-band and
   lands at 0.7+)."* The decision the enforcement rule needs to make
   is settled in §3.5 Q6 below: **plate-time hard gate, lands with
   the Editor unit at 0.7.** Action: forward the rule into the
   PRE-0.7 paper slot (§3 below) so ICD-02 v0.2 authoring and any
   ICD-05 §Notes amendment land together.

2. **`AUTO_PLATE_SENTINEL` placeholder for the Editor unit.**
   [`../js/sim/world-state.js:41-47`](../js/sim/world-state.js):
   *"The sentinel below stands in for the real EditorId field on
   `Story.plated_by` until the Editor lands (0.6/0.7). Keeping a
   non-null marker (vs null) lets future code and tests assert 'this
   story passed through the plating step', and the eventual Editor
   unit just substitutes its UnitId in the same slot."* This is
   arch-silent-on-code: ICD-05 §Shape declares `plated_by?: EditorId`
   (line 30) but is silent about the pre-Editor sentinel. The decision
   is correctly captured *where it bites* (the assignment site) and
   the substitution path is named. Resolution: **fold a sentence into
   ICD-05 §Notes at PRE-0.7** alongside ICD-02 authoring — *"Before
   the Editor unit ships at 0.7, the verified→plated→printed
   transition auto-fires same-frame at DEADLINE_FIRE with
   `plated_by = AUTO_PLATE_SENTINEL`. The Editor's first milestone
   substitutes its `UnitId` in the same slot; the field type stays
   `EditorId`."*

3. **Pickup is a sim-internal consequence of arrival, not a new Intent
   kind (re-affirmed for photog at 0.4).**
   [`../js/sim/world-state.js:281-282`](../js/sim/world-state.js):
   *"ICD-02 (intent kinds) is untouched — pickup/drop are sim-internal
   consequences of arrival, not new dispatch verbs."* This restates
   the same finding from re-eval-after-0.3 §1 item 3 (which captured it
   for the reporter at 0.3); the photog at 0.4 hews to the same
   convention. No extraction needed — the comment is the navigation
   aid, the negative-space test in
   [`../tests/story-pickup.test.mjs`](../tests/story-pickup.test.mjs)
   is the enforcement.

### Missing-test-for-arch-claim

The three claims flagged "aligned" by re-eval-after-0.3 §1 are now
two-of-three lit:

| Claim (overview line) | Status after 0.4–0.6 | Evidence |
|---|---|---|
| The print cycle (12 min/edition) | **Lit.** | [`../tests/print-cycle.test.mjs:57-66`](../tests/print-cycle.test.mjs) asserts `hud.deadline_ms === 720_000` on a fresh `World`; [`:68-75`](../tests/print-cycle.test.mjs) asserts the clock decrements by ~30_000ms per 30s of sim time. [`../js/sim/cycle-clock.js:8`](../js/sim/cycle-clock.js) pins `DEFAULT_EDITION_MS = 720_000`. |
| Five resources (Leads/Stories/Ink/Cash/Heat) — names locked | **Lit.** | [`../tests/resources.test.mjs:59-67`](../tests/resources.test.mjs) asserts `hud.resources` shape `{ leads, stories, ink, cash, heat }` literally — the five locked names appear in test source. [`../tests/print-cycle.test.mjs:65`](../tests/print-cycle.test.mjs) re-asserts the same shape. |
| Single fail-state — Press @ 90 HP | **Still aligned.** | `hp` / `hp_max` exposed on BuildingView ([`../js/sim/world-state.js:403-412`](../js/sim/world-state.js)); `PRESS_HP = 90` exported ([`:36`](../js/sim/world-state.js)). No damage source yet — first consumer is 0.7 (Goon unit RAID). The gap remains aligned-to-milestone, not open. |

No demotions warranted — every strong-band claim with no current test
has its first testable caller inside the N+M (=10) horizon.

### Arch-silent-on-code

Two facts live in code without architecture mention. Both are
boundary cases — small enough that promotion to a standalone
architecture line is overkill, but worth a documented home.

1. **`STARTING_INK = 20` and `HEAT_DECAY_PER_EDITION = 8`** —
   [`../js/sim/resources.js:10-11`](../js/sim/resources.js). Both are
   medium-band §19 numbers per the line-44 commitment, properly
   surfaced as named exports in a pure module. They are not silent on
   architecture — overview line 44 covers them as a class. No action.
2. **The auto-plate same-frame transition at `DEADLINE_FIRE`** —
   [`../js/sim/world-state.js:215-233`](../js/sim/world-state.js).
   The transition order `verified → plated → printed` is documented
   in ICD-05 §State transitions (rows 4 and 5) but the *same-frame*
   property (no Editor unit yet, both rows fire in one tick) is
   captured only in the `AUTO_PLATE_SENTINEL` comment. This is the
   same item as Decision-in-comments #2 above and the same PRE-0.7
   action carries it.

No item large enough to promote to a standalone architecture line.
The PRE-0.7 paper slot (scheduled in §3 below) absorbs the two
sentences across ICD-05 §Notes and ICD-02 v0.2.

## 2. Structural pass

Reviewed [`00-overview.md`](00-overview.md) against shipped 0.4–0.6
reality.

### Strong band — all nine commitments survive contact

| Commitment | Status |
|---|---|
| Print cycle (12 min/edition) | Promoted from "aligned" to **tested** by 0.5 — [`../tests/print-cycle.test.mjs`](../tests/print-cycle.test.mjs). |
| Five resources — names locked | Promoted from "aligned" to **tested** by 0.6 — [`../tests/resources.test.mjs`](../tests/resources.test.mjs). |
| Single fail-state — Press @ 90 HP | Still aligned. First damage consumer is 0.7. |
| Cel-shaded toon pipeline | Preserved byte-for-byte across 0.4/0.5/0.6 — no renderer touches. |
| Camera + input model | Click-to-dispatch live since 0.2; photog selection at 0.4 inherits the reporter pattern; HUD ticker added at 0.5/0.6 read frame.hud only (no new input modes). |
| Reporter unit core | HP 2 / walk 3.5 / carries 1 lead — all preserved; `REPORTER_SPEED` shared by photog at 0.4 (per-kind costs at 0.7 per ICD-03). |
| Lead → Story lifecycle | Five-row transition table lit through row 5 (`plated → printed`). Same-id-end-to-end commitment tested at debrief. |
| Save = single localStorage JSON | Untouched. PRE-0.8 still gates it. |
| Browser-only single-player MVP | Preserved. No netcode/auth/backend introduced. |

### Medium band — no promotions warranted on the §2 lines

| Line | Decision |
|---|---|
| Full 8-building catalogue (line 40) | Stay medium. Three of eight live (Bureau, Branch — pending, Darkroom). Remaining five tighten as Tier-1 approaches. |
| Full 6 unit types (line 41) | Stay medium. Three of six approach (Reporter, Photog live; Fixer/Goon at 0.7). Editor at 0.7 absorbs the `AUTO_PLATE_SENTINEL` placeholder. |
| Rival AI state machines (line 42) | **Promote → strong** for the post-0.6 horizon (0.7–0.8). See §3.5 Q2 and §4 below. |
| Story slot grammar (line 43) | Stay medium. Headline synthesis at [`../js/sim/world-state.js:440-448`](../js/sim/world-state.js) (`storyDigest()`) is placeholder per ICD-06 v0.2's "copy from Story" note; real grammar lands with the story engine (§18). |
| First-pass balancing numbers (line 44) | Stay medium. 0.6 shipped §19 numbers as medium-band by design — promotion gate is playtest, not implementation. |
| HUD corkboard layout (line 45) | Stay medium. Ticker at 0.5/0.6 is the deliberate single-strip minimum; full layout lands at 0.9. |
| Heat economy thresholds 40/60/80 (line 46) | Stay medium. Threshold consumers (decay nuances, rival-attention triggers) are 0.7+. |

### Fuzzy band

No precondition triggered. The Tier-0 → Tier-1 RE-EVAL slot (roadmap
line 33) remains the next opportunity for fuzzy-to-medium movement
(procedural city, MP, audio asset list).

### Discussion docs

Three of the six discussion docs settled in this re-eval — see §3.5
Q3 / Q4 / Q5 below. Status changes ship in this PR.

- [`../discussion/tutorial-first-edition.md`](../discussion/tutorial-first-edition.md)
  — diegetic frame locked (Q3).
- [`../discussion/difficulty-selector.md`](../discussion/difficulty-selector.md)
  — frequency-scaling deferred to Tier-1 (Q4).
- [`../discussion/rival-state-visibility.md`](../discussion/rival-state-visibility.md)
  — partial-dossier locked with vocabulary `{calm, scheming, hostile}` (Q5).

Three remain parked:

- [`../discussion/observer-violence.md`](../discussion/observer-violence.md)
  — first consumer is Observer milestone (Tier-1+).
- [`../discussion/accessibility.md`](../discussion/accessibility.md)
  — already cited from ICD-06 (deadline non-visual cue); stays
  pre-architectural.
- [`../discussion/yellow-establishment-branch.md`](../discussion/yellow-establishment-branch.md)
  — Tier-1+ branch detection; no consumer in horizon.

## 3. Forward ICD presence check (next-N window: 0.7 / PRE-0.8 / 0.8)

Per METHODOLOGY §3.1, every `[strong]` milestone inside the next-N
window must have its ICDs authored to the level the band claims.

| Milestone | Required ICDs | Status | Action |
|---|---|---|---|
| **0.7** — Evening Star SCAVENGE+RAID, Goon unit, Press HP, Fixer unit, Editor unit | ICD-02 (rival contract — RAID_BUREAU + PASS, plus state-machine commitments now that rival AI is strong); ICD-01 (UnitView `kind` enum already lists `'goon'` and `'fixer'` since v0.2 line 75 — Editor inherits the skeleton, no field-set change); ICD-05 (no new transitions — `plated_by: EditorId` slot already authored at v0.1, sentinel substitution is a value swap; §Notes paragraph captures pre-Editor sentinel) | **Not code-ready.** ICD-02 v0.1 is medium-band draft from PRE-0.1; this re-eval promotes the band (§3.5 Q2) but the contract shape needs strong-band detail before 0.7 opens. The state-machine pseudocode in the design HTML is illustrative, not committed. | **Schedule PRE-0.7 paper slot.** Authors ICD-02 v0.2 with strong-band Evening Star SCAVENGE+RAID state machine, RAID_BUREAU goon-count policy, the `RivalView` past-intents question's resolution (§3.5 Q2), and `RivalStatusView` posture vocabulary if HUD projection ships (§3.5 Q5). Folds in the §1 ICD-05 §Notes amendment for the `AUTO_PLATE_SENTINEL` substitution path and the §3.5 Q6 ink plate-time gate rule. |
| **PRE-0.8** | Itself the paper slot — authors ICD-04 | Slot is the action. | None — confirm slot scheduled. |
| **0.8** — Save / load, resume mid-edition, version field | ICD-04 | Not yet authored; PRE-0.8 is the slot. | None — gap is scheduled per the supplement and overview line 33's deferral. |

### Scheduled paper slot — PRE-0.7

A single architecture session, paper-only, no code. Authors:

1. **ICD-02 v0.2** — strong-band rival contract for the 0.7–0.8 window.
   - Evening Star SCAVENGE + RAID state-machine spec (lifts the
     design HTML pseudocode into committed prose).
   - `RAID_BUREAU` Intent shape detail: goon-count policy, eta_ms
     resolution against the cycle clock, target selection (Bureau
     always; Branch + Switchboard fuzzy until Tier-1).
   - `RivalView` projection: what each rival sees of the world,
     resolution of the v0.1 §Open questions item *"Should rivals see
     their own past intents in RivalView? Probably yes for arc-aware
     behavior. Settle at the post-0.6 re-eval."* (§3.5 Q2 below
     defers the value resolution to the paper slot; this re-eval
     commits to deciding it *at* PRE-0.7).
   - **`RivalStatusView` posture projection (medium-band on ICD-01,
     not ICD-02).** Posture vocabulary `{calm, scheming, hostile}`
     from §3.5 Q5; lands on `WorldFrame` if a HUD pill is in scope
     for 0.7 or stays on `RivalView` only until milestone 0.9 lights
     up the corkboard.
2. **ICD-05 §Notes amendment** — single paragraph capturing the pre-
   Editor `AUTO_PLATE_SENTINEL` substitution path (§1 Decision-in-
   comments #2). No shape change.
3. **Ink plate-time hard gate** — captured either as an ICD-05 §Notes
   paragraph or as a new line in ICD-02 v0.2's Evening Star spec
   (it's the Editor's plate-arrival logic; the natural home is ICD-05
   given the Editor unit drops Stories at plated-step). §3.5 Q6 owns
   the rule.

PRE-0.7 ships at v0.6.2 paper-only patch following the PRE-0.5
precedent (v0.4.1).

## 3.5 Open questions — the post-0.6 re-eval's unique content

Six questions: the three scheduled by roadmap line 26 (Q1 / Q2 / Q3),
plus three additional topics folded in at session open
(difficulty selector — Q4, rival-state visibility — Q5, ink negative-
balance enforcement — Q6).

### Q1: Does the loop play?

Read the shipped 0.4–0.6 against the *"feels like a game"* bar. The
loop has four rings: inner (dispatch → pickup → verify → plate →
print), outer (12-minute cycle + deadline + debrief), economy (cash
in, ink out, heat building), and adversarial (rivals).

| Ring | Status | Evidence |
|---|---|---|
| Inner — dispatch → pickup → verify → plate → print | **Closed.** | Reporter ferry at 0.3; photog verify at 0.4; auto-plate + print at 0.5. ICD-05 transition rows 1–5 all lit. |
| Outer — 12-minute cycle + deadline + debrief | **Closed.** | `CycleClock` at 0.5; debrief panel at 0.5; pause-during-debrief tested. |
| Economy — cash in, ink out, heat building | **Closed.** | Cash earned per print, ink decremented per plated story, heat applied per flavor, heat decay at edition boundary. |
| Adversarial — rivals act, the Press takes damage, a fail-state exists | **Open.** | First rival caller is 0.7 (ICD-02 promotion + Evening Star). Press HP wired but no damage source. |

**Verdict:** the inner three rings turn; the outer stakes (the
adversarial ring) are entirely a 0.7 concern. This is the expected
reading and matches the strong-band claim "Single fail-state — the
Press" (overview line 28). No demotions warranted on this question;
the structural pass confirms all nine strong-band commitments still
hold. The loop's *playability* gates Tier-0 closer (0.10), not 0.7
opening — 0.7 is what *makes* the adversarial ring testable.

### Q2: Promote ICD-02 to strong for 0.7–0.8?

Re-read [`../icds/ICD-02-rival-world.md`](../icds/ICD-02-rival-world.md):
the Intent vocabulary is committed today (§Per-tick contract); what's
medium is the **rival state machine pseudocode** in the design HTML
plus the §Open questions item about `RivalView` past-intents. The
caller-triggered scope table (lines 43-53) explicitly slates
`RAID_BUREAU` first implementer = Evening Star at milestone 0.7.

**Verdict: promote band medium → strong AND schedule PRE-0.7.**

The promotion is mechanical against the overview line 42 commitment
*"Each rival's contract goes to strong when its milestone enters the
N-window."* Milestone 0.7 is now in the N=3 window from 0.6.1; the
condition fires. The shape work — Evening Star state machine, goon-
count policy, RivalView past-intents resolution — is scheduled to
PRE-0.7 per the methodology §3.2 surface-and-schedule pattern (the
same pattern the post-0.3 re-eval applied to ICD-06 v0.2 via PRE-0.5).

The promotion lands as a one-line ICD-02 status edit in this PR:
`Band: medium → strong (post-0.6 RE-EVAL promotion; v0.2 shape work
scheduled to PRE-0.7)`. The full contract shape lands in PRE-0.7's
v0.2 PR.

### Q3: Decide tutorial shape

[`../discussion/tutorial-first-edition.md`](../discussion/tutorial-first-edition.md)
already proposes a five-step diegetic onboarding ("Your old man left
notes" → "Send a reporter to Riverside, kid" → return → darkroom →
plate → "Welcome to the paper"). The discussion doc names this slot
explicitly (line 22: *"Settle at the post-0.6 re-eval and write the
copy in the milestone-0.10 PR."*).

**Verdict: lock the diegetic frame as committed-direction.**

- **Frame:** notes from the old man + corkboard pins. No tooltip
  overlay system to build.
- **Implementation surface:** the corkboard at milestone 0.9 + the
  edition debrief panel at 0.5 already cover the surfaces the notes
  attach to.
- **Copy:** scheduled to milestone 0.10 PR per the discussion doc's
  own line — confirmed.
- **No paper slot needed between 0.6 and 0.10.** The frame is
  pre-architectural commitment, not an ICD.

Discussion doc status moves from `open · needs a paper session
before MVP polish` to `committed-direction · diegetic frame locked
(notes from the old man) · copy lands at milestone 0.10`.

### Q4: Difficulty selector direction

[`../discussion/difficulty-selector.md`](../discussion/difficulty-selector.md)
already states a working position (line 14): *"post-MVP,
frequency-scaling only. Single multiplier on rival tick cadence +
lead-spawn cadence. Aggression-scaling is a Tier-2+ concern."* The
discussion doc itself parks the call until the loop is playable
end-to-end (line 18).

**Verdict: confirm working position; defer the selector to Tier-1.**

Tier-0 MVP ships at a single calibrated difficulty. The selector
itself (the UI surface and the multiplier wiring) is run-meta
infrastructure that belongs alongside high-score persistence and the
run-end summary screen — milestone 0.10 territory (run-end) and
Tier-1's run-meta layer (the multiplier mechanism). No PRE-0.7
work; ICD-02 v0.2 specs Evening Star at the single calibrated
difficulty.

Discussion doc status moves from `open · pre-architecture · deferred
to post-MVP` to `committed-direction · frequency-scaling only ·
deferred to Tier-1 run-meta layer`.

### Q5: Rival-state visibility — settle the partial-dossier question

[`../discussion/rival-state-visibility.md`](../discussion/rival-state-visibility.md)
recommends (line 19) a **partial-information dossier**: posture
visible, raw meters not; front pages carry the rest; Tipster unlock
for more. The doc itself says (line 22) *"Settle at the post-0.6
re-eval, after the first loop plays through."*

**Verdict: lock the partial-dossier recommendation as
committed-direction (medium-band). Posture vocabulary:
`'calm' | 'scheming' | 'hostile'`.**

Mechanics:

- **What the player sees:** rival posture (one of three values)
  surfaced on `WorldFrame.hud` (proposed) or on a dedicated
  `RivalStatusView` array; raw meters (cash, attention, aggression
  internal counters) never leave sim.
- **What each rival sees of itself:** unrestricted — `RivalView` in
  ICD-02 v0.2 covers the rival's own dossier with full meters.
- **HUD surface:** TBD between PRE-0.7 (adds the projection if a
  pill ships at 0.7) and milestone 0.9 (HUD corkboard absorbs it
  alongside the dossier panel).
- **Tipster unlock:** medium-band Tier-1 feature; out of scope for
  Tier-0 vertical slice.

Discussion doc status moves from `open · pre-architecture · not a
commitment` to `committed-direction · partial dossier locked ·
posture vocabulary {calm, scheming, hostile}` and is cited from
ICD-02 v0.2 (PRE-0.7).

### Q6: Ink negative-balance enforcement

[`../CHANGELOG.md`](../CHANGELOG.md) v0.6.0 §Changed explicitly:
*"Negative ink is allowed at 0.6 (HUD surfaces the number; the 'can't
print if ink runs out' enforcement is medium-band and lands at 0.7+)."*
This re-eval pins the rule so PRE-0.7 / 0.7 can rely on it.

Three options:

- **(a) Plate-time hard gate** — verified stories that would push
  `ink` below zero cannot transition to `plated`; they stay verified
  and the Editor (or the pre-Editor `AUTO_PLATE_SENTINEL` path)
  skips them. Strongest player feedback; matches design doc §06's
  framing of ink as the gate on print volume.
- **(b) Print-time hard gate (DEADLINE_FIRE)** — plate freely; at
  deadline print in priority order until ink is exhausted, then drop
  the remainder back to plated for the next edition. More forgiving.
- **(c) Soft warning, no enforcement** — keep v0.6 behavior past 0.7.
  Punts to 0.10 / Tier-1.

**Verdict: (a) plate-time hard gate, scheduled to land alongside the
Editor unit at 0.7.**

The Editor's job is to plate verified stories at deadline; the ink
check belongs in its arrival logic. ICD-05 §Notes already permits
`Story.cash_yield` / `heat_yield` / `ink_cost` at the plated step —
the §Notes paragraph the PRE-0.7 slot adds for the `AUTO_PLATE_SENTINEL`
substitution path absorbs the plate-time-gate rule in the same edit:
*"Plating decrements `World.resources.ink` by `Story.ink_cost`. A
plated transition that would leave ink negative is rejected; the
Story remains in `verified` state for the next edition. The Editor's
arrival logic enforces this; the pre-Editor `AUTO_PLATE_SENTINEL`
path inherits the same rule."*

No ICD bump needed in this re-eval — the §Notes amendment lands at
PRE-0.7 alongside ICD-02 v0.2. The rule is pinned here.

## 4. Roadmap label updates

1. **Tick** the "RE-EVAL after 0.6" row (roadmap line 26).
2. **Insert** a new `PRE-0.7` row above the existing `0.7` row:
   `PRE-0.7 | Author **ICD-02 v0.2** (Evening Star SCAVENGE+RAID state
   machine, RAID_BUREAU policy, RivalView past-intents, RivalStatusView
   posture) + **ICD-05 §Notes** (AUTO_PLATE_SENTINEL substitution path
   + ink plate-time hard gate rule) | Architecture session · paper-only
   · gates milestone 0.7 | strong`.
3. **Update** the `0.7` row's band column from
   `medium → strong at re-eval` to `strong`.
4. **Advance** the "Current status" block: v0.6.1 paper shipped; 0.7
   gated by PRE-0.7.
5. **Append** a `- [x] **RE-EVAL after 0.6**` history entry below the
   v0.6.0 entry, mirroring the v0.3.1 entry's shape.

## 5. Out of scope (preserved boundaries)

- **No JS / test / index.html changes** in this session — strict
  paper-only per [`../AGENTS.md`](../AGENTS.md) §Hard rules and
  METHODOLOGY §3.2.
- **ICD-04** (save schema) — explicitly deferred to PRE-0.8 by the
  supplement; not touched.
- **Authoring ICD-02 v0.2** — surfaced here, work scheduled to PRE-0.7
  (per METHODOLOGY §3.2 precedent: PRE-0.5 ↔ ICD-06 v0.2 + ICD-01 v0.5).
- **Authoring ICD-05 §Notes amendment** — surfaced here, scheduled to
  PRE-0.7 alongside ICD-02 v0.2 (same paper slot).
- **HUD `RivalStatusView` shape** — surfaced (§3.5 Q5), scheduled to
  PRE-0.7 (paper) or milestone 0.9 (corkboard layout) depending on
  whether 0.7 ships a posture pill.
- **Tutorial copy** — diegetic frame locked (§3.5 Q3); copy lands at
  milestone 0.10.

## 6. Summary

- **Four implemented ICDs survived contact with 0.4–0.6 code.** No
  interface drift. Constraint #4 honored: 0.4 bumped ICD-05 v0.2→v0.3
  in-PR; PRE-0.5 authored ICD-06 v0.2 + ICD-01 v0.5; 0.5/0.6 used
  everything as authored. Two strong-band claims (12-min cycle,
  five-resource names) moved from *aligned* to *tested*.
- **One band promotion:** ICD-02 medium → strong (overview line 42
  fires on the N=3-window rule with 0.7 entering scope).
- **One scheduled paper slot — PRE-0.7** — authors ICD-02 v0.2
  (Evening Star RAID specifics + RivalView past-intents +
  RivalStatusView posture) and the ICD-05 §Notes amendment for
  `AUTO_PLATE_SENTINEL` + ink plate-time hard gate. Gates milestone
  0.7. Ships at v0.6.2.
- **Tutorial frame locked** — diegetic "notes from the old man." Copy
  at 0.10.
- **Difficulty selector deferred to Tier-1.** Single calibrated
  difficulty for Tier-0 MVP; frequency-scaling only when introduced.
- **Rival-state visibility locked to partial-dossier** — posture
  vocabulary `{calm, scheming, hostile}`; medium-band; surface
  decision at PRE-0.7 or milestone 0.9.
- **Ink negative-balance enforcement locked to plate-time hard gate**
  — lands at 0.7 with the Editor unit; the rule is pinned here, the
  §Notes amendment lands at PRE-0.7.
- **First-pass balancing numbers stay medium-band** — promotion gate
  is playtest, not implementation.
- **0.7 is gated by PRE-0.7.** Once PRE-0.7 ships, milestone 0.7
  opens as a code session with ICD-02 v0.2 + ICD-05 §Notes amendment
  in hand.
