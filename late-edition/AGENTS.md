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

**v0.7.1 — milestone 0.7.1 shipped (code).** The inner three rings
close. Editor unit lit; ink plate-time hard gate enforced. Both halves
of the 0.7 split (0.7.0 adversarial ring + 0.7.1 Editor + ink gate)
are now shipped. Pure code milestone — every ICD shape was already
authored at the right version going in, and the implementation lifts
ICD-05 v0.4 §Notes verbatim. No ICD bumps in this PR.

Headline outputs:

- **Editor unit.** [`js/sim/world-state.js`](js/sim/world-state.js)
  spawns a `kind: 'editor'` unit at `EDITOR_SPAWN_TILE = (4, 5)` —
  Bureau-adjacent west. Speed 0 in `UNIT_SPEED` + a `dispatch()`
  reject pin it to its tile (Design Doc §17 "Stationed at the
  Bureau"). The renderer's `buildEditorMesh` gives it a shirt + dark
  vest + green eyeshade silhouette with no selection ring (goon
  precedent for non-player units).
- **`AUTO_PLATE_SENTINEL` substitution.** At `DEADLINE_FIRE`,
  `_fireDebrief` looks up the Editor and writes `editor.id` to every
  printed story's `plated_by` (ICD-05 v0.4 §Notes). The sentinel
  constant stays exported as the defensive fallback for the no-Editor
  case (covered by `editor.test.mjs`).
- **Ink plate-time hard gate.** `_fireDebrief` walks the verified
  queue against a projected ink budget and admits only stories whose
  `inkCostFor(story)` keeps `World.resources.ink ≥ 0`. Rejected
  stories stay `verified` + `held_by_building === darkroom.id`, ready
  to retry next edition. `EditionSummary.ink_consumed` reflects the
  admitted set only — the running balance can no longer go negative
  through plating (other ink delta sources still permitted; ICD-05
  v0.4 §Notes is precise about this).
- **ICD activity.** None. ICD-01 v0.5, ICD-02 v0.2, ICD-05 v0.4,
  ICD-06 v0.3 all used as authored. ICD-04 still deferred to PRE-0.8.
- **Tests.** 85 → 94 cases. New test files: `editor.test.mjs` (5
  cases — spawn shape, dispatch reject, frame surfacing, plated_by
  substitution, sentinel fallback), `ink-gate.test.mjs` (4 cases —
  insufficient/sufficient ink, partial budget admission, held-over
  retry on restock). `world-frame.test.mjs` extended construction
  roster to `[editor, fixer, photog, reporter]`.

**Next: PRE-0.8 (architecture, paper-only).** ICD-04 (save schema) —
the one ICD explicitly deferred to PRE-0.8 by the supplement. Single
architecture session, no code, gates milestone 0.8 (save/load · resume
mid-edition · version field). Do not commit code that touches
persistence before ICD-04 is authored.

## When you're stuck

- Disagreement between markdown mirrors and source HTMLs? **Source HTML
  wins.** Update the markdown.
- Open question that doesn't have an ICD? Either author the ICD (if the
  answer is clear) or park it in [`discussion/`](discussion).
- Want to add an Intent kind to ICD-02, or a CycleEvent kind to ICD-06?
  That's an architecture session. Stop, draft the ICD change, open it as a
  paper-only PR.
