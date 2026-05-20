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
  ICD-04 in particular is explicitly deferred to PRE-0.8 — do not touch
  persistence before then.
- **When code deviates from an ICD, update the ICD in the same PR.** This
  is Constraint #4 of the methodology.
- **Bands are not decoration.** Strong-band commitments are load-bearing.
  Don't refactor them out without an architecture session.
- **The design HTMLs in [`design/`](design) are immutable.** If a design
  decision changes, the change lands in the markdown mirrors
  (`architecture/`, `icds/`, `discussion/`) — never edit the source HTMLs.

## Current state

**v0.4.0 — milestone 0.4 shipped.** Second carrier. The Photog and the
Darkroom open ICD-05 v0.2's row 3 (`lead → verified`). The Story now
moves through two pipeline stages on the grid: Reporter picks up a free
lead at the district tile and drops it on the Bureau via
`held_by_building`; Photog picks the lead off the Bureau, ferries it
Bureau → Darkroom, and drops with `state: 'lead' → 'verified'`. The Story
id is stable end-to-end (ICD-05 Purpose still holds).

- [`js/sim/world-state.js`](js/sim/world-state.js) — `World` owns the
  10×10 grid, Bureau at (5,5) and Darkroom at (7,7) (both 90/90 HP
  placeholder, kind enum from ICD-01 v0.4). Two units spawn: Reporter
  (5,4) and Photog (5,6); both move at 3.5 u/s (per-kind costs land at
  0.7 per ICD-03 v0.2). `_handleArrival` now dispatches to
  `_handleReporterArrival` / `_handlePhotogArrival` keyed on `u.kind`.
- [`js/sim/pathfinder.js`](js/sim/pathfinder.js) — pure A* matching ICD-03.
  Already generic over `unitKind`; 0.4 just exercises the channel with
  `'photog'`.
- [`js/render/renderer.js`](js/render/renderer.js) — three.js scene,
  consumes `WorldFrame` via `apply(frame, alpha)`. `_syncBuildings` and
  `_syncUnits` route through `buildBuildingMesh(kind)` /
  `buildUnitMesh(kind)`. New mesh builders: `buildDarkroomMesh` (squat
  dark-red body, red safelight on the roof) and `buildPhotogMesh` (brown
  jacket, flat cap, chest-slung camera box). Selection-ring construction
  shared via `makeSelectRing()`.
- [`js/input.js`](js/input.js) — unchanged. Selection and dispatch are
  generic over `UnitView.kind`; the Photog Just Works through the
  existing click-to-select / right-click-to-dispatch path. Verified by
  test in `unit-step.test.mjs`.
- [`js/main.js`](js/main.js) — entry. Fixed-step sim @ 30 Hz with
  renderer interp. No awareness of unit/building kinds.
- [`tests/`](tests) — `node --test` covers pathfinder, unit-step,
  WorldFrame projection, story-pickup (0.3), and now photog-verify
  (0.4). 37 cases.

ICD activity in the 0.4 PR (Constraint #4):
[`icds/ICD-05-story-lifecycle.md`](icds/ICD-05-story-lifecycle.md) → **v0.3**
(status + revision history + §Notes addition spelling out the
`lead → verified` field deltas).
[`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md) — **not
bumped**: the BuildingView/UnitView kind enums already listed
`'darkroom'`/`'photog'` at v0.4 and the LeadView filter already excludes
verified-state Stories. v0.5 stays reserved for PRE-0.5.

**Next: PRE-0.5 (paper-only).** Author **ICD-06 v0.2** (`EditionSummary`
shape) and **ICD-01 v0.5** (`HudState` shape + projection-rule wording
tightening + implementation notes for `TILE`, world-space origin offset,
30 Hz tick rate, id-minting). One architecture session, no code. Gates
milestone 0.5 (print cycle).

## When you're stuck

- Disagreement between markdown mirrors and source HTMLs? **Source HTML
  wins.** Update the markdown.
- Open question that doesn't have an ICD? Either author the ICD (if the
  answer is clear) or park it in [`discussion/`](discussion).
- Want to add an Intent kind to ICD-02, or a CycleEvent kind to ICD-06?
  That's an architecture session. Stop, draft the ICD change, open it as a
  paper-only PR.
