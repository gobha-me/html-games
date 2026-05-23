import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../js/sim/world-state.js';

// 1.5.0 (ICD-02 v0.3.4 §Herald §PUNISH body). World reconciles
// FILE_STORY { tier:'investigation', source:'herald' } by flipping the
// oldest queued investigation story in the nominated district to
// scooped=true. A scooped story is invisible to Reporter pickup, blocked
// from plating, and surfaces in WorldFrame.stories with `scooped: true`.

function getHerald(w) { return w.rivals.find((r) => r.id === 'herald'); }
function getDarkroom(w) { return w.buildings.find((b) => b.kind === 'darkroom'); }
function getBureau(w) { return w.buildings.find((b) => b.kind === 'bureau'); }

function makeInvestigationLead(w, district, overrides = {}) {
  const story = {
    id: `s-${Math.random().toString(36).slice(2, 8)}`,
    state: 'lead',
    district,
    flavor: 'vice',
    tier: 'investigation',
    truthful: true,
    spawned_at_ms: w.sim_time_ms,
    tile: { x: 2, y: 2 },
    picked_up_by: null,
    held_by_building: null,
    headline: 'INVESTIGATION HITS WIRE',
    ...overrides,
  };
  w.stories.push(story);
  return story;
}

test('FILE_STORY reconciler flips the oldest matching investigation story to scooped', () => {
  const w = new World();
  const older = makeInvestigationLead(w, 'docks', { spawned_at_ms: 1000 });
  const newer = makeInvestigationLead(w, 'docks', { spawned_at_ms: 2000 });
  const herald = getHerald(w);
  w._reconcileIntent(herald, {
    kind: 'FILE_STORY', district: 'docks', tier: 'investigation', source: 'herald',
  });
  assert.equal(older.scooped, true, 'oldest (first push) wins the scoop');
  assert.equal(newer.scooped, undefined, 'newer story stays untouched');
});

test('FILE_STORY reconciler filters by district', () => {
  const w = new World();
  const docksLead = makeInvestigationLead(w, 'docks');
  const hillsideLead = makeInvestigationLead(w, 'hillside');
  const herald = getHerald(w);
  w._reconcileIntent(herald, {
    kind: 'FILE_STORY', district: 'hillside', tier: 'investigation', source: 'herald',
  });
  assert.equal(docksLead.scooped, undefined);
  assert.equal(hillsideLead.scooped, true);
});

test('FILE_STORY reconciler matches verified-state stories at the Darkroom', () => {
  const w = new World();
  const darkroom = getDarkroom(w);
  const verifiedStory = makeInvestigationLead(w, 'docks', {
    state: 'verified',
    held_by_building: darkroom.id,
  });
  const herald = getHerald(w);
  w._reconcileIntent(herald, {
    kind: 'FILE_STORY', district: 'docks', tier: 'investigation', source: 'herald',
  });
  assert.equal(verifiedStory.scooped, true);
});

test('FILE_STORY reconciler skips plated / printed / archived stories', () => {
  const w = new World();
  const plated = makeInvestigationLead(w, 'docks', { state: 'plated' });
  const printed = makeInvestigationLead(w, 'docks', { state: 'printed' });
  const archived = makeInvestigationLead(w, 'docks', { state: 'archived' });
  const herald = getHerald(w);
  w._reconcileIntent(herald, {
    kind: 'FILE_STORY', district: 'docks', tier: 'investigation', source: 'herald',
  });
  assert.equal(plated.scooped, undefined);
  assert.equal(printed.scooped, undefined);
  assert.equal(archived.scooped, undefined);
});

test('FILE_STORY reconciler is silent no-op when no target story exists (dry scoop)', () => {
  const w = new World();
  const herald = getHerald(w);
  // No investigation-tier stories in 'hillside' on a fresh world.
  w._reconcileIntent(herald, {
    kind: 'FILE_STORY', district: 'hillside', tier: 'investigation', source: 'herald',
  });
  // Reconciler pushes a herald_scoop_dry event for the digest.
  const ev = w._pendingRivalEvents.find((e) => e.kind === 'herald_scoop_dry');
  assert.ok(ev, 'reconciler should record a dry-scoop event');
});

test('FILE_STORY reconciler skips non-herald sources (defensive)', () => {
  const w = new World();
  const lead = makeInvestigationLead(w, 'docks');
  const herald = getHerald(w);
  w._reconcileIntent(herald, {
    kind: 'FILE_STORY', district: 'docks', tier: 'investigation', source: 'evening_star',
  });
  assert.equal(lead.scooped, undefined, 'non-herald FILE_STORY does not scoop yet (Tier-1.x)');
});

test('Scooped lead — Reporter auto-pickup skips it', () => {
  const w = new World();
  // Place a reporter at the lead tile.
  const reporter = w.units.find((u) => u.kind === 'reporter');
  const tile = { x: 3, y: 3 };
  reporter.tile = { ...tile };
  const lead = makeInvestigationLead(w, 'docks', { tile: { ...tile } });
  // Scoop the lead.
  lead.scooped = true;
  // Drive arrival handler.
  reporter.carrying = null;
  w._handleReporterArrival(reporter);
  assert.equal(reporter.carrying, null, 'scooped lead must not be auto-picked');
});

test('Scooped verified story — plating gate skips it at _fireDebrief', () => {
  const w = new World();
  w.resources.ink = 100;
  const darkroom = getDarkroom(w);
  const story = makeInvestigationLead(w, 'docks', {
    state: 'verified',
    held_by_building: darkroom.id,
    scooped: true,
  });
  w._fireDebrief();
  assert.equal(story.state, 'verified', 'scooped story must NOT plate');
  assert.notEqual(story.state, 'printed');
});

test('Non-scooped verified story still plates normally (regression guard)', () => {
  const w = new World();
  w.resources.ink = 100;
  const darkroom = getDarkroom(w);
  const story = makeInvestigationLead(w, 'docks', {
    state: 'verified',
    held_by_building: darkroom.id,
  });
  w._fireDebrief();
  assert.equal(story.state, 'printed');
});

test('WorldFrame.stories surfaces a scooped lead with scooped:true', () => {
  const w = new World();
  const lead = makeInvestigationLead(w, 'docks');
  const herald = getHerald(w);
  w._reconcileIntent(herald, {
    kind: 'FILE_STORY', district: 'docks', tier: 'investigation', source: 'herald',
  });
  const frame = w.snapshot();
  const row = frame.stories.find((s) => s.id === lead.id);
  assert.ok(row, 'scooped lead should appear in WorldFrame.stories');
  assert.equal(row.scooped, true);
});

test('WorldFrame.leads omits scooped leads (no chase-able diamond)', () => {
  const w = new World();
  const lead = makeInvestigationLead(w, 'docks');
  const beforeCount = w.snapshot().leads.length;
  lead.scooped = true;
  const afterCount = w.snapshot().leads.length;
  assert.equal(afterCount, beforeCount - 1);
});

test('Reconciler emits herald_scoop rival event on successful scoop', () => {
  const w = new World();
  makeInvestigationLead(w, 'docks', { headline: 'DOCKHAND TIPS THE WIRE' });
  const herald = getHerald(w);
  w._reconcileIntent(herald, {
    kind: 'FILE_STORY', district: 'docks', tier: 'investigation', source: 'herald',
  });
  const ev = w._pendingRivalEvents.find((e) => e.kind === 'herald_scoop');
  assert.ok(ev, 'reconciler should push a herald_scoop event');
  assert.equal(ev.rival, 'herald');
  assert.ok(ev.text.includes('DOCKHAND'), 'event text quotes the scooped headline');
});
