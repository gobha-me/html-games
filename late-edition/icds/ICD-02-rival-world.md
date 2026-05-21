# ICD-02 · Rival ↔ World

**Status:** draft (Phase 0 / PRE-0.1) — band promoted at post-0.6 RE-EVAL; v0.2 shape work scheduled to PRE-0.7
**Band:** strong (post-0.6 RE-EVAL promotion per overview line 42 N-window rule; v0.1 shape preserved until PRE-0.7 authors v0.2)
**First caller:** milestone 0.7 (Evening Star SCAVENGE + RAID states)
**Source:** [`../design/phase-0-roadmap.html`](../design/phase-0-roadmap.html) §03 ·
[`../design/rival-ai-spec.html`](../design/rival-ai-spec.html) §02 + §08

## Purpose

The `tick(world, dt) → Intent[]` contract that each rival paper implements. The
world hands each rival a read-only snapshot; the rival returns intents that the
world applies (or rejects) under its own rules.

## Per-tick contract

```ts
type Intent =
  | { kind: 'FILE_STORY',     district: DistrictId, tier: Tier, source: SourceId }
  | { kind: 'RAID_BUREAU',    goons: number, eta_ms: number }
  | { kind: 'BRIBE_REPORTER', reporterId: ReporterId }
  | { kind: 'POISON_LEAD',    leadId: LeadId }
  | { kind: 'SCOUT_DISTRICT', district: DistrictId }
  | { kind: 'OFFER_WIRE_DEAL', terms: WireTerms }
  | { kind: 'OFFER_BUYOUT',    amount: number }
  | { kind: 'PARTNER_REQUEST', district: DistrictId }
  | { kind: 'PASS' };

interface Rival {
  tick(world: RivalView, dt_ms: number): Intent[];
}
```

`RivalView` is a read-only projection — rivals never mutate world state directly.

## Caller-triggered scope

The vertical slice only implements `RAID_BUREAU` and `PASS` for the Evening
Star. The **full Intent vocabulary above is committed today** — the bodies fill
in as their callers arrive (caller-triggered pattern, methodology §Phase 2). No
new Intent kinds may be added without an ICD revision.

| Intent | First implementer | First milestone |
|---|---|---|
| `PASS` | all rivals | 0.7 |
| `RAID_BUREAU` | Evening Star | 0.7 |
| `FILE_STORY` | Herald | Tier-1 |
| `BRIBE_REPORTER` | Herald | Tier-1 |
| `SCOUT_DISTRICT` | Herald | Tier-1 |
| `POISON_LEAD` | Observer | Tier-1 |
| `OFFER_WIRE_DEAL` | (TBD) | Tier-1+ |
| `OFFER_BUYOUT` | Evening Star | Tier-1+ |
| `PARTNER_REQUEST` | Observer | Tier-1+ |

## Open questions

- `WireTerms` shape — defer until first wire-deal milestone.
- Should rivals see their own past intents in `RivalView`? Probably yes for
  arc-aware behavior. **Resolution scheduled to PRE-0.7** — the post-0.6
  RE-EVAL promoted the band but deferred shape work to the PRE-0.7 paper
  slot per METHODOLOGY §3.2.

## Deviation policy

Adding an Intent kind, or changing the shape of `tick`, requires an
architecture session and a same-PR doc update.

## Revision history

- **band promotion** (post-0.6 RE-EVAL, 2026-05-21) — Band moved
  medium → strong per overview line 42's N=3-window rule with 0.7
  entering scope. **No shape change** in this PR — the v0.2 shape work
  (Evening Star SCAVENGE+RAID state machine, RAID_BUREAU goon-count
  policy, RivalView past-intents resolution, RivalStatusView posture
  projection per
  [`../discussion/rival-state-visibility.md`](../discussion/rival-state-visibility.md))
  is scheduled to PRE-0.7. See
  [`../architecture/re-eval-after-0.6.md`](../architecture/re-eval-after-0.6.md)
  §3.5 Q2 + §3 PRE-0.7.
- **v0.1** (PRE-0.1, Phase 0 bootstrap) — Draft. Intent vocabulary
  committed; caller-triggered scope table; v0.1 §Open questions
  flagged for the post-0.6 re-eval.
