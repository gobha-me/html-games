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
  All six ICDs are authored; milestones 0.1–0.8 have shipped against
  their contracts. Milestone 0.9 (HUD corkboard) lifts ICD-01 v0.5
  §HudState — no new ICD required to open the code session.
- **When code deviates from an ICD, update the ICD in the same PR.** This
  is Constraint #4 of the methodology.
- **Bands are not decoration.** Strong-band commitments are load-bearing.
  Don't refactor them out without an architecture session.
- **The design HTMLs in [`design/`](design) are immutable.** If a design
  decision changes, the change lands in the markdown mirrors
  (`architecture/`, `icds/`, `discussion/`) — never edit the source HTMLs.

## Current state

**v0.8 — save · load · resume mid-edition.** Code milestone. ICD-04
v0.1 lifted verbatim; the live-`Story`-vs-`StorySnap` projector
landed; the §Save-trigger-surface Open Question settled.

Headline outputs:

- **`js/sim/save.js` (new).** `SAVE_KEY` /
  `CURRENT_VERSION` / `STORY_VERSION` constants and the
  `saveNow(world)` / `loadSave()` / `serialize(world)` /
  `deserialize(blob)` / `runMigrations(raw)` public surface. Storage
  is dependency-injected so Node tests pass a `Map`-backed stub;
  browser path defaults to `globalThis.localStorage`. Size guard
  surfaces a `console.warn` at 500 KB.
- **`World` restore path.** `new World({ snap })` /
  `World.fromSnap(blob)` skip fresh-construct seeding and rebuild
  authoritative state from the blob; `setIdMint(n)` / `getIdMint()`
  plug the module-scoped `nextId` counter into both construct paths.
  `CycleClock.fromSnap` / `EveningStar.fromSnap` bypass their own
  constructor seeding so `_warningFired` / `_fireFired` and
  `rng.state` / `_tickAccumMs` / `pastIntents` survive verbatim.
  `Unit.selected` resets on load (ICD §Notes — UI state).
- **`main.js` wire-up.** Boot tries `loadSave()`, falls through to
  `new World()` on no-save / parse-fail / unknown-future-version.
  Subscribes `saveNow(world)` to the two recommended triggers
  (`EDITION_DEBRIEF_END` + `CYCLE_GAME_OVER`).
- **Cadence Open Q settled.** Writes fire on `CYCLE_BEGIN` (post-
  `cycle.start()` — captures the just-opened edition with a fresh
  clock) and on `CYCLE_GAME_OVER` (terminal integrity). The ICD's
  recommended `EDITION_DEBRIEF_END` couldn't be used as-is because
  `cycle.start()` inside `ackDebrief()` runs AFTER that emit, so a
  debrief-end save would capture the cycle stuck at `fire_fired=true`
  / `remainingMs=0`. The constructor's edition-1 `start(1)` runs
  before subscribers attach, so this subscriber never fires at boot.
  Autosave-every-N, multi-slot, compression, and a pre-
  `DEADLINE_FIRE` checkpoint are deferred per ICD-04 §Open-questions.
  The trigger surface is sim-external per the ICD — no ICD-04 bump.
- **`Story.version` projector.** `serialize` / `deserialize` add /
  strip the field at the persistence boundary; the live in-memory
  shape is byte-for-byte identical to v0.4 (ICD-05 v0.4.1 §Open-
  questions close, code side).
- **ICD activity.** None. v0.1 lifted verbatim. Constraint #4 (code
  deviations update the ICD in the same PR) is honored by zero
  deviation.
- **Tests.** 94 → 106 (twelve new under
  [`tests/save-load.test.mjs`](tests/save-load.test.mjs)).

**Next: milestone 0.9 (code).** HUD corkboard, deadline ticker,
selected-unit dossier (medium-band layout per ICD-01 v0.5 + design
doc §13). The post-0.9 re-eval slot follows.

## When you're stuck

- Disagreement between markdown mirrors and source HTMLs? **Source HTML
  wins.** Update the markdown.
- Open question that doesn't have an ICD? Either author the ICD (if the
  answer is clear) or park it in [`discussion/`](discussion).
- Want to add an Intent kind to ICD-02, or a CycleEvent kind to ICD-06?
  That's an architecture session. Stop, draft the ICD change, open it as a
  paper-only PR.
