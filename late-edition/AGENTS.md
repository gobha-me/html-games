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

**v0.3.0 — milestone 0.3 shipped.** First lead. The Story pipeline opens:
a `'lead'`-state Story spawns at the district tile, a Reporter walks to
it, auto-picks-up on arrival, returns to a tile adjacent to the Bureau,
and auto-drops via `Story.held_by_building`.

- [`js/sim/world-state.js`](js/sim/world-state.js) — `World` owns the
  10×10 grid, Bureau (5,5, 90/90 HP), Reporter (5,4, 3.5 u/s), and now
  `stories[]` + `sim_time_ms`. One Story spawns at tile `(2, 2)` in
  state `'lead'` (whisper / vice / truthful). `tick(dt)` advances time,
  steps units along paths, and on arrival runs `_handleArrival` for
  pickup-on-lead-tile / drop-adjacent-to-bureau.
- [`js/sim/pathfinder.js`](js/sim/pathfinder.js) — pure A* matching ICD-03.
- [`js/render/renderer.js`](js/render/renderer.js) — three.js scene,
  consumes `WorldFrame` via `apply(frame, alpha)`. Now also pools
  `leadMeshes` (id → group, flavor-tinted slab) and toggles a folder
  mesh on the unit group when `UnitView.carrying === 'lead'`.
- [`js/input.js`](js/input.js) — unchanged at 0.3. Pickup is auto on
  arrival; no new Intent kind added to the dispatch surface (ICD-02
  untouched).
- [`js/main.js`](js/main.js) — entry. Fixed-step sim @ 30 Hz with
  renderer interp.
- [`tests/`](tests) — `node --test` covers pathfinder, unit-step,
  WorldFrame projection, and now story-pickup (26 cases).

ICDs both advanced in the 0.3 PR (Constraint #4):
[`icds/ICD-05-story-lifecycle.md`](icds/ICD-05-story-lifecycle.md) → **v0.2**
(added `held_by_building` resting-state pointer and the `lead → lead`
carrier-drop transition);
[`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md) → **v0.4**
(LeadView filter tightened to exclude held-at-building Stories — no field-set
change).

**Next: RE-EVAL.** The roadmap calls for a paper-only re-eval slot after
0.3 — did ICDs 01 / 03 / 05 survive contact? Forward ICD presence check
for 0.4–0.6 (Photog · Darkroom · Print cycle · Resources). **Do not open
0.4 in the same session as the re-eval — paper output only.**

## When you're stuck

- Disagreement between markdown mirrors and source HTMLs? **Source HTML
  wins.** Update the markdown.
- Open question that doesn't have an ICD? Either author the ICD (if the
  answer is clear) or park it in [`discussion/`](discussion).
- Want to add an Intent kind to ICD-02, or a CycleEvent kind to ICD-06?
  That's an architecture session. Stop, draft the ICD change, open it as a
  paper-only PR.
