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

**v0.5.0 — milestone 0.5 shipped (code).** The print cycle lights up. The
12-min edition clock lives at [`js/sim/cycle-clock.js`](js/sim/cycle-clock.js)
as a pure module; `World` owns the lifecycle and dispatches `CYCLE_BEGIN` /
`CYCLE_TICK` / `DEADLINE_WARNING` / `DEADLINE_FIRE` /
`EDITION_DEBRIEF_BEGIN` / `EDITION_DEBRIEF_END` through a new
`subscribeCycle(fn)` channel. On `DEADLINE_FIRE` each verified-at-Darkroom
Story walks `verified → plated → printed` in the same frame (with a
`AUTO_PLATE_SENTINEL` placeholder on `plated_by` until the Editor unit
lands at 0.6/0.7), the `EditionSummary` is built, the debrief panel mounts,
and `World.tick()` early-returns until `ackDebrief()` opens the next
edition. Tests at 45/45 (37 baseline + 8 new in
[`tests/print-cycle.test.mjs`](tests/print-cycle.test.mjs)).

ICD activity (Constraint #4 — none triggered; all three relevant ICDs were
used as authored):

- **ICD-06 v0.2** — used as authored. `CycleEvent` kinds dispatched 1:1;
  `EditionSummary` produced exactly as defined; pause-during-debrief
  honoured (sim-wide, per the milestone-0.5 reading).
- **ICD-01 v0.5** — used as authored. `HudState { edition, deadline_ms,
  resources }` populated via `snapshot().hud`; the four Implementation
  notes (0.5) constants observed in code.
- **ICD-05 v0.3** — used as authored. The `verified → plated → printed`
  two-step still fires at `DEADLINE_FIRE`; the milestone-0.5 collapse into
  one frame is allowed by the table's "first milestone" column without
  changing the transition rows.

Code state (delta from v0.4.0):

- [`js/sim/cycle-clock.js`](js/sim/cycle-clock.js) — **NEW.** Pure clock
  with `{ editionDurationMs, warningOffsetMs }` defaults from ICD-06 v0.2;
  both tunable via constructor so tests don't burn real time.
- [`js/sim/world-state.js`](js/sim/world-state.js) — `World(opts)` takes
  `{ cycle?: {...} }`; new `subscribeCycle` / `ackDebrief` /
  `_fireDebrief` / `_buildEditionSummary` surface; `tick()` early-returns
  on `debriefOpen`; exported `AUTO_PLATE_SENTINEL` placeholder.
- [`js/hud.js`](js/hud.js) — **NEW.** DOM ticker, pure projection of
  `frame.hud`.
- [`js/debrief-panel.js`](js/debrief-panel.js) — **NEW.** DOM panel
  subscribed to cycle events; click-to-dismiss.
- [`js/main.js`](js/main.js) — instantiates `HudTicker` + `DebriefPanel`
  alongside the existing wiring; render loop calls `hud.apply(frame)`.
- [`index.html`](index.html) — `<div id="hud-ticker">` and
  `<div id="debrief-panel" hidden>` plus CSS; masthead + title rolled to 0.5.

**Next: milestone 0.6 (code).** Cash + Ink + Heat resources; story cash on
print; ink consumption. The `EditionSummary` `cash_earned` /
`ink_consumed` / `heat_applied` slots and the `HudState.resources` fields
are already shaped and zeroed — 0.6 fills them in. Design Doc §06 + §19
first-pass numbers; values stay medium-band until playtest. ICD-01 v0.5
and ICD-06 v0.2 already gate it at the contract level; no PRE-0.6 paper
slot scheduled.

## When you're stuck

- Disagreement between markdown mirrors and source HTMLs? **Source HTML
  wins.** Update the markdown.
- Open question that doesn't have an ICD? Either author the ICD (if the
  answer is clear) or park it in [`discussion/`](discussion).
- Want to add an Intent kind to ICD-02, or a CycleEvent kind to ICD-06?
  That's an architecture session. Stop, draft the ICD change, open it as a
  paper-only PR.
