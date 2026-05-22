# Roadmap — Late Edition

Source: [`design/phase-0-roadmap.html`](design/phase-0-roadmap.html) §04
(Initial Roadmap). Each milestone is small enough for one code session,
testable in isolation, traceable to an ICD or a design-doc section.
Re-eval slots are first-class entries.

Bands reflect the weakest-band dependency of each milestone today; re-eval
sessions will tighten them. See
[`architecture/00-overview.md`](architecture/00-overview.md) for band
definitions.

## Tier 0 — vertical slice

| Milestone | Description | Notes | Band |
|---|---|---|---|
| **PRE-0.1** | Author **ICDs 01–03 + 05–06** · seed `discussion/` files | Architecture session · no code · output is the contracts | strong |
| **0.1** | Scene, camera, toon pipeline, fog, rain, ground grid | Lift from feel test ([`js/feel-test.js`](js/feel-test.js)) · ICD-01 · no game logic yet | strong |
| **0.2** | A* pathfinding · Reporter unit · click-to-dispatch | ICD-03 · one unit class, one move command | strong |
| **0.3** | Lead spawn (single district) · pickup · return-to-bureau | ICD-05 (lead state) · no verification yet | strong |
| **RE-EVAL** | After 0.3 · paper session — *shipped v0.3.1* | Did ICDs 01/03/05 survive contact? Promote any medium content tighter? Forward ICD presence check for 0.4–0.6. See [`architecture/re-eval-after-0.3.md`](architecture/re-eval-after-0.3.md). | re-eval |
| **0.4** | Photog unit · lead→verified transition · Darkroom building — *shipped v0.4.0* | ICD-05 verified state · introduces 2nd unit kind | strong |
| **PRE-0.5** | Author **ICD-06 v0.2** (`EditionSummary`) + **ICD-01 v0.5** (`HudState` + projection-rule tightening + implementation notes) — *shipped v0.4.1* | Forward-ICD-check output of the post-0.3 re-eval · paper-only · gated milestone 0.5 | strong |
| **0.5** | Print cycle clock · deadline events · edition debrief panel — *shipped v0.5.0* | ICD-06 · the heartbeat lights up | strong |
| **0.6** | Cash + Ink + Heat resources · story cash on print · ink consumption — *shipped v0.6.0* | Design doc §06 · §19 first-pass numbers · medium-band balance values | strong |
| **RE-EVAL** | After 0.6 · paper + code-aware — *shipped v0.6.1* | Loop plays (inner three rings closed; adversarial ring is 0.7). ICD-02 promoted medium→strong. Tutorial frame locked (diegetic). Difficulty deferred to Tier-1. Partial-dossier rival visibility. Ink plate-time gate at 0.7. See [`architecture/re-eval-after-0.6.md`](architecture/re-eval-after-0.6.md). | re-eval |
| **PRE-0.7** | Author **ICD-02 v0.2** (Evening Star SCAVENGE+RAID state machine, RAID_BUREAU policy, RivalView past-intents, RivalStatusView posture) + **ICD-05 §Notes** (AUTO_PLATE_SENTINEL substitution path + ink plate-time hard gate) — *shipped v0.6.2* | Architecture session · paper-only · gates milestone 0.7 | strong |
| **0.7.0** | Evening Star SCAVENGE + RAID states · Goon unit · Fixer unit · Press HP + `CYCLE_GAME_OVER` fail-state — *shipped v0.7.0* | ICD-02 v0.2 used as authored; ICD-06 → v0.3 (CYCLE_GAME_OVER); Editor + ink gate split out to **0.7.1** | strong |
| **0.7.1** | Editor unit (substitutes `AUTO_PLATE_SENTINEL` with `UnitId`) · ink plate-time hard gate (reject `verified → plated` if ink would go negative) — *shipped v0.7.1* | ICD-05 v0.4 §Notes used as authored — code-only milestone | strong |
| **PRE-0.8** | Author **ICD-04** (save schema) · single architecture session — *shipped v0.7.2* | Required before any code touches persistence | strong |
| **0.8** | Save / load · resume mid-edition · version field — *shipped v0.8* | ICD-04 v0.1 lifted verbatim · localStorage blob · migration-chain stub · cadence locked at cycle-begin + game-over | strong |
| **0.9** | HUD corkboard · deadline ticker · selected-unit dossier — *shipped v0.9* | Design doc §13 · ICD-01 v0.5 §HudState lifted as authored · zero ICD bumps | medium → strong |
| **RE-EVAL** | After 0.9 · paper + code-aware — *shipped v0.9.2* | Six ICDs survived code-aware re-read with zero interface drift; nine acknowledged drifts + seven criticals + fourteen gaps surfaced at the design-doc-to-code level. HUD corkboard band promoted medium → strong. PRE-0.10 scheduled. Tier-0 exit criteria confirmed: seven-item PR-C scope. See [`architecture/re-eval-after-0.9.md`](architecture/re-eval-after-0.9.md) + supplement [`design/spec-vs-code-review-0.9.html`](design/spec-vs-code-review-0.9.html). | re-eval |
| **PRE-0.10** | Author **ICD-01 v0.6** (`UnitView.stats` · `LeadView.district` · `WorldFrame.rivals: RivalStatusView[]` · `FxEvent` union) + **ICD-06 v0.4** (30 s minimum debrief wording per Design Doc §19) + **ICD-07 v0.1** (audio bus, new — channel vocabulary + ducking rules + press-silence beat) — *shipped v0.9.4* | Architecture session · paper-only · gates milestone 0.10 · also carries the HUD corkboard medium → strong band promotion (overview line 45) | strong |
| **0.10.0** | Tier-0 closer — substrate · lead-spawn engine (C-04) · districts as data (G-04) · Branch Bureau (G-01) · slot-grammar headlines (G-05) · run-end summary + high-score persistence (G-13) — *shipped v0.10.0* | First half of the 0.10 closer per the authorized split (0.7 precedent). ICD-01 → v0.6.1 (BuildingKind widens for `'branch_bureau'`); ICD-04 → v0.1.1 (rng_seed semantics + lead_spawner + run_stats + scores key). Tests at 159 cases (124 → 159). | strong |
| **0.10.1** | Tier-0 closer — onboarding · diegetic tutorial (G-09) · minimum control surface (WASD pan + Block zoom + slow-mo) (G-07) | Second half of the 0.10 closer. Tutorial copy references the new controls — coupled scope. No ICD bumps expected. | strong |
| **0.10.2** | Visual feedback · rain ramp at deadline (C-06) · `WorldFrame.effects` wired end-to-end (C-07) · debrief panel as newspaper pages (D-07) · lit windows + fog-on-deadline (D-09) — *shipped v0.10.2* | PR-D from the post-0.9 re-eval. ICD-01 → v0.6.2 (`rain.intensity` range-comment widen; no shape change). Tests at 199 cases (179 → 199). Closes Gitea #299. | strong |
| **RE-EVAL** | Tier-0 → Tier-1 gate · full code-aware + paper — *shipped v0.10.3* | Seven ICDs survived 0.10.x code-aware re-read with zero interface drift. Arc framework promoted Fuzzy → Strong (§18 three-tier shape + slot grammar + spawn engine all shipped at 0.10.0). Herald + Observer enter the N-window with the Tier-1 opener; ICD-02 v0.3 scheduled to PRE-1.0 alongside ICDs 08 (Switchboard) / 09 (Archive) / 10 (Arc framework). See [`architecture/re-eval-tier-0-to-1.md`](architecture/re-eval-tier-0-to-1.md). | re-eval |

## Tier 1 — content + adversarial maturation

| Milestone | Description | Notes | Band |
|---|---|---|---|
| **PRE-1.0** | Author **ICD-02 v0.3** (Herald + Observer state machines · intent vocabulary · posture mapping) + **ICD-08** (Switchboard line-of-sight contract, new) + **ICD-09** (Archive / inter-edition story state, new) + **ICD-10** (Arc framework formalization, new) + ICD-01 v0.6.3 §Notes addition (authored-but-deferred-projection rule) | Architecture session · paper-only · gates milestone 1.0 · scheduled by the Tier-0 → Tier-1 re-eval | strong |
| **1.0** | Tier-1 opener — Herald + Observer wired (the rival triangle completes) · Switchboard building (LoS intel for raid ETA visibility) · Archive UI (intentional inter-edition story hold) · `UnitView.stats` projector for named Reporters · `LeadView.district` projector for per-district Story queue dossier · 30 s minimum debrief gate (ICD-06 v0.4 code-side) | Couples to PRE-1.0 contract authoring; split 1.0.0/1.0.1 at session open per 0.7 / 0.10 precedent if scope creeps | strong |

13 Tier-0 code milestones (0.7 split into 0.7.0 + 0.7.1; 0.10 split into
0.10.0 + 0.10.1 + 0.10.2), 4 re-evaluation slots, 5 architecture-session-
only items (PRE-0.1, PRE-0.5, PRE-0.7, PRE-0.8, and PRE-0.10). That's the
ratio the methodology asks for: re-eval every ~3 code milestones,
architecture sessions wherever a contract crosses a code-session boundary
that hasn't been authored yet. PRE-0.5 was inserted by the post-0.3 re-eval's
forward ICD presence check; PRE-0.7 was inserted by the post-0.6 re-eval's
same check; PRE-0.10 was inserted by the post-0.9 re-eval to author ICD-01
v0.6 + ICD-06 v0.4 + ICD-07 v0.1 ahead of the Tier-0 closer; **PRE-1.0**
is inserted by the Tier-0 → Tier-1 re-eval (this slot) to author ICD-02
v0.3 + ICDs 08 / 09 / 10 ahead of the Tier-1 opener. The 0.7 split (0.7.0
adversarial ring · 0.7.1 Editor + ink gate) was made at 0.7.0 open to keep
each code session inside one milestone's worth of scope — both halves of
0.7 are ICD-ready (ICD-02 v0.2 and ICD-05 v0.4 cover them). The 0.10 split
(0.10.0 substrate · 0.10.1 onboarding + controls · 0.10.2 visual feedback)
shipped end-to-end against the post-0.9 audit's PR-C / PR-D ordering. A
1.0.0 / 1.0.1 split is reserved for session-open use under the same
precedent.

## Current status

**RE-EVAL Tier-0 → Tier-1 — shipped (v0.10.3).** Paper + code-aware session.
Fourth and final re-eval in the original Tier-0 plan, mirroring
re-eval-after-0.3 + re-eval-after-0.6 + re-eval-after-0.9. The seven ICDs
(01 v0.6.2 · 02 v0.2.2 · 03 v0.2 · 04 v0.1.1 · 05 v0.4.1 · 06 v0.4 ·
07 v0.1) survived 0.10.0 / 0.10.1 / 0.10.2 code-aware re-read with **zero
interface drift**. Constraint #4 honored across the three 0.10.x
milestones (ICD-01 v0.6 → v0.6.1 → v0.6.2 + ICD-04 v0.1 → v0.1.1 all
in-PR). Two design-doc-to-code drifts carried forward from the post-0.9
audit (`UnitView.stats` + `LeadView.district` authored-but-deferred
projections · 30 s minimum debrief gate); all three land at milestone
1.0. **One band promotion:** arc framework Fuzzy → Strong (overview line
54 → §Strong; line 44 "Story slot grammar" subsumed and struck) — the
three 0.10.0 substrate modules ([`js/sim/headlines.js`](js/sim/headlines.js)
+ [`js/sim/districts.js`](js/sim/districts.js) +
[`js/sim/lead-spawner.js`](js/sim/lead-spawner.js)) implement the §18
three-tier shape + slot grammar + §19 spawn engine end-to-end at the
Whisper level. **One band tightening:** "Rival AI state machines" (line
43) — Herald + Observer enter the N-window with the Tier-1 opener.
**One discussion-doc move:** [`discussion/observer-violence.md`](discussion/observer-violence.md)
becomes a pre-PRE-1.0 input. **One scheduled paper slot — PRE-1.0** —
authors ICD-02 v0.3 (Herald + Observer) + ICD-08 (Switchboard, new) +
ICD-09 (Archive, new) + ICD-10 (Arc framework, new). Tier-1 opener
direction confirmed: rivals + switchboard + archive UI + the two
deferred projectors + the 30 s debrief gate, all at milestone 1.0;
split 1.0.0/1.0.1 if scope creeps. One Gitea ticket opened for PRE-1.0
paper. See [`architecture/re-eval-tier-0-to-1.md`](architecture/re-eval-tier-0-to-1.md).

---

**RE-EVAL after 0.9 — shipped (v0.9.2).** Paper + code-aware session.
Third re-eval in the Tier-0 plan, mirroring re-eval-after-0.3 +
re-eval-after-0.6. The six ICDs (01 v0.5 · 02 v0.2.1 · 03 v0.2 · 04
v0.1 · 05 v0.4.1 · 06 v0.3) survived code-aware re-read with **zero
interface drift**. Constraint #4 honored across all twelve code
milestones. Findings sit at the design-doc-to-code level: **seven
criticals** (audit C-01 through C-07 — Press HP repair, raid_succeeded
emit, new-run button, lead-spawn engine, 30 s minimum debrief, rain
ramp at deadline, `WorldFrame.effects` channel), **nine acknowledged
drifts** (audit D-01 through D-09 — all flagged in code comments),
**fourteen gaps** (audit G-01 through G-14 — half land at 0.10, half
Tier-1), and **eleven explicit parks** (audit P-01 through P-11 —
discussion docs + ICD §Open questions). One band promotion: **HUD
corkboard medium → strong** (overview line 45) — the §13 pixel-honest
layout shipping at 0.9 is now load-bearing for ICD-01 v0.6's
`UnitView.stats` / `LeadView.district` / `WorldFrame.rivals` additions.
PRE-0.10 scheduled to author ICD-01 v0.6 + ICD-06 v0.4 (30 s debrief
wording) + ICD-07 v0.1 (audio bus, new). Tier-0 exit criteria confirmed:
the audit's PR-C scope (lead-spawn engine + districts + Branch + grammar
+ run-end summary + tutorial + minimum controls) is the locked shape of
milestone 0.10. Four Gitea tickets opened for the next code sequence
(PR-A polish · PR-B PRE-0.10 paper · PR-C milestone 0.10 · PR-D
visual feedback). See [`architecture/re-eval-after-0.9.md`](architecture/re-eval-after-0.9.md)
+ supplement [`design/spec-vs-code-review-0.9.html`](design/spec-vs-code-review-0.9.html).

**PRE-0.10 — shipped (v0.9.4).** Paper-only architecture session. Authored
**ICD-01 v0.6** (four field-set additions: `UnitView.stats` Reporter trio
per Design Doc §08 + §13 [audit G-10] · `LeadView.district` lifted from
sim-layer `Story.district` [audit G-11] · `WorldFrame.rivals:
RivalStatusView[]` top-level posture surface [audit G-12, closes post-0.6
§3.5 Q5] · `FxEvent` union under `WorldFrame.effects` with six-kind
vocabulary `'flash' | 'print' | 'death' | 'pickup' | 'verify' |
'raid_warning'` and drained-queue semantics [audit C-07]), **ICD-06 v0.4**
(single-line §Cycle timing edit aligning the debrief wording with Design
Doc §19's 30 s minimum [audit C-05]), and **ICD-07 v0.1** (new — audio
bus contract: channels `'ambient' | 'music' | 'sfx' | 'vo'`, ducking
rules, press-silence beat tied to `CYCLE_GAME_OVER`, `FxEvent` ↔ SFX
cue-table, reference to Supplement C at `design/audio-manifest.html`
[audit G-08]). Same PR carries the HUD corkboard band promotion (medium
→ strong; overview line 45) per the post-0.9 re-eval §2. **Milestone
0.10 is now code-ready** — every required contract is in hand.

**Milestone 0.10.0 — shipped (v0.10.0).** PR-C substrate — the
0.10.0/0.10.1 split was taken at session open per the 0.7.0/0.7.1
precedent: substrate items (C-04 lead-spawn · G-04 districts · G-01
Branch Bureau · G-05 slot grammar · G-13 run-end summary + high scores)
land here against ICD-01 v0.6 + ICD-04 v0.1 + ICD-06 v0.4 + ICD-07
v0.1. Constraint #4 bumps ICD-01 → v0.6.1 (`BuildingKind` widens for
`'branch_bureau'`) and ICD-04 → v0.1.1 (`rng_seed` carries live PRNG
state · `lead_spawner` + `run_stats` blocks · `'late-edition.scores.v1'`
key with `HighScoreBlobV1`). The world spawns leads continuously per
Design Doc §19; the dossier shows per-district histograms; the debrief
panel reads §18 grammar; a destroyed Press writes a high-score entry
before the run-end overlay mounts. Tests at 159 cases (124 → 159).

**Milestone 0.10.1 — shipped (v0.10.1).** Onboarding. G-07 minimum
control surface (WASD pan + `[`/`]` Block zoom + Space slow-mo, Design
Doc §12 + §19) and G-09 diegetic tutorial (four-note spine from
[`discussion/tutorial-first-edition.md`](discussion/tutorial-first-edition.md))
land together — the tutorial's first beat is the only diegetic surface
that names the new controls. Pan/zoom state lives renderer-side; slow-mo
state lives in the main loop (real-time, no save persistence); the
tutorial beat is derived per-frame from existing WorldFrame fields. No
ICD bumps as forecast. Tests at 179 cases (159 → 179; new
`tutorial.test.mjs` + `slow-mo.test.mjs`).

**Milestone 0.10.2 — shipped (v0.10.2).** PR-D visual feedback. C-06
rain ramp · C-07 `WorldFrame.effects` end-to-end (`pickup` · `verify` ·
`print` · `death` · `raid_warning`) · D-07 debrief as newspaper pages
with slap-down animation · D-09 lit windows (per-building emissive
quads with 4–14 s random flicker → ~40% lit) + fog `near` ramp 22 → 14
across the last 60 s. Five sim emit sites total; renderer drains the
queue and spawns ephemeral noir-palette FX meshes (TTLs 200–1000 ms,
disposed in place). Boot-time rain buffer sized to the 1500-line cap so
the ramp is a `setDrawRange` tweak, not a reallocation. ICD-01 → v0.6.2
(Constraint #4 in-PR bump — `rain.intensity` range comment widened from
`0-1` to `0+ unbounded; 1 = baseline, ~2 at deadline`; §Notes paragraph
pins both ramps as sim-side computations from `cycle.remainingMs`, not
new `CycleEvent` kinds). Tests at 199 cases (179 → 199; new
`effects-pickup-verify.test.mjs` · `effects-print.test.mjs` ·
`effects-death-raid.test.mjs` · `rain-ramp.test.mjs` ·
`fog-ramp.test.mjs`). Closes Gitea issue #299. Tier-0 audit (post-0.9)
PR sequence A → B → C → D fully landed.

**RE-EVAL Tier-0 → Tier-1 — shipped (v0.10.3).** Fourth and final
re-eval in the project plan. Detail in the "Current status" block at the
top of this file. Next: **PRE-1.0** (paper-only) — authors ICD-02 v0.3
+ ICDs 08 / 09 / 10 ahead of the Tier-1 opener.

- [x] Drop the design package + `METHODOLOGY.md`.
- [x] Create `architecture/`, `icds/`, `discussion/`, `deferred/`.
- [x] Author ICDs 01–03 + 05–06 (draft, from §03 sketches).
- [x] Seed `discussion/` with the six files from §02.
- [x] Write `architecture/00-overview.md`.
- [x] Write `roadmap.md`.
- [x] Open a code session against **milestone 0.1** — lifted into
      `js/world.js`; the Phase-0 supplement is now reached via the in-page
      link to [`design/phase-0-roadmap.html`](design/phase-0-roadmap.html).
- [x] PRE-0.2 paper session: `BuildingView` / `UnitView` / `LeadView` field
      sets spelled out in [`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md)
      v0.2.
- [x] **Milestone 0.2** — A* pathfinder, Reporter, click-to-dispatch.
      WorldFrame boundary materialized; `js/world.js` retired in favour of
      the `js/sim/` ↔ `js/render/` split. Tests under
      [`tests/`](tests) (`node --test`, 19 cases).
- [x] **Milestone 0.3** — Story records, lead spawn, pickup-on-arrival,
      drop-at-bureau via `Story.held_by_building`. ICD-05 → v0.2;
      ICD-01 → v0.4. Tests at 26 cases (new `story-pickup.test.mjs` +
      LeadView projection checks).
- [x] **RE-EVAL after 0.3** — paper-only. ICDs 01 / 03 / 05 survived
      contact; no band movements; PRE-0.5 scheduled for ICD-06 v0.2 +
      ICD-01 v0.5. See
      [`architecture/re-eval-after-0.3.md`](architecture/re-eval-after-0.3.md).
- [x] **Milestone 0.4** — Photog unit, Darkroom building, ICD-05 row 3
      lit (`lead → verified` on photog drop at Darkroom). ICD-05 → v0.3
      (status + field-delta note); ICD-01 unchanged. Tests at 37 cases
      (new `photog-verify.test.mjs` + WorldFrame/UnitStep extensions).
- [x] **PRE-0.5** — paper-only. Authored ICD-06 v0.2 (`EditionSummary` +
      `StoryDigest` + `RivalEventDigest`) and ICD-01 v0.5 (`HudState` +
      tightened projection rule + Implementation notes (0.5) for `TILE`,
      origin offset, 30 Hz, id-minting). Milestones 0.5 and 0.6 now have
      every dependency at the level their band claims.
- [x] **Milestone 0.5** — Print cycle clock, deadline events, edition
      debrief panel. `CycleClock` + `World.subscribeCycle` + `ackDebrief`
      + HUD ticker + click-to-dismiss panel; `verified → plated → printed`
      auto-fires at `DEADLINE_FIRE` (pre-Editor `AUTO_PLATE_SENTINEL`
      placeholder until Editor lands at 0.6/0.7). No ICD bumps — 06 v0.2,
      01 v0.5, 05 v0.3 all used as authored. Tests at 45 cases (new
      `print-cycle.test.mjs`).
- [x] **Milestone 0.6** — Cash + Ink + Heat resources. New pure module
      [`js/sim/resources.js`](js/sim/resources.js) owns the per-tier /
      per-flavor yields + edition-boundary constants. `World.resources`
      running balances + `ackDebrief()` heat decay. `HudState.resources`
      projects derived counts + balances; HUD ticker line extends with
      four segments. No ICD bumps — 01 v0.5 / 06 v0.2 / 05 v0.3 used as
      authored. Tests at 53 cases (new `resources.test.mjs`).
- [x] **RE-EVAL after 0.6** — paper + code-aware. Four implemented ICDs
      survived contact with 0.4–0.6 code; no drift. ICD-02 band
      promoted medium→strong; PRE-0.7 scheduled to author v0.2.
      Three discussion docs settled (tutorial / difficulty / rival
      visibility). Ink plate-time hard gate locked; lands at 0.7. See
      [`architecture/re-eval-after-0.6.md`](architecture/re-eval-after-0.6.md).
- [x] **PRE-0.7** — paper-only. Authored ICD-02 v0.2 (Evening Star
      SCAVENGE+RAID state machine, `RAID_BUREAU` goon-count + `eta_ms`
      policy, `RivalView` projection with past-intents bounded to last 8,
      `RivalStatusView` posture with `{calm, scheming, hostile}`
      vocabulary + Evening Star state→posture mapping) and the ICD-05
      v0.4 §Notes amendment (`AUTO_PLATE_SENTINEL` substitution path +
      ink plate-time hard gate rule). ICD-01 unchanged — HUD pill vs.
      corkboard decision left to the 0.7 code session. Milestone 0.7 is
      now code-ready.
- [x] **Milestone 0.7.0** — Evening Star rival lit (`js/sim/evening-star.js`,
      seeded via `js/sim/seeded-rng.js`); SCAVENGE + RAID + PASS state
      bodies on a 20 s tick; RAID_BUREAU intent reconciler spawns Goon
      units at the NW grid edge with a path to a Bureau-adjacent tile;
      adjacent goons damage Press @ 1 dmg/s; Fixer unit (HP 3, 3.0 u/s)
      kills adjacent goon on contact, dies to 2-goon swarm. Press HP at
      0 emits `CYCLE_GAME_OVER`; `GameOverOverlay` mounts "THE PRESS
      BURNS" terminal screen. HUD ticker gained `X HP` segment. ICD-06
      → v0.3 (`CYCLE_GAME_OVER` event added); ICD-02 v0.2 §Open
      questions resolved (multi-edition transit deferred to Tier-1,
      HUD pill deferred to 0.9). Tests at 85 cases (53 → 85; new
      evening-star / rival-view / goon / press-hp / fixer test files).
- [x] **Milestone 0.7.1** — Editor unit (kind `editor`, stationary at
      `EDITOR_SPAWN_TILE = (4, 5)`, speed 0, dispatch-rejected); at
      `DEADLINE_FIRE` the plating step substitutes the editor's
      `UnitId` for `AUTO_PLATE_SENTINEL` on `Story.plated_by` (ICD-05
      v0.4 §Notes; sentinel kept as defensive fallback). Ink plate-time
      hard gate (ICD-05 v0.4 §Notes): `_fireDebrief` walks the verified
      queue against a projected ink budget and admits only stories
      whose cost fits; rejected stories stay `verified` at the Darkroom
      and retry next edition; `EditionSummary.ink_consumed` reflects
      admitted set only. No ICD bumps (01 v0.5, 02 v0.2, 05 v0.4, 06
      v0.3 all used as authored). Tests at 94 cases (85 → 94; new
      `editor.test.mjs` + `ink-gate.test.mjs`).
- [x] **PRE-0.8** — paper-only. Authored ICD-04 v0.1
      ([`icds/ICD-04-save-schema.md`](icds/ICD-04-save-schema.md)) —
      single-blob `localStorage` schema with explicit blob `version`,
      migration policy (`migrate_N_to_N+1` chain on load), determinism
      contract (per-rival RNG state in `EveningStarSnap.rng.state` +
      sub-tick `tick_accum_ms`), mid-edition resume rules
      (continuous `pos` + remaining `path` + `CycleClock.remainingMs`
      with `_warningFired` / `_fireFired` flags suppressing duplicate
      events), per-record `Story.version` (closes ICD-05 §Open-Q-1),
      and a recommended-but-not-locked save trigger surface (on
      `EDITION_DEBRIEF_END` + on `CYCLE_GAME_OVER`). ICD-05 bumped to
      v0.4.1 — §Open-questions closure paragraph only, no in-memory
      shape change. ICD-01 v0.5 / 02 v0.2 / 06 v0.3 unchanged.
      Milestone 0.8 is now code-ready.
- [x] **Milestone 0.8** — Save · load · resume mid-edition.
      [`js/sim/save.js`](js/sim/save.js) hosts `saveNow` / `loadSave` /
      `serialize` / `deserialize` / `runMigrations` against the single
      versioned `localStorage` blob (`'late-edition.save.v1'`).
      `World({ snap })` + `CycleClock.fromSnap` + `EveningStar.fromSnap`
      bypass fresh-construct seeding; `setIdMint` / `getIdMint` round-
      trip the module-scoped `nextId` counter. `Unit.selected` resets
      on load (UI state, ICD-04 §Notes). [`js/main.js`](js/main.js)
      boots via `loadSave() ?? new World()` and subscribes
      `saveNow(world)` to `CYCLE_BEGIN` + `CYCLE_GAME_OVER` (the
      ICD's recommended `EDITION_DEBRIEF_END` couldn't be used
      as-is because `cycle.start()` inside `ackDebrief()` runs
      AFTER that emit; the 0.8 session settles the Open Q on
      `CYCLE_BEGIN` which fires immediately after with a fresh
      clock). ICD-04 v0.1 lifted verbatim — no ICD bumps.
      Tests at 106 cases (94 → 106; new `save-load.test.mjs`).
- [x] **Milestone 0.9** — HUD corkboard, deadline ticker,
      selected-unit dossier. [`index.html`](index.html) becomes a
      four-row CSS grid (masthead · top cards · viewport+deadline-strip
      · dossier row); the renderer already reads
      `root.clientWidth/Height` so the 3D scene reflows for free.
      [`js/hud.js`](js/hud.js) becomes a `HudCorkboard` facade with
      three sibling region projectors (`TopCards`, `DeadlineStrip`,
      `Dossier`). Top cards: seven pinned index cards (Edition /
      Deadline / Leads / Stories / Ink / Cash / Heat) with serif
      numerals + mono kicker labels. Deadline strip: typewriter-ribbon
      across the top of the viewport with `.is-warning` (≤60s) /
      `.is-critical` (≤10s, 2Hz opacity pulse) class toggles. Dossier
      row: Selected (kind / state / carrying), Story queue (active
      leads + tier and flavor histograms from `LeadView.tier` /
      `LeadView.flavor` + in-flight count from `hud.resources.stories`),
      and Threats (goon count from `frame.units` + Press HP from the
      Bureau BuildingView). Pure renderer-side reorganization on top
      of the already-locked HudState / UnitView / BuildingView /
      LeadView projections — no ICD bumps; Constraint #4 honored by
      zero deviation. ICD-01 bump candidates surfaced (UnitView stat
      badges · LeadView.district · WorldFrame.rivals for raid ETA)
      parked for the post-0.9 re-eval. Tests at 113 cases (106 → 113;
      new [`tests/hud.test.mjs`](tests/hud.test.mjs) exercising
      `formatMs`, `formatEdition`, `pickSelected`, `countByKind`,
      `tierHistogram`).
- [x] **RE-EVAL after 0.9** — paper + code-aware. Six ICDs survived
      code-aware re-read; zero interface drift. Seven criticals + nine
      drifts + fourteen gaps surfaced at the design-doc-to-code level
      (no contract bumps). HUD corkboard band promoted medium → strong
      (overview line 45). PRE-0.10 scheduled to author ICD-01 v0.6 +
      ICD-06 v0.4 + ICD-07 v0.1. Tier-0 exit criteria confirmed: the
      audit's PR-C scope (lead-spawn engine + districts + Branch +
      grammar + scores + tutorial + minimum controls) is the locked
      shape of milestone 0.10. Four Gitea tickets opened for the next
      code sequence (PR-A polish · PR-B PRE-0.10 paper · PR-C closer ·
      PR-D visual feedback). See
      [`architecture/re-eval-after-0.9.md`](architecture/re-eval-after-0.9.md)
      and supplement
      [`design/spec-vs-code-review-0.9.html`](design/spec-vs-code-review-0.9.html).
- [x] **PRE-0.10** — paper-only. Authored **ICD-01 v0.6**
      ([`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md))
      — four field-set additions: `UnitView.stats: {nerve, nose, legs} |
      undefined` (Reporter trio per Design Doc §08 + §13, audit G-10);
      `LeadView.district: DistrictId` (lifted from sim-layer
      `Story.district`, audit G-11); `WorldFrame.rivals:
      RivalStatusView[]` top-level posture surface (audit G-12, closes
      post-0.6 §3.5 Q5 — top-level not nested in `hud`; `RivalStatusView`
      type stays owned by ICD-02 v0.2); `FxEvent` union under
      `WorldFrame.effects` with six-kind vocabulary `'flash' | 'print'
      | 'death' | 'pickup' | 'verify' | 'raid_warning'` and drained-
      queue semantics (audit C-07; producers + consumers wire at PR-D
      / milestone 0.10.x). Authored **ICD-06 v0.4**
      ([`icds/ICD-06-print-cycle.md`](icds/ICD-06-print-cycle.md)) —
      single-line §Cycle timing edit aligning the debrief wording with
      Design Doc §19's 30 s minimum (audit C-05; no shape change, no
      new event). Authored **ICD-07 v0.1**
      ([`icds/ICD-07-audio-bus.md`](icds/ICD-07-audio-bus.md)) — new
      contract: channels `'ambient' | 'music' | 'sfx' | 'vo'`, ducking
      rules table, press-silence beat tied to `CYCLE_GAME_OVER`,
      `FxEvent` ↔ SFX cue-table against ICD-01 v0.6's six kinds,
      reference to Supplement C
      ([`design/audio-manifest.html`](design/audio-manifest.html)) for
      the 96-prompt manifest (6 beds · 6 stems · 24 SFX · 60 VO lines).
      Same PR carries the HUD corkboard band promotion (medium → strong)
      in [`architecture/00-overview.md`](architecture/00-overview.md)
      line 45. **Milestone 0.10 is now code-ready** — every required
      contract is in hand.
- [x] **Milestone 0.10.0** — PR-C substrate. Lead-spawn engine (C-04),
      districts (G-04), Branch Bureau (G-01), slot-grammar headlines
      (G-05), run-end summary + high scores (G-13). ICD-01 → v0.6.1
      (`BuildingKind` widens to `'branch_bureau'`); ICD-04 → v0.1.1
      (`rng_seed` carries live PRNG state; `lead_spawner` + `run_stats`
      blocks; `'late-edition.scores.v1'` key with `HighScoreBlobV1`).
      Tests at 159 cases (124 → 159).
- [x] **Milestone 0.10.2** — PR-D visual feedback. Rain ramp (C-06)
      `frame.rain.intensity` 1 → 2 across the last 30 s · `WorldFrame.effects`
      end-to-end (C-07) with five sim emit sites (`pickup` on reporter
      arrival on a lead · `verify` on photog drop at Darkroom · `print`
      per admitted story at `DEADLINE_FIRE` · `death` on goon/fixer prune
      · `raid_warning` once per RAID_BUREAU intent) and renderer-side
      ephemeral FX meshes (yellow ring · white camera-flash · rising
      newspaper sprite · red X · pulsing exclamation) · debrief panel as
      newspaper pages (D-07) with masthead + two-column grid + drop caps
      + slap-down keyframe · lit windows (D-09) instanced emissive quads
      with random 4–14 s flicker + fog `near` ramp 22 → 14 across the
      last 60 s. Boot-time rain buffer sized to the 1500-line cap (Design
      Doc §15) so the ramp is a `setDrawRange` tweak. ICD-01 → v0.6.2
      (range-comment widen; no shape change). Tests at 199 cases (179 →
      199; new effects + ramp test files). Closes Gitea issue #299.
- [x] **Milestone 0.10.1** — Onboarding. G-07 minimum control surface
      (WASD pan + `[`/`]` Block zoom + Space slow-mo per Design Doc §12
      + §19) and G-09 diegetic tutorial (four-note spine — "send a
      reporter" / "verify it" / "now plate it" / "welcome to the paper"
      — from [`discussion/tutorial-first-edition.md`](discussion/tutorial-first-edition.md))
      ship coupled. The first beat carries the control-hint paren — the
      one diegetic surface that names the new keys. Pan/zoom state lives
      renderer-side (`Renderer._updateView`); slow-mo state is real-time
      loop state ([`js/slow-mo.js`](js/slow-mo.js), no save persistence);
      tutorial beat is derived per-frame from existing `WorldFrame`
      fields ([`js/sim/tutorial.js`](js/sim/tutorial.js) — no ICD bump,
      no new projection). Tests at 179 cases (159 → 179; new
      `tutorial.test.mjs` + `slow-mo.test.mjs`).
- [x] **RE-EVAL Tier-0 → Tier-1** — paper + code-aware. Fourth and final
      re-eval in the project plan. Seven ICDs survived 0.10.x code-aware
      re-read; zero interface drift. **One band promotion:** arc framework
      Fuzzy → Strong (overview line 54 → §Strong) — the three 0.10.0
      substrate modules ([`js/sim/headlines.js`](js/sim/headlines.js)
      + [`js/sim/districts.js`](js/sim/districts.js) +
      [`js/sim/lead-spawner.js`](js/sim/lead-spawner.js)) implement the
      §18 three-tier shape + slot grammar + §19 spawn engine end-to-end
      at the Whisper level. **One band tightening:** "Rival AI state
      machines" — Herald + Observer enter the N-window with the Tier-1
      opener. PRE-1.0 scheduled to author ICD-02 v0.3 (Herald +
      Observer) + ICD-08 (Switchboard, new) + ICD-09 (Archive, new) +
      ICD-10 (Arc framework, new) + ICD-01 v0.6.3 §Notes (authored-but-
      deferred-projection pattern). Tier-1 opener direction confirmed:
      rivals + switchboard + archive UI + the two deferred projectors
      + the 30 s debrief gate, all at milestone 1.0; split 1.0.0/1.0.1
      if scope creeps. One Gitea ticket opened for PRE-1.0 paper. See
      [`architecture/re-eval-tier-0-to-1.md`](architecture/re-eval-tier-0-to-1.md).

## Out of scope until called

- ~~**ICD-04** — explicitly deferred to PRE-0.8 by the supplement.~~ Authored
  at v0.1 in PRE-0.8 (shipped v0.7.2); no longer out of scope.
- ~~**Tier-1 architecture** — gated behind the Tier-0 → Tier-1 RE-EVAL slot.~~
  Re-eval shipped (v0.10.3); Tier-1 architecture surface is no longer out
  of scope. PRE-1.0 (paper-only) is the next slot — authors ICD-02 v0.3
  + ICDs 08 / 09 / 10. Tier-2 (procedural city · MP · accounts · audio
  asset pipeline · cumulative tech-tree branches) remains out of scope
  until a later re-eval calls it in.
