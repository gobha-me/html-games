import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMs,
  formatEdition,
  pickSelected,
  countByKind,
  tierHistogram,
} from '../js/hud.js';
import { World } from '../js/sim/world-state.js';

// Milestone 0.9 — HudCorkboard projection helpers.
// Rendering is browser-only (jsdom-free here); these tests exercise the
// pure-function helpers that the corkboard regions consume from each
// WorldFrame. Frame-shape integrity stays in tests/world-frame.test.mjs;
// here we lock the projection rules so a regression in the helpers
// shows up before the browser does.

test('formatMs renders MM:SS with two-digit padding and floors negatives', () => {
  assert.equal(formatMs(0), '00:00');
  assert.equal(formatMs(720_000), '12:00');
  assert.equal(formatMs(65_500), '01:05');
  assert.equal(formatMs(-1000), '00:00');
});

test('formatEdition zero-pads to three digits per Design Doc §13 mock', () => {
  assert.equal(formatEdition(1), '№ 001');
  assert.equal(formatEdition(23), '№ 023');
  assert.equal(formatEdition(140), '№ 140');
});

test('pickSelected returns the first unit with selected:true, or null', () => {
  const units = [
    { id: 'u-1', kind: 'reporter', selected: false },
    { id: 'u-2', kind: 'photog',   selected: true  },
    { id: 'u-3', kind: 'fixer',    selected: true  },
  ];
  assert.equal(pickSelected(units).id, 'u-2');
  assert.equal(pickSelected(units.filter((u) => !u.selected)), null);
  assert.equal(pickSelected([]), null);
});

test('countByKind tallies units by kind for the threats projection', () => {
  const units = [
    { kind: 'reporter' }, { kind: 'reporter' },
    { kind: 'goon' }, { kind: 'goon' }, { kind: 'goon' },
    { kind: 'fixer' },
  ];
  assert.equal(countByKind(units, 'goon'), 3);
  assert.equal(countByKind(units, 'reporter'), 2);
  assert.equal(countByKind(units, 'editor'), 0);
});

test('tierHistogram buckets LeadView tiers+flavors with stable empty defaults', () => {
  const leads = [
    { tier: 'whisper',       flavor: 'vice' },
    { tier: 'whisper',       flavor: 'violence' },
    { tier: 'investigation', flavor: 'vice' },
  ];
  const { tiers, flavors } = tierHistogram(leads);
  assert.deepEqual(tiers,   { whisper: 2, investigation: 1, arc: 0 });
  assert.deepEqual(flavors, { vice: 2, violence: 1, money: 0, labor: 0 });
});

test('tierHistogram on an empty leads array returns zeroed buckets', () => {
  const { tiers, flavors } = tierHistogram([]);
  assert.deepEqual(tiers,   { whisper: 0, investigation: 0, arc: 0 });
  assert.deepEqual(flavors, { vice: 0, violence: 0, money: 0, labor: 0 });
});

test('a fresh World snapshot drives the projection helpers without changes', () => {
  // Smoke: the helpers must keep working against the actual WorldFrame the
  // corkboard sees each frame. If snapshot() drops a field the helpers
  // depend on, this case catches it before the renderer does.
  const w = new World();
  const f = w.snapshot();
  assert.equal(pickSelected(f.units), null);
  assert.equal(countByKind(f.units, 'goon'), 0);
  const { tiers } = tierHistogram(f.leads);
  // Fresh World seeds exactly one lead at the NW district (Story 's-1').
  assert.equal(tiers.whisper + tiers.investigation + tiers.arc, f.leads.length);
});
