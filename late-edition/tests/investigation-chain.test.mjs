// Investigation 3-step chain (ICD-10 v0.1.1 · 1.1.0).
// On `lead → verified` for a tier='investigation' story, the sim spawns a
// successor in the same district with parent_story_id set. Caps at depth 3.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { World, DARKROOM_TILE } from '../js/sim/world-state.js';

// Helper: synthesize a verified-by-photog event. Sets up a story held by a
// photog adjacent to the darkroom, then drives _handlePhotogArrival which
// flips to verified AND fires the chain hook.
function verifyInvestigationLead(w, opts = {}) {
  const photog = w.units.find((u) => u.kind === 'photog');
  const darkroom = w.buildings.find((b) => b.kind === 'darkroom');
  // Park photog adjacent to darkroom (W of it).
  photog.tile = { x: darkroom.tile.x - 1, y: darkroom.tile.y };
  photog.carrying = 'lead';
  const story = {
    id: opts.id ?? `s-test-${Math.random().toString(36).slice(2, 8)}`,
    state: 'lead',
    district: opts.district ?? 'docks',
    flavor: opts.flavor ?? 'labor',
    tier: opts.tier ?? 'investigation',
    truthful: true,
    spawned_at_ms: 0,
    tile: { x: photog.tile.x, y: photog.tile.y },
    picked_up_by: photog.id,
    held_by_building: null,
    headline: opts.headline ?? 'TEST LEAD',
  };
  if (opts.parent_story_id) story.parent_story_id = opts.parent_story_id;
  w.stories.push(story);
  photog.carryingStoryId = story.id;
  w._handlePhotogArrival(photog);
  return story;
}

test('chain: investigation lead → verified spawns a successor with parent_story_id', () => {
  const w = new World();
  const parent = verifyInvestigationLead(w, { id: 's-parent-A' });
  assert.equal(parent.state, 'verified');
  const successor = w.stories.find((s) => s.parent_story_id === parent.id);
  assert.ok(successor, 'successor lead created');
  assert.equal(successor.state, 'lead');
  assert.equal(successor.tier, 'investigation');
  assert.equal(successor.district, parent.district);
});

test('chain: whisper-tier verification does NOT spawn a successor', () => {
  const w = new World();
  const parent = verifyInvestigationLead(w, { id: 's-w-1', tier: 'whisper' });
  const successor = w.stories.find((s) => s.parent_story_id === parent.id);
  assert.equal(successor, undefined, 'no successor for whisper');
});

test('chain: arc-tier verification does NOT spawn an investigation successor', () => {
  const w = new World();
  const parent = verifyInvestigationLead(w, { id: 's-arc-1', tier: 'arc' });
  const successor = w.stories.find((s) => s.parent_story_id === parent.id);
  assert.equal(successor, undefined,
    'arc tier follows the arc-episode branch path, not the investigation chain');
});

test('chain: depth caps at 3 (parent → child → grandchild; no great-grandchild)', () => {
  const w = new World();
  const parent = verifyInvestigationLead(w, { id: 's-p1' });
  const child = w.stories.find((s) => s.parent_story_id === parent.id);
  assert.ok(child);

  // Verify the child. Should spawn grandchild.
  verifyInvestigationLead(w, {
    id: 's-c1',
    parent_story_id: parent.id,
  });
  // _handlePhotogArrival on the new lead — but verifyInvestigationLead
  // creates a NEW lead with id='s-c1' and verifies that one. We want to
  // verify the existing child story instead. Use a direct manipulation.
  const childInPlace = w.stories.find((s) => s.id === child.id);
  // Simulate a fresh verify on the child by re-triggering the chain hook.
  w._maybeSpawnInvestigationFollowup(childInPlace);
  const grandchild = w.stories.find((s) => s.parent_story_id === childInPlace.id);
  assert.ok(grandchild, 'grandchild spawned');

  // Now try to verify the grandchild → should NOT spawn a fourth.
  const before = w.stories.length;
  w._maybeSpawnInvestigationFollowup(grandchild);
  assert.equal(w.stories.length, before, 'no great-grandchild (cap depth 3)');
});

test('chain: successor spawns in the SAME district as the parent', () => {
  const w = new World();
  // Hillside-flavored parent.
  const parent = verifyInvestigationLead(w, { id: 's-hill-1', district: 'hillside' });
  const successor = w.stories.find((s) => s.parent_story_id === parent.id);
  assert.equal(successor.district, 'hillside');
  // Tile is inside hillside spawnRect (x:6..9, y:1..4).
  assert.ok(successor.tile.x >= 6 && successor.tile.x <= 9);
  assert.ok(successor.tile.y >= 1 && successor.tile.y <= 4);
});

test('chain: successor pick is deterministic from parent.id', () => {
  // Two worlds with the same starting state should produce the same
  // successor tile + headline for the same parent.id.
  const w1 = new World();
  const w2 = new World();
  const p1 = verifyInvestigationLead(w1, { id: 's-deterministic' });
  const p2 = verifyInvestigationLead(w2, { id: 's-deterministic' });
  const s1 = w1.stories.find((s) => s.parent_story_id === p1.id);
  const s2 = w2.stories.find((s) => s.parent_story_id === p2.id);
  assert.deepEqual(s1.tile, s2.tile);
  assert.equal(s1.headline, s2.headline);
});
