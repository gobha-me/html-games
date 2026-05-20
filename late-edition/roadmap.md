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
| **RE-EVAL** | After 0.6 · paper + code-aware | Does the loop play? Promote rival AI contract to strong for 0.7–0.8. Decide tutorial shape. | re-eval |
| **0.7** | Evening Star SCAVENGE + RAID states · Goon unit · Press HP + fail-state | ICD-02 (subset) · Fixer unit · Bureau defense beat | medium → strong at re-eval |
| **PRE-0.8** | Author **ICD-04** (save schema) · single architecture session | Required before any code touches persistence | strong |
| **0.8** | Save / load · resume mid-edition · version field | ICD-04 · localStorage blob · migration stub | strong |
| **0.9** | HUD corkboard · deadline ticker · selected-unit dossier | Design doc §13 · medium-band layout | medium |
| **RE-EVAL** | After 0.9 · paper + code-aware | Code-arch divergence check. Tighten HUD spec. Confirm Tier-0 exit criteria. | re-eval |
| **0.10** | Tier-0 closer · 5-edition arc · run-end summary screen · high-score persistence | The first thing a friend can play · verifies the loop reads as a game | strong |
| **RE-EVAL** | Tier-0 → Tier-1 gate · full code-aware + paper | Promote arc framework to strong. Tighten Herald + Observer specs. Author ICDs 07+ for branch bureaus, switchboard, archive. | re-eval |

11 code milestones, 4 re-evaluation slots, 3 architecture-session-only items
(PRE-0.1, PRE-0.5, and PRE-0.8). That's the ratio the methodology asks for:
re-eval every ~3 code milestones, architecture sessions wherever a contract
crosses a code-session boundary that hasn't been authored yet. PRE-0.5 was
inserted by the post-0.3 re-eval's forward ICD presence check.

## Current status

**Milestone 0.6 — shipped (v0.6.0).** The economy lights up. Each printed
Story now carries `cash_yield` / `heat_yield` / `ink_cost` set at the
plated step from a new pure module
[`js/sim/resources.js`](js/sim/resources.js) (Design Doc §06 + §19
first-pass numbers — Whisper $165 / Investigation $800 / Arc $2000;
ink Whisper 1 / Investigation 3 / Arc 8; heat Vice 8 / Violence 12 /
Money 15 / Labor 4). `EditionSummary` aggregates the per-story deltas;
`World.resources` accumulates `{ ink: STARTING_INK, cash, heat }` across
editions; `ackDebrief()` applies the §19 baseline heat decay
(`HEAT_DECAY_PER_EDITION = 8`, clamped at zero). `HudState.resources`
now projects derived `leads` / `stories` counts plus the live running
balances. The HUD ticker grew four segments
(`X LD · X ST · X INK · $X · X HEAT`) inside the single masthead strip
so the milestone 0.9 corkboard can absorb them without churning
`main.js`. 53 / 53 tests pass; no ICD bumps (06 v0.2 / 01 v0.5 / 05 v0.3
all used as authored).

Next: **RE-EVAL after 0.6** (paper + code-aware — the first re-eval
since v0.3.1). Does the loop play? Promote rival AI contract to strong
for 0.7–0.8? Decide tutorial shape. Then milestone 0.7 (Evening Star
SCAVENGE + RAID states, Goon unit, Press HP + fail-state).

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

## Out of scope until called

- **ICD-04** — explicitly deferred to PRE-0.8 by the supplement.
- **Tier-1 architecture** — gated behind the Tier-0 → Tier-1 RE-EVAL slot.
