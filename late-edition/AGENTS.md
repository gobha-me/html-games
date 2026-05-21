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

**v0.9.2 — RE-EVAL after 0.9 (paper + code-aware).** Third re-eval in
the Tier-0 plan, alongside [`architecture/re-eval-after-0.3.md`](architecture/re-eval-after-0.3.md)
and [`architecture/re-eval-after-0.6.md`](architecture/re-eval-after-0.6.md).
**Read [`architecture/re-eval-after-0.9.md`](architecture/re-eval-after-0.9.md)
and the supplement [`design/spec-vs-code-review-0.9.html`](design/spec-vs-code-review-0.9.html)
before opening the next session.** The HTML is a Claude Design audit of
the v0.9 codebase against the design package; the markdown re-eval is
the formal landing site and triage layer.

Headline verdicts:

- **Six ICDs intact.** Twelve code milestones in, zero interface drift.
  Constraint #4 honored every time. The methodology is working.
- **Findings are at the design-doc-to-code level, not contract level.**
  Seven criticals (audit C-01 through C-07), nine acknowledged drifts
  (D-01 through D-09, all flagged in code comments at the deviation
  site), fourteen spec'd-but-not-implemented gaps (G-01 through G-14),
  eleven explicit parks (P-01 through P-11).
- **One band promotion:** HUD corkboard medium → strong (overview line
  45). The §13 pixel-honest layout shipping at 0.9 is now load-bearing
  for ICD-01 v0.6's `UnitView.stats` / `LeadView.district` /
  `WorldFrame.rivals` additions.
- **One scheduled paper slot — PRE-0.10** — authors **ICD-01 v0.6**
  (`UnitView.stats` + `LeadView.district` + `WorldFrame.rivals:
  RivalStatusView[]` + `FxEvent` union) + **ICD-06 v0.4** (30 s minimum
  debrief wording per Design Doc §19) + **ICD-07 v0.1** (audio bus,
  new). Gates milestone 0.10.
- **Tier-0 exit criteria confirmed.** The audit's PR-C scope (lead-spawn
  engine + districts as data + Branch Bureau + slot-grammar headlines +
  run-end summary + high-score persistence + diegetic tutorial +
  minimum control surface) is the locked shape of milestone 0.10. Split
  into 0.10.0 / 0.10.1 at session open if scope creeps (0.7 precedent).
- **Four Gitea tickets opened** for the forward code sequence:
  PR-A (0.9.1 polish — seven mechanical fixes, no ICD bumps beyond a
  one-line ICD-02 §Notes addition in-PR per Constraint #4) ·
  PR-B (PRE-0.10 paper-only) ·
  PR-C (milestone 0.10 — Tier-0 closer) ·
  PR-D (0.10.x visual feedback — after PRE-0.10's `FxEvent` lands).
  Ordering is mandatory: PR-A first (any time), PR-B before PR-C,
  PR-B + PR-C before PR-D.

**Next: PRE-0.10** (paper-only) — authors the four ICD edits above.
After PRE-0.10 ships, milestone 0.10 (the Tier-0 closer) opens as a
code session with every required contract in hand. PR-A can land any
time before, during, or after PRE-0.10 — it carries no contract
dependencies beyond the one-line §Notes patch.

## When you're stuck

- Disagreement between markdown mirrors and source HTMLs? **Source HTML
  wins.** Update the markdown.
- Open question that doesn't have an ICD? Either author the ICD (if the
  answer is clear) or park it in [`discussion/`](discussion).
- Want to add an Intent kind to ICD-02, or a CycleEvent kind to ICD-06?
  That's an architecture session. Stop, draft the ICD change, open it as a
  paper-only PR.
