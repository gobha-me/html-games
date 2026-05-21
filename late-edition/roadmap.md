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
| **0.9** | HUD corkboard · deadline ticker · selected-unit dossier | Design doc §13 · medium-band layout | medium |
| **RE-EVAL** | After 0.9 · paper + code-aware | Code-arch divergence check. Tighten HUD spec. Confirm Tier-0 exit criteria. | re-eval |
| **0.10** | Tier-0 closer · 5-edition arc · run-end summary screen · high-score persistence | The first thing a friend can play · verifies the loop reads as a game | strong |
| **RE-EVAL** | Tier-0 → Tier-1 gate · full code-aware + paper | Promote arc framework to strong. Tighten Herald + Observer specs. Author ICDs 07+ for branch bureaus, switchboard, archive. | re-eval |

12 code milestones (0.7 split into 0.7.0 + 0.7.1), 4 re-evaluation slots,
4 architecture-session-only items (PRE-0.1, PRE-0.5, PRE-0.7, and PRE-0.8).
That's the ratio the methodology asks for: re-eval every ~3 code milestones,
architecture sessions wherever a contract crosses a code-session boundary
that hasn't been authored yet. PRE-0.5 was inserted by the post-0.3 re-eval's
forward ICD presence check; PRE-0.7 was inserted by the post-0.6 re-eval's
same check. The 0.7 split (0.7.0 adversarial ring · 0.7.1 Editor + ink gate)
was made at 0.7.0 open to keep each code session inside one milestone's
worth of scope — both halves of 0.7 are ICD-ready (ICD-02 v0.2 and ICD-05
v0.4 cover them).

## Current status

**Milestone 0.8 — shipped (v0.8).** Save / load / resume mid-edition
lifted ICD-04 v0.1 verbatim. New module
[`js/sim/save.js`](js/sim/save.js) exposes `saveNow(world)` /
`loadSave()` against the single versioned `localStorage` blob at
`'late-edition.save.v1'`; the `World` snap restore path bypasses
fresh-construct seeding and rebuilds every authoritative field from
the blob. `CycleClock.fromSnap` and `EveningStar.fromSnap` carry the
`_warningFired` / `_fireFired` deadline-event guards and the rival's
`rng.state` + `_tickAccumMs` verbatim — replay determinism is
load-bearing through the round-trip. `setIdMint` / `getIdMint` plug
the module-scoped `nextId` counter into both construct paths so
post-load `mkId()` doesn't collide with the loaded blob. The
§Save-trigger-surface Open Q settles at the ICD's recommended default:
writes fire on `EDITION_DEBRIEF_END` + on `CYCLE_GAME_OVER`. The
`Story.version: 1` field lives on the persisted `StorySnap` only (ICD-
05 v0.4.1 close); the live in-memory `Story` shape is byte-for-byte
identical to v0.4. No ICD bumps — v0.1 was lifted verbatim and
Constraint #4 honored by zero deviation. Tests at 106 cases (94 →
106; twelve new under [`tests/save-load.test.mjs`](tests/save-load.test.mjs)).

Next: **milestone 0.9** — HUD corkboard, deadline ticker, selected-
unit dossier. Medium-band layout per ICD-01 v0.5 §HudState + design
doc §13. The post-0.9 re-eval slot is the third re-eval in the
tier-0 plan; it'll do the code-arch divergence check and tighten the
HUD spec before milestone 0.10 (the tier-0 closer).

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

## Out of scope until called

- ~~**ICD-04** — explicitly deferred to PRE-0.8 by the supplement.~~ Authored
  at v0.1 in PRE-0.8 (shipped v0.7.2); no longer out of scope.
- **Tier-1 architecture** — gated behind the Tier-0 → Tier-1 RE-EVAL slot.
