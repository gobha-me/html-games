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

**v0.6.0 — milestone 0.6 shipped (code).** The economy lights up. A new
pure module [`js/sim/resources.js`](js/sim/resources.js) owns the per-tier
/ per-flavor yields (Whisper $165 / Investigation $800 / Arc $2000; ink
Whisper 1 / Investigation 3 / Arc 8; heat Vice 8 / Violence 12 / Money 15 /
Labor 4) plus the edition-boundary constants (`STARTING_INK = 20`,
`HEAT_DECAY_PER_EDITION = 8`) — first-pass §19 numbers, medium-band per
overview line 44. `World._fireDebrief` writes per-story yields at the
verified→plated step (ICD-05 §Notes — "computed at plated and frozen
there"); `_buildEditionSummary` aggregates them into `cash_earned` /
`ink_consumed` / `heat_applied`; `World.resources` accumulates the
running balances across editions; `ackDebrief()` applies the §19 baseline
heat decay (clamped non-negative). `HudState.resources` now projects
derived `leads` / `stories` counts plus live `ink` / `cash` / `heat`
balances. The HUD ticker grew four segments inside the single masthead
strip. Tests at 53/53 (45 baseline + 8 new in
[`tests/resources.test.mjs`](tests/resources.test.mjs)).

ICD activity (Constraint #4 — none triggered; all three relevant ICDs were
used as authored):

- **ICD-01 v0.5** — used as authored. `HudState.resources` populated with
  non-zero values from the new module; shape unchanged from PRE-0.5.
- **ICD-06 v0.2** — used as authored. `EditionSummary.cash_earned` /
  `ink_consumed` / `heat_applied` now carry non-zero deltas summed from
  `StoryDigest.cash`; shape unchanged.
- **ICD-05 v0.3** — used as authored. `Story.cash_yield` and
  `Story.heat_yield` populated at the plated step (§Notes already
  permits). `Story.ink_cost` is a new sim-internal field — it touches no
  View, so no ICD bump warranted.

Code state (delta from v0.5.0):

- [`js/sim/resources.js`](js/sim/resources.js) — **NEW.** Pure module
  exporting `STARTING_INK`, `HEAT_DECAY_PER_EDITION`, the three lookup
  tables, and `cashYieldFor` / `inkCostFor` / `heatYieldFor` helpers.
  Mirrors the [`cycle-clock.js`](js/sim/cycle-clock.js) pure-module pattern.
- [`js/sim/world-state.js`](js/sim/world-state.js) — imports the helpers;
  constructor seeds `this.resources = { ink: STARTING_INK, cash: 0, heat: 0 }`;
  `_fireDebrief` writes per-story yields + applies summary deltas to the
  running balances; `_buildEditionSummary` aggregates; `ackDebrief()` applies
  heat decay; `snapshot()` projects derived counts + live balances.
- [`js/hud.js`](js/hud.js) — ticker line extended with four resource segments
  (`X LD · X ST · X INK · $X · X HEAT`). No CSS / DOM / main.js changes.
- [`index.html`](index.html) — title + masthead caption + initial ticker
  text rolled forward from "0.5 print cycle · deadline · debrief" to
  "0.6 cash · ink · heat".
- [`tests/print-cycle.test.mjs`](tests/print-cycle.test.mjs) — three
  assertions amended in the same PR (Constraint #4 hygiene): the fresh-HUD
  resources shape now reads `{ leads: 1, stories: 0, ink: 20, cash: 0, heat: 0 }`,
  and the print-step yield assertions now expect non-zero. The yield
  numbers are covered by `tests/resources.test.mjs`.

**Next: RE-EVAL after 0.6 (paper + code-aware).** The first re-evaluation
since v0.3.1 (the post-0.3 re-eval). Per the roadmap: does the loop play?
Promote rival AI contract to strong for 0.7–0.8? Decide tutorial shape.
Forward ICD presence check for 0.7+ (Goon unit, Evening Star state machine —
ICD-02 promotion). After re-eval, milestone 0.7: Evening Star SCAVENGE +
RAID states, Goon unit, Press HP + fail-state.

## When you're stuck

- Disagreement between markdown mirrors and source HTMLs? **Source HTML
  wins.** Update the markdown.
- Open question that doesn't have an ICD? Either author the ICD (if the
  answer is clear) or park it in [`discussion/`](discussion).
- Want to add an Intent kind to ICD-02, or a CycleEvent kind to ICD-06?
  That's an architecture session. Stop, draft the ICD change, open it as a
  paper-only PR.
