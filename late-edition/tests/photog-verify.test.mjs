import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, BUREAU_TILE, DARKROOM_TILE, LEAD_SPAWN_TILE } from '../js/sim/world-state.js';

// ICD-05 v0.2 row 3 — milestone 0.4 ferry: photog picks a held lead at
// Bureau, walks to Darkroom, drops with state transition lead → verified.
// Load-bearing: Story.id stays stable across the verify transition.

function reporter(w) { return w.units.find((u) => u.kind === 'reporter'); }
function photog(w)   { return w.units.find((u) => u.kind === 'photog'); }
function bureau(w)   { return w.buildings.find((b) => b.kind === 'bureau'); }
function darkroom(w) { return w.buildings.find((b) => b.kind === 'darkroom'); }

function tickUntilIdle(w, unit, maxSeconds = 30) {
  const dt = 0.05;
  for (let i = 0; i < maxSeconds / dt; i++) {
    w.tick(dt);
    if (unit.state === 'idle') return;
  }
  throw new Error(`${unit.kind} did not reach idle within budget`);
}

// Drives the 0.3 leg so a lead is held at the Bureau, ready for the photog.
function stageBureauHeldLead(w) {
  const r = reporter(w);
  w.dispatch(r.id, { ...LEAD_SPAWN_TILE });
  tickUntilIdle(w, r);
  w.dispatch(r.id, { x: BUREAU_TILE.x, y: BUREAU_TILE.y - 1 });
  tickUntilIdle(w, r);
}

test('Photog spawns at tile (5,6) — idle, empty-handed, kind photog', () => {
  const w = new World();
  const p = photog(w);
  assert.ok(p, 'a photog unit must exist at construction');
  assert.equal(p.kind, 'photog');
  assert.equal(p.state, 'idle');
  assert.equal(p.carrying, null);
  assert.equal(p.carryingStoryId, null);
  assert.deepEqual(p.tile, { x: 5, y: 6 });
});

test('Darkroom building is present alongside Bureau', () => {
  const w = new World();
  const d = darkroom(w);
  const b = bureau(w);
  assert.ok(d, 'a darkroom building must exist');
  assert.equal(d.kind, 'darkroom');
  assert.deepEqual(d.tile, DARKROOM_TILE);
  assert.ok(b && b.id !== d.id, 'Bureau and Darkroom are distinct entities');
});

test('Photog adjacent to Bureau picks up the Bureau-held lead', () => {
  const w = new World();
  stageBureauHeldLead(w);

  const p = photog(w);
  const story = w.stories[0];
  const storyId = story.id;
  // Sanity: 0.3 leg put the lead on the Bureau.
  assert.equal(story.held_by_building, bureau(w).id);
  assert.equal(story.state, 'lead');

  // Dispatch photog to a Bureau-adjacent tile (its spawn (5,6) already qualifies,
  // but pathing from there is a zero-length walk; use (4,5) instead to exercise A*).
  assert.equal(w.dispatch(p.id, { x: 4, y: 5 }), true);
  tickUntilIdle(w, p);

  assert.equal(p.carrying, 'lead');
  assert.equal(p.carryingStoryId, storyId);
  assert.equal(p.state, 'idle');

  assert.equal(story.id, storyId, 'Story id must not change on photog pickup');
  assert.equal(story.state, 'lead', 'pickup does not flip the state — drop does');
  assert.equal(story.picked_up_by, p.id);
  assert.equal(story.held_by_building, null, 'held_by_building clears on pickup');

  const f = w.snapshot();
  assert.equal(f.leads.length, 0, 'in-flight lead stays out of frame.leads');
  assert.equal(f.units.find((u) => u.id === p.id).carrying, 'lead');
});

test('Photog arriving adjacent to Darkroom drops with lead → verified transition', () => {
  const w = new World();
  stageBureauHeldLead(w);

  const p = photog(w);
  const d = darkroom(w);
  const storyId = w.stories[0].id;

  // Photog pickup leg.
  w.dispatch(p.id, { x: 4, y: 5 });
  tickUntilIdle(w, p);
  assert.equal(p.carrying, 'lead');

  // Drop leg: Darkroom is at (7,7); (6,7) is adjacent and walkable.
  assert.equal(w.dispatch(p.id, { x: 6, y: 7 }), true);
  tickUntilIdle(w, p);

  assert.deepEqual(p.tile, { x: 6, y: 7 });
  assert.equal(p.carrying, null);
  assert.equal(p.carryingStoryId, null);
  assert.equal(p.state, 'idle');

  const story = w.stories[0];
  assert.equal(story.id, storyId, 'Story id must not change on verify transition');
  assert.equal(story.state, 'verified', 'state flips to verified on photog drop');
  assert.equal(story.verified_by, p.id);
  assert.equal(story.held_by_building, d.id);
  assert.equal(story.picked_up_by, null);
});

test('Verified Story stays out of frame.leads (state-filter excludes it)', () => {
  const w = new World();
  stageBureauHeldLead(w);
  const p = photog(w);
  w.dispatch(p.id, { x: 4, y: 5 });
  tickUntilIdle(w, p);
  w.dispatch(p.id, { x: 6, y: 7 });
  tickUntilIdle(w, p);

  assert.equal(w.stories[0].state, 'verified');
  const f = w.snapshot();
  assert.equal(f.leads.length, 0, 'verified Story must not appear as a LeadView');
});

test('Photog at Bureau-adjacent does nothing while the lead is still on the ground', () => {
  // Before the reporter ferries it home, the lead is at (2,2) — not on the Bureau.
  // A photog walking up to the Bureau must not snag thin air.
  const w = new World();
  const p = photog(w);

  // Walk photog from (5,6) to (4,5) — adjacent to Bureau but Bureau holds nothing yet.
  assert.equal(w.dispatch(p.id, { x: 4, y: 5 }), true);
  tickUntilIdle(w, p);

  assert.equal(p.carrying, null, 'photog must not pick up if Bureau holds no lead');
  assert.equal(w.stories[0].picked_up_by, null);
  assert.equal(w.stories[0].held_by_building, null, 'lead is still on the ground');
});

test('Photog dispatch surface is unchanged — no Intent kind added (ICD-02 untouched)', () => {
  // Mirrors story-pickup.test.mjs:88 — verify/drop are sim-internal arrival
  // consequences, not new dispatch verbs.
  const w = new World();
  stageBureauHeldLead(w);
  const p = photog(w);

  // Dispatch to a tile two short of Darkroom (carrying) — no drop should fire.
  w.dispatch(p.id, { x: 4, y: 5 });
  tickUntilIdle(w, p);
  assert.equal(p.carrying, 'lead');
  w.dispatch(p.id, { x: 5, y: 7 }); // two tiles from darkroom (Manhattan 3)
  tickUntilIdle(w, p);

  assert.equal(p.carrying, 'lead', 'photog still carrying — not close enough to Darkroom');
  assert.equal(w.stories[0].state, 'lead', 'no verify transition fired');
});
