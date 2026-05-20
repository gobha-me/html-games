# ICD-05 · Story Lifecycle Object

**Status:** v0.3 (shipped against milestone 0.4 — `lead → verified` lit up)
**Band:** strong
**First caller:** milestone 0.3 (lead spawn · pickup · return-to-bureau) — shipped in v0.3.0; row 3 (`lead → verified`) lit by milestone 0.4 (Photog · Darkroom) — shipped in v0.4.0
**Source:** [`../design/phase-0-roadmap.html`](../design/phase-0-roadmap.html) §03

## Purpose

One object, three lifecycle states. Field set grows by stage. **Critical: the
same `id` flows end-to-end** — the lead a reporter picks up is the same object
that gets printed on the press.

## Shape

```ts
interface Story {
  id:        string;
  state:     'lead' | 'verified' | 'plated' | 'printed';
  district:  DistrictId;
  flavor:    'vice' | 'violence' | 'money' | 'labor';
  tier:      'whisper' | 'investigation' | 'arc';
  truthful:  boolean;              // affects Observer trigger
  spawned_at_ms: number;

  // populated as it moves through the pipeline
  picked_up_by?:     ReporterId;
  held_by_building?: BuildingId;  // set when carrier drops at a building; clears when next carrier picks up
  verified_by?:      PhotogId;
  plated_by?:        EditorId;
  printed_in?:       EditionId;
  cash_yield?:       number;
  heat_yield?:       number;
}
```

## State transitions

| From | To | Trigger | First milestone |
|---|---|---|---|
| — | `lead` | spawn in district | 0.3 |
| `lead` | `lead` | reporter drops at bureau (sets `held_by_building`, clears `picked_up_by`) | 0.3 |
| `lead` | `verified` | photog confirms at darkroom | 0.4 |
| `verified` | `plated` | editor plates for the edition | 0.5 |
| `plated` | `printed` | edition fires | 0.5 |

Transitions out of a state are one-way. A story cannot move backward (a
verified story doesn't become a lead again — it becomes a *killed* story,
which is a separate archive state out of scope for the vertical slice). The
`lead → lead` self-transition above changes the carrier pointers, not the
state — the state didn't move, the one-way rule still holds.

## Notes

- `truthful: boolean` is the Observer rival's anchor. A non-truthful story that
  prints raises Observer attention; the slice tracks the field but doesn't use
  it until milestone 0.7+.
- `cash_yield` / `heat_yield` are computed at `plated` (from tier + flavor +
  district) and **frozen** there — the edition-debrief reads them, not
  re-derives.
- `tier === 'arc'` stories cross-link to an arc record (out of scope until §18
  authoring begins).
- `held_by_building` is the resting-state pointer for an in-pipeline Story
  between carriers. When set, the Story is **not** in `frame.leads` (see
  ICD-01 §LeadView) and **not** on a `UnitView.carrying` channel — it is
  dormant inside a building, waiting for the next stage's carrier. The field
  clears when the next carrier picks the Story up. The pickup site at 0.4
  is the Bureau (where 0.3 drops it); ferrying Bureau → Darkroom is the
  photog's job, opened by 0.4.
- **`lead → verified` field deltas (0.4)** — the transition fires when a
  carrying photog arrives adjacent to a Darkroom. On drop, the photog sets:
  `state = 'verified'`, `verified_by = <photog.id>`,
  `held_by_building = <darkroom.id>`, `picked_up_by = null`. The Story.id is
  unchanged (Purpose still holds). The verified Story sits dormant at the
  Darkroom until the Editor's `verified → plated` step at 0.5.

## Open questions

- Should `Story` carry a `version` field for save-schema migration? Defer to
  ICD-04 (PRE-0.8).

## Deviation policy

If milestone 0.4/0.5 needs to change the shape or transitions, update this
ICD **in the same PR**.

## Revision history

- **v0.3** (milestone 0.4, 2026-05-20) — Row 3 (`lead → verified`) lit up.
  No shape change; §Notes spell out the field deltas the transition sets
  (`verified_by`, `held_by_building = darkroom.id`, clear `picked_up_by`)
  so future readers don't reconstruct from `_handlePhotogArrival`. First
  caller is the 0.4 Photog · Darkroom code session.
- **v0.2** (milestone 0.3, 2026-05-20) — Added `held_by_building?: BuildingId`
  to the Story shape and the `lead → lead` self-transition row (reporter
  drop-at-bureau). Documented the resting-state semantic in §Notes. First
  caller is the 0.3 return-to-bureau leg.
- **v0.1** (PRE-0.1, Phase 0 bootstrap) — Draft. Story shape + state machine
  (`lead → verified → plated → printed`) from §03 of the supplement.
