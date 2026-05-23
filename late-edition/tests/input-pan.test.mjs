import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEY_PAN, PAN_SPEED } from '../js/input.js';
import { TILE } from '../js/sim/world-state.js';

// Milestone 1.1.1 (#333): WASD pan was world-XZ-aligned in 1.1.0, which made
// every key drift diagonally under the iso camera (world +X projects to
// screen-down-right). 1.1.1 rotates the unit vectors 45° so each key maps to
// its screen axis (W=up, A=left, S=down, D=right) while the existing
// Math.hypot normalization in syncPanVelocity keeps |v| at PAN_SPEED.

// Simulate syncPanVelocity's resultant + normalize so the test exercises the
// same math the runtime does. Empty key set → zero vector (no normalize).
function resultantVelocity(keys) {
  let vx = 0, vz = 0;
  for (const k of keys) {
    const v = KEY_PAN[k];
    if (v) { vx += v.x; vz += v.z; }
  }
  const mag = Math.hypot(vx, vz);
  if (mag === 0) return { x: 0, z: 0 };
  return { x: (vx / mag) * PAN_SPEED, z: (vz / mag) * PAN_SPEED };
}

test('W is screen-up: pan vector has -X and -Z components (both negative)', () => {
  // Under the iso camera at (24,22,24) looking at origin, screen-up
  // corresponds to world (-X, -Z). The pre-normalize vector is (-1, -1).
  assert.deepEqual(KEY_PAN.w, { x: -1, z: -1 });
});

test('A is screen-left: pan vector points to (-X, +Z)', () => {
  assert.deepEqual(KEY_PAN.a, { x: -1, z: 1 });
});

test('S is screen-down: pan vector points to (+X, +Z)', () => {
  assert.deepEqual(KEY_PAN.s, { x: 1, z: 1 });
});

test('D is screen-right: pan vector points to (+X, -Z)', () => {
  assert.deepEqual(KEY_PAN.d, { x: 1, z: -1 });
});

test('single-key normalize: |v| === PAN_SPEED for each cardinal key', () => {
  // The pre-normalize magnitude is √2; the runtime normalize must scale back
  // to PAN_SPEED so axis-aligned and pre-rotated diagonals share velocity.
  for (const k of ['w', 'a', 's', 'd']) {
    const v = resultantVelocity(new Set([k]));
    const mag = Math.hypot(v.x, v.z);
    assert.ok(Math.abs(mag - PAN_SPEED) < 1e-6, `${k}: |v|=${mag} expected ${PAN_SPEED}`);
  }
});

test('opposing keys cancel (W+S held → zero velocity, no NaN)', () => {
  const v = resultantVelocity(new Set(['w', 's']));
  assert.deepEqual(v, { x: 0, z: 0 });
});

// 1.3.1 (#playtest-bug-4): the v1.3.0 playtest reported "20 taps moves
// the world maybe a tile" — at the old TILE*4 (24 u/s), a fast tap
// (~16ms) only nets ~0.4u, so 20 taps = ~8u ≈ 1.3 tiles. Bumping to
// TILE*10 (60 u/s) gives ~1u/tap, so the same 20 taps now cross ~3
// tiles. Hold-to-pan was already wired; the issue was magnitude.
test('PAN_SPEED is TILE * 10 (1.3.1 retune from TILE * 4)', () => {
  assert.equal(PAN_SPEED, TILE * 10);
});

test('two-key diagonal (W+D = up-right) normalizes to PAN_SPEED', () => {
  // W=(-1,-1) + D=(1,-1) → (0,-2) → normalized to (0, -PAN_SPEED): screen-up.
  // This is the "RTS player holds up + right" gesture; magnitude must not
  // exceed PAN_SPEED, otherwise diagonal pan crosses the world faster.
  const v = resultantVelocity(new Set(['w', 'd']));
  const mag = Math.hypot(v.x, v.z);
  assert.ok(Math.abs(mag - PAN_SPEED) < 1e-6);
  assert.ok(Math.abs(v.x) < 1e-6, `expected pure -Z, got x=${v.x}`);
  assert.ok(v.z < 0, `expected -Z (screen-up), got z=${v.z}`);
});
