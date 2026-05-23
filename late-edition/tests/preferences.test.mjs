import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  PREF_KEY_PAN_SPEED_MULT,
  PREF_KEY_AUDIO_MUTED_PREFIX,
  getRawPref,
  getPanSpeedMultiplier,
  setPanSpeedMultiplier,
  getChannelMuted,
  setChannelMuted,
} from '../js/preferences.js';

// 1.3.1: player-preferences module. The PAN_SPEED bump in v1.3.1 felt
// right but the user asked for it to be tunable; this is the smallest
// credible scaffold (one knob, console-tweakable, no UI). Tests cover
// the storage absence/presence/garbage paths and the clamp range.

// Stub localStorage between tests so each case starts clean.
beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
});

afterEach(() => {
  delete globalThis.localStorage;
});

test('getRawPref returns null when key is absent', () => {
  assert.equal(getRawPref('absent.key'), null);
});

test('getRawPref returns the stored value when present', () => {
  localStorage.setItem('foo.bar', 'baz');
  assert.equal(getRawPref('foo.bar'), 'baz');
});

test('getRawPref returns null when localStorage is undefined (node default)', () => {
  delete globalThis.localStorage;
  assert.equal(getRawPref('anything'), null);
});

test('getPanSpeedMultiplier defaults to 1.0 with no localStorage entry', () => {
  assert.equal(getPanSpeedMultiplier(), 1.0);
});

test('getPanSpeedMultiplier returns the stored numeric value when set', () => {
  localStorage.setItem(PREF_KEY_PAN_SPEED_MULT, '0.5');
  assert.equal(getPanSpeedMultiplier(), 0.5);
  localStorage.setItem(PREF_KEY_PAN_SPEED_MULT, '2.5');
  assert.equal(getPanSpeedMultiplier(), 2.5);
});

test('getPanSpeedMultiplier falls back to 1.0 on garbage / non-numeric / NaN input', () => {
  localStorage.setItem(PREF_KEY_PAN_SPEED_MULT, 'not-a-number');
  assert.equal(getPanSpeedMultiplier(), 1.0);
  localStorage.setItem(PREF_KEY_PAN_SPEED_MULT, '');
  assert.equal(getPanSpeedMultiplier(), 1.0);
  localStorage.setItem(PREF_KEY_PAN_SPEED_MULT, 'NaN');
  assert.equal(getPanSpeedMultiplier(), 1.0);
});

test('getPanSpeedMultiplier falls back to 1.0 on zero / negative input', () => {
  localStorage.setItem(PREF_KEY_PAN_SPEED_MULT, '0');
  assert.equal(getPanSpeedMultiplier(), 1.0);
  localStorage.setItem(PREF_KEY_PAN_SPEED_MULT, '-1');
  assert.equal(getPanSpeedMultiplier(), 1.0);
});

test('getPanSpeedMultiplier clamps absurdly large values to a safe maximum', () => {
  localStorage.setItem(PREF_KEY_PAN_SPEED_MULT, '1000');
  const v = getPanSpeedMultiplier();
  // Don't lock the exact clamp value (subject to tuning) — just lock that
  // the function doesn't return a thousand. 100 is generous; the actual
  // clamp in the module is tighter.
  assert.ok(v < 100, `expected clamped value, got ${v}`);
  assert.ok(v >= 1.0, `clamp should still be at least the default, got ${v}`);
});

test('getPanSpeedMultiplier clamps absurdly small values to a safe minimum', () => {
  localStorage.setItem(PREF_KEY_PAN_SPEED_MULT, '0.00001');
  const v = getPanSpeedMultiplier();
  // Lower bound prevents "pan barely moves" footgun. Generous upper bound
  // here — actual clamp is tighter; this just locks the property.
  assert.ok(v >= 0.05, `expected clamped value, got ${v}`);
  assert.ok(v <= 1.0, `clamp should not exceed default for sub-default input, got ${v}`);
});

test('PREF_KEY_PAN_SPEED_MULT is the canonical key string (lock against rename)', () => {
  // Players will hard-code this in DevTools; renaming silently breaks every
  // saved tweak. Pin the key explicitly.
  assert.equal(PREF_KEY_PAN_SPEED_MULT, 'lateEdition.panSpeedMultiplier');
});

// 1.4.0 — settings popover writers. The slider drives setPanSpeedMultiplier
// per input event; the channel toggles drive setChannelMuted on click.

test('setPanSpeedMultiplier writes the clamped value to localStorage', () => {
  setPanSpeedMultiplier(1.7);
  assert.equal(localStorage.getItem(PREF_KEY_PAN_SPEED_MULT), '1.7');
  assert.equal(getPanSpeedMultiplier(), 1.7);
});

test('setPanSpeedMultiplier clamps absurdly large values before writing', () => {
  setPanSpeedMultiplier(1000);
  const stored = Number(localStorage.getItem(PREF_KEY_PAN_SPEED_MULT));
  assert.ok(stored < 100, `expected clamped value, got ${stored}`);
  assert.ok(stored >= 1, `clamp should be at least the default, got ${stored}`);
});

test('setPanSpeedMultiplier ignores garbage / non-finite / non-positive input', () => {
  localStorage.setItem(PREF_KEY_PAN_SPEED_MULT, '1.5');
  setPanSpeedMultiplier('not-a-number');
  setPanSpeedMultiplier(NaN);
  setPanSpeedMultiplier(0);
  setPanSpeedMultiplier(-2);
  assert.equal(localStorage.getItem(PREF_KEY_PAN_SPEED_MULT), '1.5');
});

test('PREF_KEY_AUDIO_MUTED_PREFIX is the canonical key prefix (lock against rename)', () => {
  assert.equal(PREF_KEY_AUDIO_MUTED_PREFIX, 'lateEdition.audio.muted.');
});

test('getChannelMuted defaults to false (audible) on missing storage', () => {
  assert.equal(getChannelMuted(), false);
  assert.equal(getChannelMuted('sfx'), false);
  assert.equal(getChannelMuted('amb'), false);
});

test('setChannelMuted / getChannelMuted round-trip for the master channel (no channel arg)', () => {
  setChannelMuted(undefined, true);
  assert.equal(getChannelMuted(), true);
  assert.equal(localStorage.getItem('lateEdition.audio.muted.master'), 'true');
  setChannelMuted(undefined, false);
  assert.equal(getChannelMuted(), false);
  assert.equal(localStorage.getItem('lateEdition.audio.muted.master'), 'false');
});

test('setChannelMuted / getChannelMuted round-trip per channel without cross-talk', () => {
  setChannelMuted('sfx', true);
  setChannelMuted('amb', false);
  setChannelMuted('mus', true);
  assert.equal(getChannelMuted('sfx'), true);
  assert.equal(getChannelMuted('amb'), false);
  assert.equal(getChannelMuted('mus'), true);
  assert.equal(getChannelMuted('vo'),  false, 'untouched channel stays audible');
  assert.equal(getChannelMuted(),      false, 'master untouched by per-channel writes');
});

test('getChannelMuted treats non-"true" stored values as false (defensive read)', () => {
  localStorage.setItem('lateEdition.audio.muted.sfx', 'garbage');
  assert.equal(getChannelMuted('sfx'), false);
  localStorage.setItem('lateEdition.audio.muted.sfx', '1');  // truthy but not 'true'
  assert.equal(getChannelMuted('sfx'), false);
  localStorage.setItem('lateEdition.audio.muted.sfx', '');
  assert.equal(getChannelMuted('sfx'), false);
});
