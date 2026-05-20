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

**v0.1.1 — PRE-0.2 paper session done.** Milestone 0.1 shipped in v0.1.0;
[`js/world.js`](js/world.js) carries the world render scaffold (scene, camera,
toon pipeline, fog, rain, ground grid) and [`index.html`](index.html) hosts
it. The PRE-0.2 architecture session has now closed the View-struct open
question: [`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md) is
at **v0.2** with concrete `BuildingView` / `UnitView` / `LeadView` field sets.

**Next milestone: 0.2.** A* pathfinding · Reporter unit · click-to-dispatch.
Now legal to open as a code session. Touches **ICD-03** (pathfinder
request/response) and the v0.2 **ICD-01** `UnitView` / `BuildingView` field
sets. See [`roadmap.md`](roadmap.md),
[`icds/ICD-03-unit-pathfinder.md`](icds/ICD-03-unit-pathfinder.md), and
[`icds/ICD-01-world-renderer.md`](icds/ICD-01-world-renderer.md) §View struct
field sets.

> When the 0.2 code session opens, the WorldFrame → renderer boundary lands
> for real (currently the marker in `js/world.js` notes this). The animation
> playhead and `Vec3` precision questions in ICD-01 v0.2 resolve in-PR per
> Constraint #4 if 0.2 needs them.

## When you're stuck

- Disagreement between markdown mirrors and source HTMLs? **Source HTML
  wins.** Update the markdown.
- Open question that doesn't have an ICD? Either author the ICD (if the
  answer is clear) or park it in [`discussion/`](discussion).
- Want to add an Intent kind to ICD-02, or a CycleEvent kind to ICD-06?
  That's an architecture session. Stop, draft the ICD change, open it as a
  paper-only PR.
