import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  World,
  EDITOR_SPAWN_TILE,
  UNIT_SPEED,
  BUREAU_TILE,
  LEAD_SPAWN_TILE,
  AUTO_PLATE_SENTINEL,
} from '../js/sim/world-state.js';

// Milestone 0.7.1 — Editor unit. Stationary at Bureau-west, speed 0,
// dispatch-rejected. At DEADLINE_FIRE _fireDebrief substitutes its UnitId for
// AUTO_PLATE_SENTINEL on Story.plated_by per ICD-05 v0.4 §Notes (the sentinel
// stays exported as the defensive fallback for a no-Editor world).

function reporter(w) { return w.units.find((u) => u.kind === 'reporter'); }
function photog(w)   { return w.units.find((u) => u.kind === 'photog'); }
function editor(w)   { return w.units.find((u) => u.kind === 'editor'); }

function tickUntilIdle(w, unit, maxSeconds = 30) {
  const dt = 0.05;
  for (let i = 0; i < maxSeconds / dt; i++) {
    w.tick(dt);
    if (unit.state === 'idle') return;
  }
  throw new Error(`${unit.kind} did not reach idle within budget`);
}

function advanceSeconds(w, seconds) {
  const dt = 1 / 30;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) w.tick(dt);
}

function stageVerifiedAtDarkroom(w) {
  const r = reporter(w);
  w.dispatch(r.id, { ...LEAD_SPAWN_TILE });
  tickUntilIdle(w, r);
  w.dispatch(r.id, { x: BUREAU_TILE.x, y: BUREAU_TILE.y - 1 });
  tickUntilIdle(w, r);

  const p = photog(w);
  w.dispatch(p.id, { x: 4, y: 5 });
  tickUntilIdle(w, p);
  w.dispatch(p.id, { x: 6, y: 7 });
  tickUntilIdle(w, p);
}

test('Editor spawns at EDITOR_SPAWN_TILE — idle, kind editor, speed 0', () => {
  const w = new World();
  const e = editor(w);
  assert.ok(e, 'an editor unit must exist at construction');
  assert.equal(e.kind, 'editor');
  assert.equal(e.state, 'idle');
  assert.deepEqual(e.tile, EDITOR_SPAWN_TILE);
  // 0.7.1: stationary — speed 0 in the per-kind table.
  assert.equal(UNIT_SPEED.editor, 0);
});

test('Editor is non-dispatchable (Design Doc §17 "Stationed at the Bureau")', () => {
  const w = new World();
  const e = editor(w);
  // Try to send the Editor somewhere reachable; dispatch should refuse.
  assert.equal(w.dispatch(e.id, { x: 0, y: 0 }), false);
  assert.equal(e.state, 'idle');
  assert.deepEqual(e.tile, EDITOR_SPAWN_TILE, 'Editor must not move');
});

test('Editor surfaces in WorldFrame.units (ICD-01 kind enum)', () => {
  const w = new World();
  const f = w.snapshot();
  const kinds = f.units.map((u) => u.kind).sort();
  assert.deepEqual(kinds, ['editor', 'fixer', 'photog', 'reporter']);
});

test('plated_by carries the Editor UnitId (not AUTO_PLATE_SENTINEL) at print', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  stageVerifiedAtDarkroom(w);
  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);
  const story = w.stories[0];
  assert.equal(story.state, 'printed');
  // 0.7.1: substitution per ICD-05 v0.4 §Notes — the Editor's UnitId fills
  // the slot the sentinel held at 0.5–0.7.0.
  assert.equal(story.plated_by, editor(w).id);
  assert.notEqual(story.plated_by, AUTO_PLATE_SENTINEL);
});

test('Sentinel falls back when no Editor exists (defensive — should not happen at 0.7.1+)', () => {
  // Manually construct the no-Editor world the comment in _fireDebrief
  // describes as the fallback case. This locks the defensive branch.
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  w.units = w.units.filter((u) => u.kind !== 'editor');
  stageVerifiedAtDarkroom(w);
  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);
  assert.equal(w.stories[0].plated_by, AUTO_PLATE_SENTINEL);
});
