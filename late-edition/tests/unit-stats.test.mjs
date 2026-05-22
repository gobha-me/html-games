import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../js/sim/world-state.js';
import { serialize, deserialize } from '../js/sim/save.js';

// 1.0.1 (ICD-01 v0.6 §UnitView.stats projector · ICD-04 v0.1.3 §UnitSnap.stats)
// — the Reporter trio projector. Reporters carry stats: {nerve, nose, legs};
// other kinds carry no `stats` field on the Unit record, so the projection
// produces `stats: undefined` per ICD-01's contract. Save round-trip mirrors.

test('fresh World reporter UnitView carries stats {nerve, nose, legs}', () => {
  const w = new World();
  const f = w.snapshot();
  const reporter = f.units.find((u) => u.kind === 'reporter');
  assert.ok(reporter, 'reporter must be present at construction');
  assert.equal(typeof reporter.stats, 'object');
  assert.equal(typeof reporter.stats.nerve, 'number');
  assert.equal(typeof reporter.stats.nose, 'number');
  assert.equal(typeof reporter.stats.legs, 'number');
});

test('non-reporter UnitViews do not carry a stats field at Tier-0', () => {
  // ICD-01 v0.6 §UnitView.stats: `{nerve, nose, legs} | undefined` — Photog,
  // Fixer, Editor, Goon project no stats at Tier-0.
  const w = new World();
  const f = w.snapshot();
  for (const u of f.units) {
    if (u.kind === 'reporter') continue;
    assert.ok(!('stats' in u), `${u.kind} UnitView leaked a stats field`);
  }
});

test('save round-trip preserves Reporter stats', () => {
  const w = new World();
  const blob = serialize(w);
  const w2 = deserialize(blob);
  const r1 = w.units.find((u) => u.kind === 'reporter');
  const r2 = w2.units.find((u) => u.kind === 'reporter');
  assert.deepEqual(r2.stats, r1.stats);
});

test('reporter stats object is independent across snapshot reads (no shared reference)', () => {
  // Projection produces a fresh object per snapshot so a renderer mutation
  // doesn't bleed back into sim state.
  const w = new World();
  const f1 = w.snapshot();
  const f2 = w.snapshot();
  const r1 = f1.units.find((u) => u.kind === 'reporter');
  const r2 = f2.units.find((u) => u.kind === 'reporter');
  assert.notEqual(r1.stats, r2.stats, 'snapshot must spread stats per frame');
  r1.stats.nerve = 99;
  const reporterSim = w.units.find((u) => u.kind === 'reporter');
  assert.notEqual(reporterSim.stats.nerve, 99, 'projector must not expose sim reference');
});
