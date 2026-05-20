# ICD-03 · Unit ↔ Pathfinder

**Status:** draft (Phase 0 / PRE-0.1)
**Band:** strong
**First caller:** milestone 0.2 (A* pathfinding · Reporter unit · click-to-dispatch)
**Source:** [`../design/phase-0-roadmap.html`](../design/phase-0-roadmap.html) §03

## Purpose

Single request/response shape across **all** unit kinds. A* over a precomputed
grid; grid baked at city-gen time; per-building recompute on placement.

## Request / response

```ts
interface PathRequest {
  from:     GridCell;
  to:       GridCell;
  unitKind: UnitKind;   // Reporter, Photog, Fixer, Goon, ...
}

interface PathResponse {
  found:        boolean;
  cells:        GridCell[];       // empty if !found
  cost:         number;           // monotone — useful for AI heuristics
  recomputeOn:  BuildingId[];     // invalidation set — caller subscribes
}
```

## Notes

- **Grid is baked at city-gen.** Per-building recompute on placement means the
  pathfinder publishes a `recomputeOn` set; callers holding cached paths
  invalidate when any building in that set changes.
- `unitKind` exists so unit-class-specific costs (Goons cut through alleys,
  Reporters prefer streets) can be added later without changing the contract.
  Vertical slice ignores it.
- `cells` is **the full path**, not a `nextStep`. Units consume it themselves.

## Open questions

- `GridCell` representation: `{x, y}` integer pair, or single packed `int`?
  Decide at 0.2 — packed `int` if profiling shows allocation pressure.
- Should `cost` be in tiles, time, or "weighted units"? Default to tiles for
  the slice; revisit if rival AI needs comparable scores.

## Deviation policy

If milestone 0.2 needs to change this shape, update this ICD **in the same PR**.
