import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tileToPixel, worldXZToPixel, frustumQuad, GRID_W, TILE_WORLD, MARGIN } from '../js/render/minimap.js';

// Milestone 1.1.2 (#337): pure projection helpers for the minimap HUD widget.
// The math (tile → pixel, world XZ → pixel, frustum → ground rhombus) is
// factored out of hud.js so tests can exercise it without DOM/THREE/canvas
// shims — mirrors the 1.1.1 zoom-step.js factoring.
//
// Canonical canvas size for these tests is 140 px (the same widget size
// used in index.html); MARGIN=8, GRID_W=10, TILE_WORLD=6 land cell ≈ 12.4 px.

const SIZE = 140;

test('tileToPixel: tile (0, 0) maps to the cell-center near top-left', () => {
  const { px, py } = tileToPixel({ x: 0, y: 0 }, SIZE);
  const cell = (SIZE - 2 * MARGIN) / GRID_W;
  assert.ok(Math.abs(px - (MARGIN + cell / 2)) < 1e-9);
  assert.ok(Math.abs(py - (MARGIN + cell / 2)) < 1e-9);
});

test('tileToPixel: tile (9, 9) maps to the cell-center near bottom-right (symmetric)', () => {
  const { px, py } = tileToPixel({ x: 9, y: 9 }, SIZE);
  const cell = (SIZE - 2 * MARGIN) / GRID_W;
  assert.ok(Math.abs(px - (SIZE - MARGIN - cell / 2)) < 1e-9);
  assert.ok(Math.abs(py - (SIZE - MARGIN - cell / 2)) < 1e-9);
});

test('tileToPixel: corner symmetry — (0,0) and (9,9) are reflections across the canvas center', () => {
  // Sanity: with equal margins, the two opposite corners must sum to SIZE
  // on each axis (i.e. mirror across the center). Pins the cell-center
  // anchoring against accidental drift to corner-anchoring.
  const a = tileToPixel({ x: 0, y: 0 }, SIZE);
  const b = tileToPixel({ x: GRID_W - 1, y: GRID_W - 1 }, SIZE);
  assert.ok(Math.abs((a.px + b.px) - SIZE) < 1e-9);
  assert.ok(Math.abs((a.py + b.py) - SIZE) < 1e-9);
});

test('worldXZToPixel: world (-27, -27) ≡ tile (0, 0) — composition with sim tileToWorld', () => {
  // Sim's tileToWorld(t) = (t.x * 6 - 27, _, t.y * 6 - 27). Verify the
  // minimap's world-space projector lands on the same pixel as the
  // tile-space projector for the canonical corner.
  const a = worldXZToPixel({ x: -27, z: -27 }, SIZE);
  const b = tileToPixel({ x: 0, y: 0 }, SIZE);
  assert.ok(Math.abs(a.px - b.px) < 1e-9);
  assert.ok(Math.abs(a.py - b.py) < 1e-9);
});

test('worldXZToPixel: world (27, 27) ≡ tile (9, 9) — opposite-corner composition', () => {
  const a = worldXZToPixel({ x: 27, z: 27 }, SIZE);
  const b = tileToPixel({ x: 9, y: 9 }, SIZE);
  assert.ok(Math.abs(a.px - b.px) < 1e-9);
  assert.ok(Math.abs(a.py - b.py) < 1e-9);
});

test('worldXZToPixel: world (0, 0) maps to the canvas center', () => {
  const { px, py } = worldXZToPixel({ x: 0, z: 0 }, SIZE);
  // Center isn't exactly SIZE/2 — it's offset by the cell-center anchoring
  // (the canvas center sits between tiles (4,4) and (5,5); world (0,0)
  // sits between cells too, exactly halfway across the cell-center pixel
  // range, which equals SIZE/2 by the corner-symmetry property tested above).
  assert.ok(Math.abs(px - SIZE / 2) < 1e-9);
  assert.ok(Math.abs(py - SIZE / 2) < 1e-9);
});

test('frustumQuad: returns 4 distinct corners centered on pan', () => {
  // At pan=(0,0), the 4 corners should be symmetric about the origin —
  // each corner has an opposite (+R+U vs -R-U, +R-U vs -R+U).
  const quad = frustumQuad({ x: 0, z: 0 }, 22, 2);
  assert.equal(quad.length, 4);
  assert.ok(Math.abs(quad[0].x + quad[2].x) < 1e-9, 'TR.x mirrors BL.x');
  assert.ok(Math.abs(quad[0].z + quad[2].z) < 1e-9, 'TR.z mirrors BL.z');
  assert.ok(Math.abs(quad[1].x + quad[3].x) < 1e-9, 'BR.x mirrors TL.x');
  assert.ok(Math.abs(quad[1].z + quad[3].z) < 1e-9, 'BR.z mirrors TL.z');
});

test('frustumQuad: panning by (dx, dz) shifts all 4 corners by (dx, dz)', () => {
  const a = frustumQuad({ x: 0, z: 0 }, 22, 2);
  const b = frustumQuad({ x: 5, z: -3 }, 22, 2);
  for (let i = 0; i < 4; i++) {
    assert.ok(Math.abs((b[i].x - a[i].x) - 5) < 1e-9);
    assert.ok(Math.abs((b[i].z - a[i].z) - (-3)) < 1e-9);
  }
});

test('frustumQuad: smaller frustum → strictly smaller corner radii (zoom in)', () => {
  // At pan=(0,0), each corner's distance from origin must shrink monotonically
  // with frustum size — guards against a sign-flip bug in the projection.
  const r = (q) => Math.hypot(q[0].x, q[0].z);
  const rCity = r(frustumQuad({ x: 0, z: 0 }, 22, 2));
  const rBlock = r(frustumQuad({ x: 0, z: 0 }, 10, 2));
  assert.ok(rBlock < rCity, 'Block (frustum=10) must give a tighter rhombus than City (frustum=22)');
});

test('frustumQuad: wider aspect stretches the rhombus along the camera-right axis', () => {
  // The camera-right axis on the ground is (-1, +1)/√2 — so a wider aspect
  // (more screen real-estate sideways) should grow the rhombus along that
  // diagonal. Concretely, the TR corner's |x - z| (distance from the NE-SW
  // diagonal) should be larger for aspect=2 than for aspect=1.
  const qNarrow = frustumQuad({ x: 0, z: 0 }, 22, 1);
  const qWide = frustumQuad({ x: 0, z: 0 }, 22, 2);
  // Camera-right axis: (-1, +1)/√2. Distance from origin along that axis
  // is the dot product of (corner.x, corner.z) with (-1, +1)/√2.
  const projRight = (q) => Math.abs(-q[0].x + q[0].z) / Math.SQRT2;
  assert.ok(projRight(qWide) > projRight(qNarrow));
});
