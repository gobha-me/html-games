import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FRUSTUM_STEPS, nextZoomStep } from '../js/render/zoom-step.js';

// Milestone 1.1.1 (#335): the 2-state {city,block} zoom toggle read as
// unresponsive when the player mashed one key (first ']' at City frustum
// 22 hit `level === this._zoomLevel` and returned early). The ladder is
// now four steps (30 → 22 → 16 → 10) with [ stepping in (smaller frustum)
// and ] stepping out (larger frustum), clamped at the endpoints.
//
// nextZoomStep is the pure index-math helper renderer.js calls from
// stepZoom — tested here without spinning up THREE.

test('FRUSTUM_STEPS is 30 → 22 → 16 → 10 (descending)', () => {
  assert.deepEqual(FRUSTUM_STEPS, [30, 22, 16, 10]);
});

test('boot index 1 (City frustum=22) advances inward to 16 then 10', () => {
  // [ steps in = +1 (smaller frustum, tighter view).
  let idx = 1;
  idx = nextZoomStep(idx, +1);
  assert.equal(FRUSTUM_STEPS[idx], 16);
  idx = nextZoomStep(idx, +1);
  assert.equal(FRUSTUM_STEPS[idx], 10);
});

test('innermost step (frustum 10) clamps on further [ press (no wrap)', () => {
  let idx = FRUSTUM_STEPS.length - 1; // 3
  const next = nextZoomStep(idx, +1);
  assert.equal(next, idx, 'index should not advance past innermost');
  assert.equal(FRUSTUM_STEPS[next], 10);
});

test('outermost step (frustum 30) clamps on further ] press (no wrap)', () => {
  let idx = 0;
  const next = nextZoomStep(idx, -1);
  assert.equal(next, idx, 'index should not retreat past outermost');
  assert.equal(FRUSTUM_STEPS[next], 30);
});

test('] from boot City steps outward to 30 (the wider view the v1.1.0 toggle never reached)', () => {
  // The v1.1.0 bug was that pressing ']' at City was a no-op because City
  // *was* the outermost level — this test pins the new behavior of
  // actually stepping outward to a wider view at frustum 30.
  const idx = nextZoomStep(1, -1);
  assert.equal(idx, 0);
  assert.equal(FRUSTUM_STEPS[idx], 30);
});

test('repeated presses walk the full ladder in either direction', () => {
  // Press [ four times from outermost: 30 → 22 → 16 → 10 → 10 (clamped).
  const forward = [];
  let idx = 0;
  for (let i = 0; i < 4; i++) { idx = nextZoomStep(idx, +1); forward.push(FRUSTUM_STEPS[idx]); }
  assert.deepEqual(forward, [22, 16, 10, 10]);
  // Press ] four times from innermost: 10 → 16 → 22 → 30 → 30 (clamped).
  const back = [];
  idx = FRUSTUM_STEPS.length - 1;
  for (let i = 0; i < 4; i++) { idx = nextZoomStep(idx, -1); back.push(FRUSTUM_STEPS[idx]); }
  assert.deepEqual(back, [16, 22, 30, 30]);
});
