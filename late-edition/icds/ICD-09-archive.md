# ICD-09 · Archive / Inter-Edition Story State

**Status:** v0.1 (PRE-1.0 — initial draft)
**Band:** strong
**First caller:** milestone 1.0 (Tier-1 opener — Archive UI ships alongside Herald + Observer + Switchboard)
**Source:** [`../design/design-doc.html`](../design/design-doc.html) §06 line 888 ·
[`../design/design-doc.html`](../design/design-doc.html) §15 line 1234 (save spec)

## Purpose

*"Stories live in your archive until you commit them to the next
edition. Some die if left too long (the news goes cold)."* —
design-doc.html §06 line 888. The archive is the player's *intentional*
inter-edition holding pen for verified stories — distinct from the
existing *defensive* ink-gate retry rule (ICD-05 §Notes — rejected
stories stay `verified` because they can't print, not because the
player chose). ICD-09 lifts the ICD-05 v0.4.1 §Purpose archive
deferral and adds the fifth `Story.state` value.

## Shape

A widening of ICD-05's `Story` state machine. The in-memory `Story`
interface gains one value in the `state` union:

```ts
// In ICD-05 v0.4.1 the state union has four values; ICD-09 widens to five.
// Field set unchanged — held_by_building remains the resting-state pointer
// for archived stories (always = Darkroom id at v0.1; see §Notes).
interface Story {
  // ...unchanged ICD-05 fields...
  state: 'lead' | 'verified' | 'plated' | 'printed' | 'archived';  // v0.1 widening
  archived_at_ms?: number;   // v0.1 — set on verified → archived; null in older saves (decay anchor)
}
```

ICD-05's `Story` interface picks up the new value via the union
widening; ICD-05's transition table picks up two new rows below.
**Field set unchanged** beyond the optional `archived_at_ms` decay
anchor — the existing `held_by_building` pointer continues to point
at the Darkroom while the story sits in archive (the same physical
resting-state slot the `verified` state uses today). No new top-level
World field; no new building kind.

## State transitions

Two new rows extending ICD-05's transition table:

| From | To | Trigger | First milestone |
|---|---|---|---|
| `verified` | `archived` | player explicit "hold for later" gesture on a verified story sitting at Darkroom | 1.0 |
| `archived` | `verified` | player explicit "release" gesture (story re-enters plating queue next edition) | 1.0 |

The transitions out of `verified → archived` and back are **player-
initiated only** — no rival action moves a story into or out of
archive. The transitions sit alongside ICD-05's existing rows; the
one-way rule of ICD-05 §State transitions is preserved at the
state-machine level (an archived story does not become a lead again
— it goes back to `verified`, the immediately-preceding state, and
re-enters the plating queue). The two new rows are the **only**
non-monotonic edges in the Story state machine; they are explicitly
authorized by ICD-09 because the design HTML §06 commitment requires
inter-edition holding to be a player choice, not a sim consequence.

### Effects on adjacent contracts

- **Editor (ICD-05 v0.4 §Notes ink plate-time gate)** — the plating
  walk at `DEADLINE_FIRE` **skips archived stories**. The ink-budget
  walk now reads `world.stories.filter(s => s.state === 'verified')`
  rather than the previous "all not-yet-plated" set. Archived stories
  do not consume ink at the deadline; the player must explicitly
  release them back to `verified` first.
- **Decay (ICD-09 v0.1 medium-band number).** Archived stories age
  but do not auto-expire at the 180 s lead-spawner decay rule
  (ICD-04 v0.1.1 `lead_spawner` block). They expire instead on
  edition count: an archived story is **culled at the
  `EDITION_DEBRIEF_END` after `10 editions in archive`** (the design
  HTML §06 *"the news goes cold"* mechanism). 10 is a medium-band
  number — playtest moves it. Culling sets `state = 'printed'` with
  `cash_yield = 0` and `heat_yield = 0` (the story becomes inert,
  flowing through the same terminal state the printed rule uses;
  alternative was a sixth `state: 'expired'` value, rejected for
  scope at v0.1). The medium-band decay number lives in code as a
  named constant, not in the save blob.
- **Archive cap (ICD-09 v0.1 medium-band number).** At most **5
  stories may be in `state: 'archived'` simultaneously**. The cap is
  enforced at the `verified → archived` transition: if the cap is
  already met, the transition is **rejected** (the gesture surfaces
  a "Archive full" message; the story stays `verified`). 5 is a
  medium-band number — the dossier's "Story queue" region in
  [`../js/hud.js`](../js/hud.js) shows the count as `archived: N/5`
  where N is the current cap usage. Playtest moves the cap.

## Save surface

Existing `SaveBlobV1.stories[]` array round-trips the new state value.
**Value-level widening only** — the `StorySnap.state` enum widens to
include `'archived'`, and an optional `archived_at_ms?: number` field
joins the per-record save schema as a sibling of the existing
`spawned_at_ms`. ICD-04 widening:

- v0.1.1 → **v0.1.2 in-PR at milestone 1.0** per Constraint #4
  (matches the 0.10.0 `'branch_bureau'` precedent in ICD-04 §Per-record
  §Building). The widening is enum-only on `state` plus one optional
  numeric field; existing saves without the field round-trip safely
  (the load path treats `archived_at_ms === undefined` as "this Story
  was saved before ICD-09 shipped — initialize decay anchor to the
  load time"). No blob-version bump; no migration function.
- The 10-editions decay counter is derived from `archived_at_ms` and
  the current `World.cycle.edition`; storing the editions-elapsed
  number directly would duplicate `(cycle.edition - storyEditionAtArchive)`
  arithmetic. The `archived_at_ms` plus the edition-snap suffices —
  the decay check at `EDITION_DEBRIEF_END` walks the archive,
  computes `editionsInArchive = currentEdition - editionAtArchive`,
  and culls on `≥ 10`. The exact `editionAtArchive` is recovered as
  *"the edition that contained `archived_at_ms`"* — a one-step
  lookup against `CycleClock.editionFromMs()` (ICD-06).

## HUD surface

The dossier's "Story queue" region (ICD-01 v0.5 §HudState · `hud.resources.stories`)
grows an `archived` count alongside the existing `verified` count.
**Single-line addition** — no new dossier region per the re-eval
§3 verdict:

```
STORY QUEUE
  verified: 3
  archived: 2/5         ← v0.1 addition
```

The number's `/N` denominator surfaces the medium-band archive cap so
the player has visible feedback when the cap fills. No new HUD
mock-up region; the existing dossier panel from milestone 0.9 absorbs
the line.

The **player gesture** for `verified → archived` and `archived →
verified` lives at the dossier level — clicking an entry in the
"Story queue" region toggles its state between `verified` and
`archived`. Exact gesture (left-click? long-press? a dedicated
"hold" button per row?) is a 1.0 code-session call (see §Open
questions). v0.1 commits the contract: a single player gesture
flips the state; the projection-side count updates next frame.

## Notes

- **Distinction from defensive archive (ink-gate retry).** ICD-05
  v0.4 §Notes ink plate-time gate keeps a verified story at the
  Darkroom *because* the ink budget can't fit it that edition — a
  sim-side decision, no player choice. ICD-09 archive is the
  *opposite* mechanic — the player explicitly holds a verified
  story across editions even when ink is available. The two
  mechanics co-exist: the ink-gate may reject a story that the
  player *meant* to print (it stays `verified`), and on the next
  edition the player may choose to archive it instead (transitioning
  it to `archived`). Both states live at the Darkroom (`held_by_building`
  unchanged).
- **No archive-only building.** Despite design-doc.html §11 listing
  "Archive" under Tier III tech (line 1124), milestone 1.0 ships
  archive as a Darkroom-co-located feature — no separate building.
  A future Tier-III "Archive" building may unlock a larger cap or
  slower decay (post-Tier-1 scope); v0.1 does not depend on it.
- **`truthful: boolean` interaction.** Archived stories retain their
  `truthful` value. An archived lie released back to verified still
  triggers the Observer INVESTIGATE state machine's lie-detection
  pass (ICD-02 v0.3 §Observer state machine — Observer fixates on
  the worst recent player lie). Archiving does **not** wash the lie
  flag — it just holds the story.
- **Inter-edition heat decay interaction.** Archived stories do not
  contribute heat (they are not printed). Heat decay at the
  edition boundary (`-8 baseline` per ICD-06 v0.2 §EditionSummary)
  is unaffected by archive content.
- **Cap behavior at save/load.** Round-tripping a save with 5
  archived stories preserves them all; the cap-check rule fires
  only on the `verified → archived` transition, not at load. A
  load that puts the world above the cap is impossible by
  construction (saves can only be written from cap-compliant
  states).

## Open questions

- **Player gesture for hold/release.** Left-click? Long-press? A
  dedicated `[H]` hotkey paired with hover-target on the dossier
  row? Code-session call at milestone 1.0 — the projection-side
  contract (state transition + cap rule) is set here; the input
  mapping is renderer/input layer.
- **Cap as soft or hard.** v0.1 commits hard cap (transition
  rejected). A future tech-tree branch may relax it (Tier-III
  "Archive" building lifts cap to 10; Tier-IV "Wire syndication"
  lifts decay to 20 editions). v0.1's contract permits these
  extensions; no need to over-specify here.
- **Darkroom destruction interaction.** If a Darkroom holding
  archived stories is destroyed (Press HP rules at ICD-02 § goon
  damage), what happens to the archived stories? Three options:
  (a) auto-release to `verified` (they migrate to the main Bureau
  if one exists; deleted otherwise), (b) cull as `printed` with
  zero yield (treat as the cold-news rule firing early), (c)
  destroy them entirely. v0.1 punts to the milestone-1.0 code
  session — once the Darkroom destruction code lives in
  [`../js/sim/world-state.js`](../js/sim/world-state.js), the
  cleanup rule is one of the three above.
- **Front-page archive UI vs. dossier panel.** v0.1 commits a
  dossier-row count + click-gesture model. design-doc.html §11
  Tier III "Archive" implies a separate front-page UI may land
  later. No conflict — Tier-III UI replaces the dossier surface
  if it ships.

## Deviation policy

Adding a sixth `Story.state` value (e.g. `'expired'` instead of
folding cold-news culling onto `'printed'` with zero yield),
changing the cap from hard to soft, or adding a fourth transition
out of `archived` (e.g. `archived → expired`) is an architecture
session, not a deviation. Tuning the cap number (`5` → some other
small integer) or the decay-editions number (`10` → some other) is
a playtest balance change handled in-code with a `// medium-band`
comment; ICD update not required unless the new shape ships in a
save (it doesn't — both are derived constants).

## Revision history

- **v0.1** (PRE-1.0, 2026-05-22) — Initial draft. Authored ahead of
  milestone 1.0 (Tier-1 opener) to lift the ICD-05 v0.4.1 §Purpose
  archive deferral (*"a separate archive state out of scope for the
  vertical slice"*). The new `'archived'` value joins ICD-05's
  `Story.state` union as the fifth value; two new transition rows
  (`verified ↔ archived`) extend ICD-05's transition table. New
  optional `archived_at_ms` field per record (decay anchor). HUD
  surface is a single dossier-row count addition (no new region).
  Save surface is value-level widening on `SaveBlobV1.stories[]`
  (ICD-04 v0.1.1 → v0.1.2 in-PR at 1.0 per Constraint #4). Two
  medium-band numbers committed: **archive cap = 5**, **archive
  decay = 10 editions**. Investigation chain dependency from
  ICD-10 §Investigation 3-step chain shape — `Story.parent_story_id`
  links across editions, which requires inter-edition story state;
  this ICD's archive is the persistence surface that mechanic
  hangs off of (design-doc.html §18 line 1370 — *"verifying one
  lead spawns a follow-up lead, which spawns a third. 3-step
  chains."*). Four §Open questions parked (gesture · cap policy ·
  Darkroom destruction · Tier-III UI). Source anchor:
  design-doc.html §06 line 888 (*"Stories live in your archive
  until you commit them to the next edition"*).
