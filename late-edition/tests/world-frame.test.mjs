import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../js/sim/world-state.js';

// ICD-01 v0.2 — render-only projection rule:
// "no field on a View carries information the renderer doesn't use this frame."
// Snapshot must match the ICD's WorldFrame / View struct field sets exactly.

const FRAME_KEYS = ['cameraTarget', 'buildings', 'units', 'leads', 'rain', 'fog', 'hud', 'effects'];
const BUILDING_VIEW_KEYS = ['id', 'pos', 'kind', 'hp', 'hp_max', 'tier'];
const UNIT_VIEW_KEYS = ['id', 'pos', 'facing', 'kind', 'state', 'selected', 'carrying'];
const LEAD_VIEW_KEYS = ['id', 'pos', 'tier', 'flavor', 'age_ms'];

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

test('frame.buildings includes both Bureau and Darkroom (ICD-01 kind enum)', () => {
  const w = new World();
  const f = w.snapshot();
  const kinds = f.buildings.map((b) => b.kind).sort();
  assert.deepEqual(kinds, ['bureau', 'darkroom']);
});

test('frame.units includes Reporter, Photog, Fixer, and Editor (ICD-01 kind enum)', () => {
  // Milestone 0.7.0 adds the Fixer to the construction roster (defensive unit).
  // Milestone 0.7.1 adds the Editor (stationary at Bureau-west — plating proxy).
  // Goons are spawned by rival RAID_BUREAU intent and only appear once a raid
  // is in flight — they're not part of the construction surface.
  const w = new World();
  const f = w.snapshot();
  const kinds = f.units.map((u) => u.kind).sort();
  assert.deepEqual(kinds, ['editor', 'fixer', 'photog', 'reporter']);
});

test('frame.leads excludes Stories with state !== lead (verified at Darkroom)', () => {
  // Simulate the post-verify resting state by mutating Story directly.
  const w = new World();
  const story = w.stories[0];
  const darkroom = w.buildings.find((b) => b.kind === 'darkroom');
  story.state = 'verified';
  story.held_by_building = darkroom.id;
  const f = w.snapshot();
  assert.equal(f.leads.length, 0);
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
    assert.ok(!('carryingStoryId' in u), 'UnitView leaked sim field `carryingStoryId`');
  }
});

test('LeadView field set matches ICD-01 v0.4 exactly (no leaks)', () => {
  const w = new World();
  const f = w.snapshot();
  assert.ok(f.leads.length > 0, 'expected at least one lead at spawn');
  for (const l of f.leads) {
    assert.deepEqual(keysOf(l), [...LEAD_VIEW_KEYS].sort());
    assert.equal(typeof l.id, 'string');
    assert.ok(['whisper', 'investigation', 'arc'].includes(l.tier));
    assert.ok(['vice', 'violence', 'money', 'labor'].includes(l.flavor));
    assert.equal(typeof l.age_ms, 'number');
  }
});

test('frame.leads excludes Stories held by a building', () => {
  // Simulate the drop-at-bureau end state by mutating the Story directly.
  const w = new World();
  const story = w.stories[0];
  story.held_by_building = w.buildings[0].id;
  const f = w.snapshot();
  assert.equal(f.leads.length, 0);
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
