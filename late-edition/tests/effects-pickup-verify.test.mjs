import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, BUREAU_TILE, LEAD_SPAWN_TILE } from '../js/sim/world-state.js';

// Milestone 0.10.2 (audit C-07) — sim emits `pickup` when a reporter arrives
// on a lead tile, and `verify` when a photog drops the held lead at the
// Darkroom. ICD-01 v0.6 §FxEvent: both kinds carry `at: Vec3` + `story_id`
// and live on `WorldFrame.effects` for one drain cycle.

function reporter(w) { return w.units.find((u) => u.kind === 'reporter'); }
function photog(w)   { return w.units.find((u) => u.kind === 'photog'); }

function tickUntilIdle(w, unit, maxSeconds = 30) {
  const dt = 0.05;
  for (let i = 0; i < maxSeconds / dt; i++) {
    w.tick(dt);
    if (unit.state === 'idle') return;
  }
  throw new Error(`${unit.kind} did not reach idle within budget`);
}

test('reporter arriving on lead emits one pickup FxEvent with the correct story_id', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  const r = reporter(w);
  const storyId = w.stories[0].id;

  w.dispatch(r.id, { ...LEAD_SPAWN_TILE });
  tickUntilIdle(w, r);

  const frame = w.snapshot();
  const pickups = frame.effects.filter((e) => e.kind === 'pickup');
  assert.equal(pickups.length, 1, 'one pickup event must fire on reporter arrival');
  assert.equal(pickups[0].story_id, storyId, 'pickup carries the original story_id');
  assert.equal(typeof pickups[0].at.x, 'number');
  assert.equal(typeof pickups[0].at.z, 'number');
  // Anchor at the reporter's tile, which equals LEAD_SPAWN_TILE on arrival.
  // tileToWorld(2,2) → (2*6 - 27, 0, 2*6 - 27) = (-15, 0, -15).
  assert.equal(pickups[0].at.x, -15);
  assert.equal(pickups[0].at.z, -15);
});

test('photog dropping at darkroom emits one verify FxEvent with the correct story_id', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  const r = reporter(w);
  const p = photog(w);
  const storyId = w.stories[0].id;

  // Stage the ferry: reporter → lead → drop at Bureau-adjacent → photog picks up → photog drops at darkroom.
  w.dispatch(r.id, { ...LEAD_SPAWN_TILE });
  tickUntilIdle(w, r);
  w.dispatch(r.id, { x: BUREAU_TILE.x, y: BUREAU_TILE.y - 1 });
  tickUntilIdle(w, r);

  w.dispatch(p.id, { x: 4, y: 5 }); // Bureau-adjacent on the west side
  tickUntilIdle(w, p);
  // Drain the pickup event from the pre-verify segment so the assertion is clean.
  w.snapshot();

  w.dispatch(p.id, { x: 6, y: 7 }); // Darkroom-adjacent
  tickUntilIdle(w, p);

  const frame = w.snapshot();
  const verifies = frame.effects.filter((e) => e.kind === 'verify');
  assert.equal(verifies.length, 1, 'one verify event must fire on darkroom drop');
  assert.equal(verifies[0].story_id, storyId, 'verify carries the original story_id');
  assert.equal(typeof verifies[0].at.x, 'number');
});

test('effects queue drains on snapshot — second snapshot is empty without further events', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  const r = reporter(w);
  w.dispatch(r.id, { ...LEAD_SPAWN_TILE });
  tickUntilIdle(w, r);

  const first = w.snapshot();
  assert.ok(first.effects.length >= 1, 'first snapshot contains at least the pickup');
  const second = w.snapshot();
  assert.equal(second.effects.length, 0, 'second snapshot drains to empty');
});
