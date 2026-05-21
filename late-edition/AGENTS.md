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

**v0.6.1 — RE-EVAL after 0.6 shipped (paper + code-aware).** The first
re-evaluation since v0.3.1 (the post-0.3 re-eval) and the first one that's
paper + code-aware. No JS / test / index.html changes — strict paper-only
per METHODOLOGY §3.2. Outputs:

- **Four implemented ICDs survived contact with 0.4–0.6 code.** ICD-01
  v0.5, ICD-03 v0.2, ICD-05 v0.3, ICD-06 v0.2 — no drift; Constraint #4
  honored throughout (0.4 bumped ICD-05 v0.2→v0.3 in-PR; PRE-0.5 authored
  06 v0.2 + 01 v0.5; 0.5/0.6 used everything as authored). Two
  strong-band claims moved from *aligned* to *tested*: the 12-min cycle
  (`tests/print-cycle.test.mjs`) and the five-resource names
  (`tests/resources.test.mjs`).
- **Loop status:** inner three rings closed (dispatch→pickup→verify→
  plate→print, the 12-minute cycle, the cash/ink/heat economy). The
  adversarial ring (rivals + Press HP fail-state) is entirely a 0.7
  concern — expected per overview line 28.
- **One band promotion:** ICD-02 medium → strong (overview line 42
  fires on the N=3-window rule with 0.7 entering scope). Status edited
  in-PR; v0.2 shape work scheduled to PRE-0.7.
- **One scheduled paper slot — PRE-0.7** — authors ICD-02 v0.2
  (Evening Star SCAVENGE+RAID state machine, RAID_BUREAU policy,
  RivalView past-intents, RivalStatusView posture) and an ICD-05
  §Notes amendment (`AUTO_PLATE_SENTINEL` substitution path + ink
  plate-time hard gate rule). Gates milestone 0.7. Will ship at v0.6.2.
- **Three discussion docs settled:**
  - `discussion/tutorial-first-edition.md` — diegetic frame locked
    ("notes from the old man"); copy lands at milestone 0.10.
  - `discussion/difficulty-selector.md` — frequency-scaling only;
    deferred to Tier-1 run-meta layer.
  - `discussion/rival-state-visibility.md` — partial-dossier locked
    with posture vocabulary `{calm, scheming, hostile}`; medium-band.
- **Ink negative-balance enforcement** — locked to **plate-time hard
  gate**; lands at 0.7 with the Editor unit. ICD-05 §Notes amendment
  scheduled to PRE-0.7.

Full report: [`architecture/re-eval-after-0.6.md`](architecture/re-eval-after-0.6.md).

**Next: PRE-0.7 (paper).** Architecture session authoring ICD-02 v0.2 +
ICD-05 §Notes amendment. Gates milestone 0.7 (Evening Star SCAVENGE +
RAID, Goon unit, Editor unit, Fixer unit, Press HP + fail-state).

## When you're stuck

- Disagreement between markdown mirrors and source HTMLs? **Source HTML
  wins.** Update the markdown.
- Open question that doesn't have an ICD? Either author the ICD (if the
  answer is clear) or park it in [`discussion/`](discussion).
- Want to add an Intent kind to ICD-02, or a CycleEvent kind to ICD-06?
  That's an architecture session. Stop, draft the ICD change, open it as a
  paper-only PR.
