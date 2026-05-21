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
  ICD-04 was the last ICD deferred (to PRE-0.8); it's now authored at v0.1
  ([`icds/ICD-04-save-schema.md`](icds/ICD-04-save-schema.md)), so milestone
  0.8 is code-ready and persistence work may proceed.
- **When code deviates from an ICD, update the ICD in the same PR.** This
  is Constraint #4 of the methodology.
- **Bands are not decoration.** Strong-band commitments are load-bearing.
  Don't refactor them out without an architecture session.
- **The design HTMLs in [`design/`](design) are immutable.** If a design
  decision changes, the change lands in the markdown mirrors
  (`architecture/`, `icds/`, `discussion/`) — never edit the source HTMLs.

## Current state

**v0.7.2 — PRE-0.8 shipped (paper-only).** ICD-04 (save schema) authored
at v0.1. No code touched this milestone — pure architecture session, as
the supplement asked for and the methodology requires before any code
can touch persistence at milestone 0.8.

Headline outputs:

- **ICD-04 v0.1** ([`icds/ICD-04-save-schema.md`](icds/ICD-04-save-schema.md)).
  Single versioned `localStorage` JSON blob (`'late-edition.save.v1'`)
  captures the full sim state: `sim_time_ms`, `CycleClock`, running
  resources, grid, every building / unit / story (`StorySnap` with a
  per-record `version` field), Evening Star state machine + its
  `SeededRng` 32-bit state for replay determinism + `tick_accum_ms` for
  sub-tick fractional progress, the edition-history ring, and the
  `gameOver` / `debriefOpen` flags for round-trip integrity through
  terminal / paused states. Migration policy is a `migrate_N_to_N+1`
  pure-function chain on load; unknown future versions refuse to load
  rather than silently truncate. Mid-edition resume works because
  continuous `pos` + remaining `path` survive a save/load, and the
  `CycleClock` `_warningFired` / `_fireFired` flags suppress duplicate
  event emissions on resume.
- **ICD-05 v0.4.1** — §Open-questions closure paragraph only. The
  "should `Story` carry a `version` field" question deferred at v0.1 to
  PRE-0.8 is now closed: the field lives on the persisted `StorySnap`,
  not on the live in-memory `Story`, so the in-memory `Story` shape is
  **byte-for-byte identical** to v0.4. The 0.8 code session will add the
  tiny serialize/deserialize projector that bridges the two surfaces.
- **What's NOT locked.** Save trigger cadence (autosave-every-N vs.
  on-debrief-end vs. manual) is an Open Question for the 0.8 code
  session per ICD-04 §Open-questions — v0.1 recommends on
  `EDITION_DEBRIEF_END` + on `CYCLE_GAME_OVER` but doesn't lock it.
  Compression and multi-slot are also deferred.
- **ICD activity.** ICD-04 authored at v0.1. ICD-05 bumped to v0.4.1
  (§Open-questions paragraph only — no shape change). ICD-01 v0.5 /
  ICD-02 v0.2 / ICD-06 v0.3 unchanged.
- **Tests.** Unchanged at 94 cases — paper-only milestone, no JS touched.

**Next: milestone 0.8 (code).** Save/load · resume mid-edition · version
field. The 0.8 code session lifts ICD-04 v0.1 verbatim; deviations
update the ICD in the same PR (Constraint #4). The cadence Open Q above
and the live-Story-vs-`StorySnap` projector both settle in that
session.

## When you're stuck

- Disagreement between markdown mirrors and source HTMLs? **Source HTML
  wins.** Update the markdown.
- Open question that doesn't have an ICD? Either author the ICD (if the
  answer is clear) or park it in [`discussion/`](discussion).
- Want to add an Intent kind to ICD-02, or a CycleEvent kind to ICD-06?
  That's an architecture session. Stop, draft the ICD change, open it as a
  paper-only PR.
