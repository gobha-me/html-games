import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMs,
  formatEdition,
  pickSelected,
  countByKind,
  tierHistogram,
  renderStoryRow,
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

// 1.1.0 (ICD-10 v0.1.1 §HUD surface) — Story queue row renderer covers the
// archive HOLD chip, arc breadcrumb + branch chips, and Investigation chain
// depth suffix. Renderer is jsdom-free; checks the HTML string output.

test('renderStoryRow: plain verified story renders headline + flavor · district', () => {
  const html = renderStoryRow({
    id: 's-1',
    state: 'verified',
    headline: 'DOCKHAND NAMES FENCE',
    flavor: 'vice',
    tier: 'whisper',
    district: 'docks',
  });
  assert.match(html, /story-row/);
  assert.match(html, /data-story-id="s-1"/);
  assert.match(html, /DOCKHAND NAMES FENCE/);
  assert.match(html, /vice · The Docks/);
  assert.doesNotMatch(html, /is-archived/);
  assert.doesNotMatch(html, /HOLD/);
  assert.doesNotMatch(html, /arc-line/);
  assert.doesNotMatch(html, /Investigation /);
});

test('renderStoryRow: archived story carries the HOLD chip + is-archived class', () => {
  const html = renderStoryRow({
    id: 's-2',
    state: 'archived',
    headline: 'JUDGE TAKES BRIBE',
    flavor: 'money',
    tier: 'investigation',
    district: 'hillside',
  });
  assert.match(html, /is-archived/);
  assert.match(html, /chip is-hold/);
  assert.match(html, /HOLD/);
});

test('renderStoryRow: investigation chain depth appears in the meta line', () => {
  const html = renderStoryRow({
    id: 's-c2',
    state: 'verified',
    headline: 'MAYOR LIES ABOUT MISTRESS',
    flavor: 'money',
    tier: 'investigation',
    district: 'hillside',
    chain_depth: 2,
  });
  assert.match(html, /Investigation 2\/3/);
});

test('renderStoryRow: un-picked arc story renders branch chips with pick-branch action', () => {
  const html = renderStoryRow({
    id: 's-arc-1',
    state: 'verified',
    headline: 'THE WALKOUT — Longshoremen halt the harbor',
    flavor: 'labor',
    tier: 'arc',
    district: 'docks',
    arc_episode_id: 'longshoreman_strike.walkout',
    branch_choices: [{ label: 'bury' }, { label: 'splash' }],
  });
  assert.match(html, /arc-line/);
  assert.match(html, /Arc · Longshoreman Strike/);
  assert.match(html, /data-action="pick-branch"/);
  assert.match(html, /data-story-id="s-arc-1"/);
  assert.match(html, /data-branch-label="bury"/);
  assert.match(html, /data-branch-label="splash"/);
  assert.doesNotMatch(html, /Picked:/);
});

test('renderStoryRow: picked arc story shows the chosen label and hides chips', () => {
  const html = renderStoryRow({
    id: 's-arc-2',
    state: 'verified',
    headline: 'THE WALKOUT — Longshoremen halt the harbor',
    flavor: 'labor',
    tier: 'arc',
    district: 'docks',
    arc_episode_id: 'longshoreman_strike.walkout',
    arc_branch_label: 'splash',
  });
  assert.match(html, /arc-line/);
  assert.match(html, /Picked: splash/);
  assert.doesNotMatch(html, /data-action="pick-branch"/);
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
