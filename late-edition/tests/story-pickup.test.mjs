import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, LEAD_SPAWN_TILE } from '../js/sim/world-state.js';

// ICD-05 v0.2 + ICD-01 v0.4 — milestone 0.3 pickup / return-to-bureau loop.
// Load-bearing commitment: the same Story.id flows end-to-end (ICD-05 Purpose).

function tickUntilIdle(w, maxSeconds = 30) {
  const dt = 0.05;
  for (let i = 0; i < maxSeconds / dt; i++) {
    w.tick(dt);
    if (w.units[0].state === 'idle') return;
  }
  throw new Error('reporter did not reach idle within budget');
}

test('one Story spawns in lead state at the district tile', () => {
  const w = new World();
  assert.equal(w.stories.length, 1);
  const s = w.stories[0];
  assert.equal(s.state, 'lead');
  assert.equal(s.picked_up_by, null);
  assert.equal(s.held_by_building, null);
  assert.deepEqual(s.tile, LEAD_SPAWN_TILE);
});

test('initial frame.leads exposes the LeadView', () => {
  const w = new World();
  const f = w.snapshot();
  assert.equal(f.leads.length, 1);
  assert.equal(f.leads[0].id, w.stories[0].id);
});

test('reporter arrival at lead tile picks it up — same id flows through', () => {
  const w = new World();
  const r = w.units[0];
  const storyIdAtSpawn = w.stories[0].id;

  assert.equal(w.dispatch(r.id, { ...LEAD_SPAWN_TILE }), true);
  tickUntilIdle(w);

  assert.deepEqual(r.tile, LEAD_SPAWN_TILE);
  assert.equal(r.carrying, 'lead');
  assert.equal(r.carryingStoryId, storyIdAtSpawn);
  assert.equal(r.state, 'idle');

  const story = w.stories[0];
  assert.equal(story.id, storyIdAtSpawn, 'Story id must not change on pickup');
  assert.equal(story.state, 'lead');
  assert.equal(story.picked_up_by, r.id);
  assert.equal(story.held_by_building, null);

  const f = w.snapshot();
  assert.equal(f.leads.length, 0, 'picked-up lead leaves frame.leads');
  assert.equal(f.units[0].carrying, 'lead', 'carrying surfaces on UnitView');
});

test('carrying reporter arriving adjacent to Bureau drops via held_by_building', () => {
  const w = new World();
  const r = w.units[0];
  const storyId = w.stories[0].id;
  const bureauId = w.buildings[0].id;

  w.dispatch(r.id, { ...LEAD_SPAWN_TILE });
  tickUntilIdle(w);
  assert.equal(r.carrying, 'lead');

  // Spawn tile (5,4) is adjacent to Bureau (5,5) — dispatch the reporter home.
  assert.equal(w.dispatch(r.id, { x: 5, y: 4 }), true);
  tickUntilIdle(w);

  assert.deepEqual(r.tile, { x: 5, y: 4 });
  assert.equal(r.carrying, null);
  assert.equal(r.carryingStoryId, null);
  assert.equal(r.state, 'idle');

  const story = w.stories[0];
  assert.equal(story.id, storyId, 'Story id must not change on drop');
  assert.equal(story.state, 'lead', 'state stays lead — no 0.3 transition out');
  assert.equal(story.picked_up_by, null);
  assert.equal(story.held_by_building, bureauId);

  const f = w.snapshot();
  assert.equal(f.leads.length, 0, 'held-at-bureau lead stays out of frame.leads');
  assert.equal(f.units[0].carrying, null);
});

test('pickup is auto on arrival — no Intent kind added to dispatch surface', () => {
  // ICD-02 (intent kinds) was not amended for 0.3; pickup is a sim-internal
  // consequence of arrival, not a new dispatch verb.
  const w = new World();
  const r = w.units[0];
  // Dispatch one tile short of the lead and verify no pickup happens.
  w.dispatch(r.id, { x: 3, y: 2 });
  tickUntilIdle(w);
  assert.equal(r.carrying, null);
  assert.equal(w.stories[0].picked_up_by, null);
});
