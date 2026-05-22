# ICD-05 · Story Lifecycle Object

**Status:** v0.4.3 (milestone 1.1.0 — §Notes cross-reference addition only; ICD-10 v0.1.1 adds three optional Story fields on the persistence boundary — `parent_story_id?: StoryId` (Investigation 3-step chain), `arc_episode_id?: ArcEpisodeId` (arc-tier stories), `arc_branch_label?: string` (pickArcBranch intent); in-memory Story shape unchanged from v0.4)
**Prior:** v0.4.2 (milestone 1.0.1 — §Notes cross-reference addition only; ICD-09 v0.1 widens the `Story.state` union to five values (`'archived'`) and adds two new transition rows (`verified ↔ archived`); ink-budget walk pins to `state === 'verified'` so archived stories naturally skip plating)
**Prior:** v0.4.1 (PRE-0.8 §Open-Q-1 closure — `Story.version` deferred-to-ICD-04 resolved; per-record version captured by ICD-04 v0.1 `StorySnap.version`)
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

Transitions out of a state are one-way **except** the `verified ↔ archived`
pair authored at [`ICD-09 v0.1`](ICD-09-archive.md) §State transitions —
the only non-monotonic edges in the Story state machine. ICD-09 owns the
fifth `Story.state` value (`'archived'`) and the two new transition rows;
the rule is preserved at the state-machine level because an archived story
goes back to `verified` (the immediately-preceding state), not to `lead`.
The `lead → lead` self-transition above changes the carrier pointers, not
the state — the state didn't move, the one-way rule still holds for that
case.

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
- **Arc + chain foreign keys (v0.4.3 / 1.1.0 — ICD-10 v0.1.1).** Three new
  optional Story fields land on the persistence boundary (ICD-04 v0.1.4):
  `parent_story_id?: StoryId` (Investigation 3-step chain pointer — set by
  the sim-side spawn hook in `_handlePhotogArrival` on `lead → verified`
  for `tier === 'investigation'` stories), `arc_episode_id?: ArcEpisodeId`
  (set on arc-tier stories at spawn — minted by the arc dispatcher in
  `_runSpawnerTick` and re-minted at the next-episode spawn inside
  `_applyArcPlate`), `arc_branch_label?: string` (player's pickArcBranch
  intent — recorded at click; the verified-→-plated gate filters out
  arc stories without it). All three fields are sim-side spawner/UI
  minted, NOT state-machine-driven — the §State transitions table above
  is unchanged. The in-memory Story interface §Shape stays byte-for-byte
  identical to v0.4; the new fields exist on real Story records only
  when the spawner / pickArcBranch / chain hook sets them.
- **Archive interactions (v0.4.2 / 1.0.1 — ICD-09 v0.1).** The fifth
  `Story.state` value `'archived'` is owned by [`ICD-09`](ICD-09-archive.md);
  the two new transition rows (`verified → archived` on player hold gesture,
  `archived → verified` on player release gesture) extend the table above.
  Two adjacent-contract effects sit at the ICD-05 boundary: (1) the
  **ink-budget walk at `DEADLINE_FIRE`** pins `state === 'verified'` and
  thereby skips archived stories — the player must explicitly release
  archive → verified for an archived story to re-enter the plating queue;
  (2) the **cold-news decay** at `EDITION_DEBRIEF_END` culls archived
  stories with `editionsInArchive ≥ 10` to `state = 'printed'` with
  `cash_yield = 0` and `heat_yield = 0` (flows through the same terminal
  state the print rule uses — a sixth `'expired'` value was rejected at
  ICD-09 v0.1 for scope). Both are sim-side rules; the in-memory `Story`
  interface §Shape above is unchanged at v0.4.2 — the new `'archived'`
  value is added to the persisted union in `StorySnap.state`
  ([`ICD-04 v0.1.3`](ICD-04-save-schema.md)) and read on the live Story
  via the same `state` field.

## Open questions

- ~~Should `Story` carry a `version` field for save-schema migration? Defer to
  ICD-04 (PRE-0.8).~~ **Resolved at v0.4.1 (PRE-0.8).** ICD-04 v0.1
  ([`ICD-04-save-schema.md`](ICD-04-save-schema.md) §Core shape — `StorySnap`
  + §Notes "Story `version` field") settles this: every Story carries a
  per-record `version` field, starting at `1` in v0.1. The field migrates
  **independently** of the blob-level `version` so future Story shape changes
  bump `Story.version` and add a localized `migrate_story_N_to_N+1` pure
  function without cascading the whole save through a blob-version bump.
  The in-memory Story interface (§Shape above) stays at its v0.4 fields
  for the 0.7.1 surface — the `version` field is added to the persisted
  shape only and lives at the save-write boundary, not on the live Story
  in code. The 0.8 code session is where the live-vs-persisted split lands
  (likely a tiny `serializeStory` projector). No in-memory shape change at
  PRE-0.8; this is a §Notes / §Open-questions paragraph only.

## Deviation policy

If milestone 0.4/0.5 needs to change the shape or transitions, update this
ICD **in the same PR**.

## Revision history

- **v0.4.3** (milestone 1.1.0, 2026-05-22) — §Notes-only amendment; no
  in-memory shape change. Adds the "Arc + chain foreign keys" paragraph
  cross-referencing ICD-10 v0.1.1. Three new optional Story fields
  (`parent_story_id?`, `arc_episode_id?`, `arc_branch_label?`) land on
  the persistence boundary via ICD-04 v0.1.4; the live Story interface
  is untouched at v0.4. State transitions table is unchanged — the new
  fields are spawner / chain-hook / UI minted, not state-machine driven.

- **v0.4.2** (milestone 1.0.1, 2026-05-22) — §Notes-only amendment; no
  in-memory shape change. ICD-09 v0.1 widens the persisted
  `StorySnap.state` union with `'archived'` (the fifth value) and adds
  two new transition rows (`verified ↔ archived`); ICD-05's transition
  table here gains a one-paragraph cross-reference to ICD-09 instead of
  inlining the rows, since ICD-09 owns them. §Notes gains a single
  paragraph documenting the two ICD-05-boundary effects: the ink-budget
  walk's state-value filter (archived stories naturally skip plating)
  and the cold-news decay rule (culls to `'printed'` with zero yields
  at `editions_in_archive ≥ 10`). The in-memory `Story` interface in
  §Shape stays byte-for-byte v0.4 — adding `'archived'` to the live
  union there would duplicate ICD-09's authority; readers should treat
  ICD-09 as the source of truth for the value and read the §Notes
  cross-reference here.

- **v0.4.1** (PRE-0.8, 2026-05-21) — §Open-questions closure only; no
  shape change. The "should `Story` carry a `version` field" question
  deferred to ICD-04 at v0.1 (Phase 0 bootstrap) is now resolved:
  ICD-04 v0.1's `StorySnap.version` carries the per-record version at
  the persistence boundary, starting at `1`. The in-memory `Story`
  interface above is **byte-for-byte identical** to v0.4 — the version
  field lives in the save schema only, not on the live Story object.
  The 0.8 code session adds the tiny serialize/deserialize projector
  that bridges the two. See
  [`ICD-04-save-schema.md`](ICD-04-save-schema.md) §Core shape (`StorySnap`)
  and §Notes (Story `version` field) for the resolution detail.
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
