import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../js/sim/world-state.js';

// ICD-01 v0.6 (PRE-0.10 paper) — render-only projection rule:
// "no field on a View carries information the renderer doesn't use this frame."
// Snapshot must match the ICD's WorldFrame / View struct field sets exactly.
// v0.6 adds: WorldFrame.rivals · LeadView.district · FxEvent union (effects
// shape stays the same — drained queue, kind+payload entries).
// v0.6.5 (1.0.1) adds: WorldFrame.stories (per-row Story queue projection)
// and UnitView.stats (Reporter trio; undefined for non-Reporter kinds).

const FRAME_KEYS = ['cameraTarget', 'buildings', 'units', 'leads', 'stories', 'rivals', 'rain', 'fog', 'hud', 'effects'];
const BUILDING_VIEW_KEYS = ['id', 'pos', 'kind', 'hp', 'hp_max', 'tier'];
const UNIT_VIEW_CORE_KEYS = ['id', 'pos', 'facing', 'kind', 'state', 'selected', 'carrying'];
const LEAD_VIEW_KEYS = ['id', 'pos', 'tier', 'flavor', 'district', 'age_ms'];
const STORY_QUEUE_VIEW_KEYS = ['id', 'state', 'headline', 'flavor', 'tier', 'district'];

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

test('frame.buildings includes Bureau, Branch Bureau, Darkroom, Switchboard (ICD-01 v0.6.4 kind enum)', () => {
  // 0.10.0 (G-01): Branch Bureau is the third construction-time building.
  // It covers the Hillside district (districts.js) and lets reporters drop
  // their leads at either bureau-family building.
  // 1.0.0 (ICD-08): Switchboard is the fourth — intel-defense building
  // gating goon visibility (see _isUnitVisible / tests/switchboard.test.mjs).
  const w = new World();
  const f = w.snapshot();
  const kinds = f.buildings.map((b) => b.kind).sort();
  assert.deepEqual(kinds, ['branch_bureau', 'bureau', 'darkroom', 'switchboard']);
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

test('UnitView field set matches ICD-01 v0.6.5 exactly (core + optional stats)', () => {
  // 1.0.1 (ICD-01 v0.6 §UnitView.stats projector): the Reporter trio is the
  // only optional UnitView field at Tier-0. Every other kind carries exactly
  // the v0.2 core set.
  const w = new World();
  const f = w.snapshot();
  assert.ok(f.units.length > 0);
  for (const u of f.units) {
    const expected = u.kind === 'reporter'
      ? [...UNIT_VIEW_CORE_KEYS, 'stats'].sort()
      : [...UNIT_VIEW_CORE_KEYS].sort();
    assert.deepEqual(keysOf(u), expected);
    assert.ok(['idle', 'walking', 'carrying'].includes(u.state));
    assert.equal(typeof u.facing, 'number');
    assert.equal(typeof u.selected, 'boolean');
    if (u.kind === 'reporter') {
      assert.equal(typeof u.stats.nerve, 'number');
      assert.equal(typeof u.stats.nose, 'number');
      assert.equal(typeof u.stats.legs, 'number');
    }
  }
});

test('frame.stories is empty in a fresh World (no verified+ stories at construction)', () => {
  const w = new World();
  const f = w.snapshot();
  assert.deepEqual(f.stories, []);
});

test('frame.stories captures verified and archived held at Darkroom (ICD-01 v0.6.5)', () => {
  const w = new World();
  const darkroom = w.buildings.find((b) => b.kind === 'darkroom');
  // Verify the starter story in place, then archive it.
  w.stories[0].state = 'verified';
  w.stories[0].held_by_building = darkroom.id;
  let f = w.snapshot();
  assert.equal(f.stories.length, 1);
  assert.equal(f.stories[0].state, 'verified');
  for (const row of f.stories) {
    assert.deepEqual(keysOf(row), [...STORY_QUEUE_VIEW_KEYS].sort());
  }
  const res = w.toggleArchive(w.stories[0].id);
  assert.equal(res.ok, true);
  f = w.snapshot();
  assert.equal(f.stories.length, 1);
  assert.equal(f.stories[0].state, 'archived');
  assert.equal(f.hud.resources.archived, 1);
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

test('LeadView field set matches ICD-01 v0.6 exactly (no leaks)', () => {
  const w = new World();
  const f = w.snapshot();
  assert.ok(f.leads.length > 0, 'expected at least one lead at spawn');
  for (const l of f.leads) {
    assert.deepEqual(keysOf(l), [...LEAD_VIEW_KEYS].sort());
    assert.equal(typeof l.id, 'string');
    assert.ok(['whisper', 'investigation', 'arc'].includes(l.tier));
    assert.ok(['vice', 'violence', 'money', 'labor'].includes(l.flavor));
    assert.equal(typeof l.age_ms, 'number');
    // ICD-01 v0.6 line 131 — DistrictId is one of the authored ids in
    // districts.js (Tier-0 ships docks + hillside).
    assert.ok(['docks', 'hillside'].includes(l.district));
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
