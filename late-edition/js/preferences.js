// Late Edition — player preferences.
//
// 1.3.1: thin localStorage-backed preferences layer. The v1.3.1 PAN_SPEED
// bump (TILE*4 → TILE*10) felt right to the user but they asked for the
// value to be tunable rather than hardcoded. This module is the smallest
// credible scaffold: a single `getPanSpeedMultiplier()` reader, no UI,
// console-tweakable. If more knobs accumulate, a gear-icon settings popover
// can layer on without revisiting the storage surface.
//
// Tweak from DevTools:
//   localStorage.setItem('lateEdition.panSpeedMultiplier', '0.5'); location.reload();
//
// Pure module — never throws, never imports from sim/renderer/HUD. Safe to
// load from node:test (localStorage falls back to the default).

export const PREF_KEY_PAN_SPEED_MULT = 'lateEdition.panSpeedMultiplier';

const PAN_SPEED_MULTIPLIER_DEFAULT = 1.0;
const PAN_SPEED_MULTIPLIER_MIN = 0.1;
const PAN_SPEED_MULTIPLIER_MAX = 10;

// Read a raw string preference. Returns null when localStorage is missing
// (node), inaccessible (sandboxed iframe / disabled storage), or unset.
// Exported for tests + future preference helpers.
export function getRawPref(key) {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch (_e) {
    return null;
  }
}

// Pan-speed multiplier. Applied at velocity-sync time in input.js so a
// localStorage change takes effect on the next pan keypress (no reload
// strictly required, though reload is the documented gesture). Clamps to
// a safe range; invalid / non-finite / negative values fall back to 1.0.
export function getPanSpeedMultiplier() {
  const raw = getRawPref(PREF_KEY_PAN_SPEED_MULT);
  if (raw === null || raw === '') return PAN_SPEED_MULTIPLIER_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return PAN_SPEED_MULTIPLIER_DEFAULT;
  return Math.max(PAN_SPEED_MULTIPLIER_MIN, Math.min(PAN_SPEED_MULTIPLIER_MAX, n));
}
