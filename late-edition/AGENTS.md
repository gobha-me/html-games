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

**v0.6.2 — PRE-0.7 shipped (paper-only).** Single architecture session,
no code. The forward-ICD gap the post-0.6 re-eval surfaced is now closed
— milestone 0.7 has every ICD it needs at the level the strong band
claims. METHODOLOGY §3.2 honored: zero diff under `js/`, `tests/`,
`index.html`, `design/`. Pattern mirrors the v0.4.1 PRE-0.5 precedent.
Outputs:

- **ICD-02 v0.1 → v0.2** — strong-band rival contract authored ahead of
  its 0.7 first caller. Four pieces of shape work:
  - **Evening Star SCAVENGE + RAID state machine** lifted from
    `design/rival-ai-spec.html` §04 + §08 into committed prose. 6
    states (`SCAVENGE | RAID | BRIBE | RUSH | PANIC | BURNOUT`), 9
    transitions with seeded-RNG predicates, 20 s tick cadence. The
    0.7 slice scope is SCAVENGE + RAID + PASS; the other four states
    are shape-committed (transition graph closes) but caller-triggered.
  - **`RAID_BUREAU` Intent shape detail** — `goons` count by heat band
    (1 at heat 40–60, 2 at 60–80, 3 at ≥ 80), `eta_ms` clamped to
    `cycle.remaining_ms - 1000` (one-edition raids at 0.7; multi-edition
    deferred), `target: BuildingId` always the Bureau at 0.7 (Branch +
    Switchboard fuzzy until Tier-1).
  - **`RivalView` projection** authored — cycle / player / own /
    edition_history sub-shapes. Closes v0.1 §Open-questions item on
    past-intent visibility: rivals **do** see their own past intents,
    bounded to the last 8 entries (the cooldown working set).
  - **`RivalStatusView` posture projection** — medium-band vocabulary
    `'calm' | 'scheming' | 'hostile'` locked at re-eval §3.5 Q5. The
    Evening Star state→posture mapping is committed (SCAVENGE/RUSH/
    BURNOUT → `calm`; BRIBE → `scheming`; RAID/PANIC → `hostile`);
    Herald + Observer mappings defer to their first-caller milestones.
- **ICD-05 v0.3 → v0.4 §Notes amendment** — no shape change. Two
  paragraphs added:
  - **Pre-Editor `AUTO_PLATE_SENTINEL` substitution path** — captures
    in committed prose what previously lived only in code comments
    (`world-state.js:41-47`): the same-frame `verified → plated →
    printed` auto-fire at `DEADLINE_FIRE` uses `plated_by =
    AUTO_PLATE_SENTINEL` until the Editor unit at 0.7 substitutes its
    `UnitId` in the same slot. Field type stays `EditorId`.
  - **Ink plate-time hard gate** — pins the v0.6.0 changelog's
    "can't print if ink runs out" enforcement to plate-time rejection
    (verdict (a) of re-eval §3.5 Q6). A `verified → plated` transition
    that would leave `World.resources.ink` negative is rejected; the
    Story stays `verified` and waits for the next edition. The
    Editor's arrival logic enforces it at 0.7; the
    `AUTO_PLATE_SENTINEL` path inherits the rule until then.
- **No other ICD touched.** ICD-01 v0.5 stays — the `RivalStatusView`
  HUD surface decision (a `HudState.rival_status` pill at 0.7 vs. the
  corkboard at 0.9 absorbing it) is flagged on ICD-02 §Open questions
  and decided at the 0.7 code session, not at PRE-0.7. ICD-03 v0.2,
  ICD-06 v0.2 — no drift; no bumps.

**Next: milestone 0.7 (code).** Evening Star SCAVENGE + RAID (Intent
emission + state-machine bodies for those two states + PASS), Goon
unit, Editor unit (substitutes `AUTO_PLATE_SENTINEL` and enforces the
plate-time ink gate), Fixer unit, Press HP + fail-state. All required
ICDs are now authored.

## When you're stuck

- Disagreement between markdown mirrors and source HTMLs? **Source HTML
  wins.** Update the markdown.
- Open question that doesn't have an ICD? Either author the ICD (if the
  answer is clear) or park it in [`discussion/`](discussion).
- Want to add an Intent kind to ICD-02, or a CycleEvent kind to ICD-06?
  That's an architecture session. Stop, draft the ICD change, open it as a
  paper-only PR.
