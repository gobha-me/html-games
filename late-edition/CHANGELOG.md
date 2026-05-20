# Changelog — Late Edition

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
