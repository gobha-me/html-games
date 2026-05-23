# AGENTS.md — Late Edition

If you're an LLM (or LLM-driven editor) about to make changes inside
`late-edition/`, read this first. The repo-root [`../AGENTS.md`](../AGENTS.md)
covers cross-game rules (branch protection, the back-to-arcade link, the
deploy pipeline); this file covers Late-Edition-specific direction.

## Read in this order

1. **`index.html`** (also at [`design/phase-0-roadmap.html`](design/phase-0-roadmap.html))
   — Supplement B, the architecture banding + ICDs + roadmap. This is the
   spine of the project. **Read it in full** before touching anything.
2. **[`roadmap.md`](roadmap.md)** — current milestone status. The roadmap
   says which milestone is next and which ICDs that milestone depends on.
3. **[`architecture/00-overview.md`](architecture/00-overview.md)** — the
   band classification of every architectural commitment. *Section headers
   carry their band; unlabeled is strong.*
4. **[`icds/`](icds)** — the interface contracts that gate code sessions.
   Read the ICDs relevant to your milestone before writing code.
5. **[`METHODOLOGY.md`](METHODOLOGY.md)** — the LLM-assisted-development
   methodology this project is built to. Reference it when you need to ask
   "is this an architecture session or a code session?"
6. **[`design/`](design)** — the original design package (pixel-perfect from
   Claude Design). Cited from every other doc. The HTMLs are the source of
   truth.

## The methodology in one paragraph

Architecture sessions and code sessions are different sessions.
**Architecture comes first; code comes second.** Architecture sessions
produce written outputs (ICDs, banding notes, discussion docs). Code
sessions read those, then implement one milestone within one session.
Every band-tier transition and every ~3 code milestones triggers a re-eval
slot — paper-only, no code. If a code session opens without an ICD it
needs, **stop and run an architecture session**. That's the methodology
working as designed, not a delay.

## Hard rules for this game

- **Don't commit code for milestones that haven't had their ICDs authored.**
  All ten ICDs are now authored (01 v0.6.5 · 02 v0.3.2 · 03 v0.2 · 04
  v0.1.4 · 05 v0.4.3 · 06 v0.4 · 07 v0.1 · 08 v0.1 · 09 v0.1.1 · 10 v0.1.1);
  Tier-0 milestones 0.1 → 0.10.2 have shipped against their contracts;
  the Tier-0 → Tier-1 re-eval shipped at v0.10.3; **PRE-1.0** (paper-
  only) shipped at v0.10.4; **milestone 1.0** shipped across two halves
  — 1.0.0 (adversarial substrate: Herald + Observer + Switchboard) and
  1.0.1 (Archive UI · Reporter trio projector · 30 s debrief gate);
  **milestone 1.1.0** shipped the first authored arc (Longshoreman
  Strike) + Investigation 3-step chain wiring; **milestone 1.1.1**
  shipped the same-day-playtest UX polish bundle (fog camera distance ·
  WASD screen-aligned pan · building dossier (Option A) · multi-step
  zoom). Remaining Tier-1 content
  (Herald PUNISH / BUYOUT · Observer DESPERATE / SILENCED · Star-vs-
  Observer raid · audio bus first caller · further authored arcs)
  stays at Tier-1.x.
- **When code deviates from an ICD, update the ICD in the same PR.** This
  is Constraint #4 of the methodology.
- **Bands are not decoration.** Strong-band commitments are load-bearing.
  Don't refactor them out without an architecture session.
- **The design HTMLs in [`design/`](design) are immutable.** If a design
  decision changes, the change lands in the markdown mirrors
  (`architecture/`, `icds/`, `discussion/`) — never edit the source HTMLs.

## Audio asset generation

Venice.ai (`venice <command>`) is the standing audio-asset pipeline for
this game. Any session that needs an audio cue can generate against
Supplement C ([`design/audio-manifest.html`](design/audio-manifest.html))
without an architecture round — ICD-07 explicitly authorizes asset
generation in parallel to the first-caller code session. Save outputs
to [`assets/audio/`](assets/audio/) keyed by Supplement-C ID
(e.g. `SFX-01-reporter-dispatched.mp3`) so the eventual cue-table maps
1:1.

**Subcommand availability — re-check `venice --help` at session start;**
**this is a moving target.** As of the 2026-05-22 probe:

- `venice sfx` — *available*. Two model paths:
  - `elevenlabs-sound-effects-v2` — max **22 s/take**, ~$0.01/s. Best
    fit for `sfx`-channel one-shots (SFX-01..24; all ≤2 s in the
    manifest).
  - `mmaudio-v2-text-to-audio` — max **30 s/take**, ~$0.001/s. Cheap;
    doesn't reach AMB-01..06 (90 s) or MUS-01..06 (120 s) single-take.
  - `--duration` is integer-only; round sub-second durations up to 1 s.
- `venice tts` — **in flight at Venice; not yet shipped.** When the
  subcommand lands, it unblocks VO-001..060 (the radio-announcer arc).
  A future session should re-check `venice --help` before assuming VO
  is still gated.
- `venice chat`, `venice image`, `venice embed` — not yet implemented;
  no current consumer in this game.

**Path for AMB-01..06 + MUS-01..06.** Manifest source durations exceed
both models' single-take caps. Three options on the table — decision
parked at the Tier-1 audio milestone first-caller session:

1. Seamless 30 s loops looped client-side. Cheap, lower variation;
   requires prompts to specify "seamlessly loopable."
2. Stitched takes with crossfades. More variation; forces the ICD-07
   §Open-questions engine selection (Tone.js / Howler / own wrapper)
   earlier than the contract requires.
3. Shorten source durations in the markdown mirrors. Design HTMLs in
   [`design/`](design) stay immutable per the hard rules; any duration
   change lands in `architecture/` / `discussion/`.

**Cost discipline.** Always `--dry-run` first to confirm the quote;
pass `--max-spend USD` as a fail-closed cap. Full T0 SFX (24 cues)
prices around $0.24. The pipeline costs nothing until a call queues —
dry-runs are free.

**Inventory.** SFX-01 (typewriter), SFX-05 (camera shutter), SFX-07
(press fires) generated 2026-05-22 ($0.03). All other Supplement-C
cues remain unrecorded; a session that needs one should record it then
and commit it alongside whatever change triggered the need.

## Current state

**v1.2.0 — Tier-1.x adversarial maturation · Observer DESPERATE +
SILENCED state bodies.** First Tier-1.x adversarial-maturation session
against the roadmap "Next" list (Herald PUNISH/BUYOUT · Observer
DESPERATE/SILENCED · Star-vs-Observer raid · audio bus · further arcs).
Three deliverables landed:

- **DESPERATE body — PARTNER_REQUEST emission + HUD chip.** The
  INVESTIGATE → DESPERATE branch in [`js/sim/observer.js`](js/sim/observer.js)
  emits `PARTNER_REQUEST { district }` one-time on the transition (the
  persistent DESPERATE body still PASSes — emission is transition-bound,
  not body-bound). District = `argmax(view.world.district_heat)` with
  declaration-order tie-break. New helper `pickHotterDistrict` factored
  out of the branch. `RivalView` widens with a top-level
  `world: { district_heat, observer_publish_suppressed }` block in
  `World._buildRivalView` so the Observer reads world signals via the
  projection (never a World backlink). The World's `_reconcileIntent`
  PARTNER_REQUEST branch writes `World.partnerOffer`;
  `WorldFrame.partnerOffer` projects it; new
  [`js/hud.js`](js/hud.js) helpers `renderPartnerOfferChip` +
  `renderActivePartnerDealLine` mount inside the Threats panel via
  `Dossier._applyThreats`. Delegated-listener `Dossier._onThreatsClick`
  routes `data-action="partner-accept"` / `="partner-decline"` to the
  HudCorkboard's `actions.acceptPartnerOffer` / `declinePartnerOffer`
  callbacks (wired in [`js/main.js`](js/main.js)).

- **DESPERATE acceptance/decline + active deal.** New World methods
  `acceptPartnerOffer()` / `declinePartnerOffer()` wrap the existing
  `observer.acceptPartner` / `declinePartner` and apply world-side
  effects: accept debits `PARTNER_DEAL_COST = $500` from
  `World.resources.cash`, hands $500 to Observer, sets
  `World.activePartnerDeal { district, editionsRemaining: 5 }`, and flips
  `World.observerPublishSuppressed = 5`. `_fireDebrief` plating gate
  filters verified stories by `s.district !== activePartnerDeal.district`
  (blocked stories stay verified — same dwell mechanism the ink-gate
  uses). Observer's INVESTIGATE → PUBLISH predicate gates on
  `view.world.observer_publish_suppressed > 0`. Deal expiry ticks down
  once per edition end after the rival-onEditionEnd loop in `ackDebrief`;
  on zero the deal + suppression both clear (`partner_deal_expired`
  rival event emitted). Accept refuses with `{ ok: false, reason }` when
  no offer is pending OR player cash is insufficient (no in-debt deals).

- **SILENCED body — heat decay slowdown.** While any rival has
  `state === 'SILENCED'` the player's per-edition heat decay scales by
  `SILENCED_DECAY_FACTOR = 0.5` in `ackDebrief`. ICD-02 v0.3.3 reading:
  *"Heat decays slower for the player while Observer is silenced (the
  city notices the silence)"* — silencing the Observer is a Tier-IV move
  that draws civic suspicion onto the player, so heat persists ~2×
  longer (a penalty, not relief). The existing
  `HEAT_DECAY_STALL_THRESHOLD` rule still wins; the multiplier applies
  inside the decay branch, not over it. SILENCED entry stays caller-only
  via `observer.frame()` — the Tier-IV "Frame the Observer" arc that
  would surface it in normal play is a later milestone.

**Three ICD bumps in-PR (Constraint #4).** ICD-01 v0.6.6 → v0.6.7
(`PartnerOfferView` + `ActivePartnerDealView` view-structs +
`WorldFrame.partnerOffer` / `activePartnerDeal` nullable fields).
ICD-02 v0.3.2 → v0.3.3 (RivalView §world block + §Observer
§DESPERATE/§SILENCED body completions + state-table "First milestone"
column updates + Intent table's `PARTNER_REQUEST` entry pinned to v1.2.0
first-caller). ICD-04 v0.1.4 → v0.1.5 (`SaveBlobV1` widens with
`partner_offer?: PartnerOfferSnap | null` + `active_partner_deal?:
ActivePartnerDealSnap | null` + `observer_publish_suppressed?: number`;
two new snap interfaces; `migrate_1_3_to_1_4` stamps the version and
defaults all three to null/0). Tests at 390 cases (365 → 390 = +25; new
`tests/world-partner-deal.test.mjs` covering reconciler / accept-decline
/ plating gate / PUBLISH suppression / WorldFrame projection · new
`tests/world-silenced-decay.test.mjs` covering the multiplier + stall
interaction · observer.test.mjs / hud.test.mjs / save-load.test.mjs /
world-frame.test.mjs / rival-view.test.mjs all add cases or update
schema-lock key sets).

**Next: remaining Tier-1.x content + adversarial maturation.** Herald
PUNISH + BUYOUT state bodies (mirrors this work — caller methods exist,
bodies need wiring) · Star-vs-Observer raid mechanic (§06 matrix cell 3 ·
the raid also triggers SILENCED, so v1.2.0's body becomes reachable via
two routes) · audio bus first caller against ICD-07 · further authored
arcs (Mayor's Mistress · Empty Vault · Frame the Observer — Tier-IV
arc surfaces SILENCED in normal play) · district-disposition mechanical
effect (spawn-rate / raid-prob modifiers) at the 1.1.x balance pass.

---

**v1.1.2 — Playtest UX polish round 2 (dossier hierarchy · minimap).**
Second Tier-1.x polish session. Closes out the two deferred items from
the v1.1.0 same-day playtest (v1.1.1 took the four first-launch blockers;
v1.1.2 takes the two cosmetic / orientation items that benefit from
landing after the fog calibration). Two deliverables landed:

- **#336 dossier hierarchy.** [`index.html`](index.html): `#hud-dossier`
  `border-top: 1px solid var(--rule)` → `2px solid var(--ink)` so the
  bottom row matches the deadline-strip's heavy ink weight at the top
  of `#world`. `.panel min-height: 78px` → `120px` so the auto-sized
  dossier row grows from ~105px to ~148px without changing the body
  grid template — SELECTED / STORY QUEUE / THREATS read as a deliberate
  bottom surface, not as crammed-against-the-canvas residue. CSS-only;
  no JS / sim changes.
- **#337 minimap.** New 140×140 px HUD widget bottom-right of `#world`
  (top is owned by the deadline strip). Renders the 10×10 grid + 4
  buildings (kind-colored squares) + leads (flavor-colored diamonds) +
  player units + visible goons (the LoS-filtered set already in
  `WorldFrame`) + selection ring on the selected building/unit + camera
  frustum overlay (iso-rotated ground rhombus from the orthographic
  camera). [`js/render/minimap.js`](js/render/minimap.js) (new, pure)
  hosts the projection helpers `tileToPixel` / `worldXZToPixel` /
  `frustumQuad` — mirrors the v1.1.1 zoom-step.js factoring so the
  math is testable without DOM / THREE. [`js/hud.js`](js/hud.js) adds
  the `Minimap` region as a fifth `HudCorkboard` sibling (TopCards /
  DeadlineStrip / Dossier / TutorialNote / Minimap), instantiated only
  when `roots.minimap` is non-null so the HUD still functions in a
  minimap-less host. [`js/render/renderer.js`](js/render/renderer.js)
  exposes `getView()` returning `{ pan, frustum, aspect }`; the HUD
  reads it through `actions.getView` (callback at construction, same
  pattern as `actions.toggleArchive`) — the HUD never holds a renderer
  reference and the renderer stays the canonical view-state owner.

**No ICD bumps in-PR.** All minimap inputs come from existing
`WorldFrame` fields (ICD-01 v0.6.6) + renderer-local view state that
ICD-01 §Notes pins as "renderer never reaches back" (the sim never
sees pan/zoom). Tests at 365 cases (355 → 365 = +10; new
`tests/minimap.test.mjs` covering tile-to-pixel symmetry, world-XZ ↔
tile-pixel composition, frustum pan offset, zoom-shrinks-radius,
aspect-stretches-along-camera-right). Closes Gitea issues #336 / #337.
The v1.1.x playtest UX polish track is now done.

**Next: Tier-1.x content + adversarial maturation.** Same backlog as
v1.1.1 next-up: Herald PUNISH + BUYOUT state bodies · Observer
DESPERATE + SILENCED state bodies · Star-vs-Observer raid mechanic
(§06 matrix cell 3) · audio bus first caller against ICD-07 · further
authored arcs (Mayor's Mistress · Empty Vault · etc.) · district-
disposition mechanical effect (spawn-rate / raid-prob modifiers) at
the 1.1.x balance pass.

---

**v1.1.1 — Playtest UX polish (fog · WASD · building dossier · multi-step
zoom).** First Tier-1.x polish session. v1.1.0 shipped 2026-05-22 at 14:22;
the same-day playtest produced six issues, four of which made the game
feel broken on first launch. Four deliverables landed:

- **#332 fog calibration** — [`js/render/renderer.js`](js/render/renderer.js)
  camera position (40,35,40) → (24,22,24) introduced as `CAMERA_OFFSET`
  (shared between boot `lookAt` and `_updateView` pan integration).
  Camera-to-target distance shrinks ~65 → ~40 units; every grid tile now
  sits inside the fog band [22, 60] at default pan. Iso angle preserved.
- **#333 WASD pan** — [`js/input.js`](js/input.js) `KEY_PAN` unit vectors
  rotated 45° in XZ so each key maps to its screen axis under the iso
  camera (W=up, A=left, S=down, D=right). `Math.hypot` normalize keeps
  |v| at PAN_SPEED for single + two-key inputs. `KEY_PAN` + `PAN_SPEED`
  exported for `tests/input-pan.test.mjs`.
- **#334 building dossier (Option A)** — new `World.buildingAtTile(cell)`
  and `World.selectBuilding(id)` mirror the unit selection API
  (`unitAtTile` / `selectUnit`). Mutually exclusive with unit selection
  — `selectUnit` / `selectBuilding` / `deselectAll` clear each other.
  `World.snapshot()` projects `WorldFrame.selectedBuilding:
  SelectedBuildingView | null` (widens `BuildingView` with
  `district: DistrictId`). Left-click on a building tile now populates
  the §13 SELECTED dossier with `Bureau · 60/60 HP · The Docks` —
  Switchboard + Branch Bureau gain their first player-readable HP
  surface.
- **#335 multi-step zoom** — replaced the 2-state `setZoom('city'|'block')`
  enum with a 4-step ladder `FRUSTUM_STEPS = [30, 22, 16, 10]` per
  design-doc-§12 spirit. `[` calls `renderer.stepZoom(+1)` (zoom in,
  smaller frustum); `]` calls `stepZoom(-1)` (zoom out, larger frustum).
  Endpoints clamp silently. `FRUSTUM_STEPS` + `nextZoomStep` factored
  into [`js/render/zoom-step.js`](js/render/zoom-step.js) so the index
  math is testable without spinning up THREE.

**ICD bump in-PR (Constraint #4):** ICD-01 v0.6.5 → v0.6.6 — new
`SelectedBuildingView` view-struct + new `WorldFrame.selectedBuilding`
top-level field. Tests at 355 cases (334 → 355 = +21; three new test
files). Closes Gitea issues #332/#333/#334/#335 + stale tracking #330.
Defers #336 (likely auto-resolved by fog fix — verify post-merge) and
#337 (minimap enhancement; benefits from #332 landing first).

**Next: remaining Tier-1.x content + adversarial maturation.** Same set
as v1.1.0 next-up: Herald PUNISH + BUYOUT state bodies · Observer
DESPERATE + SILENCED state bodies · Star-vs-Observer raid mechanic
(§06 matrix cell 3) · audio bus first caller against ICD-07 · further
authored arcs (Mayor's Mistress · Empty Vault · etc.) · district-
disposition mechanical effect (spawn-rate / raid-prob modifiers) at the
1.1.x balance pass.

---

**v1.1.0 — Tier-1 content · first authored arc + Investigation chain.**
First Tier-1.x content session. Seven deliverables landed:

- **`js/sim/arcs.js`** (new) — `THE_LONGSHOREMAN_STRIKE` lifted verbatim
  from ICD-10 §Spec-validation (4 episodes · 4 outcomes · trigger:
  docks heat > 60 AND docks covered AND observer silent ≥ 3 editions).
  Pure `evalTrigger` recursive evaluator handles 8 named predicate kinds
  + 2 composers + the v0.1.1 `negate` flip flag.
- **Arc dispatcher** in `_runSpawnerTick` — retires the
  `tier === 'arc'` collapse from 0.10.0; upgrades to an authored arc
  episode when trigger fires AND district matches AND no active
  instance, downgrades to investigation otherwise.
- **Investigation 3-step chain hook** in `_handlePhotogArrival` —
  spawns successor in same district on `lead → verified` for
  investigation-tier stories; depth 3 cap; deterministic from
  `parent.id` via FNV-1a hash.
- **`pickArcBranch` + `_applyArcPlate`** — corkboard-chip player
  gesture records intent; effects fire at verified → plated (terminal
  outcomes apply cash/heat one-times + `districtDispositions` write,
  retire ActiveArc; advance outcomes spawn next-episode lead).
- **District-heat accumulator** (`World.districtHeat`) — accumulated at
  `_fireDebrief` (admitted printed stories' heat_yield by district);
  decayed at `ackDebrief` (flat `-5 / edition`). Powers
  `district_heat_above`.
- **Observer recentStates ring** (cap 5) — pushed once per edition
  inside `onEditionEnd`; powers `observer_silent_n_editions`
  ("not loud" = anything but PUBLISH/WARN).
- **Dossier breadcrumb** — story-queue rows render
  `Arc · Longshoreman Strike · bury | splash` for un-picked arc
  stories, `Picked: splash` for picked, `Investigation 2/3` for
  chained investigations.

Save schema bumps v1.2 → v1.3 in-PR via `migrate_1_2_to_1_3` (defaults
the three new top-level collections + observer.recent_states). Four
ICD bumps in-PR (Constraint #4): ICD-10 v0.1 → v0.1.1 (six surface
changes + Q1/Q3/Q4 closed); ICD-04 v0.1.3 → v0.1.4
(`active_arcs[]` + `district_heat` + `district_dispositions` + Story
optional fields + ActiveArcSnap interface + migration); ICD-02 v0.3.1
→ v0.3.2 (§Notes Observer.recentStates); ICD-05 v0.4.2 → v0.4.3
(§Notes cross-ref). District-disposition mechanical effect deferred to
1.1.x balance pass per ICD-10 §Notes. Tests at 334 cases (281 → 334).

**Next: remaining Tier-1.x content + adversarial maturation.** Herald
PUNISH + BUYOUT state bodies · Observer DESPERATE + SILENCED state
bodies · Star-vs-Observer raid mechanic (§06 matrix cell 3) · audio
bus first caller against ICD-07 · further authored arcs (Mayor's
Mistress · Empty Vault · etc.) · district-disposition mechanical
effect (spawn-rate / raid-prob modifiers) at the 1.1.x balance pass.

---

**v1.0.1 — Tier-1 opener · second half shipped.** Closes the 1.0
opener split scheduled by Gitea issue #317. Four deliverables landed:

- **Archive UI** (ICD-09 v0.1.1) — `World.toggleArchive(storyId)`,
  `'archived'` as the fifth `Story.state` value, `ARCHIVE_CAP = 5`
  hard cap, `ARCHIVE_DECAY_EDITIONS = 10` cold-news decay at
  `EDITION_DEBRIEF_END`. Player gesture wires as **left-click on the
  per-story dossier row** (§Open Q1 close).
- **`UnitView.stats` projector** (ICD-01 v0.6.5 + the v0.6.3 §Notes
  pattern's load-bearing case) — Reporter trio renders in the §13
  Selected dossier as *"Nerve 6 · Nose 8 · Legs 4"*.
- **`LeadView.district` dossier read** — the projector itself shipped
  in the 0.10.0 substrate; 1.0.1 wires the per-row caption in the
  Story-queue dossier.
- **30 s minimum debrief gate** (ICD-06 v0.4 §Cycle timing · audit
  C-05) — renderer-side clamp on the dismiss click with a panel-owned
  rAF countdown ribbon. `MIN_DEBRIEF_MS = 30_000` exported for testing.

Save schema bumps v1.1 → v1.2 in-PR via `migrate_1_1_to_1_2`
(pass-through; `archived_at_ms` and `stats` are optional fields). Four
ICD bumps in-PR (Constraint #4): ICD-01 v0.6.4 → v0.6.5; ICD-04 v0.1.2
→ v0.1.3; ICD-05 v0.4.1 → v0.4.2 (§Notes only); ICD-09 v0.1 → v0.1.1
(§Open Q1 close). Tests at 281 cases (257 → 281). Closes Gitea #317.

---

**v1.0.0 — Tier-1 opener · adversarial substrate (Herald + Observer +
Switchboard).** Shipped the rival triangle, Switchboard intel-defense
building + goon LoS visibility filter, and save schema v1.0 → v1.1
migration. ICD bumps: ICD-01 v0.6.3 → v0.6.4 · ICD-02 v0.3 → v0.3.1 ·
ICD-04 v0.1.1 → v0.1.2. Tests at 257 cases.

---

**v0.10.4 — PRE-1.0 paper shipped.** Paper-only. Authored the four
contract surfaces (plus one §Notes addition) that the Tier-0 → Tier-1
re-eval scheduled:

- **ICD-02 v0.3** — Herald five-state machine (`IDLE | COURT | WIRED |
  PUNISH | BUYOUT`, tick 1/edition) + Observer five-state machine
  (`INVESTIGATE | PUBLISH | WARN | DESPERATE | SILENCED`, tick 1/2
  editions) both lifted verbatim from
  [`design/rival-ai-spec.html`](design/rival-ai-spec.html) §03 + §05.
  Two new Intent kinds (`PUBLISH_COUNTER` · `INVESTIGATE_LEAD`).
  `RivalStatusView` posture mapping extended to all three rivals.
  §Notes inter-rival paragraph against §06 interaction matrix.
- **ICD-08** — new. Switchboard line-of-sight contract. Rectangular
  axis-aligned LoS, ±6-tile medium-band radius. No top-level
  `WorldFrame` field — extends the existing snapshot-layer filter.
- **ICD-09** — new. Archive `Story.state` value. Two new transition
  rows (`verified ↔ archived`). Archive cap = 5 medium-band; cold-
  news decay = 10 editions medium-band.
- **ICD-10** — new. Arc framework. `StoryArc` record + `ArcEpisode`
  + `ArcTriggerPredicate` vocabulary with eight kinds + two
  composers. Investigation 3-step chain semantics via
  `Story.parent_story_id`. THE LONGSHOREMAN STRIKE encoded as the
  spec-validation reference.
- **ICD-01 v0.6.3** — single §Notes paragraph addition only.
  Authored-but-deferred-projection pattern pinned.

Two source-HTML-name reconciliations against the re-eval doc's
informal naming (`LURK` → `IDLE`; `WATCH` → `INVESTIGATE`) per the
source-HTML-wins rule (Hard rules above). `discussion/observer-violence.md`
status flipped from `pre-PRE-1.0 input` to `settled at PRE-1.0`.
**Milestone 1.0 is now code-ready** — every required contract is in hand.


---

**v0.10.3 — Tier-0 → Tier-1 re-eval shipped.** Paper-only. Fourth and
final re-eval in the original plan. The seven ICDs (01 v0.6.2 · 02
v0.2.2 · 03 v0.2 · 04 v0.1.1 · 05 v0.4.1 · 06 v0.4 · 07 v0.1) survived
0.10.0 / 0.10.1 / 0.10.2 code-aware re-read with **zero interface
drift**; Constraint #4 honored across all three milestones. **One band
promotion:** arc framework Fuzzy → Strong (overview line 54 → §Strong)
— the three 0.10.0 substrate modules ([`js/sim/headlines.js`](js/sim/headlines.js)
+ [`js/sim/districts.js`](js/sim/districts.js) +
[`js/sim/lead-spawner.js`](js/sim/lead-spawner.js)) implement the §18
three-tier shape + slot grammar + §19 spawn engine end-to-end at the
Whisper level. **One band tightening:** "Rival AI state machines" —
Herald + Observer enter the N-window with the Tier-1 opener. **One
discussion-doc move:** [`discussion/observer-violence.md`](discussion/observer-violence.md)
becomes a pre-PRE-1.0 input. See [`architecture/re-eval-tier-0-to-1.md`](architecture/re-eval-tier-0-to-1.md).

---

**v0.9.2 — RE-EVAL after 0.9 (paper + code-aware).** Third re-eval in
the Tier-0 plan, alongside [`architecture/re-eval-after-0.3.md`](architecture/re-eval-after-0.3.md)
and [`architecture/re-eval-after-0.6.md`](architecture/re-eval-after-0.6.md).
**Read [`architecture/re-eval-after-0.9.md`](architecture/re-eval-after-0.9.md)
and the supplement [`design/spec-vs-code-review-0.9.html`](design/spec-vs-code-review-0.9.html)
before opening the next session.** The HTML is a Claude Design audit of
the v0.9 codebase against the design package; the markdown re-eval is
the formal landing site and triage layer.

Headline verdicts:

- **Six ICDs intact.** Twelve code milestones in, zero interface drift.
  Constraint #4 honored every time. The methodology is working.
- **Findings are at the design-doc-to-code level, not contract level.**
  Seven criticals (audit C-01 through C-07), nine acknowledged drifts
  (D-01 through D-09, all flagged in code comments at the deviation
  site), fourteen spec'd-but-not-implemented gaps (G-01 through G-14),
  eleven explicit parks (P-01 through P-11).
- **One band promotion:** HUD corkboard medium → strong (overview line
  45). The §13 pixel-honest layout shipping at 0.9 is now load-bearing
  for ICD-01 v0.6's `UnitView.stats` / `LeadView.district` /
  `WorldFrame.rivals` additions.
- **One scheduled paper slot — PRE-0.10** — authors **ICD-01 v0.6**
  (`UnitView.stats` + `LeadView.district` + `WorldFrame.rivals:
  RivalStatusView[]` + `FxEvent` union) + **ICD-06 v0.4** (30 s minimum
  debrief wording per Design Doc §19) + **ICD-07 v0.1** (audio bus,
  new). Gates milestone 0.10.
- **Tier-0 exit criteria confirmed.** The audit's PR-C scope (lead-spawn
  engine + districts as data + Branch Bureau + slot-grammar headlines +
  run-end summary + high-score persistence + diegetic tutorial +
  minimum control surface) is the locked shape of milestone 0.10. Split
  into 0.10.0 / 0.10.1 at session open if scope creeps (0.7 precedent).
- **Four Gitea tickets opened** for the forward code sequence:
  PR-A (0.9.1 polish — seven mechanical fixes, no ICD bumps beyond a
  one-line ICD-02 §Notes addition in-PR per Constraint #4) ·
  PR-B (PRE-0.10 paper-only) ·
  PR-C (milestone 0.10 — Tier-0 closer) ·
  PR-D (0.10.x visual feedback — after PRE-0.10's `FxEvent` lands).
  Ordering is mandatory: PR-A first (any time), PR-B before PR-C,
  PR-B + PR-C before PR-D.

**Next: PRE-0.10** (paper-only) — authors the four ICD edits above.
After PRE-0.10 ships, milestone 0.10 (the Tier-0 closer) opens as a
code session with every required contract in hand. PR-A can land any
time before, during, or after PRE-0.10 — it carries no contract
dependencies beyond the one-line §Notes patch.

## When you're stuck

- Disagreement between markdown mirrors and source HTMLs? **Source HTML
  wins.** Update the markdown.
- Open question that doesn't have an ICD? Either author the ICD (if the
  answer is clear) or park it in [`discussion/`](discussion).
- Want to add an Intent kind to ICD-02, or a CycleEvent kind to ICD-06?
  That's an architecture session. Stop, draft the ICD change, open it as a
  paper-only PR.
