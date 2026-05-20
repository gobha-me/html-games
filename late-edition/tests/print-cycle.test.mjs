import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, BUREAU_TILE, LEAD_SPAWN_TILE } from '../js/sim/world-state.js';

// Milestone 0.5 — print cycle clock, deadline events, edition debrief panel.
// ICD-06 v0.2 owns the event vocabulary and EditionSummary shape;
// ICD-01 v0.5 owns the HudState shape that mirrors the cycle clock.
//
// Cycle constants under test (medium-band override allowed via World opts so
// tests don't have to advance 12 minutes of sim time):
//   editionDurationMs = 720_000 (strong-band default — Design Doc §05)
//   warningOffsetMs   =  30_000 (strong-band default — ICD-06 v0.2 §Cycle timing)

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

// Drives the existing 0.3+0.4 ferry so a verified story sits at the darkroom,
// ready to be plated+printed at the next deadline.
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

function collectCycleEvents(w) {
  const events = [];
  w.subscribeCycle((ev) => events.push(ev));
  return events;
}

// Advance the cycle clock by N sim-seconds in 1/30s slices (matches main.js).
function advanceSeconds(w, seconds) {
  const dt = 1 / 30;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) w.tick(dt);
}

test('fresh World — hud.edition === 1, hud.deadline_ms === 720_000', () => {
  const w = new World();
  const f = w.snapshot();
  assert.equal(f.hud.edition, 1);
  assert.equal(f.hud.deadline_ms, 720_000);
  // Milestone 0.6: the seeded lead surfaces in frame.leads → leads count is 1;
  // ink starts at STARTING_INK (20); cash/heat/stories are zero until print.
  // Exact yield numbers are covered by tests/resources.test.mjs.
  assert.deepEqual(f.hud.resources, { leads: 1, stories: 0, ink: 20, cash: 0, heat: 0 });
});

test('advancing 30 sim-seconds decrements hud.deadline_ms by ~30_000', () => {
  const w = new World();
  const before = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, 30);
  const after = w.snapshot().hud.deadline_ms;
  const delta = before - after;
  assert.ok(Math.abs(delta - 30_000) <= 100, `deadline moved by ${delta}ms (want ~30_000)`);
});

test('DEADLINE_WARNING fires exactly once at T-30s crossing', () => {
  // Shrink the cycle so the test doesn't have to chew through 12 minutes.
  const w = new World({ cycle: { editionDurationMs: 5_000, warningOffsetMs: 2_000 } });
  const events = collectCycleEvents(w);
  advanceSeconds(w, 4); // crosses the T-2s threshold once
  const warnings = events.filter((ev) => ev.kind === 'DEADLINE_WARNING');
  assert.equal(warnings.length, 1, 'DEADLINE_WARNING must fire exactly once per edition');
  assert.equal(warnings[0].remaining_ms, 2_000);
});

test('DEADLINE_FIRE fires exactly once at T-0', () => {
  const w = new World({ cycle: { editionDurationMs: 2_000, warningOffsetMs: 500 } });
  const events = collectCycleEvents(w);
  advanceSeconds(w, 3); // overshoots deadline
  const fires = events.filter((ev) => ev.kind === 'DEADLINE_FIRE');
  assert.equal(fires.length, 1, 'DEADLINE_FIRE must fire exactly once per edition');
  assert.equal(fires[0].edition, 1);
});

test('EDITION_DEBRIEF_BEGIN carries an EditionSummary; stories_printed[0].id matches the original Story.id', () => {
  // editionDurationMs comfortably exceeds the ferry's ~25s of sim time so the
  // deadline doesn't fire mid-stage and freeze the reporter.
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  stageVerifiedAtDarkroom(w);
  const originalStoryId = w.stories[0].id;

  const events = collectCycleEvents(w);
  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);

  const begin = events.find((ev) => ev.kind === 'EDITION_DEBRIEF_BEGIN');
  assert.ok(begin, 'EDITION_DEBRIEF_BEGIN must fire when deadline hits');
  assert.equal(begin.edition, 1);

  const summary = begin.summary;
  assert.equal(summary.edition, 1);
  assert.equal(typeof summary.cash_earned, 'number');
  assert.equal(typeof summary.ink_consumed, 'number');
  assert.equal(typeof summary.heat_applied, 'number');
  assert.ok(Array.isArray(summary.stories_printed));
  assert.ok(Array.isArray(summary.rival_events));
  assert.equal(summary.stories_printed.length, 1, 'one verified story should print');

  const digest = summary.stories_printed[0];
  assert.equal(digest.id, originalStoryId, 'StoryDigest.id must equal original Story.id (ICD-05 §Purpose)');
  assert.equal(digest.flavor, 'vice');
  assert.equal(digest.tier, 'whisper');
  assert.equal(typeof digest.headline, 'string');
  assert.equal(typeof digest.cash, 'number');
});

test('debrief pause: cycle clock + unit motion both freeze while debrief is open', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  stageVerifiedAtDarkroom(w);

  // Burn to deadline.
  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.2);
  assert.equal(w.debriefOpen, true, 'debrief should be open after deadline fires');

  // Dispatch the reporter mid-debrief — should not move.
  const r = reporter(w);
  const startPos = { x: r.pos.x, z: r.pos.z };
  w.dispatch(r.id, { ...LEAD_SPAWN_TILE });
  const cycleMsBefore = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, 1);
  const cycleMsAfter = w.snapshot().hud.deadline_ms;

  assert.equal(cycleMsAfter, cycleMsBefore, 'cycle clock must not advance during debrief');
  assert.equal(r.pos.x, startPos.x, 'reporter x position must not change during debrief');
  assert.equal(r.pos.z, startPos.z, 'reporter z position must not change during debrief');
});

test('ackDebrief() emits EDITION_DEBRIEF_END then CYCLE_BEGIN(edition=2); printed stories stay out of frame.leads', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  stageVerifiedAtDarkroom(w);
  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);

  const events = [];
  w.subscribeCycle((ev) => events.push(ev));
  w.ackDebrief();

  const kinds = events.map((ev) => ev.kind);
  const endIdx = kinds.indexOf('EDITION_DEBRIEF_END');
  const beginIdx = kinds.indexOf('CYCLE_BEGIN');
  assert.ok(endIdx >= 0, 'EDITION_DEBRIEF_END must fire on ack');
  assert.ok(beginIdx > endIdx, 'CYCLE_BEGIN(2) must fire after EDITION_DEBRIEF_END');
  assert.equal(events[beginIdx].edition, 2);

  assert.equal(w.debriefOpen, false);
  const f = w.snapshot();
  assert.equal(f.hud.edition, 2);
  assert.equal(f.hud.deadline_ms, 60_000, 'fresh edition resets the clock');
  assert.equal(f.leads.length, 0, 'printed story must not surface as a LeadView');
});

test('verified → plated → printed transitions fire same-frame at DEADLINE_FIRE', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  stageVerifiedAtDarkroom(w);
  assert.equal(w.stories[0].state, 'verified');

  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);

  const story = w.stories[0];
  assert.equal(story.state, 'printed', 'story must end at printed state');
  assert.equal(story.printed_in, 1);
  assert.equal(typeof story.plated_by, 'string', 'plated_by carries a sentinel pre-Editor');
  // Milestone 0.6: yields land at the plated step from js/sim/resources.js.
  // The seeded story is vice-whisper → cash $165, heat 8. tests/resources.test.mjs
  // owns the per-tier/per-flavor coverage; this asserts the wiring fired.
  assert.equal(typeof story.cash_yield, 'number');
  assert.equal(typeof story.heat_yield, 'number');
  assert.ok(story.cash_yield > 0, 'cash_yield set at plated step');
  assert.ok(story.heat_yield > 0, 'heat_yield set at plated step');
});
