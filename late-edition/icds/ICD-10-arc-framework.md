# ICD-10 · Arc Framework

**Status:** v0.1 (PRE-1.0 — initial draft)
**Band:** strong (framework only; arc content stays fuzzy at Tier-1.x / Tier-2)
**First caller:** milestone 1.0 (Tier-1 opener — framework lit; first authored arc content lands at milestone 1.1 or 1.2)
**Source:** [`../design/design-doc.html`](../design/design-doc.html) §18 (story engine · three-tier shape · slot grammar · Investigation 3-step chain · authored arc spec)

## Purpose

design-doc.html §18 names three tiers — **Whispers** (~70%, slot-grammar
templates, single-step), **Investigations** (~25%, procedural 3-step
chains), and **Arcs** (~5%, hand-authored 4-6 episode branching
narratives). The Tier-0 substrate
([`../js/sim/headlines.js`](../js/sim/headlines.js) §18 slot grammar +
[`../js/sim/districts.js`](../js/sim/districts.js) §16 district-as-data
+ [`../js/sim/lead-spawner.js`](../js/sim/lead-spawner.js) §19 spawn
engine) shipped at 0.10.0 lit the Whisper tier and the 70/25/5 tier
roll, but **collapses `tier === 'arc'` to `'investigation'`** because
no contract authored what an arc *was*. ICD-10 lifts that placeholder.

The framework promotion to Strong at the post-Tier-0 → Tier-1 re-eval
made the Whisper substrate load-bearing for every Tier-1 story
milestone; ICD-10 makes the Investigation and Arc tiers contract-ready
so the Tier-1.x content sessions have a shape to author against. The
**eight authored arcs** themselves (Longshoreman Strike · Mayor's
Mistress · Empty Vault · Vanishing Singer · Veteran's Suicide · Hand
on the Bell · Race at Belmont · Your Father's Killer) stay fuzzy as
content authoring (overview §Fuzzy band line 54); ICD-10 ships the
framework they slot into.

## Shape

```ts
type StoryTier = 'whisper' | 'investigation' | 'arc';   // unchanged from ICD-05 v0.1

// Existing Story shape (ICD-05) gains one optional field at v0.1:
interface Story {
  // ...unchanged ICD-05 fields...
  parent_story_id?: StoryId;     // v0.1 — links Investigation 3-step chain and Arc episode chain
  arc_episode_id?: ArcEpisodeId; // v0.1 — set when this Story is an Arc episode (undefined otherwise)
}

type ArcId = string;          // 'longshoreman_strike' | 'mayors_mistress' | ... (eight values at MVP)
type ArcEpisodeId = string;   // 'longshoreman_strike.walkout' | 'longshoreman_strike.foremans_wife' | ...

interface StoryArc {
  id:        ArcId;
  trigger:   ArcTriggerPredicate;     // composable; see §Trigger predicate vocabulary
  episodes:  ArcEpisode[];            // ordered; first is the entry
  outcomes:  ArcOutcome[];            // terminal-state effects on world
}

interface ArcEpisode {
  id:          ArcEpisodeId;
  headline:    string;                // authored canonical headline; slot grammar does NOT apply
  branch_table: ArcBranchTable;       // 2-3 way choice → next episode or terminal
  // Optional balance hints (per-episode override of the §19 yields):
  cash_yield?: number;
  heat_yield?: number;
  ink_cost?:   number;
}

interface ArcBranchTable {
  choices: ArcChoice[];               // 2-3 entries
}

interface ArcChoice {
  label:    string;                   // player-facing prose (e.g. "bury" / "splash" / "kill the story")
  next:     ArcEpisodeId | 'terminal';// next episode in chain, or end-of-arc marker
  outcome?: ArcOutcomeId;             // populated only on terminal — picks an outcome by id
}

interface ArcOutcome {
  id:                 ArcOutcomeId;
  district_disposition?: { district: DistrictId, value: 'loyal' | 'grudging' | 'bitter' | 'open hostility' };
  rival_posture_delta?:  { rival: RivalId, delta: -1 | 0 | +1 };
  cash_one_time?:     number;
  heat_one_time?:     number;
}

type ArcOutcomeId = string;
```

The framework hangs **off two existing primitives**: ICD-05's `Story`
interface (extended with the two optional foreign-key fields) and
ICD-04's save schema (extended at v0.1.2 in-PR per Constraint #4 to
carry an `active_arcs[]` block — see §Save surface below). No new
World-level shape; no new building kind; no new top-level WorldFrame
field.

## Investigation 3-step chain shape

design-doc.html §18 line 1347 — *"verifying one lead spawns a
follow-up lead, which spawns a third. 3-step chains."* Mid-game
bread-and-butter. The framework treats Investigations as **procedural
arcs with a fixed 3-step structure and no authored branches** — the
spawner emits the chain mechanically against the existing slot
grammar.

**Mechanics:**

1. Story `A` spawns with `tier: 'investigation'`, `parent_story_id:
   undefined`. Player picks it up; reporter delivers it to the Bureau;
   photog verifies it at Darkroom (ICD-05 transition row 3).
2. On `A` reaching `state: 'verified'`, the spawner emits Story `B`
   with `tier: 'investigation'`, `parent_story_id: A.id`. `B` spawns
   in the **same district as `A`** (the Investigation chain stays
   geographically focused). The spawn carries a deterministic seed
   derived from `A.id` so save/load reproduces the chain.
3. On `B` reaching `state: 'verified'`, the spawner emits Story `C`
   with `parent_story_id: B.id`. Same district; same determinism.
4. On `C` reaching `state: 'printed'`, the chain terminates.
   `EditionSummary.story_digest[]` carries the chain via `parent_story_id`
   so the debrief panel can render the 3-step as a single Investigation
   feature.

**Rival interaction.** Evening Star RUSH state (ICD-02 v0.2 §Evening
Star state machine) targets visible Investigation leads — a RUSH that
scoops the player's `A` short-circuits the chain (no `B` spawns).
Observer INVESTIGATE state (ICD-02 v0.3) similarly may pick `B` or `C`
as its multi-edition target if they're player lies.

**Archive interaction.** Per ICD-09, the player may archive `A`, `B`,
or `C` while waiting on the next step. The chain pauses at archive —
the next-step spawn fires on `verified` state arrival, not on chain
progression, so an archived story does not advance the chain.
Releasing archived → verified re-enables progression.

The lead-spawner placeholder in
[`../js/sim/lead-spawner.js`](../js/sim/lead-spawner.js) line 101
(`if (tier === 'arc') tier = 'investigation';`) is **the slot the
ICD-10 `'arc'` tier value retires.** At milestone 1.0 the spawner's
tier roll keeps producing 5% `'arc'` lots, and the new arc-trigger
predicate decides whether the 5% becomes an actual arc spawn or
collapses back to investigation (no arc whose trigger fires →
investigation; arc with firing trigger → arc episode 1). The 70/25/5
distribution holds; arcs become rarer because their triggers gate.

## Trigger predicate vocabulary

A small, composable predicate language. Triggers are evaluated against
the world state at lead-spawner roll time (per the ICD-04 v0.1.1
`lead_spawner` block's seeded cadence). Each named predicate is a
pure function `(world: WorldSnap) → boolean`.

```ts
type ArcTriggerPredicate =
  | { kind: 'heat_above',               threshold: number }                  // world.heat > threshold
  | { kind: 'district_uncovered',       district: DistrictId }               // no Bureau-family covers it
  | { kind: 'observer_silent_n_editions', n: number }                        // Observer in SILENCED or PASS for ≥ n editions
  | { kind: 'rival_state',              rival: RivalId, state: string }      // RivalView.own.state === state
  | { kind: 'district_heat_above',      district: DistrictId, threshold: number }  // per-district heat (Tier-1.x)
  | { kind: 'edition_at_least',         edition: number }                    // world.cycle.edition ≥ edition
  | { kind: 'all_of',                   children: ArcTriggerPredicate[] }    // composer: AND
  | { kind: 'any_of',                   children: ArcTriggerPredicate[] };   // composer: OR
```

- **Per-rival reads.** `rival_state` reads against the rival's own
  current state name — the same surface ICD-02 v0.2.2 exposed via
  `RivalView.own.state`. Arc triggers see rival state directly
  (unlike rivals, which see each other through `edition_history` per
  ICD-02 §Notes inter-rival paragraph).
- **District-heat (Tier-1.x).** The `district_heat_above` predicate
  depends on a per-district heat accumulator that does not exist at
  Tier-0 (heat is global). v0.1 commits the predicate shape; the
  sim-side accumulator wires when the first arc that needs it lands
  (Longshoreman Strike, per the canonical example below — *"Docks
  heat > 60"*).
- **Composers.** `all_of` / `any_of` accept any list of children;
  arbitrary nesting allowed. The trigger evaluator is a pure
  recursive walk; depth is unlikely to exceed 3-4 layers across the
  eight MVP arcs.
- **Vocabulary closure.** Adding a new predicate kind (e.g.
  `cash_above` or `reporters_dead_n`) is an architecture session
  per the §Deviation policy below. The Tier-1.x content sessions
  may surface needs; the vocabulary tightens at the first such
  surfacing, not pre-emptively.

## Spec-validation reference — THE LONGSHOREMAN STRIKE

design-doc.html §18 lines 1382-1392 is the canonical authored-arc
table. Lifted verbatim into ICD-10's shape:

```ts
const THE_LONGSHOREMAN_STRIKE: StoryArc = {
  id: 'longshoreman_strike',
  trigger: {
    kind: 'all_of',
    children: [
      { kind: 'district_heat_above',          district: 'docks', threshold: 60 },
      // "player has 1+ Bureau in Docks" — encoded as district-uncovered NOT firing:
      { kind: 'all_of', children: [
        { kind: 'district_uncovered', district: 'docks' }
      ]},  // (this nested predicate is intentionally negated in code — see §Notes)
      { kind: 'observer_silent_n_editions',   n: 3 },  // approximates "Observer has not run the strike story in the last 3 editions"
    ],
  },
  episodes: [
    { id: 'longshoreman_strike.walkout',
      headline: 'THE WALKOUT — Longshoremen halt the harbor',
      branch_table: { choices: [
        { label: 'bury',   next: 'terminal', outcome: 'bury_outcome' },   // low cash, low heat
        { label: 'splash', next: 'longshoreman_strike.foremans_wife' },   // high cash, +heat, unlocks ep 2
      ]},
    },
    { id: 'longshoreman_strike.foremans_wife',
      headline: "THE FOREMAN'S WIFE — A personal angle",
      branch_table: { choices: [
        { label: 'humanize',       next: 'longshoreman_strike.company_man' },
        { label: 'vilify',         next: 'longshoreman_strike.company_man' },
        { label: 'kill the story', next: 'terminal', outcome: 'kill_outcome' },
      ]},
    },
    { id: 'longshoreman_strike.company_man',
      headline: 'THE COMPANY MAN — The planted source',
      branch_table: { choices: [
        { label: 'print his version',    next: 'longshoreman_strike.deal' },
        { label: 'counter-investigate',  next: 'longshoreman_strike.deal' },
        { label: 'blackmail him',        next: 'longshoreman_strike.deal' },
      ]},
    },
    { id: 'longshoreman_strike.deal',
      headline: 'THE DEAL — The strike ends',
      branch_table: { choices: [
        { label: 'celebrate labor',  next: 'terminal', outcome: 'labor_outcome' },
        { label: 'bury labor',       next: 'terminal', outcome: 'corp_outcome' },
      ]},
    },
  ],
  outcomes: [
    { id: 'bury_outcome',    district_disposition: { district: 'docks', value: 'grudging'        }, cash_one_time:   300 },
    { id: 'kill_outcome',    district_disposition: { district: 'docks', value: 'bitter'          },                       heat_one_time: -10 },
    { id: 'labor_outcome',   district_disposition: { district: 'docks', value: 'loyal'           }, cash_one_time:  2000, heat_one_time: +20 },
    { id: 'corp_outcome',    district_disposition: { district: 'docks', value: 'open hostility'  }, cash_one_time:  3500, heat_one_time: +35 },
  ],
};
```

This example is **the validation reference for the framework**, not
ICD-10 itself authoring the Longshoreman Strike — first authored arc
content lands at milestone 1.1 or 1.2 (content slot). The shape above
demonstrates that the framework accommodates the §18 spec's branch
table, outcome table, and trigger predicate.

## Save surface

Arc episode progress lives in a new `SaveBlobV1.active_arcs[]` block
authored at ICD-04 v0.1.2 (in-PR at the first milestone that wires an
authored arc — milestone 1.1 or 1.2). The block carries one entry per
arc currently in progress:

```ts
interface ActiveArcSnap {
  arc_id:           ArcId;
  current_episode:  ArcEpisodeId;
  chosen_path:      ArcChoice['label'][];   // chain of branch choices made so far
  spawn_edition:    number;                 // edition the arc first fired its trigger
}
```

A Story carrying `arc_episode_id` round-trips via the existing
`SaveBlobV1.stories[]` array (the `arc_episode_id` joins
`StorySnap` as a sibling optional field at ICD-04 v0.1.2). The
`active_arcs[]` block is the parallel record of arc-level state
(which episode the player is on; which branches were picked).

**Note:** v0.1 of ICD-10 ships **only the framework shape**. The
`active_arcs[]` save block is committed at ICD-04 v0.1.2 in-PR with
the first arc-content milestone — milestone 1.0 (Tier-1 opener)
does **not** wire arcs (no authored content lands then), so the
save block does not yet need to exist. The lead-spawner's `tier ===
'arc'` collapse rule from 0.10.0 stays in effect at milestone 1.0
under a tighter condition: "if no `StoryArc` is registered, collapse
to investigation." The registry surface is a milestone 1.1+ concern.

## HUD surface

Arc episodes surface through two existing channels:

- **The dossier "Selected" region** (ICD-01 v0.5 §HudState) — when
  the selected unit is carrying a Story whose `arc_episode_id` is
  set, the dossier shows the arc id + episode headline + branch-
  table teaser. Single-line addition; no new dossier region.
- **The edition debrief panel** (ICD-06 v0.2 §EditionSummary) —
  arc episodes appear as headline cards on the newspaper-page
  layout (D-07, shipped at 0.10.2). Front-page placement (large
  card) for arc tier; the existing slot-grammar Whisper layout
  handles whisper/investigation. The newspaper-page renderer in
  [`../js/debrief-panel.js`](../js/debrief-panel.js) at the first
  arc milestone widens to handle the larger card.

**Branch-choice UI gesture** — at the `verified → plated` transition
for an arc story, the player must pick a branch before the story
can plate. The UI gesture for the choice (a modal? a corkboard
in-line picker?) is a milestone 1.1+ code-session call.

## Notes

- **§18 three-tier shape promotion (post-Tier-0 → Tier-1 re-eval).**
  The arc framework was promoted Fuzzy → Strong at v0.10.3 because
  the three Tier-0 substrate modules
  ([`../js/sim/headlines.js`](../js/sim/headlines.js) §18 slot
  grammar · [`../js/sim/districts.js`](../js/sim/districts.js) §16
  district-as-data ·
  [`../js/sim/lead-spawner.js`](../js/sim/lead-spawner.js) §19 spawn
  engine) implement the three-tier shape end-to-end at the Whisper
  level. ICD-10 makes the Investigation and Arc tiers contract-ready
  to match. Per the N=3 horizon rule, strong applies through milestone
  1.2.
- **Investigation chain is procedural-not-authored.** Unlike Arcs,
  Investigation 3-step chains have **no `StoryArc` record** — they
  are emitted directly by the lead-spawner's verification-handler
  hook (the hook fires on `verified` state arrival per ICD-05 §State
  transitions row 3). The framework treats Investigations as
  *synthetic arcs* — same `parent_story_id` chain semantics, same
  save-surface for chain reconstruction, but no branching, no
  authored headlines, no outcomes table.
- **Trigger evaluation cadence.** Arc triggers evaluate against the
  world state **at the lead-spawner's tier-roll boundary** (every
  spawn attempt — ~90 s per district per ICD-04 v0.1.1 `lead_spawner`
  block). They do **not** evaluate per-frame. This means an arc
  whose trigger fires *between* spawn attempts must wait — at most
  one spawn cycle of delay. Acceptable: trigger predicates are
  long-running world-state predicates (heat, district coverage,
  rival posture), not transient frame-level events.
- **One arc active per arc id.** A `StoryArc` cannot fire while a
  prior instance of itself is still active (`ActiveArcSnap` exists
  for that `arc_id`). Two simultaneous instances of THE LONGSHOREMAN
  STRIKE would conflict on outcomes; the rule prevents the dispatch.
  Different arcs may overlap (Longshoreman + Mayor's Mistress in
  parallel is fine).
- **The Longshoreman example's nested-NOT predicate (§Spec-validation).**
  The example encodes *"player has 1+ Bureau in Docks"* as a nested
  `all_of` with `district_uncovered: docks` — read as "Docks **must
  not** be uncovered" → "Docks must have a covering Bureau."
  Predicate negation is not a first-class vocabulary kind at v0.1;
  the example uses an idiom (an `all_of` with a NOT semantic on its
  child) that the evaluator handles via a `! result` flip flag in
  the AST node. A `not` predicate kind is a §Open question.

## Open questions

- **`not` predicate kind.** v0.1's vocabulary lacks explicit
  negation. Adding `{ kind: 'not', child: ArcTriggerPredicate }`
  cleans up the Longshoreman-example idiom. Defer to the milestone
  that authors the first arc requiring negation — likely Longshoreman
  itself at 1.1 or 1.2.
- **Per-episode balance hint policy.** v0.1 makes `cash_yield` /
  `heat_yield` / `ink_cost` optional per episode (override of §19
  defaults). The §18 spec is silent on whether arcs use the §19
  yield table or carry per-arc economics. Playtest at first arc
  content milestone will settle it; the field shape stays.
- **Branch-choice timing.** At v0.1 the choice fires at `verified
  → plated` (the plating moment, when the story commits). An
  alternative is to fire it at `verified` arrival (the moment the
  story enters the queue). Code-session call at first arc milestone.
- **Multi-arc interaction.** When two arcs in parallel both want
  to set `district_disposition.docks`, last-writer-wins or
  vetoing? v0.1 commits last-writer-wins (the more-recently-finished
  arc dictates Docks disposition); playtest may want priority by
  arc weight.

## Deviation policy

Adding a new `ArcTriggerPredicate.kind`, changing the
`ArcBranchTable.choices.length` allowed range (currently 2-3 per the
§18 spec), adding a sixth `state` value to ICD-05's Story interface,
or changing the chain semantics of `parent_story_id` (e.g. allowing
multi-parent / DAG instead of pure chain) is an architecture session,
not a deviation. Tuning the per-episode `cash_yield` / `heat_yield`
numbers, or the trigger thresholds, is content authoring — no ICD
update unless the shape moves.

## Revision history

- **v0.1** (PRE-1.0, 2026-05-22) — Initial draft. Authored ahead of
  milestone 1.0 (Tier-1 opener) to retire the
  [`../js/sim/lead-spawner.js`](../js/sim/lead-spawner.js) line 101
  `tier === 'arc'` collapse-to-investigation placeholder. Five core
  shape commitments: (1) `StoryArc` record (id · trigger · episodes ·
  outcomes); (2) `ArcEpisode` shape (id · headline · branch table ·
  optional balance hints); (3) `ArcTriggerPredicate` vocabulary with
  eight named kinds + two composers (`all_of` / `any_of`); (4)
  Investigation 3-step chain semantics (`Story.parent_story_id`
  threading; spawner emits on `verified` arrival; rival RUSH /
  INVESTIGATE may scoop); (5) Save surface deferred to ICD-04 v0.1.2
  in-PR at first arc-content milestone (1.1+). Spec-validation
  reference: THE LONGSHOREMAN STRIKE (design-doc.html §18 lines
  1382-1392) encoded against the framework — demonstrates the trigger
  predicate, branch table, and outcome shapes all accommodate the
  canonical authored arc without contortion. ICD-05 widens by two
  optional fields (`parent_story_id`, `arc_episode_id`) in-PR at the
  milestone that ships authored content. HUD surface reuses the
  existing dossier "Selected" region + the milestone-0.10.2 newspaper-
  page debrief; no new regions. Four §Open questions parked (negation
  predicate · per-episode balance policy · branch-choice timing ·
  multi-arc disposition conflict). Source anchor: design-doc.html §18
  (three-tier shape · slot grammar · Investigation 3-step chain ·
  authored arc spec).
