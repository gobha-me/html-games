# ICD-01 · World ↔ Renderer

**Status:** draft (Phase 0 / PRE-0.1)
**Band:** strong
**First caller:** milestone 0.1 (scene, camera, toon pipeline)
**Source:** [`../design/phase-0-roadmap.html`](../design/phase-0-roadmap.html) §03

## Purpose

What the simulation hands the renderer each frame. Keeps simulation pure; keeps
renderer dumb. The renderer never reaches back into world state.

## Per-frame contract

```ts
// Per frame
interface WorldFrame {
  cameraTarget: Vec3;
  buildings: BuildingView[];   // pos, kind, hp, tier
  units:     UnitView[];       // pos, facing, kind, state
  leads:     LeadView[];       // pos, tier, age
  rain:      RainConfig;       // intensity 0-1
  fog:       { near: number, far: number, color: number };
  hud:       HudState;         // edition, deadline_ms, resources
  effects:   FxEvent[];        // flashes, prints, deaths
}
```

## Notes

- `WorldFrame` is the **only** thing the renderer sees. Anything not on it
  doesn't render.
- All positions are world-space `Vec3`. The renderer applies the orthographic
  isometric camera transform.
- `effects: FxEvent[]` is a **drained queue** — events live for one frame, the
  renderer consumes them and never sees them again.
- `fog.color` matches `--paper` from the design doc (`#c8c4bc` at MVP).

## Open questions

- View structs (`BuildingView`, `UnitView`, etc.) — sketch the field sets in
  ICD-01 v0.2 before milestone 0.1 opens.
- Animation state — does the renderer interpolate between frames or render
  discrete positions? Defer until the first walk cycle is on screen.

## Deviation policy

If milestone 0.1 needs to change this shape, update this ICD **in the same PR**
that ships the renderer (Constraint #4 of the methodology).
