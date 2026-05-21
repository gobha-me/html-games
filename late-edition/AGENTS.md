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
  All six ICDs are authored; milestones 0.1–0.9 have shipped against
  their contracts. The next slot is the post-0.9 re-eval (paper-only)
  before milestone 0.10 (Tier-0 closer).
- **When code deviates from an ICD, update the ICD in the same PR.** This
  is Constraint #4 of the methodology.
- **Bands are not decoration.** Strong-band commitments are load-bearing.
  Don't refactor them out without an architecture session.
- **The design HTMLs in [`design/`](design) are immutable.** If a design
  decision changes, the change lands in the markdown mirrors
  (`architecture/`, `icds/`, `discussion/`) — never edit the source HTMLs.

## Current state

**v0.9 — HUD corkboard · deadline ticker · dossier.** Code milestone.
ICD-01 v0.5 §HudState lifted as authored. Pure renderer-side
reorganization on top of the already-locked HudState / UnitView /
BuildingView / LeadView projections.

Headline outputs:

- **CSS Grid layout in [`index.html`](index.html).** `<body>` becomes
  a four-row grid (masthead · top cards · viewport+deadline-strip ·
  dossier row). `#world` keeps its full-bleed canvas in the `1fr`
  row; the renderer already reads `root.clientWidth/Height`
  ([`js/render/renderer.js`](js/render/renderer.js)) so resize
  reflows for free. Arcade back-link folds into the masthead so
  no chrome floats over the dossier.
- **`HudCorkboard` facade in [`js/hud.js`](js/hud.js).** Single
  `apply(frame)` entry kept (`main.js` change is one line). Three
  sibling region projectors:
  - `TopCards` — seven pinned index cards with serif numerals (Bodoni
    Moda) + mono kicker labels. `.is-hot` class on the Heat card when
    `heat >= 40` (design doc §19 first threshold).
  - `DeadlineStrip` — typewriter-ribbon across the top of the
    viewport. `.is-warning` class at ≤60s (red), `.is-critical` class
    at ≤10s (red + 2Hz opacity pulse via CSS `@keyframes`). Both
    classes clear at zero so the cycle transition doesn't strobe.
  - `Dossier` — three panels:
    - **Selected**: `frame.units.find(u => u.selected)` → kind
      (Reporter / Photog / Fixer / Editor / Goon) + state (Idle /
      Walking / Carrying) + "Carrying lead" annotation when applicable.
      Empty state "No selection".
    - **Story queue**: active leads count + tier histogram (whisper /
      investigation / arc) + flavor histogram (vice / violence /
      money / labor) — both derived from LeadView's locked `tier` /
      `flavor` fields — plus in-flight count from
      `hud.resources.stories`.
    - **Threats**: goon count from `frame.units` + Press HP from the
      Bureau BuildingView. Empty state "Streets quiet".
  - Projection helpers (`pickSelected`, `countByKind`,
    `tierHistogram`, `formatMs`, `formatEdition`) are named exports
    so node tests exercise them without jsdom.
- **Per-record change detection.** Each region caches its rendered
  state and writes DOM only on change.
- **ICD activity.** None. Every field consumed at 0.9 was already
  projected at v0.8 or earlier. Constraint #4 honored by zero
  deviation. ICD-01 bump candidates surfaced — `UnitView` stat
  badges (Nerve / Nose / Legs from the §13 mock) for the Selected
  dossier · `LeadView.district` for per-district Story queue ·
  `WorldFrame.rivals` for raid ETA / source direction — parked for
  the post-0.9 re-eval.
- **Tests.** 106 → 113 (seven new under
  [`tests/hud.test.mjs`](tests/hud.test.mjs)).

**Next: post-0.9 re-eval (paper-only).** Code-arch divergence check
across all six ICDs; weigh promotion of the surfaced ICD-01 bumps;
tighten HUD spec from medium→strong; confirm Tier-0 exit criteria
before milestone 0.10 (the Tier-0 closer).

## When you're stuck

- Disagreement between markdown mirrors and source HTMLs? **Source HTML
  wins.** Update the markdown.
- Open question that doesn't have an ICD? Either author the ICD (if the
  answer is clear) or park it in [`discussion/`](discussion).
- Want to add an Intent kind to ICD-02, or a CycleEvent kind to ICD-06?
  That's an architecture session. Stop, draft the ICD change, open it as a
  paper-only PR.
