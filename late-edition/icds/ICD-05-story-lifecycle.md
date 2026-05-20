# ICD-05 · Story Lifecycle Object

**Status:** draft (Phase 0 / PRE-0.1)
**Band:** strong
**First caller:** milestone 0.3 (lead spawn · pickup · return-to-bureau)
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
  picked_up_by?: ReporterId;
  verified_by?:  PhotogId;
  plated_by?:    EditorId;
  printed_in?:   EditionId;
  cash_yield?:   number;
  heat_yield?:   number;
}
```

## State transitions

| From | To | Trigger | First milestone |
|---|---|---|---|
| — | `lead` | spawn in district | 0.3 |
| `lead` | `verified` | photog confirms at darkroom | 0.4 |
| `verified` | `plated` | editor plates for the edition | 0.5 |
| `plated` | `printed` | edition fires | 0.5 |

Transitions are one-way. A story cannot move backward (a verified story doesn't
become a lead again — it becomes a *killed* story, which is a separate archive
state out of scope for the vertical slice).

## Notes

- `truthful: boolean` is the Observer rival's anchor. A non-truthful story that
  prints raises Observer attention; the slice tracks the field but doesn't use
  it until milestone 0.7+.
- `cash_yield` / `heat_yield` are computed at `plated` (from tier + flavor +
  district) and **frozen** there — the edition-debrief reads them, not
  re-derives.
- `tier === 'arc'` stories cross-link to an arc record (out of scope until §18
  authoring begins).

## Open questions

- Should `Story` carry a `version` field for save-schema migration? Defer to
  ICD-04 (PRE-0.8).

## Deviation policy

If milestone 0.3/0.4/0.5 needs to change the shape or transitions, update this
ICD **in the same PR**.
