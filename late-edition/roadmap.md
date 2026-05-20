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
| **RE-EVAL** | After 0.3 · paper session | Did ICDs 01/03/05 survive contact? Promote any medium content tighter? Forward ICD presence check for 0.4–0.6. | re-eval |
| **0.4** | Photog unit · lead→verified transition · Darkroom building | ICD-05 verified state · introduces 2nd unit kind | strong |
| **0.5** | Print cycle clock · deadline events · edition debrief panel | ICD-06 · the heartbeat lights up | strong |
| **0.6** | Cash + Ink + Heat resources · story cash on print · ink consumption | Design doc §06 · §19 first-pass numbers · medium-band balance values | strong |
| **RE-EVAL** | After 0.6 · paper + code-aware | Does the loop play? Promote rival AI contract to strong for 0.7–0.8. Decide tutorial shape. | re-eval |
| **0.7** | Evening Star SCAVENGE + RAID states · Goon unit · Press HP + fail-state | ICD-02 (subset) · Fixer unit · Bureau defense beat | medium → strong at re-eval |
| **PRE-0.8** | Author **ICD-04** (save schema) · single architecture session | Required before any code touches persistence | strong |
| **0.8** | Save / load · resume mid-edition · version field | ICD-04 · localStorage blob · migration stub | strong |
| **0.9** | HUD corkboard · deadline ticker · selected-unit dossier | Design doc §13 · medium-band layout | medium |
| **RE-EVAL** | After 0.9 · paper + code-aware | Code-arch divergence check. Tighten HUD spec. Confirm Tier-0 exit criteria. | re-eval |
| **0.10** | Tier-0 closer · 5-edition arc · run-end summary screen · high-score persistence | The first thing a friend can play · verifies the loop reads as a game | strong |
| **RE-EVAL** | Tier-0 → Tier-1 gate · full code-aware + paper | Promote arc framework to strong. Tighten Herald + Observer specs. Author ICDs 07+ for branch bureaus, switchboard, archive. | re-eval |

11 code milestones, 4 re-evaluation slots, 2 architecture-session-only items
(PRE-0.1 and PRE-0.8). That's the ratio the methodology asks for: re-eval every
~3 code milestones, architecture sessions wherever a contract crosses a
code-session boundary that hasn't been authored yet.

## Current status

**0.2 — shipped.** A* pathfinding · Reporter unit · click-to-dispatch all
landed; the WorldFrame → renderer boundary is now real in code. Sim lives
under [`js/sim/`](js/sim) and produces a `WorldFrame` per snapshot;
[`js/render/renderer.js`](js/render/renderer.js) consumes it; [`js/input.js`](js/input.js)
glues clicks → sim intents via the renderer's `screenToGridCell` projection.
ICD-01 bumped to v0.3 and ICD-03 to v0.2; all 0.2-decision open questions
closed in the same PR (Constraint #4).

Next: milestone **0.3** — lead spawn in a single district · pickup ·
return-to-bureau. ICD-05 governs lead state; ICD-01 v0.2 §LeadView and the
LeadView ↔ UnitView.carrying handoff are already spelled out.

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

## Out of scope until called

- **ICD-04** — explicitly deferred to PRE-0.8 by the supplement.
- **Tier-1 architecture** — gated behind the Tier-0 → Tier-1 RE-EVAL slot.
