# ICD-01 · World ↔ Renderer

**Status:** v0.5 (shipped against PRE-0.5 — `HudState` shape authored, render-only projection rule tightened, implementation notes added for arch-silent constants)
**Band:** strong
**First caller:** milestone 0.1 (scene, camera, toon pipeline) — shipped in v0.1.0
**Current caller:** milestone 0.4 (Photog · Darkroom · `lead → verified`) — shipped in v0.4.0 with no ICD bump. PRE-0.5 (v0.4.1) authors `HudState` ahead of milestone 0.5 (print cycle) and milestone 0.6 (resources).
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
  rain:      RainConfig;       // intensity 0-1
  fog:       { near: number, far: number, color: number };
  hud:       HudState;         // edition, deadline_ms, resources
  effects:   FxEvent[];        // flashes, prints, deaths
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
  kind:   BuildingKind;        // 'bureau' at 0.2; 'darkroom' at 0.4; full catalogue medium-band
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

### LeadView

Drives milestone 0.3 (first lead spawn). The field set is committed now so 0.3
opens cleanly without a second paper session.

```ts
interface LeadView {
  id:     StoryId;                                       // same id as Story (ICD-05) — flows end-to-end
  pos:    Vec3;                                          // district pickup point
  tier:   'whisper' | 'investigation' | 'arc';
  flavor: 'vice' | 'violence' | 'money' | 'labor';      // drives color tint per flavor
  age_ms: number;                                        // sim-computed from spawned_at_ms
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

## Notes

- `WorldFrame` is the **only** thing the renderer sees. Anything not on it
  doesn't render.
- All positions are world-space `Vec3`. The renderer applies the orthographic
  isometric camera transform.
- `effects: FxEvent[]` is a **drained queue** — events live for one frame, the
  renderer consumes them and never sees them again.
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
implementation-notes constants all ship locked at v0.5.)*

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
