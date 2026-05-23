// 1.1.1 (#335) — pure zoom-step ladder shared with tests.
// Renderer.stepZoom uses these to keep the THREE.js-dependent code thin
// and the integer index math testable without spinning up WebGL.
//
// Steps go outermost → innermost; stepZoom(+1) is "zoom in" (smaller
// frustum, tighter view); stepZoom(-1) is "zoom out" (larger frustum,
// wider view). Endpoints clamp silently — see nextZoomStep below.

export const FRUSTUM_STEPS = [30, 22, 16, 10];

// Compute the next zoom-step index given a current index and a direction
// (+1 = in / smaller frustum / tighter; -1 = out / larger frustum / wider).
// Clamps at [0, FRUSTUM_STEPS.length - 1]. Returns the same index when
// clamped so the caller can detect a no-op press without extra state.
export function nextZoomStep(currentIdx, direction) {
  const max = FRUSTUM_STEPS.length - 1;
  return Math.max(0, Math.min(max, currentIdx + direction));
}
