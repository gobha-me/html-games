import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../js/sim/world-state.js';

// ICD-01 v0.2 — render-only projection rule:
// "no field on a View carries information the renderer doesn't use this frame."
// Snapshot must match the ICD's WorldFrame / View struct field sets exactly.

const FRAME_KEYS = ['cameraTarget', 'buildings', 'units', 'leads', 'rain', 'fog', 'hud', 'effects'];
const BUILDING_VIEW_KEYS = ['id', 'pos', 'kind', 'hp', 'hp_max', 'tier'];
const UNIT_VIEW_KEYS = ['id', 'pos', 'facing', 'kind', 'state', 'selected', 'carrying'];

function keysOf(obj) { return Object.keys(obj).sort(); }

test('snapshot() returns exactly the WorldFrame top-level keys', () => {
  const w = new World();
  const f = w.snapshot();
  assert.deepEqual(keysOf(f), [...FRAME_KEYS].sort());
});

test('BuildingView field set matches ICD-01 v0.2 exactly (no leaks)', () => {
  const w = new World();
  const f = w.snapshot();
  assert.ok(f.buildings.length > 0);
  for (const b of f.buildings) {
    assert.deepEqual(keysOf(b), [...BUILDING_VIEW_KEYS].sort());
    assert.equal(typeof b.id, 'string');
    assert.equal(typeof b.hp, 'number');
    assert.ok([1, 2, 3].includes(b.tier));
  }
});

test('UnitView field set matches ICD-01 v0.2 exactly (no leaks)', () => {
  const w = new World();
  const f = w.snapshot();
  assert.ok(f.units.length > 0);
  for (const u of f.units) {
    assert.deepEqual(keysOf(u), [...UNIT_VIEW_KEYS].sort());
    assert.ok(['idle', 'walking', 'carrying'].includes(u.state));
    assert.equal(typeof u.facing, 'number');
    assert.equal(typeof u.selected, 'boolean');
  }
});

test('snapshot does not expose sim-only fields (path, tile, pathIdx)', () => {
  const w = new World();
  const f = w.snapshot();
  for (const u of f.units) {
    assert.ok(!('path' in u), 'UnitView leaked sim field `path`');
    assert.ok(!('tile' in u), 'UnitView leaked sim field `tile`');
    assert.ok(!('pathIdx' in u), 'UnitView leaked sim field `pathIdx`');
  }
});

test('effects queue is drained on snapshot (lives one frame)', () => {
  const w = new World();
  w.effects.push({ kind: 'flash' });
  const f1 = w.snapshot();
  assert.equal(f1.effects.length, 1);
  const f2 = w.snapshot();
  assert.equal(f2.effects.length, 0);
});

test('fog color matches design doc paper #c8c4bc', () => {
  const w = new World();
  const f = w.snapshot();
  assert.equal(f.fog.color, 0xc8c4bc);
});
