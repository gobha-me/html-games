# ICD-01 · World ↔ Renderer

**Status:** v0.6.1 (shipped against milestone 0.10.0 — `BuildingKind` vocabulary widens to include `'branch_bureau'`; no shape change)
**Band:** strong
**First caller:** milestone 0.1 (scene, camera, toon pipeline) — shipped in v0.1.0
**Current caller:** milestone 0.9 (HUD corkboard) — shipped in v0.9.0 against v0.5 with no ICD bump; HUD corkboard band promoted medium → strong post-0.9 (overview line 45). PRE-0.10 (v0.9.4) authors the v0.6 additions ahead of milestone 0.10 (Tier-0 closer): `UnitView.stats` for the §13 Selected dossier, `LeadView.district` for the Story queue, `WorldFrame.rivals` for the Threats dossier, `FxEvent` union for the rain-ramp + effects-channel feedback path (producers wire at milestone 0.10.x / PR-D).
**Source:** [`../design/phase-0-roadmap.html`](../design/phase-0-roadmap.html) §03

## Purpose

What the simulation hands the renderer each frame. Keeps simulation pure; keeps
renderer dumb. The renderer never reaches back into world state.

## Per-frame contract

```ts
// Per frame
interface WorldFrame {
  cameraTarget: Vec3;
  buildings: BuildingView[];
  units:     UnitView[];
  leads:     LeadView[];
  rivals:    RivalStatusView[]; // posture surface for Threats dossier (v0.6; type owned by ICD-02 v0.2)
  rain:      RainConfig;        // intensity 0-1
  fog:       { near: number, far: number, color: number };
  hud:       HudState;          // edition, deadline_ms, resources
  effects:   FxEvent[];         // drained queue: flash · print · death · pickup · verify · raid_warning (v0.6)
}
```

## View struct field sets (v0.2)

The three View arrays on `WorldFrame` carry **render-only projections** of
simulation objects. Sim owns the authoritative state (Buildings, Units, Stories);
the renderer sees only what it needs to draw a frame. Every field below traces
back to a strong-band commitment or an ICD whose first caller is within the
N=3 horizon.

### BuildingView

Drives milestone 0.2 (Bureau anchor on the grid) and forward-compatible with
Darkroom at 0.4 and the remaining strong-band buildings (§07 of the design doc).

```ts
interface BuildingView {
  id:     BuildingId;          // stable; pairs with ICD-03 recomputeOn invalidation set
  pos:    Vec3;                // world-space origin (footprint anchor)
  kind:   BuildingKind;        // 'bureau' at 0.2; 'darkroom' at 0.4; 'branch_bureau' at 0.10.0 (G-01); full catalogue medium-band
  hp:     number;              // current HP
  hp_max: number;              // for HUD damage bar (0.7+); 90 for press, per overview
  tier:   1 | 2 | 3;           // §07; default 1 in vertical slice
}
```

- `id` is required by ICD-03: the pathfinder publishes a `recomputeOn:
  BuildingId[]` invalidation set on every `PathResponse`, and callers holding
  cached paths must be able to match by id.
- `hp` / `hp_max` are load-bearing for the **single fail-state** strong-band
  commitment ([`../architecture/00-overview.md`](../architecture/00-overview.md)).
  The press @ 90 HP is the only terminal condition.
- `tier` stays in the v0.2 skeleton even though only Mk I ships in the
  vertical slice — keeps the contract open for the Tier-1 promotion path
  without re-cutting BuildingView later.

### UnitView

Drives milestone 0.2 (Reporter). The architecture overview is explicit that
"other units inherit this skeleton" (Photog at 0.4, Fixer / Goon at 0.7), so the
field set is sized for the full slice unit-cast, not just the Reporter.

```ts
interface UnitView {
  id:       UnitId;
  pos:      Vec3;                                       // world-space; ICD-03 path consumed sim-side
  facing:   number;                                     // radians around y-axis
  kind:     UnitKind;                                   // 'reporter' at 0.2; 'photog' | 'fixer' | 'goon' later
  state:    'idle' | 'walking' | 'carrying';            // visible behaviour states
  selected: boolean;                                    // 0.2 click-to-dispatch selection ring
  carrying: 'lead' | null;                              // visual folder over sprite
  stats:    { nerve: number, nose: number, legs: number } | undefined; // Reporter trio (v0.6; Design Doc §08 + §13)
}
```

- `pos` is the *current* world position. ICD-03 returns the full path as
  `cells: GridCell[]` and units consume it themselves (sim-side stepping); the
  renderer never sees the path queue.
- `facing` is a radian angle around the y-axis; the toon pipeline needs
  oriented sprites from milestone 0.2 forward.
- `state` is the rendered behaviour state, not the AI state. `'carrying'`
  exists because a reporter walking with a lead is visually distinct from a
  reporter walking empty-handed (see `carrying` below).
- `selected` is set by the input layer at click-to-dispatch (a strong-band
  commitment per the design doc §13 / §17 lock). The renderer draws a
  selection ring; the HUD is free to also read it.
- `carrying: 'lead' | null` resolves the **sim ↔ render edge** for 0.3 lead
  pickup: once a Reporter's path lands on a lead, the Story transitions
  past `'lead'` state (ICD-05) and the lead leaves `frame.leads` — the
  carry becomes visible via this field on the carrying UnitView.
- **Animation playhead — resolved at 0.2: renderer interpolates.** Sim
  runs at a fixed 30 Hz tick (33 ms). The renderer latches `pos` and
  `facing` from each tick's snapshot and lerps linearly from the prior
  tick to the current tick by `alpha = (now − lastTickTime) / tickDuration`,
  clamped `[0, 1]`. Discrete-position rendering was rejected: visible
  stepping at typical refresh rates does not serve the noir aesthetic —
  the toon look comes from cel shading and outlines, not motion judder.
- **`stats: {nerve, nose, legs} | undefined` (v0.6)** is the **Reporter
  trio** per Design Doc §08 (*"three substats: nerve (resists intimidation),
  nose (lead quality), legs (move speed)"*) and rendered in the §13 HUD
  mock under Selected · Reporter (*"M. Calloway / Nerve 6 · Nose 8 · Legs
  4"*). The field is `undefined` for every non-Reporter kind at Tier-0
  (Photog, Editor, Fixer, Goon) — their stat surfaces are deferred to
  their own follow-on slots when the §13 mock asks for them. Numbers
  themselves are medium-band per overview §"First-pass balancing numbers";
  the *projection shape* is locked at v0.6. The dossier reads this field
  directly via `pickSelected(frame).stats` (HUD §Selected pane); units
  with `stats === undefined` render the pane without the mono-numeral
  line.

### LeadView

Drives milestone 0.3 (first lead spawn). The field set is committed now so 0.3
opens cleanly without a second paper session.

```ts
interface LeadView {
  id:       StoryId;                                       // same id as Story (ICD-05) — flows end-to-end
  pos:      Vec3;                                          // district pickup point
  tier:     'whisper' | 'investigation' | 'arc';
  flavor:   'vice' | 'violence' | 'money' | 'labor';      // drives color tint per flavor
  age_ms:   number;                                        // sim-computed from spawned_at_ms
  district: DistrictId;                                    // sim-layer Story.district lifted into projection (v0.6)
}
```

- `id` is **the same id** as the corresponding `Story` (ICD-05 §Shape). This is
  the load-bearing "same id flows end-to-end" commitment: the lead a Reporter
  picks up is the same object that prints on the press.
- `tier` and `flavor` are carried from the Story object so the renderer can
  draw size / color cues without reaching into sim state.
- `age_ms` is **computed sim-side** from `Story.spawned_at_ms` and the sim
  clock. The renderer is renderer-dumb: it consumes a pre-baked elapsed
  duration, not a timestamp it has to subtract against the wall clock.
- `LeadView` only exists while `Story.state === 'lead'` **AND** the Story
  is neither picked up nor held by a building (`!picked_up_by &&
  !held_by_building`, per ICD-05 v0.2). Once `picked_up_by: ReporterId` is
  set on the Story (ICD-05), the lead leaves `frame.leads` and surfaces
  visually via the carrier's `UnitView.carrying` channel. Once
  `held_by_building` is set (drop-at-bureau at 0.3), the lead is dormant
  inside that building and stays out of `frame.leads` until the next
  carrier picks it up. **Stories in other states never appear in
  `frame.leads`.**
- `district: DistrictId` (v0.6) lifts the sim-layer `Story.district` field
  (live since milestone 0.3) into the projection so the §13 Story-queue
  dossier can render per-district headlines (*"Docks: Strike Threat ·
  Hillside: Mayor's Mistress · Diamond Row: Empty Vault"*) without the
  HUD reaching back into sim state. Couples to G-04 (districts-as-data,
  milestone 0.10) — the concrete `DistrictId` union enumerates at PR-C
  when district records become first-class; the projection edge is locked
  here. Whisper-tier histograms in the Dossier row read this field via
  the HUD's bucket helpers.

### HudState (v0.5)

Drives milestone 0.5 (deadline ticker) and milestone 0.6 (resource readouts).
The `hud` field on `WorldFrame` was reserved at v0.2 with no shape; PRE-0.5
locks it. The HUD is part of the renderer's draw surface — corkboard layout
per design doc §13 — and the data it needs flows through this projection like
every other View.

```ts
interface HudState {
  edition:     number;          // 1, 2, 3, ... — matches CYCLE_BEGIN.edition (ICD-06)
  deadline_ms: number;          // ms remaining until DEADLINE_FIRE for the active edition
  resources: {
    leads:   number;            // strong-band locked name (overview §Five resources)
    stories: number;            // plated, awaiting print
    ink:     number;            // remaining ink for the cycle
    cash:    number;            // running balance
    heat:    number;            // running rival/criminal pressure
  };
}
```

- `edition` and `deadline_ms` mirror ICD-06's clock so the HUD ticker can
  render the deadline countdown without subscribing to `CycleEvent` directly.
  Sim is the single owner of cycle time; HUD reads the projection.
- `resources` field names are the **strong-band locked names** from
  [`../architecture/00-overview.md`](../architecture/00-overview.md)
  §"Five resources" — Leads / Stories / Ink / Cash / Heat. The order of fields
  here follows the design-doc §06 debrief order (acquisition → plating →
  consumables → outputs → pressure). Numbers stay medium-band at 0.6; the
  shape is locked here.
- `HudState` is the home for speculative-but-near-horizon HUD data per the
  render-only projection rule (§Notes below). Fields with no committed
  near-horizon consumer don't belong here either — they belong nowhere until
  the consumer is scheduled.

### RivalStatusView surface (v0.6)

`WorldFrame.rivals: RivalStatusView[]` is the player-facing posture surface
for the §13 Threats dossier (the *"Evening Star raid · ETA 02:40 / 3 GOONS ·
FROM SW"* tile). The `RivalStatusView` **type itself is owned by
[ICD-02 v0.2](ICD-02-rival-world.md) §RivalStatusView** (`{rival, posture}`
with vocabulary `'calm' | 'scheming' | 'hostile'`); this ICD authors only
the projection surface — the top-level `rivals` array on `WorldFrame`.

- **Why a top-level key and not nested inside `hud`.** Resolves the
  post-0.6 re-eval §3.5 Q5 carryover (option B selected). Threading
  posture through `HudState` would re-export ICD-02 vocabulary through
  ICD-01's `hud` slot; a top-level `WorldFrame.rivals` array keeps the
  surface owned by the renderer's draw layer where the Threats dossier
  renders, mirroring how `buildings` / `units` / `leads` live as siblings
  to `hud`. The HUD reads `frame.rivals` directly, the same way it reads
  `frame.units` for the Selected pane and `frame.leads` for the Story
  queue.
- **Cadence.** One entry per active rival. At Tier-0 the array carries
  the Evening Star only; Herald + Observer join when their state machines
  enter the N-window (Tier-1 per overview line 42). The array is empty
  before any rival's first caller milestone, never `null`.
- **Per-entry shape evolution.** The §13 mock surfaces detail beyond
  `{rival, posture}` (*"ETA 02:40 · 3 GOONS · FROM SW"*). Extending
  `RivalStatusView` to carry raid ETA / goon count / source direction is
  an ICD-02 §Open questions item, deferred to milestone 0.10's Threats-
  dossier surfacing (PR-C). The *array declaration* on `WorldFrame` is
  locked at v0.6; per-entry shape grows under ICD-02's authoritative
  window.

### FxEvent union (v0.6)

`WorldFrame.effects: FxEvent[]` has existed on the per-frame contract
since v0.1 as a placeholder; v0.6 authors the actual union the renderer
drains each frame. Producers + consumers wire at PR-D (milestone 0.10.x
— visual feedback ramp); v0.6 is the contract authoring only.

```ts
type FxEvent =
  | { kind: 'flash',        at: Vec3 }                        // photog verify camera-flash · co-emits with 'verify'
  | { kind: 'print',        at: Vec3, edition: number }       // press fires at DEADLINE_FIRE
  | { kind: 'death',        at: Vec3, unit_kind: UnitKind }   // unit HP→0 (Reporter / Photog / Fixer / Goon)
  | { kind: 'pickup',       at: Vec3, story_id: StoryId }     // Reporter lands on a lead
  | { kind: 'verify',       at: Vec3, story_id: StoryId }     // Darkroom plate completes
  | { kind: 'raid_warning', at: Vec3, rival: RivalId };       // Evening Star RAID-entry tick
```

- **Drained queue.** Events live for one frame. The renderer consumes
  them and never sees them again; the queue is empty on the next
  `snapshot()`. No subscriber state lives in the array.
- **`at: Vec3`** is the world-space position the renderer anchors the
  FX to (particle spawn, sound 3D-pan, screen-shake epicenter). All six
  kinds carry this — the vocabulary is intentionally homogeneous on the
  spatial channel.
- **Vocabulary scope.** Six kinds, scoped to the Tier-0 feedback
  surfaces the audit calls out (C-06 rain ramp · C-07 effects channel)
  plus the four already-load-bearing moments (pickup · verify · print ·
  death). A seventh `'rain_ramp_intensity'` kind was rejected in favor
  of the existing `WorldFrame.rain.intensity` channel which the renderer
  already consumes per-frame — `'raid_warning'` is the discrete trigger
  that flips the ramp on; `rain.intensity` carries the continuous ramp.
- **Cross-ICD coupling.** `verify` and `pickup` carry `story_id: StoryId`
  ([ICD-05](ICD-05-story-lifecycle.md)) so the SFX layer can correlate
  with the dossier; `raid_warning` carries `rival: RivalId`
  ([ICD-02](ICD-02-rival-world.md)) so the music bed can crossfade per
  rival; `death` carries `unit_kind: UnitKind` so the corkboard pin in
  the next debrief reads the right caption. None of these reach back
  into sim — the renderer consumes the projected ids only.
- **Producers + consumers (PR-D wires; this ICD authors only).**
  Producer-side: sim emits on the relevant state transitions (`pickup`
  on Reporter path landing a lead per ICD-05 v0.2; `verify` on Darkroom
  plate per ICD-05 v0.3; `print` on `DEADLINE_FIRE` per
  [ICD-06](ICD-06-print-cycle.md); `death` on Unit HP→0; `raid_warning`
  on Evening Star's RAID-entry tick per ICD-02 v0.2; `flash` co-emits
  with `verify` for the photog camera-flash beat). Consumer-side:
  renderer FX layer (particles, screen-shake, ground flashes) and
  [ICD-07 audio bus](ICD-07-audio-bus.md) SFX channel cue-table. Both
  sides wire at PR-D; this ICD authors only the contract.

## Notes

- `WorldFrame` is the **only** thing the renderer sees. Anything not on it
  doesn't render.
- All positions are world-space `Vec3`. The renderer applies the orthographic
  isometric camera transform.
- `effects: FxEvent[]` — see §`FxEvent` union (v0.6) for the six-kind
  vocabulary and drained-queue semantics.
- `fog.color` matches `--paper` from the design doc (`#c8c4bc` at MVP).
- **Render-only projection rule (tightened at v0.5).** No field on a View
  carries information the renderer doesn't use **within the next-N window**.
  A field justified by a committed near-horizon caller is allowed — canonical
  example: `LeadView.age_ms`, plumbed sim-side from `Story.spawned_at_ms` for
  decay / pulse FX before its first consumer ships. A speculative field with
  no committed near-horizon caller belongs on `HudState`, not on
  `BuildingView` / `UnitView` / `LeadView`; a field with no committed caller
  *at all* belongs nowhere. The rule was first stated at v0.2 against the
  per-frame use ("…the renderer doesn't use this frame"); v0.5 widens the
  window to the next-N horizon to legitimize the `age_ms` case without
  loosening intent.

## Open questions

*(All v0.2 open questions closed at 0.2 — see Revision history below. PRE-0.5
opens no new questions: `HudState` shape, projection-rule wording, and the
implementation-notes constants all ship locked at v0.5. PRE-0.10 opens no
new questions either — the v0.6 additions are pure surface declarations.
The one remaining shape question — extending per-entry `RivalStatusView`
to carry raid-ETA / goon-count / source-direction for the §13 Threats mock
— lives under [ICD-02 §Open questions](ICD-02-rival-world.md) (RivalStatusView
type is owned there); ICD-01's only commitment is the top-level array.)*

## Deviation policy

If any future milestone needs to change this shape (View field add/drop,
`WorldFrame` sub-field rename, `HudState` field add/drop, etc.), update this
ICD **in the same PR** that ships the deviation (Constraint #4 of the
methodology). Adding a fourth View kind, or a new top-level `WorldFrame` key,
is an architecture session, not a deviation — stop and run a paper session.

## Implementation notes (0.2)

The 0.2 PR materialized the WorldFrame boundary. Sim lives under
`js/sim/` and produces a fresh `WorldFrame` each `snapshot()`; the
renderer under `js/render/renderer.js` consumes it via `apply(frame,
alpha)` and never reaches into sim state. Input bridges the two
through `renderer.screenToGridCell(clientX, clientY, gridW, gridH)`,
which returns a plain `GridCell` — the renderer's scene graph is not
exposed to either sim or input.

Sim-internal fields (`tile`, `path`, `pathIdx`) live on the Unit
record but never appear on `UnitView`. The `tests/world-frame.test.mjs`
suite enforces the projection by asserting `Object.keys(snapshot())`
matches the WorldFrame field set exactly.

## Implementation notes (0.5)

Four constants live in code today below the level the markdown architecture
or any other ICD pins. PRE-0.5 absorbs them here so future code sessions find
them in spec rather than having to re-derive from the source. Per the
[re-eval after 0.3](../architecture/re-eval-after-0.3.md) §1 "Arch-silent-on-code"
finding, none are large enough to promote to a standalone architecture line —
they live here as implementation pins.

- **`TILE = 6` world-units (grid pitch).**
  [`../js/sim/world-state.js:18`](../js/sim/world-state.js). The 10×10 playable
  grid plus a 6-unit pitch yields a world range of `[-30, +30]` on x/z (the
  ground plane in `renderer.js` matches at 120×120 with margin). The 6-unit
  pitch matches the design doc's cel-shaded renderer rhythm; future code
  sessions must `import { TILE } from './sim/world-state.js'` rather than
  hard-code `6`.
- **World-space origin offset = −27.**
  [`../js/sim/world-state.js:27,33`](../js/sim/world-state.js).
  `tileToWorld({x, y}) = { x: x·TILE − 27, y: 0, z: y·TILE − 27 }`;
  `worldToTile(pos) = { x: round((pos.x + 27) / TILE), y: round((pos.z + 27) / TILE) }`.
  The −27 centers the grid: tile (0, 0) lands at world (−27, 0, −27) and tile
  (9, 9) lands at world (+27, 0, +27). The renderer also applies the offset
  when placing meshes ([`../js/render/renderer.js`](../js/render/renderer.js)
  `_syncBuildings` / `_syncUnits`); sim is the canonical source.
- **Fixed 30 Hz sim tick.**
  [`../js/main.js:9-10`](../js/main.js): `TICK_HZ = 30`, `TICK_DT = 1 / TICK_HZ`.
  ICD-01 v0.3 §UnitView locked the renderer-interpolation rule against a fixed
  30 Hz tick rate; v0.5 pins the rate itself so a future code session doesn't
  re-derive it from the lerp formula. ICD-06's `CYCLE_TICK.dt_ms` (milestone
  0.5) will receive `1000 / TICK_HZ ≈ 33.33` per tick.
- **Id-minting convention.**
  [`../js/sim/world-state.js:38-39`](../js/sim/world-state.js). A module-scoped
  monotonic counter `nextId` (reset to 1 in the `World()` constructor) yields
  ids via `mkId(prefix) = \`${prefix}-${nextId++}\``. Prefixes in use at v0.4.0:
  `'b'` (buildings — `b-1` Bureau, `b-2` Darkroom), `'u'` (units — `u-1`
  Reporter, `u-2` Photog), `'s'` (stories — `s-1` first lead). ICD-05's
  "same id flows end-to-end" commitment is satisfied because `World` owns
  minting; future modules (rivals at 0.7, save at 0.8) must mint through the
  same counter to keep `BuildingId` / `UnitId` / `StoryId` globally unique
  per game run.

## Revision history

- **v0.6.1** (milestone 0.10.0, 2026-05-21) — `BuildingKind` vocabulary
  widens to include `'branch_bureau'` (audit G-01 — Tier-0 §16 calls for
  three buildings; code shipped Bureau + Darkroom through 0.9.x). The
  Branch Bureau is the second bureau-family building; reporters drop at
  either, and the new building covers the Hillside district per
  [`../js/sim/districts.js`](../js/sim/districts.js) `coveredByKind`.
  Branch destruction does NOT trigger `CYCLE_GAME_OVER` — only the main
  Bureau drives the §17 single fail-state. Value-level addition under the
  open-vocabulary `BuildingKind` slot — no shape change. Constraint #4
  in-PR bump alongside the milestone 0.10.0 substrate code session.
- **v0.6** (PRE-0.10, 2026-05-21) — Four field-set additions ahead of
  milestone 0.10 (Tier-0 closer). **`UnitView.stats: {nerve: number,
  nose: number, legs: number} | undefined`** authored for the Reporter
  trio per Design Doc §08 + §13 HUD mock (audit G-10); the field is
  `undefined` for every non-Reporter kind at Tier-0. **`LeadView.district:
  DistrictId`** lifted from the sim-layer `Story.district` field (live
  since milestone 0.3) into the projection so the §13 Story-queue dossier
  can render per-district headlines (audit G-11; couples to G-04
  districts-as-data at PR-C). **`WorldFrame.rivals: RivalStatusView[]`**
  top-level key authored as the player-facing posture surface for the
  §13 Threats dossier (audit G-12; resolves post-0.6 §3.5 Q5 carryover —
  top-level not nested inside `hud`; `RivalStatusView` type stays owned
  by [ICD-02 v0.2](ICD-02-rival-world.md)). **`FxEvent` union** authored
  under `WorldFrame.effects` with six-kind vocabulary (`'flash' | 'print'
  | 'death' | 'pickup' | 'verify' | 'raid_warning'`) and drained-queue
  semantics (audit C-07; producers + consumers wire at PR-D / milestone
  0.10.x — this slot authors the contract only). No `WorldFrame` top-
  level removal; existing fields unchanged. No `HudState` change — posture
  surface lives on `WorldFrame.rivals`, not on `HudState`. No new
  Implementation notes — v0.6 is contract authoring, no arch-silent
  constants surfaced. HUD corkboard band promoted medium → strong
  (overview line 45) in the same paper slot — see PRE-0.10 supplement to
  [`../architecture/re-eval-after-0.9.md`](../architecture/re-eval-after-0.9.md)
  §2.
- **v0.5** (PRE-0.5, 2026-05-20) — Authored the `HudState` shape (`edition`,
  `deadline_ms`, `resources: { leads, stories, ink, cash, heat }`) referenced
  by the `WorldFrame.hud` slot since v0.2 — gates milestones 0.5 (deadline
  ticker) and 0.6 (resource readouts). Tightened the render-only projection
  rule from "this frame" to "within the next-N window" to legitimize
  `LeadView.age_ms` (plumbed for decay / pulse FX before its first consumer
  ships). Added an Implementation notes (0.5) subsection pinning four
  arch-silent constants the v0.4.0 code already runs on: `TILE = 6`,
  world-space origin offset `−27`, fixed 30 Hz sim tick (`TICK_HZ` /
  `TICK_DT`), and the per-`World` monotonic id-minting convention (`b-`,
  `u-`, `s-` prefixes). No View struct field-set changes; no `WorldFrame`
  top-level field changes.
- **v0.4** (milestone 0.3, 2026-05-20) — Tightened the `LeadView` filter rule
  to exclude Stories with `held_by_building` set (the resting-state pointer
  added in ICD-05 v0.2). No field-set change; `LeadView` keys are
  unchanged. Carrying-folder render path lit up via `UnitView.carrying`.
- **v0.3** (milestone 0.2, 2026-05-20) — Animation playhead resolved
  (renderer interpolates `pos`/`facing` between fixed 30 Hz sim ticks);
  `Vec3` precision resolved (plain `{x,y,z}` object). WorldFrame
  boundary materialized in code under `js/sim/` ↔ `js/render/` split.
- **v0.2** (PRE-0.2, 2026-05-20) — Spelled out the three View struct field
  sets; documented the LeadView ↔ UnitView.carrying handoff at pickup; added
  the render-only projection rule; closed the v0.1 "View structs" open
  question; added the `Vec3` precision question deferred to 0.2.
- **v0.1** (PRE-0.1, Phase 0 bootstrap) — Draft. WorldFrame skeleton from §03
  of the supplement; View field sets left as one-line sketches.
