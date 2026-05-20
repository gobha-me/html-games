# ICD-03 · Unit ↔ Pathfinder

**Status:** v0.2 (shipped against milestone 0.2 — open questions closed)
**Band:** strong
**First caller:** milestone 0.2 (A* pathfinding · Reporter unit · click-to-dispatch) — shipped in v0.2.0
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

## Resolved at 0.2

- **`GridCell` = `{ x: number, y: number }`** plain object. Packed-int was
  rejected as premature; profiling at 0.2 showed no allocation pressure
  (one Reporter, sub-100-cell paths). Promote to packed int only if a
  future milestone shows measurable GC pressure from path objects.
- **`cost` units = tiles** at 0.2 with one unit kind. The field stays in
  tiles while `unitKind` is unused by the pathfinder. When milestone 0.7
  introduces per-kind costs (Goons cutting alleys, Reporters preferring
  streets), `cost` becomes weighted units and rival-AI heuristics need to
  account for the unit-shift; that's a contract change to be handled in
  the 0.7 PR's ICD update.
- **Heuristic** = Manhattan distance (4-neighbor grid, no diagonals at 0.2).
  Diagonals are not in scope for the vertical slice.
- **`recomputeOn` at 0.2** = always `[]`. Buildings bake once at city-gen
  and never move in milestones 0.2 through 0.6; the invalidation channel
  is wired but no current caller subscribes.

## Open questions

*(All v0.1 open questions closed at 0.2 — see Revision history below.)*

## Implementation notes (0.2)

A* lives at `late-edition/js/sim/pathfinder.js` as a pure function:
`pathfind(req, grid) → PathResponse` where `grid = { width, height,
walkable: boolean[H][W] }`. The grid is owned by `World` (see
`js/sim/world-state.js`); buildings mark their footprint cells
non-walkable at construction. Pathfinder coverage is in
`tests/pathfinder.test.mjs` (6 cases).

## Deviation policy

If a future milestone needs to change this shape, update this ICD **in the
same PR**.

## Revision history

- **v0.2** (milestone 0.2, 2026-05-20) — Shipped against the first
  caller. Closed `GridCell` (plain object), `cost` units (tiles for now),
  heuristic (Manhattan), and noted `recomputeOn` is empty at the slice.
- **v0.1** (PRE-0.1, Phase 0 bootstrap) — Draft. Request/response shape
  from §03 of the supplement; representation questions left open.
