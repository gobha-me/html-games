// 1.1.2 (#337) — pure projection helpers for the minimap HUD widget.
// Mirrors the v1.1.1 zoom-step.js factoring pattern: keep the math out of
// hud.js so tests/minimap.test.mjs can exercise it without DOM or THREE.js.
//
// Coordinate systems:
//   - Tile coords: integer (x, y) in [0, GRID_W-1]; same convention as
//     js/sim/world-state.js GridCell.
//   - World XZ: float; sim's tileToWorld(t) = (t.x*TILE_WORLD - 27, _,
//     t.y*TILE_WORLD - 27) for the canonical 10×6 grid (TILE_WORLD = 6).
//   - Canvas pixel space: (px, py) with origin top-left, +px right, +py
//     down. tile (0, 0) maps to the cell-center near top-left; tile (9, 9)
//     to the cell-center near bottom-right.
//
// The camera-frustum overlay is computed by lifting the orthographic frustum
// (left/right/top/bottom in camera space) to a rhombus on the ground plane,
// using the (24, 22, 24) iso camera's pre-baked azimuth/tilt constants.
// See frustumQuad() below.

export const GRID_W = 10;
export const TILE_WORLD = 6;
export const MARGIN = 8;

// Pre-baked constants for the (24, 22, 24) isometric camera in renderer.js.
// Camera azimuth in XZ is 45° (looking toward origin from NE corner).
// Camera tilt from horizontal is atan(22 / √(24² + 24²)) ≈ 32.95°.
// sin(tilt) = 22 / √(24² + 22² + 24²) = 22/√1652 ≈ 0.5413.
//   CAMERA_RIGHT_XZ: unit vector of "screen right" projected onto the ground
//     (perpendicular to look in XZ; cross of world-up × look = (-cos45, sin45)).
//   CAMERA_UP_XZ_LEN: magnitude of "screen up" once projected onto the ground;
//     the projection magnifies by 1/sin(tilt) because the screen-up vector
//     rises sharply (camera tilts down).
const SQRT2_OVER_2 = 0.7071067811865476;
const CAMERA_RIGHT_X = -SQRT2_OVER_2;
const CAMERA_RIGHT_Z = SQRT2_OVER_2;
const CAMERA_UP_XZ_LEN = SQRT2_OVER_2 / 0.5413309587528197;  // ≈ 1.306

// Tile (x, y) in [0, GRID_W-1] → canvas-space {px, py} centered on the cell.
// Returning the cell *center* (not corner) lets building/unit/lead markers
// stamp on the cell centroid for a "this is where the thing is" read.
export function tileToPixel(tile, size, margin = MARGIN, gridW = GRID_W) {
  const cell = (size - 2 * margin) / gridW;
  return {
    px: margin + tile.x * cell + cell / 2,
    py: margin + tile.y * cell + cell / 2,
  };
}

// World XZ (x, z) → canvas-space {px, py}. Linear map: world X in
// [-WORLD_HALF + TILE_WORLD/2, WORLD_HALF - TILE_WORLD/2] (tile-center extent
// after sim's tileToWorld offset) maps to the same pixel range as tileToPixel
// for the corresponding cell. Used for unit interpolation positions and the
// frustum-rect overlay corners.
export function worldXZToPixel(worldXZ, size, margin = MARGIN, gridW = GRID_W, tileWorld = TILE_WORLD) {
  const cell = (size - 2 * margin) / gridW;
  const tileCenter0 = -gridW * tileWorld / 2 + tileWorld / 2;  // -27 for gridW=10, tileWorld=6
  return {
    px: margin + cell / 2 + (worldXZ.x - tileCenter0) * cell / tileWorld,
    py: margin + cell / 2 + (worldXZ.z - tileCenter0) * cell / tileWorld,
  };
}

// Camera frustum → 4-vertex rhombus on the ground plane (world XZ).
// The orthographic frustum is a screen-aligned rect of size
// (frustum*aspect) × frustum in camera space. Lifting that to the ground
// gives a rhombus with corners:
//   center + ±R*(halfW) ± U*(halfH)
// where R is the camera-right vector projected onto the ground (unit length),
// and U is the camera-up vector projected onto the ground (length 1/sin(tilt)
// — the ground projection magnifies as the camera tilts toward horizontal).
// Returns 4 {x, z} world points in winding order (TR, BR, BL, TL).
export function frustumQuad(pan, frustum, aspect) {
  const halfW = frustum * aspect / 2;
  const halfH = frustum / 2;
  const rX = CAMERA_RIGHT_X * halfW;
  const rZ = CAMERA_RIGHT_Z * halfW;
  const uX = CAMERA_UP_XZ_LEN * halfH;
  const uZ = CAMERA_UP_XZ_LEN * halfH;
  return [
    { x: pan.x + rX + uX, z: pan.z + rZ + uZ },  // TR — top-right of screen
    { x: pan.x + rX - uX, z: pan.z + rZ - uZ },  // BR
    { x: pan.x - rX - uX, z: pan.z - rZ - uZ },  // BL
    { x: pan.x - rX + uX, z: pan.z - rZ + uZ },  // TL
  ];
}
