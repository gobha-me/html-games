# Late Edition

A noir RTS where the player runs a 1940s newspaper that's a front for an
information empire. Deploy reporters across a fog-soaked city, convert leads
into stories, hit the print deadline every 12 in-game minutes, and defend the
press from rival papers and crime bosses. Build → defend → upgrade fused with
resource optimization on a print-cycle clock.

## Status

**v1.5.0 — Herald PUNISH + BUYOUT state bodies.** Second Tier-1.x
adversarial-maturation session (after v1.2.0's Observer DESPERATE /
SILENCED bodies). The Herald's two caller-triggered states — shape-
committed at v1.0.0 with state-machine transitions in place but bodies
still PASSing — wire their ICD-02 v0.3.4 bodies. **PUNISH** emits
`FILE_STORY { tier:'investigation', source:'herald' }` on entry
(heat-driven IDLE→PUNISH OR caller-driven decline paths) subject to a
3-edition cooldown via `Herald.lastScoopEdition`; the World reconciler
flips the oldest queued Investigation story in the nominated district
(`argmax(district_heat)`) to `scooped=true`. A scooped story is
invisible to Reporter auto-pickup, blocked from plating (same dwell
mechanism as the v1.2.0 partner-deal gate), and surfaces in the Story
queue dossier with a `[SCOOPED]` chip + strikethrough headline.
**BUYOUT** emits `OFFER_BUYOUT { amount: 50_000 }` one-time on
WIRED→BUYOUT entry; acceptance triggers the **first run-end win path
in the game** — `World.acceptBuyout` adds $50k to player cash, sets
`World.endingState='establishment'`, sets `gameOver=true`, and emits
`CYCLE_ESTABLISHMENT_ENDING` so the existing game-over overlay mounts
with **THE PRESS WAS BOUGHT** banner (vs. fail-state's THE PRESS BURNS).
Decline latches `Herald.buyoutDeclined=true` and the Herald cascade
locks into PUNISH for the rest of the run — skipping the PUNISH→IDLE
cooldown via the locked-PUNISH branch — so a player who refuses the
buyout faces a hostile Herald scooping their investigations every 3
editions until the run ends. **Three ICD bumps in-PR (Constraint #4):**
ICD-01 v0.6.7 → v0.6.8 (`BuyoutOfferView` + `WorldFrame.buyoutOffer` +
`StoryQueueView.scooped` widening); ICD-02 v0.3.3 → v0.3.4 (§Herald
§PUNISH + §BUYOUT body completions; Intent table `FILE_STORY` source
widens to include `'herald'`; state-table First milestone column +
two new transition rows for the BUYOUT caller exits); ICD-04 v0.1.5
→ v0.1.6 (SaveBlobV1 widens with `buyout_offer?` + `ending_state?`;
HeraldSnap widens with three optional body fields; StorySnap widens
with `scooped?` + `scooped_at_ms?`; new `BuyoutOfferSnap` interface;
`HighScoreEntry.cause` widens; `migrate_1_4_to_1_5` authored).
ICD-06 §Notes addendum documents the new `CYCLE_ESTABLISHMENT_ENDING`
event kind. Tests at 504 cases (455 → 504 = +49; four new test files
covering Herald PUNISH body · Herald BUYOUT body · World scoop
reconciliation · Establishment ending + WorldFrame projection).
See [`roadmap.md`](roadmap.md) and [`CHANGELOG.md`](CHANGELOG.md).

**v1.4.0 — Settings popover (pan speed · audio mute).** First
Tier-1.x content session for **player-tunable preferences**. Gear-icon
button at top:40px/left:12px (alongside the slow-mo/zoom-pill row);
popover panel surfaces two primitives that shipped unwired in earlier
rounds: pan-speed multiplier (the v1.3.1 `js/preferences.js` scaffold,
console-only) and per-channel audio mute (the v1.3.0
`audioBus.mute(channel?)` primitive, no caller). `AUDIO_CHANNELS =
['sfx','amb','mus','vo']` exported as the canonical channel
vocabulary the popover renders one toggle per (AMB/MUS/VO ship
audible-but-silent until cues record). Six deliverables: `SettingsPanel`
class as a sixth HudCorkboard sibling, bus + player getters
(`isChannelMuted` / `getMuted`), preference writers
(`setPanSpeedMultiplier` / `get/setChannelMuted`), HUD wiring in
`js/main.js`, DOM + CSS in `index.html`, version bump. Five close
paths wired (gear toggle / close-button / ESC / outside-click /
programmatic). **No ICD bumps** — all surfaces are renderer/HUD layer
reading existing primitives; mirrors the v1.1.1 / v1.1.2 / v1.3.1
polish precedent (Constraint #4 satisfied trivially). Tests at 455
cases (419 → 455).

**v1.3.0 — Audio bus first caller (ICD-07).**
First caller against ICD-07 v0.1 (authored at PRE-0.10, shipped v0.9.4).
The game gets its first audible cues: the typewriter when a Reporter
picks up a lead (SFX-01), the camera shutter when a Photog plates at
the Darkroom (SFX-05), and the press firing when the edition prints
(SFX-07). All three Supplement-C cues already recorded against the
venice.ai workflow on 2026-05-22. Four deliverables land:
(1) **[`js/audio/cue-table.js`](js/audio/cue-table.js)** — pure const map
binding `FxEvent.kind` → `{ id, channel, path }` for the three recorded
cues; `death` / `raid_warning` / `flash` intentionally absent and pass
silently until their Supplement-C cues record.
(2) **[`js/audio/audio-bus.js`](js/audio/audio-bus.js)** — Node-importable
bus class. `loadAll()` preloads at boot; `consumeEffects(events)` drains
`WorldFrame.effects[]` and routes by kind; `unlock()` lifts the browser
autoplay gate (idempotent); `mute(channel?)` ships unwired for the
second caller's press-silence beat.
(3) **[`js/audio/html-audio-player.js`](js/audio/html-audio-player.js)** —
default browser-side Player implementation. `HTMLAudioElement` per cue
with a 3-element pool so rapid re-triggers don't fight over one element
(Safari `currentTime = 0` stall avoided via `cloneNode`).
(4) **First-gesture audio unlock** — `js/input.js` calls `audioBus.unlock()`
on the first `mousedown` or `keydown` so the bus satisfies browser
autoplay policy without coupling itself to input. The per-frame drain
hooks in [`js/main.js`](js/main.js) between `renderer.apply` and
`hud.apply` — same drained array; renderer iterates without mutating so
bus + renderer stay in lockstep on the FX channel. **No ICD bumps** —
ICD-07 line 130 anticipated the cue-id drift; a §Notes addendum binds
the v1.3.0 SFX-01/05/07 subset against the locked channel commitments.
Tests at 397 cases (390 → 397 = +7 — `tests/audio-bus.test.mjs` covers
cue-table shape lock, pre/post-unlock dispatch, unknown-kind silence,
mute forwarding, loadAll-per-entry). Press-silence beat + ducking
engine + AMB/MUS/VO recording all defer to subsequent callers. See
[`roadmap.md`](roadmap.md) and [`CHANGELOG.md`](CHANGELOG.md).

**v1.2.0 — Tier-1.x adversarial maturation · Observer DESPERATE +
SILENCED state bodies.** First Tier-1.x adversarial-maturation session
against the roadmap "Next" list. The Observer's two caller-triggered
states — shape-committed at v1.0.0 with `acceptPartner` /
`declinePartner` / `frame` methods on [`js/sim/observer.js`](js/sim/observer.js)
but no body behavior — get their ICD-02 v0.3.3 bodies. INVESTIGATE →
DESPERATE emits `PARTNER_REQUEST { district }` one-time with district =
`argmax(view.world.district_heat)`; World records the offer; HUD
surfaces an Accept | Decline chip; accept debits $500, sets a 5-edition
deal that blocks plating in the deal's district and suppresses Observer
PUBLISH; SILENCED scales the player's heat decay by 0.5 while any rival
is silenced (the city notices). Three ICD bumps in-PR (Constraint #4):
ICD-01 v0.6.6 → v0.6.7 · ICD-02 v0.3.2 → v0.3.3 · ICD-04 v0.1.4 →
v0.1.5. Tests at 390 cases (365 → 390). Closes Gitea issue #341.

**v1.1.2 — Playtest UX polish round 2 (dossier hierarchy · minimap).**
Second Tier-1.x polish session, closing out the two deferred items from
the v1.1.0 same-day playtest. v1.1.1 fixed the four cascading first-launch
bugs (fog · WASD · building dossier · multi-step zoom); v1.1.2 picks up the
two cosmetic / orientation items that were intentionally deferred to verify
post-fog-fix. Two deliverables land here:
(1) **#336 dossier hierarchy** — [`index.html`](index.html) `#hud-dossier`
border-top `1px solid var(--rule)` → `2px solid var(--ink)` (matches the
deadline-strip's heavy ink rule at the top of `#world` so the bottom row
carries equal hierarchy); `.panel` `min-height: 78px` → `120px` (the
auto-sized dossier row grows from ~105px to ~148px without changing the
body grid template, giving SELECTED / STORY QUEUE / THREATS visible
weight against the world canvas).
(2) **#337 minimap** — new 140×140 px HUD widget in the bottom-right of
`#world`. Renders the 10×10 grid + 4 buildings (kind-colored squares) +
leads (flavor-colored diamonds) + player units (kind-colored dots) +
visible goons (ink dots) + selection ring on the selected building or
unit + camera frustum overlay (the iso-rotated ground rhombus). Pure
canvas-2D; reads existing `WorldFrame` fields (no new projections) plus
new `renderer.getView()` for live pan + frustum + aspect. The HUD stays
projection-only — the renderer view is exposed via an `actions.getView`
callback at `HudCorkboard` construction, same pattern as
`actions.toggleArchive`. [`js/render/minimap.js`](js/render/minimap.js)
(new, pure) hosts the projection helpers (`tileToPixel` /
`worldXZToPixel` / `frustumQuad`) so the math is testable without DOM /
THREE; [`js/hud.js`](js/hud.js) gains a `Minimap` region as a fifth
`HudCorkboard` sibling. **No ICD bumps** — all minimap inputs come from
existing fields + renderer-local view state that ICD-01 §Notes
explicitly pins as "renderer never reaches back". Tests at 365 cases
(355 → 365 = +10 — `tests/minimap.test.mjs` covers tile-to-pixel
symmetry, world-XZ ↔ tile composition, frustum pan/zoom/aspect math).
Closes Gitea issues #336 · #337 — the v1.1.x playtest UX polish track
is now done; next opens Tier-1.x content + adversarial maturation
(Herald PUNISH / BUYOUT · Observer DESPERATE / SILENCED · audio bus
first caller · further authored arcs). See [`roadmap.md`](roadmap.md)
and [`CHANGELOG.md`](CHANGELOG.md).

**v1.1.1 — Playtest UX polish (fog · WASD · building dossier · multi-step zoom).**
First Tier-1.x polish session. v1.1.0 shipped at 14:22; the same-day
playtest produced six issues, four of which made the game feel broken
on first launch. This bundle restores baseline playability:
(1) **#332 fog** — `js/render/renderer.js` camera (40,35,40) → (24,22,24)
introduced as `CAMERA_OFFSET`; every grid tile now sits inside the fog
band [22, 60] at default pan (was: only the Darkroom at (7,7) drew, all
other buildings + units were past `fog.far`).
(2) **#333 WASD pan** — `js/input.js` `KEY_PAN` unit vectors rotated 45°
in XZ so each key maps to its screen axis under the iso camera (W=up,
A=left, S=down, D=right). `Math.hypot` normalize keeps |v| at PAN_SPEED
for single + two-key inputs.
(3) **#334 building dossier (Option A)** — left-click on a building tile
now populates the §13 SELECTED dossier (`Bureau · 60/60 HP · The Docks`).
New `World.buildingAtTile` + `World.selectBuilding` mirror the unit
selection API; mutually exclusive with unit selection (sim-side
enforcement). `WorldFrame.selectedBuilding: SelectedBuildingView | null`
projects when set. Switchboard + Branch Bureau gain their first
player-readable HP surface. **ICD-01 v0.6.5 → v0.6.6** in-PR
(Constraint #4) — one new view-struct + one new top-level
`WorldFrame` field.
(4) **#335 multi-step zoom** — replaced the 2-state `setZoom('city'|'block')`
toggle (read as broken when the player mashed one key, since the first
`]` at City was a no-op) with a 4-step ladder `FRUSTUM_STEPS = [30, 22,
16, 10]`. `[` steps in, `]` steps out, clamped silently at endpoints.
Pure index math (`nextZoomStep`) factored into `js/render/zoom-step.js`
for testability.
Tests at 355 cases (334 → 355 = +21 — three new test files:
`building-select.test.mjs` · `input-pan.test.mjs` · `zoom.test.mjs`).
Closes Gitea issues #332 · #333 · #334 · #335 + stale tracking #330.
Defers #336 (likely auto-resolved by fog fix — verify post-merge) and
#337 (minimap enhancement; benefits from #332 calibration landing
first). See [`roadmap.md`](roadmap.md) and [`CHANGELOG.md`](CHANGELOG.md).

**v1.0.1 — Tier-1 opener · Archive UI + projectors + debrief gate.**
Second half of the Tier-1 opener split (issue #317; 1.0.0 / 1.0.1
precedent followed from 0.7 / 0.10). Four deliverables land here:
(1) **Archive UI** (ICD-09) — `World.toggleArchive(storyId)` admits the
fifth `Story.state` value `'archived'` with the medium-band
`ARCHIVE_CAP = 5` cap rule + `ARCHIVE_DECAY_EDITIONS = 10` cold-news
decay at `EDITION_DEBRIEF_END`; the dossier "Story queue" panel grows
per-story rows + a `verified: N · archived: M/5` summary line; left-
click on a row toggles state (ICD-09 v0.1.1 §Open Q1 close).
(2) **`UnitView.stats` projector** for Reporters — the v0.6.3 *authored-
but-deferred-projection* slot wires; the §13 Selected dossier shows
*Nerve 6 · Nose 8 · Legs 4* on the Reporter row.
(3) **`LeadView.district` projector read** — the dossier per-row
rendering now consumes the district name (already lifted at
[`js/sim/world-state.js:leadView`](js/sim/world-state.js) in the 0.10.0
substrate); each Story-queue row reads *Headline · flavor · district*.
(4) **30 s minimum debrief gate** (ICD-06 v0.4 §Cycle timing · audit
C-05) — clicks within the first 30 s of the debrief are no-ops; the
dismiss caption counts down via a panel-owned `requestAnimationFrame`
loop. Save schema bumps v1.1 → v1.2 via `migrate_1_1_to_1_2`
(pass-through; both new persisted fields are optional). **ICD bumps
in-PR (Constraint #4):** ICD-01 v0.6.4 → v0.6.5 (`WorldFrame.stories` +
`UnitView.stats` projector + `HudState.resources.archived`); ICD-04
v0.1.2 → v0.1.3 (`StorySnap.state` widens · `archived_at_ms?` ·
`UnitSnap.stats?` · `migrate_1_1_to_1_2`); ICD-05 v0.4.1 → v0.4.2
(§Notes cross-reference to ICD-09); ICD-09 v0.1 → v0.1.1 (§Open Q1
close). Tests at 281 cases (257 → 281). Closes Gitea issue #317. See
[`roadmap.md`](roadmap.md) and [`CHANGELOG.md`](CHANGELOG.md).

**v1.0.0 — Tier-1 opener · adversarial substrate (Herald + Observer
+ Switchboard).** First Tier-1 code session. The rival triangle
completes: Herald lifts the IDLE | COURT | WIRED state-machine bodies
on a 1/EDITION cadence (with PUNISH / BUYOUT shape-committed for
caller-triggered Tier-1.x wiring); Observer lifts the INVESTIGATE |
PUBLISH | WARN bodies on a 1/2 EDITIONS cadence, emitting
`INVESTIGATE_LEAD` at INVESTIGATE entry, `PUBLISH_COUNTER` at PUBLISH
entry (with +25 heat reconciler effect), and `POISON_LEAD` at WARN
entry. The Switchboard intel-defense building (ICD-08) spawns at tile
(3, 3) and runs the ±6-tile axis-aligned LoS rect that gates goon
visibility in `World.snapshot()`; without a Switchboard goons stay
hidden until they enter Chebyshev distance 1 of any Bureau-family
building (the design HTML §10 *"window breaking"* beat). Save schema
bumps v1.0 → v1.1 in-PR via `migrate_1_0_to_1_1`; pre-1.0.0 saves
load through synthesized default Herald + Observer state. **ICD bumps
in-PR (Constraint #4):** ICD-01 v0.6.3 → v0.6.4 (`BuildingKind` widens
for `'switchboard'`); ICD-02 v0.3 → v0.3.1 (`RivalView.player.printed_lies`
field added); ICD-04 v0.1.1 → v0.1.2 (`RivalsSnap` widens to
`{evening_star, herald, observer}` + new `HeraldSnap` + `ObserverSnap`
interfaces). Tests at 257 cases (199 → 257). Closes Gitea issue #317
(1.0.0/1.0.1 split — 1.0.1 follow-up forthcoming for Archive UI +
deferred projectors + 30 s debrief gate). See [`roadmap.md`](roadmap.md)
and [`CHANGELOG.md`](CHANGELOG.md).

**v0.10.4 — PRE-1.0 paper (ICD-02 v0.3 · ICDs 08 / 09 / 10).**
Paper-only architecture session. Authored **ICD-02 v0.3** (Herald +
Observer five-state machines lifted from
[`design/rival-ai-spec.html`](design/rival-ai-spec.html) §03 + §05;
two new Intent kinds — `PUBLISH_COUNTER` + `INVESTIGATE_LEAD`;
`RivalStatusView` posture mapping extended to all three rivals;
§Notes inter-rival paragraph against §06 interaction matrix), **ICD-08**
(new — Switchboard line-of-sight contract; ±6-tile medium-band rect;
no top-level `WorldFrame` field), **ICD-09** (new — Archive
inter-edition story state; new `'archived'` value extending ICD-05's
state union; cap 5 + decay 10 editions, both medium-band), **ICD-10**
(new — Arc framework formalization; `StoryArc` record + Investigation
3-step chain + trigger predicate vocabulary; THE LONGSHOREMAN STRIKE
encoded as the spec-validation reference), and **ICD-01 v0.6.3**
(single §Notes paragraph pinning the authored-but-deferred-projection
pattern). **Ten ICDs authored.** Milestone 1.0 is now code-ready.
Closes Gitea issue #315. See [`roadmap.md`](roadmap.md) and
[`CHANGELOG.md`](CHANGELOG.md).

**v0.10.3 — Tier-0 → Tier-1 RE-EVAL (paper + code-aware).**
Fourth and final re-eval in the project plan. Seven ICDs survived
0.10.x code-aware re-read with zero interface drift. Arc framework
band promoted Fuzzy → Strong. Herald + Observer state machines
scheduled to PRE-1.0.

**v0.10.2 — PR-D visual feedback (Tier-0 closes).**
The closing post-0.9 audit PR — rain ramp at deadline (C-06), the
`WorldFrame.effects` channel wired end-to-end (C-07 — `pickup` · `verify` ·
`print` · `death` · `raid_warning`), debrief panel as newspaper pages
(D-07), and lit windows + fog-pull-on-deadline (D-09). Pure renderer +
DOM/CSS layered on top of five small sim emit sites. ICD-01 → v0.6.2
(`rain.intensity` range-comment widen; no shape change). Tests at
199 cases (179 → 199). Closes Gitea issue #299; Tier-0 audit (post-0.9)
fully landed.

**v0.10.1 — Onboarding (WASD pan · Block zoom · slow-mo · diegetic tutorial).**
G-07 minimum control surface and G-09 diegetic tutorial coupled as the
second half of the Tier-0 closer.

**v0.10.0 — PR-C substrate (Tier-0 closer · substrate half).**
Code session against the milestone 0.10 closer authored at PRE-0.10.
The roadmap's authorized 0.10.0/0.10.1 split (precedent: 0.7.0 / 0.7.1)
lands five of the seven items here; the remaining two (G-09 diegetic
tutorial · G-07 minimum control surface) defer to **0.10.1 (onboarding)**.
**C-04 — Lead-spawn engine.** New pure module
[`js/sim/lead-spawner.js`](js/sim/lead-spawner.js) — Design Doc §19's
"1 lead per ~90s per covered district, ×0.5 if uncovered, 70/25/5 tier
roll, 180s decay" — replaces the 0.3-era hardcoded single-lead spawn so
every edition after the first no longer fires with zero stories
(*"reads as a game"* per the post-0.9 re-eval §3.5 Q1). Deterministic
via a `SeededRng` stream that round-trips through the save blob.
**G-04 — Districts as data.** New pure module
[`js/sim/districts.js`](js/sim/districts.js) ships two records at
Tier-0 — **The Docks** (vice/violence-leaning · SW) and **Hillside**
(money-heavy · NE) — each with a spawn rect, a covering bureau-family
tag, per-district flavor weights, and an actor pool. `DistrictId`
becomes a real union per ICD-01 v0.6's `LeadView.district` projection.
**G-01 — Branch Bureau.** Second bureau-family building at tile (8, 3)
inside the Hillside spawn rect. HP 20 (squishy per §15 *"1 goon takes
them out in 20s"*). Reporters drop at either bureau-family building;
photogs likewise pick up from either. Branch destruction does NOT
trigger `CYCLE_GAME_OVER` — only the main Bureau drives the §17 single
fail-state. **G-05 — Slot-grammar headlines.** New pure module
[`js/sim/headlines.js`](js/sim/headlines.js) implements Design Doc §18's
actor-verb-object grammar with flavor-tagged verbs and tier prefixes
("EXCLUSIVE · " for Investigation). Story shape gains an optional
`headline` field set deterministically at spawn time. **G-13 — Run-end
summary + high-score persistence.** New `World.runStats` rolls revenue
+ editions + top headline across the run; `'late-edition.scores.v1'`
hosts a cross-run sorted-desc cap-at-10 high-score list; the existing
game-over overlay now renders the run summary card (editions · revenue
· top headline · rank · top-5 board) inside the same terminal mount,
preserving the "Start a new run" exit. **ICD bumps (Constraint #4):**
ICD-01 → v0.6.1 widens `BuildingKind` for `'branch_bureau'`; ICD-04 →
v0.1.1 settles the `rng_seed` semantics (live PRNG state, not initial
seed), adds the `lead_spawner` + `run_stats` blocks, and documents the
new `SCORES_KEY` with full `HighScoreBlobV1` schema — all
backward-compatible via optional-field reads (no migration). Tests at
**159 cases** (124 → 159 — five new test files covering the substrate
modules). Next: **0.10.1 (onboarding)** — diegetic tutorial copy + WASD
pan / Block zoom / slow-mo control surface. See
[`roadmap.md`](roadmap.md) and [`CHANGELOG.md`](CHANGELOG.md).

## How to navigate

1. Open `index.html` in a browser (or click the **Late Edition** card
   from the arcade launcher). You'll see the cel-shaded world with two
   buildings (Bureau in the center, Darkroom to the southeast), four
   units (Reporter north of the Bureau, Photog south, Fixer east —
   distinguishable by trench coat + brim + red kerchief — Editor west
   in a green visor + dark vest), a lead at the northwest district
   tile, and a HUD ticker top-right showing
   the corkboard HUD (top: seven pinned index cards · viewport: a
   torn-edge deadline ticker · bottom: Selected / Story queue /
   Threats dossier panels) counting down from 12:00. **Left-click a unit** to select (a yellow ring
   appears — the Editor and Goon don't get rings, they're not player
   controlled). **Right-click anywhere on the street grid** to
   dispatch — the unit walks the A*-shortest path. Left-click empty
   ground to deselect. The story flow: Reporter to the lead
   (auto-pickup; LD drops to 0), Reporter back to a Bureau-adjacent
   tile (auto-drop); Photog to a Bureau-adjacent tile (picks up the
   held lead), Photog to a Darkroom-adjacent tile (drop flips state to
   `'verified'`; ST ticks to 1). The verified story then waits at the
   Darkroom; when the 12-minute deadline fires, the Editor plates and
   the debrief panel mounts with the front page and the resources
   reconcile (cash earned, ink consumed, heat applied). **If
   `INK` is too low for the story's ink cost, the plating is
   rejected** — the story stays `verified` at the Darkroom and tries
   again next edition (ink stays where it was). Click anywhere on the
   panel to dismiss; heat decays by the §19 baseline and the next
   edition opens. After the second edition with heat above 40, the
   Evening Star may fire a `RAID_BUREAU` — look for a Goon (dark coat,
   no select ring) at the NW grid edge walking toward the Bureau.
   **Right-click the goon's tile while the Fixer is selected** to
   intercept — Fixer beats one goon, two goons beat one Fixer. If
   goons reach the Bureau, the `X HP` segment drains at 1/s; at 0,
   the "THE PRESS BURNS" overlay mounts and the run ends.
2. The in-page **Phase 0 + Roadmap →** link (top-right of the scene) opens
   the architectural supplement (also reachable directly at
   [`design/phase-0-roadmap.html`](design/phase-0-roadmap.html)).
3. Read [`roadmap.md`](roadmap.md) for the milestone list in plain markdown.
4. Read [`architecture/00-overview.md`](architecture/00-overview.md) for the
   strong/medium/fuzzy banding in markdown.
5. Open the [`icds/`](icds) directory for the ten interface contracts
   (01–10) that gate the code sessions. All ten are now authored —
   ICDs 01–06 shipped across PRE-0.1 → PRE-0.7; ICD-04 (save schema) at
   PRE-0.8; ICDs 01 v0.6 / 06 v0.4 / 07 v0.1 at PRE-0.10; ICDs 01 v0.6.3
   / 02 v0.3 / 08 / 09 / 10 at PRE-1.0.

## Tech stack (planned)

- **three.js** (via ES module CDN) for cel-shaded toon 3D — MeshToonMaterial,
  3-step gradient map, EdgesGeometry outlines @ 25°, linear fog 22→60.
- **Orthographic isometric** camera, WASD pan, click-to-dispatch.
- **localStorage JSON** for saves (one versioned blob).
- **Browser-only, single-player MVP.** No backend, no netcode, no auth.

Architecture must not foreclose later multiplayer / cloud saves / procedural
city generation — those are post-MVP. See
[`architecture/00-overview.md`](architecture/00-overview.md) for the fuzzy band.

## File layout

```
late-edition/
├── index.html              # the playable scene host (milestone 0.1+)
├── README.md               # this file
├── CHANGELOG.md            # version history
├── AGENTS.md               # routing doc for future code sessions
├── METHODOLOGY.md          # LLM-assisted-development methodology, verbatim
├── roadmap.md              # milestone list (markdown mirror of §04)
├── architecture/
│   └── 00-overview.md      # strong/medium/fuzzy banding (markdown)
├── icds/                   # interface control documents
│   ├── ICD-01-world-renderer.md
│   ├── ICD-02-rival-world.md
│   ├── ICD-03-unit-pathfinder.md
│   ├── ICD-04-save-schema.md
│   ├── ICD-05-story-lifecycle.md
│   ├── ICD-06-print-cycle.md
│   ├── ICD-07-audio-bus.md
│   ├── ICD-08-switchboard.md          # PRE-1.0
│   ├── ICD-09-archive.md              # PRE-1.0
│   └── ICD-10-arc-framework.md        # PRE-1.0
├── discussion/             # pre-architecture parking spots
│   ├── observer-violence.md
│   ├── rival-state-visibility.md
│   ├── difficulty-selector.md
│   ├── tutorial-first-edition.md
│   ├── accessibility.md
│   └── yellow-establishment-branch.md
├── deferred/               # explicit deferrals (empty until something lands)
├── design/                 # the original design package (pixel-perfect)
│   ├── design-doc.html         # master design doc
│   ├── phase-0-roadmap.html    # Supplement B (was the landing; now linked)
│   ├── rival-ai-spec.html      # Supplement A
│   └── audio-manifest.html     # Supplement C
└── js/
    ├── main.js             # entry point — sim loop + interp
    ├── input.js            # left-click select / right-click dispatch
    ├── hud.js              # ticker DOM projection
    ├── debrief-panel.js    # edition debrief overlay
    ├── game-over-overlay.js# 0.7.0 fail-state overlay
    ├── sim/
    │   ├── world-state.js  # authoritative grid + units + stories + rivals
    │   ├── pathfinder.js   # A* (ICD-03)
    │   ├── cycle-clock.js  # 12-min print cycle (ICD-06)
    │   ├── resources.js    # cash/ink/heat yield tables
    │   ├── seeded-rng.js   # 0.7.0 deterministic PRNG
    │   ├── evening-star.js # 0.7.0 rival state machine (ICD-02)
    │   └── save.js         # 0.8 localStorage save/load (ICD-04 v0.1)
    └── render/
        └── renderer.js     # three.js cel-shaded toon world
```

## Design package

The four design HTMLs in [`design/`](design) are the **source of truth** —
authored in Claude Design (claude.ai/design), checked in unchanged. The
markdown docs in this directory mirror specific sections for code-session use;
when the two disagree, the source HTML wins.

- [`design/design-doc.html`](design/design-doc.html) — the master design doc
  (pitch, visual system, world, core loop, resources, buildings, units,
  rivals, defense, tech tree, camera/HUD/audio, three.js notes, story engine,
  balancing, decisions locked, still-TBD).
- [`design/phase-0-roadmap.html`](design/phase-0-roadmap.html) — **Supplement
  B**, this page. Architecture banding, ICDs, roadmap, paper-vs-design
  triage, Monday plan.
- [`design/rival-ai-spec.html`](design/rival-ai-spec.html) — **Supplement
  A**. State machines for Herald / Evening Star / Observer, transition
  tables, interaction matrix, difficulty curve, pseudocode.
- [`design/audio-manifest.html`](design/audio-manifest.html) — **Supplement
  C**. 60 audio prompts: 6 ambient beds, 6 music stems, 24 SFX, 60 VO lines,
  phased to milestones.
