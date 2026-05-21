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

**v0.7.0 — milestone 0.7.0 shipped (code).** The adversarial ring closes.
Roadmap milestone 0.7 was split at session open into 0.7.0 (this PR —
adversarial ring) and 0.7.1 (Editor + ink plate-time gate, next PR) to
keep each code session inside one milestone's worth of scope. Both halves
are ICD-ready: ICD-02 v0.2 and ICD-05 v0.4 cover them as authored at
PRE-0.7.

Headline outputs:

- **Evening Star rival lit.** [`js/sim/evening-star.js`](js/sim/evening-star.js)
  implements ICD-02 v0.2's state machine — SCAVENGE + RAID + PASS bodies
  (the other four states caller-triggered to Tier-1), 20 s tick cadence,
  heat-banded `goons = 1/2/3` for `[40,60)/[60,80)/[80,∞)`,
  `eta_ms ≤ remaining_ms - 1000` clamp. Deterministic via the new
  [`js/sim/seeded-rng.js`](js/sim/seeded-rng.js) mulberry32 PRNG;
  same-seed reproducibility is asserted in tests.
- **Goon + Fixer units land.** Goons spawn at the NW grid edge
  (`GOON_SPAWN_TILE`) on `RAID_BUREAU` intent reconciliation, walk at
  2.5 u/s to a Bureau-adjacent tile, damage Press at 1 dmg/s on contact
  (design doc §17). Fixer (HP 3, 3.0 u/s) spawns east of Bureau,
  dispatchable via the existing input model; on adjacency 1-hit kills
  one goon; if 2+ goons adjacent, fixer dies too ("two goons beat one
  fixer" — design doc §rivals).
- **Press HP fail-state.** Bureau HP at 0 emits `CYCLE_GAME_OVER`
  (ICD-06 → v0.3); the new
  [`js/game-over-overlay.js`](js/game-over-overlay.js) mounts a terminal
  "THE PRESS BURNS" screen and the World short-circuits subsequent ticks
  (same shape as the debrief pause).
- **ICD activity.** ICD-06 v0.2 → v0.3 (CYCLE_GAME_OVER event added to
  the vocabulary; subscriber expectations table gained Game-over overlay
  row). ICD-02 v0.2 §Open questions closed in-PR (multi-edition transit
  deferred to Tier-1, HUD pill deferred to 0.9 corkboard); no shape
  change — bumped to v0.2.1 in revision history only. ICD-01 v0.5,
  ICD-03 v0.2, ICD-05 v0.4 — used as authored; no bumps. ICD-04 still
  deferred to PRE-0.8.
- **Tests.** 53 → 85 cases. New test files: `evening-star.test.mjs`,
  `rival-view.test.mjs`, `goon.test.mjs`, `press-hp.test.mjs`,
  `fixer.test.mjs`. `world-frame.test.mjs` updated to expect the new
  Fixer at construction.

**Next: milestone 0.7.1 (code).** Editor unit — stationary at Bureau,
substitutes `AUTO_PLATE_SENTINEL` with its `UnitId` at the plating step.
Ink plate-time hard gate per ICD-05 v0.4 §Notes: `verified → plated`
that would leave ink negative is rejected; the Story stays `verified`.
All required ICD shapes are already authored at v0.4 — code-only
milestone.

## When you're stuck

- Disagreement between markdown mirrors and source HTMLs? **Source HTML
  wins.** Update the markdown.
- Open question that doesn't have an ICD? Either author the ICD (if the
  answer is clear) or park it in [`discussion/`](discussion).
- Want to add an Intent kind to ICD-02, or a CycleEvent kind to ICD-06?
  That's an architecture session. Stop, draft the ICD change, open it as a
  paper-only PR.
