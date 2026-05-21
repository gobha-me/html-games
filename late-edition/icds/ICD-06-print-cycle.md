# ICD-06 · Edition / Print Cycle Events

**Status:** v0.4 (shipped against PRE-0.10 — §Cycle timing debrief wording aligned with Design Doc §19's 30 s minimum)
**Band:** strong (touches every subsystem)
**First caller:** milestone 0.5 (print cycle clock · deadline events · debrief panel)
**Source:** [`../design/phase-0-roadmap.html`](../design/phase-0-roadmap.html) §03

## Purpose

The print cycle is the heartbeat — everything subscribes to it. This ICD is
strong-band by virtue of crossing every other subsystem: unit AI, rival AI,
HUD, audio, save, edition debrief.

## Event vocabulary

```ts
type CycleEvent =
  | { kind: 'CYCLE_BEGIN',         edition: number }
  | { kind: 'CYCLE_TICK',          dt_ms: number }
  | { kind: 'DEADLINE_WARNING',    remaining_ms: 30_000 }
  | { kind: 'DEADLINE_FIRE',       edition: number }
  | { kind: 'EDITION_DEBRIEF_BEGIN', edition: number, summary: EditionSummary }
  | { kind: 'EDITION_DEBRIEF_END' }
  | { kind: 'CYCLE_GAME_OVER',     edition: number, reason: GameOverReason };

type GameOverReason = 'press_destroyed';   // v0.3 vocabulary; new reasons admitted via this ICD only
```

- `CYCLE_GAME_OVER` is **terminal**. It fires at most once per game run, when
  the single fail-state condition is reached (overview §Single fail-state).
  After it fires, the World short-circuits subsequent ticks the same way
  `EDITION_DEBRIEF_BEGIN` pauses the sim — the renderer keeps painting the
  last snapshot, but the cycle clock and units stop. There is no `ack`-equivalent
  for `CYCLE_GAME_OVER`; the run is over.
- The 0.7.0 vocabulary covers exactly one `GameOverReason`: `'press_destroyed'`
  (Bureau HP reached 0 via goon damage). Future reasons (e.g., bankruptcy at
  Tier-1) widen the union and require an ICD-06 bump.

## `EditionSummary` shape (v0.2)

The data contract for the debrief panel — a recap of what happened during the
just-closed edition, surfaced as the corkboard-of-newspaper-pages described in
[`../design/design-doc.html`](../design/design-doc.html) §06. Carried on
`EDITION_DEBRIEF_BEGIN.summary` (see Event vocabulary above) so the panel can
render without reaching back into sim state.

```ts
interface EditionSummary {
  edition:         number;             // matches the closing edition's CYCLE_BEGIN.edition
  stories_printed: StoryDigest[];      // what landed on the front page this cycle
  cash_earned:     number;             // delta cash this edition (sum of StoryDigest.cash)
  ink_consumed:    number;             // delta ink this edition (press cost + plate cost)
  heat_applied:    number;             // delta heat this edition (own choices + rival actions)
  rival_events:    RivalEventDigest[]; // major rival beats during this edition (corkboard pins)
}

interface StoryDigest {
  id:       StoryId;                                  // same id as the printed Story (ICD-05 §Purpose)
  headline: string;                                   // copy from Story
  flavor:   'vice' | 'violence' | 'money' | 'labor'; // matches LeadView.flavor (ICD-01)
  tier:     'whisper' | 'investigation' | 'arc';     // matches LeadView.tier (ICD-01)
  cash:     number;                                   // this story's contribution to cash_earned
}

interface RivalEventDigest {
  rival: 'herald' | 'evening_star' | 'observer';     // matches ICD-02 rival roster
  kind:  string;                                      // ICD-02 v0.2+ Intent kind (string-typed at v0.2 while ICD-02 stays medium-band)
  text:  string;                                      // short caption for the corkboard pin
}
```

- `edition` reuses the same number the closing `CYCLE_BEGIN` emitted; the
  debrief belongs to the edition just ended, not the one about to open.
- `stories_printed[].id` is **the same id** as the corresponding `Story` (ICD-05
  §Purpose). The debrief is the last surface where that id appears before the
  Story leaves the live world; the run-end summary at 0.10 can chain through it.
- `cash_earned` is the published delta; the running balance lives on `HudState`
  (ICD-01 v0.5). The summary intentionally carries the *delta* so the panel can
  render "+$ this edition" without diffing against a prior snapshot.
- `ink_consumed` and `heat_applied` follow the same delta pattern. Numbers stay
  medium-band per [`../architecture/00-overview.md`](../architecture/00-overview.md) §"Five resources" — the
  *shape* is locked here; the values land at milestone 0.6.
- `rival_events.kind` is string-typed at v0.2: ICD-02 v0.1 is medium-band and
  the rival intent vocabulary isn't pinned yet. The post-0.6 RE-EVAL slot
  ([`../roadmap.md`](../roadmap.md) line 26) is the scheduled promotion point;
  a future ICD-02 bump may tighten this to a union.

## Cycle timing

- **One edition = 12 minutes** (Design Doc §05, strong band).
- `DEADLINE_WARNING` fires **once** at T-30s. Audio sting + HUD shake hang off
  this (the non-visual deadline cue is the accessibility lever — see
  [`../discussion/accessibility.md`](../discussion/accessibility.md)).
- `DEADLINE_FIRE` triggers print: plated stories print, ink/cash/heat
  reconciled, debrief begins.
- `EDITION_DEBRIEF_BEGIN`/`END` bracket a paused interval where the player
  reviews the front page. **30 s minimum debrief animation; dismissable
  after the minimum elapses** ([`../design/design-doc.html`](../design/design-doc.html)
  §19 — *"Between-edition pause: 30s · cannot be skipped · debrief
  animation"*; also §05 — *"The first 30 seconds of every new edition are
  a debrief"*). Before the minimum elapses the dismiss input is ignored;
  after it elapses the player closes the panel as before. The code-side
  gate lands at milestone 0.10 alongside the corkboard-newspaper-pages
  debrief panel (PR-D / audit C-05).
- `CYCLE_BEGIN` fires immediately after `EDITION_DEBRIEF_END` for the next
  edition.

## Subscriber expectations

| Subsystem | Subscribes to | First milestone |
|---|---|---|
| Print press | `DEADLINE_FIRE` | 0.5 |
| HUD ticker | `CYCLE_TICK`, `DEADLINE_WARNING` | 0.5, 0.9 |
| Edition debrief panel | `EDITION_DEBRIEF_BEGIN`/`END` | 0.5 |
| Audio sting | `DEADLINE_WARNING` | 0.5+ (audio system fuzzy) |
| Rival AI tick | `CYCLE_TICK` | 0.7 |
| Save | `EDITION_DEBRIEF_END` | 0.8 |
| Run-end summary | `DEADLINE_FIRE` (final) | 0.10 |
| Game-over overlay | `CYCLE_GAME_OVER` | 0.7.0 |

## Open questions

*(All v0.1 open questions closed at PRE-0.5 — see Revision history below.)*

- Pause-during-debrief — **resolved at v0.2: `CYCLE_TICK` stops while
  `EDITION_DEBRIEF_BEGIN` is open and resumes at `EDITION_DEBRIEF_END`.** The
  default the v0.1 draft proposed; the post-0.6 re-eval may revisit if play
  surfaces a reason to keep the world ticking during debrief.

## Deviation policy

If milestone 0.5 needs to change the event shape or timing, update this ICD
**in the same PR** (Constraint #4 of the methodology). Adding a new
`CycleEvent` kind, or changing a field on `EditionSummary` / `StoryDigest` /
`RivalEventDigest`, is an architecture session, not a deviation — stop and run
a paper session.

## Revision history

- **v0.4** (PRE-0.10, 2026-05-21) — Single-line wording change to §Cycle
  timing (audit C-05). Replaced *"Duration is player-controlled (click to
  dismiss)"* with *"30 s minimum debrief animation; dismissable after the
  minimum elapses"*, citing Design Doc §19 (*"Between-edition pause: 30s ·
  cannot be skipped · debrief animation"*) and §05 (*"The first 30 seconds
  of every new edition are a debrief"*). No shape change, no new event
  kind, no `EditionSummary` / `StoryDigest` / `RivalEventDigest` change,
  no subscriber-table change. The code-side gate (a minimum-elapsed clamp
  on the dismiss handler in the corkboard debrief panel) lands at
  milestone 0.10 alongside the newspaper-pages debrief render (PR-D).
- **v0.3** (milestone 0.7.0, 2026-05-21) — Added `CYCLE_GAME_OVER` event to
  the vocabulary for the strong-band single-fail-state condition (overview
  §Single fail-state). `GameOverReason` union introduced with a single
  initial value `'press_destroyed'`; terminal-event semantics pinned in the
  vocabulary §Notes. Subscriber expectations table gained the Game-over
  overlay row (`js/game-over-overlay.js`, milestone 0.7.0). `EditionSummary`,
  `StoryDigest`, `RivalEventDigest`, cycle timing, and pause-during-debrief
  semantics unchanged from v0.2.
- **v0.2** (PRE-0.5, 2026-05-20) — Authored the `EditionSummary` shape (plus
  `StoryDigest` and `RivalEventDigest` sub-shapes) referenced by
  `EDITION_DEBRIEF_BEGIN` since v0.1. Resolved the pause-during-debrief
  question: `CYCLE_TICK` stops between `EDITION_DEBRIEF_BEGIN` and
  `EDITION_DEBRIEF_END`. Event vocabulary, cycle timing, and subscriber
  expectations unchanged from v0.1.
- **v0.1** (PRE-0.1, Phase 0 bootstrap) — Draft. Event vocabulary and timing
  drafted from §03 of the supplement; `EditionSummary` shape left as one-line
  sketch (closed at v0.2).
