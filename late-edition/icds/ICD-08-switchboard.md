# ICD-08 · Switchboard Line-of-Sight

**Status:** v0.1 (PRE-1.0 — initial draft)
**Band:** strong
**First caller:** milestone 1.0 (Tier-1 opener — Switchboard building lights alongside Herald + Observer)
**Source:** [`../design/design-doc.html`](../design/design-doc.html) §10 line 1088 ·
[`../design/rival-ai-spec.html`](../design/rival-ai-spec.html) §04 RAID state

## Purpose

*"Information about the threat is itself a defense resource."* —
design-doc.html §10 line 1088. The Switchboard is the Tier-II
intel-defense building that gates visibility of incoming goon raids.
Without a Switchboard with line-of-sight to a goon's tile, the first
the player knows of a raid is a window breaking (the goon entering
the Bureau's 1-tile radius). This ICD pins the visibility projection
rule, the LoS geometry, and the save-surface widening.

## Shape

```ts
// BuildingKind widening (lands on ICD-01 v0.6.4 at milestone 1.0 in-PR per Constraint #4):
type BuildingKind = 'bureau' | 'branch_bureau' | 'darkroom' | 'switchboard';

// No new top-level WorldFrame field. The visibility projection rule
// extends the existing UnitView / RivalIntentView filters at the
// World.snapshot() boundary — see §Visibility projection rule below.

// RivalIntentView (defined in ICD-01 v0.6 §RivalStatusView surface)
// carries an optional eta_ms; the projection rule decides when it's
// undefined.
interface RivalIntentView {
  kind:    'RAID_BUREAU' | 'RAID_BRANCH';
  goons:   number;
  eta_ms?: number;        // undefined when not LoS-visible (see §Visibility projection rule)
}
```

## Visibility projection rule

The load-bearing contract. `World.snapshot()` projects rival intent
and goon-unit visibility at the boundary between sim and renderer.

**Rule:** for each tile a goon (or rival-spawned unit) occupies at
snapshot time, the projector checks whether **at least one
`'switchboard'` building's LoS rect contains that tile**.

- **If yes:** the goon's `UnitView` (`pos`, `kind: 'goon'`, etc.)
  appears in `WorldFrame.units`, and any associated
  `RivalIntentView.eta_ms` (e.g. on an active `RAID_BUREAU` intent)
  surfaces as a numeric value.
- **If no:** the goon's `UnitView` is **omitted** from
  `WorldFrame.units` entirely, and `RivalIntentView.eta_ms` is
  `undefined` (the rival's `RAID_BUREAU` intent may still surface
  on `WorldFrame.rivals` as a `scheming` posture, but the precise ETA
  + spawn position do not).

**Defensive default** — when **no** Switchboard exists in the world,
the goon's `UnitView` and the `eta_ms` field both remain hidden until
the goon enters a **1-tile radius around any Bureau-family building**
(main Bureau or Branch Bureau). That radius is the *"window breaking"*
beat — the goon becomes visible because it has physically arrived,
not because the player has intel. At that point the snapshot pass
includes the `UnitView` and the `eta_ms` becomes the literal remaining
walk distance.

The rule is **renderer-side as well as HUD-side** — a goon outside LoS
is not drawn in the 3D world, not just hidden from the HUD ticker.
The fog-on-deadline visual (ICD-01 v0.6.2 §Notes rain/fog ramp) helps
sell the no-LoS posture: in fog, things you don't see aren't there
yet.

**Save-cycle interaction.** A `World.snapshot()` taken at save time
captures only the visibility-filtered `WorldFrame.units`; the
underlying `Unit` records (goons included) live unfiltered in
`SaveBlobV1.units[]` (ICD-04 v0.1.1). Load + snapshot at the new
session re-evaluates LoS against the loaded Switchboard set — a player
who saves mid-raid with LoS, then loads after destroying their
Switchboard, will not see the goon on the next snapshot until the
window-breaking radius is breached. The Unit's sim-side state
(position, path, HP) round-trips faithfully; the visibility filter is
a pure projection at snapshot time.

## LoS rect shape

**Rectangular projection, axis-aligned, centered on the Switchboard
tile.** Picked over circular / line-traced LoS because: (a) the grid
is axis-aligned (no rotation in the camera model — ICD-01 §Implementation
notes (0.2) `TILE = 6` and orthographic isometric), (b) rectangular
intersection tests are O(1), (c) the design-doc §10 framing — *"on
the map"* — implies a regional reveal, not a per-pixel sightline.

**Radius (medium-band starting value):** ±6 tiles in each cardinal
direction — a 13×13 tile rect centered on the Switchboard. Calibration
rationale:

- The grid is 24×24 tiles wide (ICD-01 §View struct field sets · world
  size implicit from [`../js/sim/world-state.js`](../js/sim/world-state.js)
  initial tile bounds).
- A 13×13 rect covers ~29% of the grid area — one Switchboard reveals
  about a third of the city.
- Two Switchboards positioned at opposite corners cover most of the
  grid with a contested middle strip (intentional — the player should
  not be able to fully blanket coverage from a single Switchboard
  purchase).
- Number lives medium-band per the post-Tier-0 → Tier-1 re-eval band
  policy; playtest moves it. Final value before Tier-1 close is
  expected to land between ±5 and ±8.

**LoS shape geometry (committed):**

```
For Switchboard at tile (sx, sy):
  visible_tiles = { (x, y) : sx - 6 ≤ x ≤ sx + 6, sy - 6 ≤ y ≤ sy + 6 }
```

No obstacles, no line-tracing, no occlusion — the rect ignores
buildings between the Switchboard and the target tile. This is a
deliberate simplification at v0.1; the design HTML's §10 wording is
silent on occlusion, and adding occlusion to the medium-band number is
premature complexity.

## Save surface

Switchboard buildings round-trip via the existing `SaveBlobV1.buildings[]`
array (ICD-04 v0.1.1 §Per-record §Building). **Value-level widening
only** — `BuildingKind` widens to include `'switchboard'` at milestone
1.0 in-PR per Constraint #4 (matching the 0.10.0 precedent for
`'branch_bureau'`); no new save field is required.

The LoS rect itself is **not persisted** — it's derived per-snapshot
from the Switchboard's `pos` tile + the radius constant in code. A
future radius tuning at playtest moves a constant, not a save migration.

## Notes

- **Switchboard does not reveal Herald / Observer intents.** v0.3 of
  this ICD's sibling (ICD-02) commits Herald + Observer state machines
  that do **not** emit physical goons — Herald's PUNISH state scoops
  via `FILE_STORY`; Observer's PUBLISH state emits `PUBLISH_COUNTER`.
  Neither has a `RAID_*` intent, so the Switchboard's filter rule is
  silent on them — Herald + Observer posture surfaces via
  `WorldFrame.rivals: RivalStatusView[]` regardless of Switchboard
  presence (the player always sees rival posture, just not goon
  positions). This matches the design HTML §10 framing — *"Goons
  appear from district edges"* — the rule is goon-scoped, not
  rival-scoped.
- **Multiple Switchboards.** The visibility projection rule reads
  "**at least one**" Switchboard's LoS rect — multiple Switchboards
  union their reveals. There is **no count cap committed at v0.1**;
  see §Open questions.
- **Destruction.** A destroyed Switchboard immediately loses its LoS
  rect — on the next snapshot frame, any goon previously visible only
  through that Switchboard becomes hidden. The renderer's per-frame
  consume rule means the goon's mesh persists for that frame's interp
  window then disappears; the design beat is *"the line went dead."*
  Press HP rules treat Switchboard destruction as silent (only main
  Bureau drives `CYCLE_GAME_OVER` per overview §Strong band single-
  fail-state line).
- **Wiring at milestone 1.0.** The snapshot-pass extension lives in
  [`../js/sim/world-state.js`](../js/sim/world-state.js)'s
  `snapshot()` boundary — the existing `UnitView` projection already
  filters by sim-internal state (`Unit.kind === 'editor'` is dispatch-
  rejected per ICD-03; same site adds the LoS filter for `'goon'`-kind
  units). Pure data computation — no pathfinding cost; one
  `Array.some()` over the Switchboard set per goon.

## Open questions

- **Switchboard count cap (medium-band).** v0.1 commits no cap;
  ground-truth is the building-purchase economy at Tier-1.x. Playtest
  may want a hard cap (e.g. 2 max — coverage forces a placement
  decision) or soft cap (diminishing-returns LoS bonus per
  additional Switchboard).
- **LoS occlusion.** Currently the rect ignores buildings between the
  Switchboard and the target. If playtest finds this too generous,
  add a line-trace pass against the building grid. Code shape stays
  the same; just the predicate inside the projection rule changes.
- **Rotational variants.** The rect is axis-aligned. If a later tech-
  tree branch wants directional LoS (e.g. a Tier-IV "wire syndication"
  upgrade that points a 1×20 rect along an edge), the rect shape
  extends — the projection rule's contract stays the same.
- **Goon retroactive visibility on Switchboard placement.** If a
  player builds a Switchboard mid-raid such that an already-pathing
  goon enters its LoS rect on the next snapshot, the goon appears
  immediately. This is the intended behavior (information *is* the
  defense, even retroactively); no special-case rule.

## Deviation policy

Changing the LoS rect shape from axis-aligned rectangular to anything
else (circular, line-traced, occlusion-aware) is an architecture
session, not a deviation. Tuning the rect radius constant (±6 →
some other small integer) is a playtest balance change handled
in-code with a `// medium-band` comment; ICD update not required
unless the radius ships in a save (it doesn't — see §Save surface).
Adding a new `BuildingKind` literal or a new `RivalIntentView` field
follows ICD-01 / ICD-02 deviation policies respectively (those
contracts own those types).

## Revision history

- **v0.1** (PRE-1.0, 2026-05-22) — Initial draft. Authored ahead of
  milestone 1.0 (Tier-1 opener). Switchboard `BuildingKind` widening
  pinned (lands on ICD-01 in-PR at 1.0 per Constraint #4 precedent
  from 0.10.0's `'branch_bureau'` widening). Visibility projection
  rule pinned as snapshot-time filter on `UnitView` + `RivalIntentView.eta_ms`,
  with the "no Switchboard → reveal at 1-tile Bureau radius" defensive
  default lifting the design HTML §10 *"window breaking"* beat.
  Rectangular axis-aligned LoS with ±6-tile radius committed as
  medium-band. Save surface stays at value-level widening
  (`SaveBlobV1.buildings[]` already round-trips Building records;
  ICD-04 v0.1.1 not bumped at PRE-1.0). Four §Open questions parked
  (count cap · occlusion · rotational variants · retroactive
  visibility). Source anchor: design-doc.html §10 line 1088
  (*"Information about the threat is itself a defense resource"*).
