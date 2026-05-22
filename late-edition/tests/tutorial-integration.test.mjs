import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../js/sim/world-state.js';
import { currentTutorialBeat } from '../js/sim/tutorial.js';

// 0.10.1 integration: tutorial-beat derivation against a real World snapshot.
// Confirms the projection fields the tutorial reads (hud.edition, hud.deadline_ms,
// hud.resources.stories, units[].kind/.carrying) are present and stable across
// realistic state transitions — fresh construct, mid-carry, post-verify.

test('fresh World → fresh snapshot derives send-reporter', () => {
  const w = new World();
  const frame = w.snapshot();
  assert.equal(frame.hud.edition, 1, 'fresh world starts at edition 1');
  assert.equal(currentTutorialBeat(frame), 'send-reporter');
});

test('reporter carrying a lead → verify', () => {
  const w = new World();
  // Force a reporter into the carrying state — the simulated drop path
  // requires walking, but we only need the projection shape here.
  const reporter = w.units.find((u) => u.kind === 'reporter');
  assert.ok(reporter, 'fresh World has a reporter unit');
  reporter.carrying = 'lead';
  assert.equal(currentTutorialBeat(w.snapshot()), 'verify');
});

test('verified story at darkroom (no reporter carrying) → plate', () => {
  const w = new World();
  // Flip the starter lead to verified state — simulating a successful
  // drop. The Darkroom existence + held_by_building wiring isn't needed
  // for the tutorial projection (stories count is derived in snapshot()).
  const story = w.stories[0];
  story.state = 'verified';
  const frame = w.snapshot();
  assert.equal(frame.hud.resources.stories, 1, 'verified counts toward stories');
  assert.equal(currentTutorialBeat(frame), 'plate');
});
