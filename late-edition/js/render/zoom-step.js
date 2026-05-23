// 1.1.1 (#335) — pure zoom-step ladder shared with tests.
// Renderer.stepZoom uses these to keep the THREE.js-dependent code thin
// and the integer index math testable without spinning up WebGL.
//
// Steps go outermost → innermost; stepZoom(+1) is "zoom in" (smaller
// frustum, tighter view); stepZoom(-1) is "zoom out" (larger frustum,
// wider view). Endpoints clamp silently — see nextZoomStep below.

// 1.3.1 (#playtest-bug-3a): the v1.1.1 range [30, 22, 16, 10] was a 27%
// step at the outermost boundary, which read as imperceptible to the eye
// against the iso angle + fog band. Widen the outer two steps to [36, 24]
// so step 0 → 1 is a noticeable pull-back; inner steps preserve at 16/10
// so the deep-zoom debugging case stays intact. Boot still indexes at
// step 1 — see renderer.js FRUSTUM_CITY (now 24 to match).
export const FRUSTUM_STEPS = [36, 24, 16, 10];

// Compute the next zoom-step index given a current index and a direction
// (+1 = in / smaller frustum / tighter; -1 = out / larger frustum / wider).
// Clamps at [0, FRUSTUM_STEPS.length - 1]. Returns the same index when
// clamped so the caller can detect a no-op press without extra state.
export function nextZoomStep(currentIdx, direction) {
  const max = FRUSTUM_STEPS.length - 1;
  return Math.max(0, Math.min(max, currentIdx + direction));
}
