import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FRUSTUM_STEPS, nextZoomStep } from '../js/render/zoom-step.js';

// Milestone 1.1.1 (#335): the 2-state {city,block} zoom toggle read as
// unresponsive when the player mashed one key (first ']' at City frustum
// 22 hit `level === this._zoomLevel` and returned early). The ladder is
// four steps with [ stepping in (smaller frustum) and ] stepping out
// (larger frustum), clamped at the endpoints.
//
// 1.3.1 (#playtest-bug-3): the v1.1.1 range [30, 22, 16, 10] read as
// imperceptibly tight at the outer end — the 27% step from 30→22 was
// invisible against the iso angle + fog. Widened to [36, 24, 16, 10]
// so the outer pull-back is dramatic; inner steps preserve for deep-zoom.
// Boot still indexes at step 1 (frustum=24); FRUSTUM_CITY in renderer.js
// tracks the new value.
//
// nextZoomStep is the pure index-math helper renderer.js calls from
// stepZoom — tested here without spinning up THREE.

test('FRUSTUM_STEPS is 36 → 24 → 16 → 10 (descending; 1.3.1 widened outer)', () => {
  assert.deepEqual(FRUSTUM_STEPS, [36, 24, 16, 10]);
});

test('FRUSTUM_STEPS is strictly decreasing — guards against accidental re-order', () => {
  for (let i = 1; i < FRUSTUM_STEPS.length; i++) {
    assert.ok(FRUSTUM_STEPS[i] < FRUSTUM_STEPS[i - 1],
      `step ${i} (${FRUSTUM_STEPS[i]}) should be < step ${i - 1} (${FRUSTUM_STEPS[i - 1]})`);
  }
});

test('boot index 1 (City frustum=24) advances inward to 16 then 10', () => {
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

test('outermost step (frustum 36) clamps on further ] press (no wrap)', () => {
  let idx = 0;
  const next = nextZoomStep(idx, -1);
  assert.equal(next, idx, 'index should not retreat past outermost');
  assert.equal(FRUSTUM_STEPS[next], 36);
});

test('] from boot City steps outward to 36 (the wider view 1.3.1 widened to)', () => {
  // 1.1.0 toggle missed the outer step; 1.1.1 added it at 30; 1.3.1
  // widened to 36 so the step reads as a dramatic pull-back. This case
  // pins the new boundary so a future "tighten the outer" doesn't slip in
  // unnoticed.
  const idx = nextZoomStep(1, -1);
  assert.equal(idx, 0);
  assert.equal(FRUSTUM_STEPS[idx], 36);
});

test('repeated presses walk the full ladder in either direction', () => {
  // Press [ four times from outermost: 36 → 24 → 16 → 10 → 10 (clamped).
  const forward = [];
  let idx = 0;
  for (let i = 0; i < 4; i++) { idx = nextZoomStep(idx, +1); forward.push(FRUSTUM_STEPS[idx]); }
  assert.deepEqual(forward, [24, 16, 10, 10]);
  // Press ] four times from innermost: 10 → 16 → 24 → 36 → 36 (clamped).
  const back = [];
  idx = FRUSTUM_STEPS.length - 1;
  for (let i = 0; i < 4; i++) { idx = nextZoomStep(idx, -1); back.push(FRUSTUM_STEPS[idx]); }
  assert.deepEqual(back, [16, 24, 36, 36]);
});
