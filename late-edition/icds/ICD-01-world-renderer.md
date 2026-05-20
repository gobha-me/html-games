# ICD-01 · World ↔ Renderer

**Status:** v0.2 (PRE-0.2 paper session — View structs spelled out)
**Band:** strong
**First caller:** milestone 0.1 (scene, camera, toon pipeline) — shipped in v0.1.0
**Next caller:** milestone 0.2 (A* pathfinding · Reporter unit · click-to-dispatch)
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
- **Animation playhead remains deferred.** The v0.1 open question
  ("interpolate between frames or render discrete positions?") stands —
  resolved at the first walk-cycle milestone (currently 0.2 or 0.3, decided
  in-PR per Constraint #4).

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
- `LeadView` only exists while `Story.state === 'lead'`. Once
  `picked_up_by: ReporterId` is set on the Story (ICD-05), the lead leaves
  `frame.leads` and surfaces visually via the carrier's `UnitView.carrying`
  channel. **Stories in other states never appear in `frame.leads`.**

## Notes

- `WorldFrame` is the **only** thing the renderer sees. Anything not on it
  doesn't render.
- All positions are world-space `Vec3`. The renderer applies the orthographic
  isometric camera transform.
- `effects: FxEvent[]` is a **drained queue** — events live for one frame, the
  renderer consumes them and never sees them again.
- `fog.color` matches `--paper` from the design doc (`#c8c4bc` at MVP).
- Render-only projection rule: **no field on a View carries information the
  renderer doesn't use this frame.** Speculative fields ("we'll need this for
  the HUD later") belong on `HudState`, not on `BuildingView` / `UnitView` /
  `LeadView`.

## Open questions

- Animation state — does the renderer interpolate between frames or render
  discrete positions? Defer until the first walk cycle is on screen.
- `Vec3` precision — `Float32Array` packed into a typed-array pool, or plain
  `{x,y,z}` object? Decide at 0.2 if profiling flags allocation pressure.

## Deviation policy

If milestone 0.2 needs to change this shape (View field add/drop, WorldFrame
sub-field rename, etc.), update this ICD **in the same PR** that ships the
deviation (Constraint #4 of the methodology). Adding a fourth View kind is an
architecture session, not a deviation — stop and run a paper session.

## Revision history

- **v0.2** (PRE-0.2, 2026-05-20) — Spelled out the three View struct field
  sets; documented the LeadView ↔ UnitView.carrying handoff at pickup; added
  the render-only projection rule; closed the v0.1 "View structs" open
  question; added the `Vec3` precision question deferred to 0.2.
- **v0.1** (PRE-0.1, Phase 0 bootstrap) — Draft. WorldFrame skeleton from §03
  of the supplement; View field sets left as one-line sketches.
