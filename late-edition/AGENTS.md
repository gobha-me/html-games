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

**v0.2.0 — milestone 0.2 shipped.** First dispatch. Sim and renderer are
now distinct modules with the WorldFrame boundary materialized:

- [`js/sim/world-state.js`](js/sim/world-state.js) — `World` class owns
  the grid (10×10), Bureau (tile (5,5), 90/90 HP), Reporter (spawns at
  (5,4), walks 3.5 u/s). `tick(dt)` advances units; `snapshot()` projects
  to a `WorldFrame`.
- [`js/sim/pathfinder.js`](js/sim/pathfinder.js) — pure A* matching ICD-03.
- [`js/render/renderer.js`](js/render/renderer.js) — three.js scene,
  consumes `WorldFrame` via `apply(frame, alpha)`. Interpolates `pos` /
  `facing` between sim ticks. Exposes `screenToGridCell()` for input.
- [`js/input.js`](js/input.js) — click handling. Left = select / deselect;
  right = dispatch. Per design doc §13 + decision §17.
- [`js/main.js`](js/main.js) — entry. Fixed-step sim @ 30 Hz with
  renderer interp.
- [`tests/`](tests) — `node --test` covers pathfinder, unit-step,
  WorldFrame projection (19 cases).

ICDs both advanced in the 0.2 PR (Constraint #4):
[`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md) → **v0.3**
(animation playhead + Vec3 precision closed);
[`icds/ICD-03-unit-pathfinder.md`](icds/ICD-03-unit-pathfinder.md) → **v0.2**
(GridCell shape + cost units closed).

**Next milestone: 0.3.** Lead spawn (single district) · pickup ·
return-to-bureau. Touches **ICD-05** (lead state machine) and the v0.2
**ICD-01** `LeadView` field set + the `LeadView ↔ UnitView.carrying`
pickup handoff (both already spelled out). See
[`icds/ICD-05-story-lifecycle.md`](icds/ICD-05-story-lifecycle.md) and
[`roadmap.md`](roadmap.md).

> 0.3 is legal to open as a code session. After 0.3 the roadmap calls for
> a re-eval (paper) session before 0.4. Don't skip it.

## When you're stuck

- Disagreement between markdown mirrors and source HTMLs? **Source HTML
  wins.** Update the markdown.
- Open question that doesn't have an ICD? Either author the ICD (if the
  answer is clear) or park it in [`discussion/`](discussion).
- Want to add an Intent kind to ICD-02, or a CycleEvent kind to ICD-06?
  That's an architecture session. Stop, draft the ICD change, open it as a
  paper-only PR.
