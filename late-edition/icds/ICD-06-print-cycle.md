# ICD-06 · Edition / Print Cycle Events

**Status:** draft (Phase 0 / PRE-0.1)
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
  | { kind: 'EDITION_DEBRIEF_END' };
```

## Cycle timing

- **One edition = 12 minutes** (Design Doc §05, strong band).
- `DEADLINE_WARNING` fires **once** at T-30s. Audio sting + HUD shake hang off
  this (the non-visual deadline cue is the accessibility lever — see
  [`../discussion/accessibility.md`](../discussion/accessibility.md)).
- `DEADLINE_FIRE` triggers print: plated stories print, ink/cash/heat
  reconciled, debrief begins.
- `EDITION_DEBRIEF_BEGIN`/`END` bracket a paused interval where the player
  reviews the front page. Duration is player-controlled (click to dismiss).
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

## Open questions

- `EditionSummary` shape — stories printed, cash earned, heat applied, rival
  events. Sketch in ICD-06 v0.2 before milestone 0.5.
- Pause semantics — does `CYCLE_TICK` stop while the debrief is open?
  Default: **yes**. Confirm at the post-0.6 re-eval.

## Deviation policy

If milestone 0.5 needs to change the event shape or timing, update this ICD
**in the same PR**.
