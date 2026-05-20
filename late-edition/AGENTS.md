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

**v0.4.1 — PRE-0.5 shipped (paper).** Paper-only architecture session. The
forward-ICD gap the post-0.3 re-eval flagged
([`architecture/re-eval-after-0.3.md`](architecture/re-eval-after-0.3.md) §3
"Scheduled paper slot — PRE-0.5") is closed. Two ICDs bumped, byte-zero
diff under [`js/`](js) and [`tests/`](tests) and [`index.html`](index.html).
Tests stay at 37 / 37.

ICD activity (Constraint #4 — paper-only this round, so no code drift to
record):

- [`icds/ICD-06-print-cycle.md`](icds/ICD-06-print-cycle.md) → **v0.2**.
  `EditionSummary` shape authored (with `StoryDigest` and
  `RivalEventDigest` sub-shapes); closes v0.1's deferred open question.
  Pause-during-debrief default confirmed: `CYCLE_TICK` stops between
  `EDITION_DEBRIEF_BEGIN` and `EDITION_DEBRIEF_END`. Event vocabulary,
  cycle timing, and subscriber expectations unchanged.
- [`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md) →
  **v0.5**. `HudState` shape authored (`edition`, `deadline_ms`,
  `resources: { leads, stories, ink, cash, heat }`); render-only
  projection rule tightened from "this frame" to "within the next-N
  window" (legitimizes `LeadView.age_ms`); new Implementation notes
  (0.5) section pins `TILE = 6`, world-space origin offset `−27`, fixed
  30 Hz sim tick (`TICK_HZ` / `TICK_DT`), and the per-`World` monotonic
  id-minting convention (`b-`, `u-`, `s-` prefixes). No `WorldFrame`
  top-level changes; no `BuildingView` / `UnitView` / `LeadView`
  field-set changes.

Code state (unchanged from v0.4.0 — paper session forbids it):

- [`js/sim/world-state.js`](js/sim/world-state.js) — `World` owns the
  10×10 grid, Bureau at (5,5) and Darkroom at (7,7). Two units spawn:
  Reporter (5,4) and Photog (5,6); both at 3.5 u/s. Story id stable
  through pickup → drop → verify.
- [`js/sim/pathfinder.js`](js/sim/pathfinder.js) — pure A* matching ICD-03.
- [`js/render/renderer.js`](js/render/renderer.js) — three.js scene,
  consumes `WorldFrame` via `apply(frame, alpha)`.
- [`js/input.js`](js/input.js), [`js/main.js`](js/main.js) — unchanged.
- [`tests/`](tests) — 37 cases, unchanged from v0.4.0.

**Next: milestone 0.5 (code).** Print cycle clock, deadline events,
edition debrief panel. ICD-06 v0.2 supplies the event vocabulary and
`EditionSummary`; ICD-01 v0.5 supplies the `HudState` projection the HUD
ticker reads. Constraint #4 applies: any deviation from those shapes during
implementation must update the owning ICD in the same PR.

## When you're stuck

- Disagreement between markdown mirrors and source HTMLs? **Source HTML
  wins.** Update the markdown.
- Open question that doesn't have an ICD? Either author the ICD (if the
  answer is clear) or park it in [`discussion/`](discussion).
- Want to add an Intent kind to ICD-02, or a CycleEvent kind to ICD-06?
  That's an architecture session. Stop, draft the ICD change, open it as a
  paper-only PR.
