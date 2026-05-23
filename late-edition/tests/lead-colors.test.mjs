import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEAD_FLAVOR_HEX, leadColorHex, leadColorInt } from '../js/render/lead-colors.js';

// 1.3.1: lead-flavor colors moved out of the duplicated definitions in
// js/render/renderer.js (LEAD_FLAVOR_COLOR as 0x ints) and js/hud.js
// (MINIMAP_LEAD_COLOR as '#' hex strings). Both callers now read from
// this module so the minimap diamond and the 3D scene diamond render
// the same flavor color.

test('LEAD_FLAVOR_HEX covers the four canonical flavors with #RRGGBB strings', () => {
  for (const flavor of ['vice', 'violence', 'money', 'labor']) {
    assert.match(LEAD_FLAVOR_HEX[flavor], /^#[0-9a-f]{6}$/);
  }
});

test('leadColorHex returns the LEAD_FLAVOR_HEX entry for known flavors', () => {
  assert.equal(leadColorHex('vice'),     LEAD_FLAVOR_HEX.vice);
  assert.equal(leadColorHex('violence'), LEAD_FLAVOR_HEX.violence);
  assert.equal(leadColorHex('money'),    LEAD_FLAVOR_HEX.money);
  assert.equal(leadColorHex('labor'),    LEAD_FLAVOR_HEX.labor);
});

test('leadColorHex returns a default for unknown flavors (no throw)', () => {
  const fallback = leadColorHex('mystery');
  assert.match(fallback, /^#[0-9a-f]{6}$/);
  // The fallback must not collide with the four canonical flavors — that
  // would silently mask new-flavor bugs.
  assert.notEqual(fallback, LEAD_FLAVOR_HEX.vice);
});

test('leadColorInt is the parseInt of leadColorHex (composition lock)', () => {
  for (const flavor of ['vice', 'violence', 'money', 'labor']) {
    const expected = parseInt(LEAD_FLAVOR_HEX[flavor].slice(1), 16);
    assert.equal(leadColorInt(flavor), expected);
  }
});

test('leadColorInt for vice is 0x8a3a4a (lock against silent flavor recolor)', () => {
  // Spot-check one known value so a flavor recolor in one place can't
  // pass the composition test above by accidentally moving in both files.
  assert.equal(leadColorInt('vice'), 0x8a3a4a);
});
