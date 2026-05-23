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
| **PRE-1.0** | Author **ICD-02 v0.3** (Herald + Observer state machines · intent vocabulary · posture mapping) + **ICD-08** (Switchboard line-of-sight contract, new) + **ICD-09** (Archive / inter-edition story state, new) + **ICD-10** (Arc framework formalization, new) + ICD-01 v0.6.3 §Notes addition (authored-but-deferred-projection rule) — *shipped v0.10.4* | Architecture session · paper-only · gates milestone 1.0 · scheduled by the Tier-0 → Tier-1 re-eval | strong |
| **1.0.0** | Tier-1 opener — adversarial substrate · Herald state machine (IDLE / COURT / WIRED bodies; PUNISH / BUYOUT caller-triggered) · Observer state machine (INVESTIGATE / PUBLISH / WARN bodies; DESPERATE / SILENCED caller-triggered) · Switchboard building + goon LoS visibility filter (ICD-08) — *shipped v1.0.0* | First half of the 1.0 opener per the authorized split (0.7 / 0.10 precedent). ICD-01 → v0.6.4 (`BuildingKind` widens for `'switchboard'`); ICD-02 → v0.3.1 (`RivalView.player.printed_lies` field added); ICD-04 → v0.1.2 (`RivalsSnap` widens; v1.0 → v1.1 migration). Tests at 257 cases (199 → 257). | strong |
| **1.0.1** | Tier-1 opener — Archive UI (ICD-09 · `archived` Story state · cap=5 · decay=10 editions · dossier `archived: N/5` · left-click per-row gesture) · `UnitView.stats` projector for Reporter trio · `LeadView.district` dossier read · 30 s minimum debrief gate (ICD-06 v0.4 code-side) — *shipped v1.0.1* | Second half of the 1.0 opener. ICD-01 → v0.6.5 (`WorldFrame.stories` + `UnitView.stats` projector + `HudState.resources.archived`); ICD-04 → v0.1.3 (`StorySnap.state` widens + `archived_at_ms` + `UnitSnap.stats`; v1.1 → v1.2 migration); ICD-05 → v0.4.2 (§Notes cross-ref to ICD-09); ICD-09 → v0.1.1 (§Open Q1 close). Tests at 281 cases (257 → 281). Closes Gitea #317. | strong |
| **1.1.0** | Tier-1 content — first authored arc (Longshoreman Strike) + Investigation 3-step chain wiring · arc dispatcher in `_runSpawnerTick` (trigger predicate + district constraint + one-instance-per-arc-id) · `_handlePhotogArrival` chain hook (depth 3 cap, deterministic from parent.id) · `World.pickArcBranch` corkboard-chip player gesture · `_applyArcPlate` outcome application (cash/heat one-times + districtDispositions) · district-heat accumulator + flat -5/edition decay · Observer.recentStates ring (cap 5) — *shipped v1.1.0* | First Tier-1.x content session. Retires the `tier === 'arc'` lead-spawner collapse from 0.10.0. ICD-10 → v0.1.1 (negate-flag + StoryArc.district + arc registry + chain hook + observer_silent_n_editions semantics + §Save-surface lift + §Open-Qs Q1/Q3/Q4 closed). ICD-04 → v0.1.4 (`active_arcs`, `district_heat`, `district_dispositions`; `StorySnap` optional `parent_story_id` + `arc_episode_id` + `arc_branch_label`; `ObserverSnap.recent_states`; v1.2 → v1.3 migration). ICD-02 → v0.3.2 (§Notes Observer.recentStates). ICD-05 → v0.4.3 (§Notes cross-ref to ICD-10 v0.1.1). Tests at 334 cases (281 → 334). | strong |
| **1.1.1** | Playtest UX polish — #332 fog camera-target distance (camera (40,35,40)→(24,22,24) via `CAMERA_OFFSET`) · #333 WASD pan rotated 45° to screen-aligned axes (KEY_PAN unit vectors) · #334 building dossier (Option A — `buildingAtTile` + `selectBuilding` mirror unit pattern; `WorldFrame.selectedBuilding: SelectedBuildingView \| null` projection; Switchboard + Branch Bureau gain player-readable HP) · #335 multi-step zoom (4-step ladder 30→22→16→10 with silent-clamp endpoints, `FRUSTUM_STEPS` + `nextZoomStep` in `js/render/zoom-step.js` for testability) — *shipped v1.1.1* | First Tier-1.x polish session against v1.1.0 same-day playtest reports. ICD-01 v0.6.5 → v0.6.6 (`SelectedBuildingView` widens `BuildingView` with `district`; `WorldFrame.selectedBuilding` top-level field). Tests at 355 cases (334 → 355 = +21; three new test files: `building-select.test.mjs` · `input-pan.test.mjs` · `zoom.test.mjs`). Closes Gitea issues #332/#333/#334/#335 + stale #330. Defers #336 (likely auto-resolved by fog fix) and #337 (minimap, separate ticket). | strong |
| **1.1.2** | Playtest UX polish round 2 — #336 dossier hierarchy (`#hud-dossier` border-top `1px var(--rule)` → `2px var(--ink)` to match the deadline-strip weight; `.panel` `min-height` 78px → 120px so the auto-sized dossier row grows from ~105px → ~148px without changing the body grid template) · #337 minimap (new 140×140 px HUD widget bottom-right of `#world` — 10×10 grid + buildings/units/leads/visible-goons + selection ring + iso-rotated camera-frustum rhombus overlay; pure projection helpers `tileToPixel`/`worldXZToPixel`/`frustumQuad` in new `js/render/minimap.js`; `Minimap` region added to `HudCorkboard` as fifth sibling; `renderer.getView()` exposes pan + frustum + aspect through `actions.getView` callback so the HUD never holds a renderer reference) — *shipped v1.1.2* | Second Tier-1.x polish session. Closes the two items v1.1.1 deferred (#336 was *"likely auto-resolved by fog fix"* — required CSS reinforcement; #337 *"benefits from #332 calibration landing first"* — now calibratable). **No ICD bumps** — all minimap inputs come from existing WorldFrame fields (ICD-01 v0.6.6) + renderer-local view state. Tests at 365 cases (355 → 365 = +10; new `minimap.test.mjs`). Closes Gitea issues #336/#337. The v1.1.x playtest UX polish track is now done. | strong |
| **1.2.0** | Tier-1.x adversarial maturation — Observer DESPERATE + SILENCED state bodies (ICD-02 v0.3.3). DESPERATE body: INVESTIGATE→DESPERATE transition emits `PARTNER_REQUEST { district }` one-time with `district = argmax(view.world.district_heat)`; World reconciler writes `World.partnerOffer`; HUD surfaces an Accept | Decline chip in the Threats panel; `World.acceptPartnerOffer` debits `PARTNER_DEAL_COST = $500`, transfers to Observer, sets `World.activePartnerDeal { district, editionsRemaining: 5 }`, suppresses Observer PUBLISH via `observerPublishSuppressed` counter; `_fireDebrief` plating gate skips stories whose district matches the active deal; deal expiry ticks down at edition end. SILENCED body: player heat decay ×`SILENCED_DECAY_FACTOR = 0.5` in `ackDebrief` while any rival has `state === 'SILENCED'`. `RivalView` widens with `world: { district_heat, observer_publish_suppressed }` so the Observer reads world signals without a backlink. — *shipped v1.2.0* | First Tier-1.x adversarial-maturation session against the roadmap "Next" list (Herald PUNISH/BUYOUT · Observer DESPERATE/SILENCED · Star-vs-Observer raid · audio bus · further arcs). **Three ICD bumps in-PR (Constraint #4):** ICD-01 v0.6.6 → v0.6.7 (`PartnerOfferView` + `ActivePartnerDealView` + two `WorldFrame` nullable fields); ICD-02 v0.3.2 → v0.3.3 (RivalView §world block + §Observer §DESPERATE/§SILENCED body completions + state-table "First milestone" column); ICD-04 v0.1.4 → v0.1.5 (`SaveBlobV1` widens with `partner_offer?` + `active_partner_deal?` + `observer_publish_suppressed?`; v1.3 → v1.4 migration). Tests at 390 cases (365 → 390 = +25; new `world-partner-deal.test.mjs` + 5 cases · new `world-silenced-decay.test.mjs` + 5 cases · observer.test.mjs + 3 cases · hud.test.mjs + 3 cases · save-load.test.mjs + 2 cases). | strong |
| **1.3.1** | Playtest UX polish round 3 (legibility pass) — unit-role caption in §13 SELECTED dossier (`ROLE_CAPTIONS` map; Photog "Plates leads at the Darkroom" is the load-bearing inner-loop hint; Editor "Stationed at the Bureau — directs your reporters" substitutes for the silent dispatch-rejection) · lead marker re-skinned from a flat slab to a hovering flavor-colored octahedron with sin-bob (no more "reads as architectural detail on the Darkroom roof") · new `js/render/lead-colors.js` collapses duplicated flavor→color maps shared by minimap (hex) + 3D scene (int) · slow-mo HUD pill (transient top-right `SLOW-MO · 4.2s` countdown reusing existing `activeRemainingMs`) · zoom HUD pill (`ZOOM N/4` for 1.2s on every `[`/`]` press; renderer increments `_zoomCallCount` before clamp early-return so endpoint mashes flash too) · `FRUSTUM_STEPS` widened `[30,22,16,10]` → `[36,24,16,10]` (outer pull-back now visibly dramatic) · `PAN_SPEED` `TILE*4` → `TILE*10` (60 u/s; tap-style play now crosses the grid in ~10 inputs) · version centralization (new `js/version.js` exports `VERSION` + `VERSION_TAGLINE`; `main.js` boot-writes both `document.title` and `#hud-version` so the next bump touches one file) — *shipped v1.3.1* | Second Tier-1.x playtest UX-polish session (after v1.1.1 / v1.1.2). The v1.3.0 same-day playtest reported the inner loop is mechanically working but invisible to a first-time player — every fix targets affordance/feedback, not mechanics. **No ICD bumps** — all surfaces render existing `WorldFrame` fields or are pure tuning constants; mirrors the v1.1.1 / v1.1.2 precedent. Role-aware dispatch filtering (rejecting Fixer→building etc. with a toast) deferred — caption discoverability is sufficient; filtering touches the sim layer and likely needs an ICD-02 §Notes addition for the rejection-reason channel. Tests at 419 cases (397 → 419 = +22; new `tests/version.test.mjs` · `tests/lead-colors.test.mjs` · `tests/hud.test.mjs` extended with `ROLE_CAPTIONS` / `SlowMoPill` / `ZoomPill` cases · `tests/zoom.test.mjs` + `tests/input-pan.test.mjs` updated for the new constants). | strong |
| **1.3.0** | Audio bus first caller (ICD-07 v0.1) — new `js/audio/cue-table.js` (pure const map binding `FxEvent.kind` → `{ id, channel, path }` for the three Supplement-C SFX cues recorded 2026-05-22: `pickup → SFX-01` typewriter · `verify → SFX-05` camera shutter · `print → SFX-07` press fires) · new `js/audio/audio-bus.js` (Node-importable bus class: `loadAll` preloads · `consumeEffects(events)` drains `WorldFrame.effects[]` and routes by kind · `unlock()` lifts the autoplay gate · `mute(channel?)` unwired for the second caller) · new `js/audio/html-audio-player.js` (default browser Player; `HTMLAudioElement` per cue with a 3-element clone pool to avoid Safari `currentTime = 0` re-trigger stall) · `js/main.js` constructs the bus after slow-mo init and drains `frame.effects` into it after `renderer.apply` (renderer iterates without mutating; bus + renderer in lockstep) · `js/input.js` calls `audioBus.unlock()` on first `mousedown`/`keydown` (idempotent) — *shipped v1.3.0* | First caller against ICD-07 v0.1 (authored at PRE-0.10 / shipped v0.9.4). **No ICD bumps** — ICD-07 line 130 anticipated the cue-id drift ("cue ids may shift as the Supplement-C catalog is recorded; the channels and trigger sites are locked"); a §Notes addendum binds the v1.3.0 SFX-01/05/07 subset against the locked channel commitments (Constraint #4 satisfied via §Notes per the ICD-02 v0.3.2 §Notes precedent). Press-silence beat (`CYCLE_GAME_OVER` → mute AMB-04/05) deferred for the second caller — no AMB cue recorded yet; the `mute(channel?)` primitive ships unwired so the next caller adds the listener in three lines. Ducking engine + AMB / MUS / VO recording + engine swap to Web Audio API all defer to subsequent callers. Tests at 397 cases (390 → 397 = +7; new `tests/audio-bus.test.mjs` covering cue-table shape lock, pre-/post-unlock dispatch, unknown-kind silence, mute/loadAll forwarding). | strong |

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

**v1.3.0 — Audio bus first caller (ICD-07).** First caller against
ICD-07 v0.1 (authored at PRE-0.10 / shipped v0.9.4). The game gains
audible cues for the inner loop's three diegetic beats: typewriter on
Reporter pickup (SFX-01), camera shutter on Photog plating at the
Darkroom (SFX-05), press firing on edition print (SFX-07). All three
Supplement-C cues already recorded against the venice.ai workflow on
2026-05-22 — ICD-07 §Asset reference identifies them as the T0 SFX
subset. Four deliverables ship:

(1) **`js/audio/cue-table.js` (new).** Pure const map binding
`FxEvent.kind` → `{ id, channel, path }` for the three recorded cues.
All route the `sfx` channel per ICD-07's locked channel commitments.
`death` / `raid_warning` / `flash` intentionally absent (their
Supplement-C cues unrecorded) — `consumeEffects` passes them silently.

(2) **`js/audio/audio-bus.js` (new).** Node-importable bus class.
`loadAll()` preloads every cue at boot; `consumeEffects(events)` drains
a `WorldFrame.effects[]` array and routes by kind through the cue
table; `unlock()` lifts the browser-autoplay gate (idempotent);
`mute(channel?)` / `unmute(channel?)` forward to the player for the
future press-silence beat. The bus never imports `HTMLAudioElement` —
the browser surface lives in `html-audio-player.js` so the bus stays
testable under `node:test` without DOM.

(3) **`js/audio/html-audio-player.js` (new).** Default browser Player.
`HTMLAudioElement` per cue with a 3-element pool (`cloneNode` at
construction) so rapid re-triggers don't fight over one element and
Safari's `currentTime = 0` re-trigger stall is avoided. Channel-scoped
mute via `setMuted(muted, channel?)`.

(4) **Wire-in.** `js/main.js` constructs `AudioBus(new HTMLAudioPlayer())`
after the slow-mo init, calls `audioBus.loadAll()`, passes `audioBus`
through `attachInput`'s hooks for the unlock plumbing. Per-frame loop
adds `audioBus.consumeEffects(frame.effects)` between `renderer.apply`
and `hud.apply` — same drained array; renderer iterates without
mutating so reading after is safe and the bus stays in lockstep with
the renderer's FX channel. `js/input.js` calls `audioBus.unlock()` on
the first `mousedown` or `keydown` (idempotent) so the player can hear
audio without the bus being coupled to input.

**No ICD bumps in-PR.** ICD-07 line 130 anticipates the cue-id drift;
a §Notes addendum binds the v1.3.0 SFX-01/05/07 subset against the
locked channel commitments (Constraint #4 satisfied via §Notes per the
ICD-02 v0.3.2 §Notes precedent). Tests at 397 cases (390 → 397 = +7
— new `tests/audio-bus.test.mjs` covering cue-table shape lock,
pre-/post-unlock dispatch, unknown-kind silence, mute/loadAll
forwarding). Press-silence beat + ducking engine + AMB / MUS / VO
recording + engine swap to Web Audio API all defer to subsequent
callers.

**Next: remaining Tier-1.x content + adversarial maturation.** Herald
PUNISH + BUYOUT state bodies (mirrors v1.2.0 — caller methods exist,
bodies need wiring) · Star-vs-Observer raid mechanic (§06 matrix cell 3 ·
also triggers SILENCED so v1.2.0's body becomes reachable via two
routes) · second audio caller (press-silence beat once AMB-04/05
record) · further authored arcs (Mayor's Mistress · Empty Vault ·
Frame the Observer) · district-disposition mechanical effect at the
1.1.x balance pass.

---

**v1.2.0 — Tier-1.x adversarial maturation · Observer DESPERATE +
SILENCED state bodies.** First Tier-1.x adversarial-maturation session
against the roadmap "Next" list. The Observer's two caller-triggered
states — shape-committed at v1.0.0 with `acceptPartner` / `declinePartner`
/ `frame` methods on `js/sim/observer.js` but no body behavior — get their
ICD-02 v0.3.3 bodies. Three deliverables ship:

(1) **DESPERATE body — PARTNER_REQUEST emission + HUD chip.** The
INVESTIGATE → DESPERATE branch in `observer.js` emits
`PARTNER_REQUEST { district }` one-time on transition (the persistent
DESPERATE body still PASSes — no flag needed because the emit is bound to
the transition, not the body). District nomination is `argmax(view.world.
district_heat)` with declaration-order tie-break — the Observer punishes
where the player has been loudest. `RivalView` widens with a top-level
`world: { district_heat, observer_publish_suppressed }` block so the
Observer reads world signals through the projection (never a World
backlink). The World's `_reconcileIntent` PARTNER_REQUEST branch writes
`World.partnerOffer`; `WorldFrame.partnerOffer` projects it; the Threats
panel renders a corkboard chip via new `renderPartnerOfferChip` (mirrors
the v1.1.0 arc-branch chip in Story queue — same delegated-listener
pattern in `Dossier._onThreatsClick`).

(2) **DESPERATE acceptance/decline + active deal.** `World.acceptPartnerOffer()`
debits `PARTNER_DEAL_COST = $500` from player cash, hands it to the
Observer (via `observer.acceptPartner()`), sets
`World.activePartnerDeal { district, editionsRemaining: 5 }`, and flips
`World.observerPublishSuppressed = 5`. `_fireDebrief` plating gate skips
verified stories whose `district === activePartnerDeal.district` (they
stay verified at the Darkroom). The Observer's INVESTIGATE → PUBLISH
predicate reads `view.world.observer_publish_suppressed > 0` and
short-circuits to PASS. Deal expiry ticks down once per edition end in
`ackDebrief`; on zero the deal + suppression both clear.
`WorldFrame.activePartnerDeal` projects the countdown for the
breadcrumb (`Partner deal · 3 editions left · The Docks blocked`).

(3) **SILENCED body — heat decay slowdown.** While any rival has
`state === 'SILENCED'` the player's per-edition heat decay multiplies by
`SILENCED_DECAY_FACTOR = 0.5` in `ackDebrief`. ICD-02 v0.3.3 reading:
*"Heat decays slower for the player while Observer is silenced (the city
notices the silence)"* — the city's suspicion fills the silence, so heat
persists ~2× longer. The HEAT_DECAY_STALL_THRESHOLD rule still wins (the
multiplier applies inside the existing decay branch, not over it).
SILENCED entry stays caller-triggered via `observer.frame()` — the Tier-IV
"Frame the Observer" arc that would surface it in normal play is its own
later milestone.

**Three ICD bumps in-PR (Constraint #4):** ICD-01 v0.6.6 → v0.6.7
(`PartnerOfferView` + `ActivePartnerDealView` view-structs + two
`WorldFrame` nullable fields); ICD-02 v0.3.2 → v0.3.3 (RivalView §world
block + §Observer §DESPERATE/§SILENCED body completions + state-table
"First milestone" column updates); ICD-04 v0.1.4 → v0.1.5 (`SaveBlobV1`
widens with `partner_offer?` + `active_partner_deal?` +
`observer_publish_suppressed?` — all optional; `migrate_1_3_to_1_4`
stamps the version and defaults to null/0). Tests at 390 cases
(365 → 390 = +25; new `world-partner-deal.test.mjs` covering the
reconciler / accept-decline / plating gate / PUBLISH suppression /
WorldFrame projection · new `world-silenced-decay.test.mjs` covering
the multiplier + stall-rule interaction · observer.test.mjs adds the
PARTNER_REQUEST emission shape + transition-once invariant + PUBLISH
suppression gate · save-load.test.mjs adds v1.3 → v1.4 migration +
active-deal round-trip · hud.test.mjs adds chip + breadcrumb render
helpers · world-frame.test.mjs + rival-view.test.mjs update the
schema-lock key sets).

**Next: remaining Tier-1.x content + adversarial maturation.** Herald
PUNISH + BUYOUT state bodies (same pattern — caller methods already
exist, bodies need wiring) · Star-vs-Observer raid mechanic (§06 matrix
cell 3 · burning down the Observer's bureau also triggers SILENCED, so
the v1.2.0 body becomes reachable via two routes) · audio bus first
caller against ICD-07 · further authored arcs (Mayor's Mistress · Empty
Vault · Frame the Observer — Tier-IV; surfaces SILENCED in normal play) ·
district-disposition mechanical effect (spawn-rate / raid-prob modifiers)
at the 1.1.x balance pass.

---

**v1.1.2 — Playtest UX polish round 2 (dossier hierarchy · minimap).**
Second Tier-1.x polish session. Closes the two deferred items from the
v1.1.0 same-day playtest (v1.1.1 took the four first-launch blockers).
Two deliverables ship: (1) **#336 dossier hierarchy** — `index.html`
`#hud-dossier { border-top: 1px solid var(--rule); }` →
`2px solid var(--ink);` matches the deadline-strip's heavy ink weight at
the top of `#world` so the bottom row carries equal hierarchy; `.panel`
`min-height: 78px` → `120px` grows the auto-sized dossier row from
~105px → ~148px without changing the body grid template. CSS-only.
(2) **#337 minimap** — new 140×140 px HUD widget bottom-right of
`#world` (top is owned by the deadline strip). Renders the 10×10 grid +
4 buildings (kind-colored squares) + leads (flavor-colored diamonds) +
player units + visible goons + selection ring + camera frustum overlay
(iso-rotated ground rhombus from the orthographic camera).
`js/render/minimap.js` (new, pure) hosts the projection helpers
(`tileToPixel`, `worldXZToPixel`, `frustumQuad`) — mirrors the v1.1.1
`zoom-step.js` factoring so the math is testable without DOM / THREE.
`js/hud.js` adds the `Minimap` region as a fifth `HudCorkboard` sibling.
`js/render/renderer.js` exposes `getView()` returning `{ pan, frustum,
aspect }`; the HUD reads it through `actions.getView` (callback at
construction, same pattern as `actions.toggleArchive`). **No ICD bumps
in-PR** — all minimap inputs come from existing WorldFrame fields (ICD-01
v0.6.6) + renderer-local view state ICD-01 §Notes pins as "renderer
never reaches back". Tests at 365 cases (355 → 365 = +10; new
`tests/minimap.test.mjs`). Closes Gitea issues #336 + #337. The v1.1.x
playtest UX polish track is now done; next opens Tier-1.x content +
adversarial maturation (Herald PUNISH / BUYOUT · Observer DESPERATE /
SILENCED · Star-vs-Observer raid · audio bus first caller · further
authored arcs).

---

**v1.1.1 — Playtest UX polish (fog · WASD · building dossier · multi-step
zoom).** First Tier-1.x polish session. v1.1.0 shipped at 14:22; the same-
day playtest produced six issues — four cascading bugs (only the Darkroom
visible · WASD drifts diagonally · building clicks deselect · `[`/`]`
appears unresponsive) plus a dossier hierarchy bug and a minimap
enhancement. This PR bundles the four bugs as one milestone; the two
deferred issues are tracked separately. (1) **#332 fog calibration** —
camera position (40,35,40) → (24,22,24) via `CAMERA_OFFSET` (renderer.js);
camera-to-target distance shrinks ~65 → ~40 units, every grid tile inside
the fog band [22, 60]. (2) **#333 WASD pan** — `KEY_PAN` unit vectors
rotated 45° in XZ (input.js); each key maps to its screen axis under the
iso camera. (3) **#334 building dossier (Option A)** — `World.buildingAtTile`
+ `World.selectBuilding` mirror the unit pattern, mutually exclusive with
unit selection; `WorldFrame.selectedBuilding: SelectedBuildingView | null`
projects when set; HUD renders `Bureau · 60/60 HP · The Docks` in the §13
SELECTED card. Switchboard + Branch Bureau gain their first player-
readable HP surface. (4) **#335 multi-step zoom** — replaced the 2-state
toggle with a 4-step ladder `FRUSTUM_STEPS = [30, 22, 16, 10]` (renderer.js
+ zoom-step.js); `[` steps in, `]` steps out, clamped at endpoints. **One
ICD bump in-PR (Constraint #4):** ICD-01 v0.6.5 → v0.6.6 (`SelectedBuildingView`
+ `WorldFrame.selectedBuilding`). Tests at 355 cases (334 → 355 = +21;
three new test files). Closes Gitea issues #332/#333/#334/#335 + stale
tracking #330. Defers #336 (verify post-fog-fix) and #337 (minimap, own
ticket).

---

**v1.1.0 — Tier-1 content · first authored arc (Longshoreman Strike) +
Investigation 3-step chain.** First Tier-1.x content session against the
ten authored ICDs. New `js/sim/arcs.js` lifts the `THE_LONGSHOREMAN_STRIKE`
record verbatim from ICD-10 §Spec-validation (4 episodes · 4 outcomes ·
trigger: docks heat > 60 AND docks covered AND observer silent ≥ 3
editions). The lead-spawner's `tier === 'arc'` collapse line retires;
`_runSpawnerTick` consults the arc registry, evaluates triggers against
a pure context object (heat · edition · districtHeat · coveredDistricts
· observerRecentStates · rivalStates), and either upgrades the spawn to
an authored arc episode (one-instance-per-arc-id enforced) or downgrades
to investigation as fallback. `_handlePhotogArrival` adds the
Investigation 3-step chain hook — on `lead → verified` for tier
'investigation' the sim spawns a successor in the same district with
`parent_story_id` set, capped at depth 3, deterministic from parent.id
via FNV-1a hash. `World.pickArcBranch(storyId, label)` records the
player's intent (corkboard in-line chip click); the un-picked arc gate
in `_fireDebrief` blocks plating until the player commits.
`_applyArcPlate` fires at the verified → plated boundary: terminal
choices write `cash_one_time` / `heat_one_time` to `World.resources` +
`districtDispositions` (last-writer-wins per ICD-10 §Open-Q4 close);
advance choices spawn the next episode's lead in the same district via
`_spawnArcEpisode`. District-heat accumulator (`World.districtHeat`) +
flat `-5 / edition` decay powers `district_heat_above`. Observer gains
a `recentStates` ring (cap 5) pushed once per edition for
`observer_silent_n_editions` ("not loud" semantics — loud = PUBLISH /
WARN). Dossier story-queue rows render `Arc · Longshoreman Strike ·
bury | splash` chips for un-picked arc stories, `Picked: splash` for
picked, `Investigation 2/3` for chained investigations. **Four ICD
bumps in-PR (Constraint #4):** ICD-10 v0.1 → v0.1.1 (six surface
changes: StoryArc.district · negate flag · observer_silent
semantics · district_heat lit · Story foreign keys · save-surface lift;
three §Open-Qs closed Q1/Q3/Q4); ICD-04 v0.1.3 → v0.1.4 (three new
top-level fields + three StorySnap optional fields + ObserverSnap
recent_states + ActiveArcSnap interface + migrate_1_2_to_1_3); ICD-02
v0.3.1 → v0.3.2 (§Notes Observer.recentStates); ICD-05 v0.4.2 → v0.4.3
(§Notes cross-ref to ICD-10 v0.1.1). District-disposition mechanical
effect (spawn-rate / raid-prob modifiers) stored + displayed but
deferred to the 1.1.x balance pass per ICD-10 §Notes. Tests at 334
cases (281 → 334; new arcs-trigger.test.mjs · arcs-episode.test.mjs ·
investigation-chain.test.mjs + extensions to observer.test.mjs ·
save-load.test.mjs · hud.test.mjs).

---

**v1.0.1 — Tier-1 opener · Archive UI + projectors + debrief gate.**
Second Tier-1 code session, closing out the 1.0 split scheduled by issue
#317. The four 1.0.1 deliverables ship intact: Archive UI per ICD-09
(player gesture is left-click on per-story dossier rows · `archived:
N/5` count line · `ARCHIVE_CAP = 5` hard cap · 10-edition cold-news
decay walk at `EDITION_DEBRIEF_END`); the deferred `UnitView.stats`
projector lights up the §13 Selected dossier's *"Nerve 6 · Nose 8 ·
Legs 4"* line for Reporters (ICD-01 v0.6.3 §Notes pattern's load-bearing
case wires); the Story-queue dossier now reads `LeadView.district` for
the per-row caption (the projector itself shipped in the 0.10.0
substrate); the 30 s minimum debrief gate clamps the dismiss click via
a panel-owned rAF countdown ribbon (ICD-06 v0.4 §Cycle timing · audit
C-05). Save schema bumps v1.1 → v1.2 in-PR via `migrate_1_1_to_1_2`
(pure version stamp — both new fields are optional). **Four ICD bumps
in-PR (Constraint #4):** ICD-01 v0.6.4 → v0.6.5; ICD-04 v0.1.2 → v0.1.3;
ICD-05 v0.4.1 → v0.4.2 (§Notes only); ICD-09 v0.1 → v0.1.1 (§Open Q1
close). Tests at 281 cases (257 → 281). Closes Gitea issue #317.

---

**v1.0.0 — Tier-1 opener · adversarial substrate (Herald + Observer +
Switchboard).** First Tier-1 code session against the ten authored ICDs.
The 1.0.0 / 1.0.1 split was taken at session open per issue #317 + the
0.7 / 0.10 precedent: 1.0.0 ships the adversarial triangle (Herald +
Observer state machines · Switchboard intel-defense building · goon LoS
visibility filter · save-schema v1.0 → v1.1 migration). 1.0.1 (next
session) ships the Archive UI + the deferred projectors + the 30 s
debrief gate. **Three ICD bumps in-PR (Constraint #4):** ICD-01
v0.6.3 → v0.6.4 (`BuildingKind` widens for `'switchboard'`); ICD-02
v0.3 → v0.3.1 (`RivalView.player.printed_lies` field added);
ICD-04 v0.1.1 → v0.1.2 (`RivalsSnap` widens; v1.0 → v1.1 migration).
Tests at 257 cases (199 → 257). See
[`architecture/re-eval-tier-0-to-1.md`](architecture/re-eval-tier-0-to-1.md)
§3 for the deliverable list this PR closes against the 1.0.0 half of.

---

**PRE-1.0 — shipped (v0.10.4).** Paper-only architecture session. Authored
**ICD-02 v0.3** (Herald five-state machine `IDLE | COURT | WIRED | PUNISH |
BUYOUT` lifted verbatim from
[`design/rival-ai-spec.html`](design/rival-ai-spec.html) §03 FIG. H1 with
tick cadence `1/EDITION`; Observer five-state machine `INVESTIGATE |
PUBLISH | WARN | DESPERATE | SILENCED` lifted from §05 FIG. O1 with tick
cadence `1/2 EDITIONS`; two new Intent kinds added —`PUBLISH_COUNTER` +
`INVESTIGATE_LEAD`; `RivalStatusView` posture mapping extended to all
three rivals; §Notes inter-rival paragraph against §06 interaction matrix
naming three matrix cells, only cell (1) wiring at milestone 1.0;
Observer DESPERATE `PARTNER_REQUEST` formally settles the
[`discussion/observer-violence.md`](discussion/observer-violence.md)
partner-fund-violence parking note), **ICD-08** (new — Switchboard
line-of-sight contract; rectangular axis-aligned LoS at ±6-tile
medium-band radius; "no Switchboard → reveal at 1-tile Bureau radius"
defensive default lifting the design HTML §10 *"window breaking"* beat;
no top-level WorldFrame field — extends the existing snapshot-layer
filter), **ICD-09** (new — Archive / inter-edition story state; new
`Story.state` value `'archived'` extending ICD-05's four-state union to
five; two new transition rows `verified ↔ archived`; archive cap = 5
medium-band; cold-news decay = 10 editions medium-band; HUD surface is
a single dossier-row count addition), **ICD-10** (new — Arc framework
formalization; `StoryArc` record (id · trigger · episodes · outcomes);
Investigation 3-step chain semantics via `Story.parent_story_id`;
trigger predicate vocabulary with eight named kinds + two composers
(`all_of` / `any_of`); THE LONGSHOREMAN STRIKE encoded as the
spec-validation reference per design-doc.html §18 lines 1382-1392),
and **ICD-01 v0.6.3** (single §Notes paragraph addition pinning the
*"authored-but-deferred-projection"* pattern surfaced at the
post-Tier-0 → Tier-1 re-eval). **Milestone 1.0 is now code-ready** —
every required contract is in hand. Two source-HTML-name
reconciliations against the re-eval doc's informal naming (`LURK` →
`IDLE`; `WATCH` → `INVESTIGATE`) per the source-HTML-wins rule. One
Gitea ticket opened for milestone 1.0 (Tier-1 opener). See
[`architecture/re-eval-tier-0-to-1.md`](architecture/re-eval-tier-0-to-1.md)
§3 for the deliverable list this PR closes against.

---

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
- [x] **Milestone 1.0.0** — Tier-1 opener · adversarial substrate. New
      [`js/sim/herald.js`](js/sim/herald.js) (IDLE | COURT | WIRED | PUNISH |
      BUYOUT, tick 1/EDITION) + [`js/sim/observer.js`](js/sim/observer.js)
      (INVESTIGATE | PUBLISH | WARN | DESPERATE | SILENCED, tick 1/2
      EDITIONS) lifted from ICD-02 v0.3. IDLE / COURT / WIRED + INVESTIGATE
      / PUBLISH / WARN bodies ship; the remaining four states (PUNISH /
      BUYOUT / DESPERATE / SILENCED) are shape-committed but caller-
      triggered (acceptWire / declineWire / breakDeal / acceptPartner /
      declinePartner / frame). Switchboard `BuildingKind` widens
      ICD-01 v0.6.4; spawned at tile (3, 3) with HP 30. `World._isUnitVisible`
      filters goons in `snapshot()` per ICD-08 §Visibility projection rule
      (±6 LoS rect OR Chebyshev ≤ 1 of any Bureau-family building).
      `World.rivals = [evening_star, herald, observer]` (iteration order
      pinned). `_reconcileIntent` gains branches for `PUBLISH_COUNTER`
      (+25 player heat + digest), `INVESTIGATE_LEAD`, `POISON_LEAD` (digest
      only at 1.0.0). `_buildRivalView` adds `player.printed_lies` (ICD-02
      v0.3.1 — last 5 editions of `truthful === false` printed stories).
      Save schema bumps v1.0 → v1.1 in-PR (ICD-04 v0.1.2 — `RivalsSnap`
      widens to `{evening_star, herald, observer}`; `migrate_1_0_to_1_1`
      synthesizes default Herald + Observer state for pre-1.0.0 saves).
      Tests at 257 cases (199 → 257; new `herald.test.mjs` ·
      `observer.test.mjs` · `switchboard.test.mjs` ·
      `herald-observer-integration.test.mjs`).
- [x] **PRE-1.0** — paper-only. Authored **ICD-02 v0.3** (Herald five-state
      machine `IDLE | COURT | WIRED | PUNISH | BUYOUT` lifted verbatim
      from [`design/rival-ai-spec.html`](design/rival-ai-spec.html) §03
      FIG. H1 with tick cadence `1/EDITION`; Observer five-state machine
      `INVESTIGATE | PUBLISH | WARN | DESPERATE | SILENCED` lifted from
      §05 FIG. O1 with tick cadence `1/2 EDITIONS`; two new Intent kinds
      added — `PUBLISH_COUNTER` + `INVESTIGATE_LEAD`; `RivalStatusView`
      posture mapping extended to all three rivals — Herald never reaches
      `hostile` per §03 *"Never sends goons"*, Observer never reaches
      `hostile` per §05 *"never hostile except via information"*; §Notes
      inter-rival paragraph against §06 interaction matrix naming three
      matrix cells, only cell (1) wiring at milestone 1.0; Observer
      DESPERATE `PARTNER_REQUEST` formally settles the
      [`discussion/observer-violence.md`](discussion/observer-violence.md)
      partner-fund-violence parking note). Authored **ICD-08** (new —
      Switchboard line-of-sight contract; rectangular axis-aligned LoS
      at ±6-tile medium-band radius; "no Switchboard → reveal at 1-tile
      Bureau radius" defensive default lifting design-doc.html §10 line
      1088 *"Information about the threat is itself a defense resource"*;
      no top-level `WorldFrame` field — extends the existing snapshot-
      layer filter; save surface is value-level widening on
      `SaveBlobV1.buildings[]` with `BuildingKind` widening landing
      in-PR on ICD-01 at milestone 1.0). Authored **ICD-09** (new —
      Archive / inter-edition story state; new `Story.state` value
      `'archived'` extending ICD-05's four-state union to five; two new
      transition rows `verified ↔ archived` — the only non-monotonic
      edges in the Story state machine, explicitly authorized by ICD-09
      per design-doc.html §06 line 888 *"Stories live in your archive
      until you commit them to the next edition"*; archive cap = 5
      medium-band; cold-news decay = 10 editions medium-band; HUD
      surface is a single dossier-row count addition `archived: N/5`).
      Authored **ICD-10** (new — Arc framework formalization; `StoryArc`
      record with id · trigger · episodes · outcomes; Investigation
      3-step chain semantics via `Story.parent_story_id` plus optional
      `arc_episode_id` foreign keys on Story; trigger predicate
      vocabulary with eight named kinds plus two composers `all_of` /
      `any_of`; THE LONGSHOREMAN STRIKE encoded as the spec-validation
      reference per design-doc.html §18 lines 1382-1422; arc save block
      `SaveBlobV1.active_arcs[]` deferred to ICD-04 v0.1.2 in-PR at the
      first arc-content milestone). Authored **ICD-01 v0.6.3** (single
      §Notes paragraph pinning the *"authored-but-deferred-projection"*
      pattern surfaced at the post-Tier-0 → Tier-1 re-eval §1.5; no
      shape change). Same PR carries the
      [`discussion/observer-violence.md`](discussion/observer-violence.md)
      status flip from `pre-PRE-1.0 input` to `settled at PRE-1.0`. Two
      source-HTML-name reconciliations against the re-eval doc's
      informal naming (`LURK` → `IDLE`; `WATCH` → `INVESTIGATE`) per the
      [`AGENTS.md`](AGENTS.md) source-HTML-wins rule. Milestone 1.0
      Gitea ticket opened. Milestone 1.0 (Tier-1 opener) is now
      code-ready.

## Out of scope until called

- ~~**ICD-04** — explicitly deferred to PRE-0.8 by the supplement.~~ Authored
  at v0.1 in PRE-0.8 (shipped v0.7.2); no longer out of scope.
- ~~**Tier-1 architecture** — gated behind the Tier-0 → Tier-1 RE-EVAL slot.~~
  Re-eval shipped (v0.10.3); PRE-1.0 (paper-only) shipped (v0.10.4) —
  authored ICD-02 v0.3 + ICDs 08 / 09 / 10 + ICD-01 v0.6.3. Tier-1
  architecture surface is no longer out of scope. Milestone 1.0
  (Tier-1 opener) is the next code session. Tier-2 (procedural city ·
  MP · accounts · audio asset pipeline · cumulative tech-tree
  branches) remains out of scope until a later re-eval calls it in.
