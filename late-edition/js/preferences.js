// Late Edition — player preferences.
//
// 1.3.1: thin localStorage-backed preferences layer. The v1.3.1 PAN_SPEED
// bump (TILE*4 → TILE*10) felt right to the user but they asked for the
// value to be tunable rather than hardcoded. This module is the smallest
// credible scaffold: a single `getPanSpeedMultiplier()` reader, no UI,
// console-tweakable. If more knobs accumulate, a gear-icon settings popover
// can layer on without revisiting the storage surface.
//
// 1.4.0: gear-icon settings popover lands as planned. setPanSpeedMultiplier
// + channel-mute persistence join the surface. Tweak from DevTools still
// works:
//   localStorage.setItem('lateEdition.panSpeedMultiplier', '0.5'); location.reload();
//
// Pure module — never throws, never imports from sim/renderer/HUD. Safe to
// load from node:test (localStorage falls back to the default).

export const PREF_KEY_PAN_SPEED_MULT = 'lateEdition.panSpeedMultiplier';
// 1.4.0: one localStorage key per channel + one master key. The master key
// uses the literal string 'master' rather than a separate constant so the
// keyFor helper is uniform; channel ids live in audio-bus.js's AUDIO_CHANNELS.
export const PREF_KEY_AUDIO_MUTED_PREFIX = 'lateEdition.audio.muted.';

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

// Write a raw string preference. Silent no-op when localStorage is missing
// or throws (private-mode quota, disabled storage). Mirrors getRawPref's
// fail-safe stance so callers don't need to wrap every set in try/catch.
function setRawPref(key, value) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch (_e) {
    // Quota / SecurityError — drop silently. The in-memory state still
    // applies for the rest of the session; persistence is best-effort.
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

// 1.4.0: persist the multiplier from the settings popover slider. Clamps
// at write time to the same range the getter clamps on read; rejects
// non-finite / non-positive without writing (keeps storage clean).
export function setPanSpeedMultiplier(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return;
  const clamped = Math.max(PAN_SPEED_MULTIPLIER_MIN, Math.min(PAN_SPEED_MULTIPLIER_MAX, n));
  setRawPref(PREF_KEY_PAN_SPEED_MULT, String(clamped));
}

// 1.4.0: channel-mute persistence backing the settings popover toggles.
// channel === undefined → master mute (key 'lateEdition.audio.muted.master').
// channel === 'sfx' / 'amb' / 'mus' / 'vo' → per-channel mute.
// Both reads default to false (audible) on missing / garbage storage so a
// fresh install never lands muted by accident.
function audioMuteKey(channel) {
  return PREF_KEY_AUDIO_MUTED_PREFIX + (channel === undefined ? 'master' : channel);
}

export function getChannelMuted(channel) {
  const raw = getRawPref(audioMuteKey(channel));
  return raw === 'true';
}

export function setChannelMuted(channel, muted) {
  setRawPref(audioMuteKey(channel), muted ? 'true' : 'false');
}
