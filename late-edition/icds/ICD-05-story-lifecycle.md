# ICD-05 · Story Lifecycle Object

**Status:** v0.4 (PRE-0.7 §Notes amendment — `AUTO_PLATE_SENTINEL` substitution path + ink plate-time hard gate)
**Band:** strong
**First caller:** milestone 0.3 (lead spawn · pickup · return-to-bureau) — shipped in v0.3.0; row 3 (`lead → verified`) lit by milestone 0.4 (Photog · Darkroom) — shipped in v0.4.0; rows 4 + 5 (`verified → plated → printed`) auto-fired by milestone 0.5 via the pre-Editor `AUTO_PLATE_SENTINEL` path — shipped in v0.5.0
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
- **Pre-Editor `AUTO_PLATE_SENTINEL` substitution path (PRE-0.7).** Before
  the Editor unit ships at milestone 0.7, the `verified → plated → printed`
  transition auto-fires same-frame at `DEADLINE_FIRE` (ICD-06 §Event
  vocabulary) with `plated_by = AUTO_PLATE_SENTINEL`. The sentinel is a
  non-null marker exported by the sim so future code and tests can assert
  *"this story passed through the plating step"* without ambiguity against
  `plated_by === null`. The Editor's first milestone substitutes its
  `UnitId` in the same slot; the field type stays `EditorId` and the
  transition table rows 4 + 5 stay one-way. No shape change at PRE-0.7 —
  this paragraph captures a decision that previously lived only in code
  comments (post-0.6 re-eval §1 Decision-in-comments #2).
- **Ink plate-time hard gate (PRE-0.7).** Plating decrements
  `World.resources.ink` by `Story.ink_cost` (the value frozen at the
  plated step per the `cash_yield` / `heat_yield` rule above). A `verified
  → plated` transition that would leave `World.resources.ink` negative is
  **rejected**; the Story remains in `verified` state and waits for the
  next edition (where the player has had a chance to restock ink). The
  Editor's arrival logic enforces this at 0.7 when the Editor lands; the
  pre-Editor `AUTO_PLATE_SENTINEL` path inherits the same rule when it
  fires at `DEADLINE_FIRE`. This is the load-bearing rule for the
  *"can't print if ink runs out"* commitment the v0.6.0 changelog
  flagged as medium-band and the post-0.6 re-eval pinned to plate-time
  (verdict (a), re-eval §3.5 Q6). The negative-ink display in `HudState`
  (ICD-01 v0.5 §HudState) remains permitted until 0.7 ships the gate;
  after 0.7, ink cannot go negative through plating, but ink-purchase
  failures or rival actions at Tier-1+ may revisit the question.

## Open questions

- Should `Story` carry a `version` field for save-schema migration? Defer to
  ICD-04 (PRE-0.8).

## Deviation policy

If milestone 0.4/0.5 needs to change the shape or transitions, update this
ICD **in the same PR**.

## Revision history

- **v0.4** (PRE-0.7, 2026-05-21) — §Notes-only amendment. Two paragraphs
  added: (1) pre-Editor `AUTO_PLATE_SENTINEL` substitution path — captures
  the same-frame `verified → plated → printed` auto-fire at
  `DEADLINE_FIRE`, names the sentinel as the marker the Editor swaps for
  its `UnitId` at milestone 0.7, keeps the field type at `EditorId` and
  rows 4 + 5 of the transition table one-way; (2) ink plate-time hard
  gate — pins the v0.6.0 changelog's *"can't print if ink runs out"*
  enforcement rule to **plate-time rejection** (verdict (a) of the
  post-0.6 re-eval §3.5 Q6), with the Editor's arrival logic the
  enforcement site at 0.7 and the `AUTO_PLATE_SENTINEL` path inheriting
  the same rule until then. **Shape unchanged** — `Story` interface,
  transition table, and field-delta paragraph all byte-for-byte
  identical to v0.3. See
  [`../architecture/re-eval-after-0.6.md`](../architecture/re-eval-after-0.6.md)
  §1 Decision-in-comments #2 + §3.5 Q6.
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
