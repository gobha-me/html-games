# Changelog — Late Edition

## v0.1.1 — 2026-05-20 — PRE-0.2 paper session

Paper-only, no code. The methodology gate the v0.1.0 entry flagged
("View-struct field sets deferred to a PRE-0.2 paper session") is now closed.
Milestone 0.2 (A* pathfinding · Reporter unit · click-to-dispatch) is legal to
open as a code session.

### Changed

- [`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md) bumped to
  **v0.2**. Concrete `BuildingView` / `UnitView` / `LeadView` field sets
  authored, with per-field justification tracing each one back to a strong-band
  commitment or a near-horizon ICD. New "render-only projection rule" added:
  no field on a View carries information the renderer doesn't use this frame.
  LeadView ↔ UnitView.carrying handoff documented for the 0.3 pickup case.
  Animation-playhead open question retained (per its own v0.1 deferral logic);
  `Vec3` precision flagged as a new 0.2-decided open question.
- [`AGENTS.md`](AGENTS.md) — "Current state" and "Next milestone" paragraphs
  updated: PRE-0.2 done, 0.2 unblocked.
- [`roadmap.md`](roadmap.md) — PRE-0.2 paper-session checkbox ticked.

### Not changed

- `js/world.js` — paper session, no renderer code touched.
- `index.html`, `games.json` — unchanged.
- Design HTMLs in [`design/`](design) — immutable per AGENTS.md hard rule.

## v0.1.0 — 2026-05-20 — Milestone 0.1: world render scaffold

First playable code lands. The renderer-only scaffold from
[`design/phase-0-roadmap.html`](design/phase-0-roadmap.html) §04 row 0.1 is
now live: scene, camera, toon pipeline, fog, rain, ground grid. No game
logic. Touches ICD-01 only.

### Added

- [`js/world.js`](js/world.js) — three.js scene host. Orthographic isometric
  camera, MeshToonMaterial with a 3-step gradient, linear fog 22→60, 120×120
  ground plane, street grid at 6-unit pitch, 600-segment rain. `withOutline`
  helper carried forward for buildings/units arriving at 0.2/0.3.
- New top-level `index.html` — minimal scene host with masthead, footer
  arcade link, and an in-page link out to the Phase 0 + Roadmap supplement.

### Changed

- `index.html` is now the playable scene. The Phase 0 + Roadmap supplement
  page (previously the landing) is reached via the in-page link or directly
  at [`design/phase-0-roadmap.html`](design/phase-0-roadmap.html); the
  immutable copy in `design/` is unchanged.
- [`README.md`](README.md) — "How to navigate" updated; status bumped to
  v0.1.0.
- [`AGENTS.md`](AGENTS.md) — current state + next milestone re-pointed at
  0.2 (A* pathfinding, Reporter unit, click-to-dispatch).
- [`roadmap.md`](roadmap.md) — milestone 0.1 box ticked.

### Removed

- [`js/feel-test.js`](js/feel-test.js) — the lift source for 0.1. Now that
  the scaffold lives in `world.js`, keeping the feel test would invite drift
  (its game-logic sketches conflict with future milestones). The immutable
  design HTMLs in `design/` are the source of truth, not `feel-test.js`.

### ICD activity

- **ICD-01** — no deviation. Strong-band commitments (MeshToonMaterial,
  3-step gradient, EdgesGeometry @ 25°, linear fog 22→60, orthographic
  isometric camera) all preserved byte-equal from the feel test. The
  `WorldFrame → renderer` boundary is *not* materialized at 0.1; without a
  simulation it would be premature abstraction. Marker comment at the top
  of `world.js` notes where it lands at 0.2.
- View-struct field sets (ICD-01 open question) deferred to a PRE-0.2 paper
  session.

## v0.0.1 — 2026-05-20 — Phase 0 bootstrap

Phase 0 (architecture-only) lands. No game code yet — this PR executes the
"What To Do Monday" order of operations from
[`design/phase-0-roadmap.html`](design/phase-0-roadmap.html) §06.

### Added

- Design package preserved verbatim in [`design/`](design): Design Doc,
  Phase 0 + Roadmap, Rival AI Spec, Audio Manifest (all four HTMLs from the
  Claude Design handoff bundle).
- `index.html` — Phase 0 + Roadmap as the landing page (pixel-perfect copy,
  with a single arcade-integration addition: the required `← Back to Arcade`
  link).
- [`METHODOLOGY.md`](METHODOLOGY.md) — the LLM-assisted-development
  methodology doc, verbatim.
- [`roadmap.md`](roadmap.md) — markdown mirror of §04.
- [`architecture/00-overview.md`](architecture/00-overview.md) — markdown
  mirror of §02 (strong/medium/fuzzy banding).
- ICDs drafted from §03 sketches:
  - [`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md)
  - [`icds/ICD-02-rival-world.md`](icds/ICD-02-rival-world.md)
  - [`icds/ICD-03-unit-pathfinder.md`](icds/ICD-03-unit-pathfinder.md)
  - [`icds/ICD-05-story-lifecycle.md`](icds/ICD-05-story-lifecycle.md)
  - [`icds/ICD-06-print-cycle.md`](icds/ICD-06-print-cycle.md)
  - ICD-04 (save schema) intentionally deferred to PRE-0.8.
- [`discussion/`](discussion) seeded with the six files from §02:
  observer-violence, rival-state-visibility, difficulty-selector,
  tutorial-first-edition, accessibility, yellow-establishment-branch.
- [`deferred/`](deferred) directory created (empty; the directory itself
  signals the methodology to the next session).
- [`js/feel-test.js`](js/feel-test.js) — three.js cel-shaded feel-test
  copied from the design bundle. Slated for milestone 0.1 as the starting
  renderer.
- [`AGENTS.md`](AGENTS.md) — routing doc for the next code session.
- Arcade integration: registered in repo-root `games.json` and `index.html`
  with a `📰` icon and the *Strategy (Design Phase)* tag, following the
  Oregon Trail "scaffold phase" precedent.

### Next

- Milestone **0.1** in a separate code session: scene, camera, toon
  pipeline, fog, rain, ground grid. Lift from the feel test. ICD-01 only.
