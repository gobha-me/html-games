import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  World,
  ARCHIVE_CAP,
  ARCHIVE_DECAY_EDITIONS,
  DARKROOM_TILE,
} from '../js/sim/world-state.js';
import { serialize, deserialize } from '../js/sim/save.js';

// 1.0.1 (ICD-09 v0.1.1) — Archive UI sim layer. The contract authoring lives
// in icds/ICD-09-archive.md; the live behavior is World.toggleArchive +
// snapshot.frame.stories + the cold-news decay walk in ackDebrief. Tests
// cover the player-gesture rejects, the cap, the decay rule, the ink-budget
// exclusion, and the save round-trip of the new state + field.

function setupVerifiedAtDarkroom(w, story) {
  const darkroom = w.buildings.find((b) => b.kind === 'darkroom');
  story.state = 'verified';
  story.held_by_building = darkroom.id;
  return darkroom;
}

function addStory(w, opts = {}) {
  const id = `s-test-${w.stories.length + 1}`;
  const story = {
    id,
    state: 'verified',
    district: 'docks',
    flavor: 'vice',
    tier: 'whisper',
    truthful: true,
    spawned_at_ms: 0,
    tile: { x: 2, y: 2 },
    picked_up_by: null,
    held_by_building: null,
    headline: `TEST STORY ${id}`,
    ...opts,
  };
  w.stories.push(story);
  return story;
}

test('toggleArchive: verified → archived stamps archived_at_ms and flips state', () => {
  const w = new World();
  setupVerifiedAtDarkroom(w, w.stories[0]);
  w.sim_time_ms = 12_345;
  const res = w.toggleArchive(w.stories[0].id);
  assert.equal(res.ok, true);
  assert.equal(w.stories[0].state, 'archived');
  assert.equal(w.stories[0].archived_at_ms, 12_345);
});

test('toggleArchive: archived → verified clears archived_at_ms', () => {
  const w = new World();
  setupVerifiedAtDarkroom(w, w.stories[0]);
  w.sim_time_ms = 12_345;
  w.toggleArchive(w.stories[0].id);
  const res = w.toggleArchive(w.stories[0].id);
  assert.equal(res.ok, true);
  assert.equal(w.stories[0].state, 'verified');
  assert.equal(w.stories[0].archived_at_ms, undefined);
});

test('toggleArchive: rejects when not at Darkroom', () => {
  const w = new World();
  const story = w.stories[0];
  story.state = 'verified';
  story.held_by_building = null;
  const res = w.toggleArchive(story.id);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'not_at_darkroom');
  assert.equal(story.state, 'verified');
});

test('toggleArchive: rejects unknown id', () => {
  const w = new World();
  const res = w.toggleArchive('s-nope');
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'not_found');
});

test('toggleArchive: rejects when archive is at cap', () => {
  const w = new World();
  const darkroom = w.buildings.find((b) => b.kind === 'darkroom');
  // Fill the archive to the cap with synthetic verified stories.
  for (let i = 0; i < ARCHIVE_CAP; i++) {
    const s = addStory(w, { id: `s-cap-${i}`, held_by_building: darkroom.id });
    const res = w.toggleArchive(s.id);
    assert.equal(res.ok, true);
  }
  // One more verified at the Darkroom — the cap rejects the transition.
  const overflow = addStory(w, { id: 's-overflow', held_by_building: darkroom.id });
  const res = w.toggleArchive(overflow.id);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'cap_full');
  assert.equal(overflow.state, 'verified');
});

test('toggleArchive: rejects when story is in a non-toggleable state (e.g. lead)', () => {
  const w = new World();
  const darkroom = w.buildings.find((b) => b.kind === 'darkroom');
  const story = w.stories[0];
  story.held_by_building = darkroom.id;
  // state stays 'lead' — the at-darkroom check passes but the state check
  // surfaces the rejection reason.
  const res = w.toggleArchive(story.id);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'not_verified');
});

test('snapshot.frame.stories reflects toggleArchive state changes', () => {
  const w = new World();
  setupVerifiedAtDarkroom(w, w.stories[0]);
  let f = w.snapshot();
  assert.equal(f.stories.length, 1);
  assert.equal(f.stories[0].state, 'verified');
  assert.equal(f.hud.resources.archived, 0);

  w.toggleArchive(w.stories[0].id);
  f = w.snapshot();
  assert.equal(f.stories.length, 1);
  assert.equal(f.stories[0].state, 'archived');
  assert.equal(f.hud.resources.archived, 1);
});

test('ink-budget walk excludes archived stories at DEADLINE_FIRE', () => {
  // Two stories at the Darkroom: one verified, one archived. Run a full
  // edition; only the verified one should plate + print.
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  const darkroom = w.buildings.find((b) => b.kind === 'darkroom');
  const a = w.stories[0];
  setupVerifiedAtDarkroom(w, a);
  const b = addStory(w, { id: 's-archive-me', held_by_building: darkroom.id });
  // Archive the second story.
  const archRes = w.toggleArchive(b.id);
  assert.equal(archRes.ok, true);

  // Advance to DEADLINE_FIRE. CycleClock fires DEADLINE_FIRE at remaining<=0.
  const dt = 1 / 30;
  for (let i = 0; i < Math.round(70 / dt); i++) w.tick(dt);

  // After DEADLINE_FIRE, the verified story has plated → printed; the archived
  // one is unchanged (still 'archived' at Darkroom).
  const post = w.stories.find((s) => s.id === a.id);
  const postB = w.stories.find((s) => s.id === b.id);
  assert.equal(post.state, 'printed');
  assert.equal(postB.state, 'archived');
});

test('cold-news decay culls archived stories after ARCHIVE_DECAY_EDITIONS editions', () => {
  // Hand-construct an archived story stamped many editions ago. Use small
  // edition duration to keep the test fast.
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  const darkroom = w.buildings.find((b) => b.kind === 'darkroom');
  const s = addStory(w, { id: 's-decay-me', held_by_building: darkroom.id });
  s.state = 'archived';
  s.archived_at_ms = 0; // edition 1
  s.cash_yield = 100;
  s.heat_yield = 5;

  // Advance the cycle's edition counter directly to (ARCHIVE_DECAY_EDITIONS + 1)
  // — the decay walk culls when editionsInArchive >= ARCHIVE_DECAY_EDITIONS.
  w.cycle.edition = ARCHIVE_DECAY_EDITIONS + 1;
  // Mark a debrief open so ackDebrief proceeds.
  w.debriefOpen = true;
  w._lastSummary = { heat_applied: 0 };
  w.ackDebrief();

  const post = w.stories.find((s2) => s2.id === s.id);
  assert.equal(post.state, 'printed');
  assert.equal(post.cash_yield, 0);
  assert.equal(post.heat_yield, 0);
  assert.equal(post.archived_at_ms, undefined);
});

test('cold-news decay does NOT cull archived stories before the edition cap', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  const darkroom = w.buildings.find((b) => b.kind === 'darkroom');
  const s = addStory(w, { id: 's-young', held_by_building: darkroom.id });
  s.state = 'archived';
  s.archived_at_ms = 0; // edition 1
  // Only 1 edition has elapsed.
  w.cycle.edition = 2;
  w.debriefOpen = true;
  w._lastSummary = { heat_applied: 0 };
  w.ackDebrief();
  const post = w.stories.find((s2) => s2.id === s.id);
  assert.equal(post.state, 'archived');
});

test('save round-trip preserves archived state + archived_at_ms', () => {
  const w = new World();
  setupVerifiedAtDarkroom(w, w.stories[0]);
  w.sim_time_ms = 42_000;
  w.toggleArchive(w.stories[0].id);
  const blob = serialize(w);
  const w2 = deserialize(blob);
  const restored = w2.stories.find((s) => s.id === w.stories[0].id);
  assert.equal(restored.state, 'archived');
  assert.equal(restored.archived_at_ms, 42_000);
});

test('ARCHIVE_CAP and ARCHIVE_DECAY_EDITIONS are exported as named constants', () => {
  // ICD-09 v0.1 §HUD surface — the HUD reads ARCHIVE_CAP for the N/5
  // denominator; tests assert the contract numbers here so the medium-band
  // numbers stay traceable to spec.
  assert.equal(ARCHIVE_CAP, 5);
  assert.equal(ARCHIVE_DECAY_EDITIONS, 10);
});

// Light sanity check that DARKROOM_TILE is still imported here without choking
// the test module — the constants surface is shared with the sim layer.
test('DARKROOM_TILE import is intact', () => {
  assert.equal(typeof DARKROOM_TILE.x, 'number');
  assert.equal(typeof DARKROOM_TILE.y, 'number');
});
