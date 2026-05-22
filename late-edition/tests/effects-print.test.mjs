import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, BUREAU_TILE, LEAD_SPAWN_TILE } from '../js/sim/world-state.js';

// Milestone 0.10.2 (audit C-07) — DEADLINE_FIRE emits one `print` FxEvent
// per admitted story. ICD-01 v0.6 §FxEvent: `print` carries `edition: number`
// + `at: Vec3` anchored at the Darkroom.

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

function advanceSeconds(w, seconds) {
  const dt = 1 / 30;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) w.tick(dt);
}

function stageVerified(w) {
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

test('DEADLINE_FIRE emits one print FxEvent per admitted story', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  stageVerified(w);
  // Drain pickup/verify so we read only the print events.
  w.snapshot();

  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);

  const frame = w.snapshot();
  const prints = frame.effects.filter((e) => e.kind === 'print');
  assert.equal(prints.length, 1, 'one print event for the single staged story');
  assert.equal(prints[0].edition, 1, 'print carries the closing edition number');
  assert.equal(typeof prints[0].at.x, 'number');
  assert.equal(typeof prints[0].at.z, 'number');
});

test('no verified stories → no print events at DEADLINE_FIRE', () => {
  const w = new World({ cycle: { editionDurationMs: 5_000, warningOffsetMs: 1_000 } });
  // Do not stage anything; the seeded lead never reaches verified.
  advanceSeconds(w, 6);
  const frame = w.snapshot();
  const prints = frame.effects.filter((e) => e.kind === 'print');
  assert.equal(prints.length, 0);
});
