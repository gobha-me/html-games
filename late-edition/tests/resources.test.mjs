import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, BUREAU_TILE, LEAD_SPAWN_TILE } from '../js/sim/world-state.js';
import {
  STARTING_INK,
  HEAT_DECAY_PER_EDITION,
  HEAT_DECAY_QUIET_EDITION,
  HEAT_DECAY_STALL_THRESHOLD,
  CASH_BY_TIER,
  INK_BY_TIER,
  HEAT_BY_FLAVOR,
} from '../js/sim/resources.js';

// Milestone 0.6 — Cash + Ink + Heat resources. ICD-01 v0.5 §HudState and
// ICD-06 v0.2 §EditionSummary already authored the shapes at PRE-0.5; 0.6
// fills the values. First-pass numbers (Design Doc §06 + §19) are medium-band
// per architecture/00-overview.md line 44 — single representative per
// tier/flavor (no district modifier, no lie/front-page multipliers). The
// seeded Story (ICD-05) is a vice-whisper, so the deadline math is
// deterministic: cash $165, ink 1, heat 8.

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

test('fresh World — hud.resources reads STARTING_INK with derived leads/stories at zero+1', () => {
  const w = new World();
  const f = w.snapshot();
  // The constructor seeds one vice-whisper lead at LEAD_SPAWN_TILE — it shows
  // up in frame.leads, so leads === 1 from the start (matches the player view).
  assert.deepEqual(f.hud.resources, {
    leads: 1,
    stories: 0,
    ink: STARTING_INK,
    cash: 0,
    heat: 0,
  });
  assert.equal(STARTING_INK, 20);
});

test('leads count tracks frame.leads — picked-up lead leaves the count', () => {
  const w = new World();
  assert.equal(w.snapshot().hud.resources.leads, 1);

  // Reporter picks up the seeded lead.
  const r = reporter(w);
  w.dispatch(r.id, { ...LEAD_SPAWN_TILE });
  tickUntilIdle(w, r);

  const f = w.snapshot();
  assert.equal(f.leads.length, 0, 'lead leaves frame.leads on pickup');
  assert.equal(f.hud.resources.leads, 0, 'hud.resources.leads mirrors frame.leads');
});

test('stories count ticks to 1 after photog verify (verified + plated)', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  assert.equal(w.snapshot().hud.resources.stories, 0);

  stageVerifiedAtDarkroom(w);
  assert.equal(w.stories[0].state, 'verified');
  assert.equal(w.snapshot().hud.resources.stories, 1);
});

test('DEADLINE_FIRE writes per-story yields from js/sim/resources.js', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  stageVerifiedAtDarkroom(w);
  assert.equal(w.stories[0].flavor, 'vice');
  assert.equal(w.stories[0].tier, 'whisper');

  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);

  const story = w.stories[0];
  assert.equal(story.state, 'printed');
  assert.equal(story.cash_yield, CASH_BY_TIER.whisper, 'cash yield by tier');
  assert.equal(story.heat_yield, HEAT_BY_FLAVOR.vice,  'heat yield by flavor');
  assert.equal(story.ink_cost,   INK_BY_TIER.whisper,  'ink cost by tier');
});

test('EditionSummary aggregates printed stories\' yields', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  stageVerifiedAtDarkroom(w);

  const events = [];
  w.subscribeCycle((ev) => events.push(ev));
  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);

  const begin = events.find((ev) => ev.kind === 'EDITION_DEBRIEF_BEGIN');
  assert.ok(begin, 'EDITION_DEBRIEF_BEGIN fires at deadline');
  assert.equal(begin.summary.cash_earned,  CASH_BY_TIER.whisper);
  assert.equal(begin.summary.ink_consumed, INK_BY_TIER.whisper);
  assert.equal(begin.summary.heat_applied, HEAT_BY_FLAVOR.vice);
});

test('running balances accumulate on the World after print', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  stageVerifiedAtDarkroom(w);

  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);

  // Debrief is open — running balances reflect the just-closed edition's deltas.
  const f = w.snapshot();
  assert.equal(f.hud.resources.cash, CASH_BY_TIER.whisper, 'cash += cash_earned');
  assert.equal(f.hud.resources.ink,  STARTING_INK - INK_BY_TIER.whisper, 'ink -= ink_consumed');
  assert.equal(f.hud.resources.heat, HEAT_BY_FLAVOR.vice,  'heat += heat_applied');
});

test('ackDebrief applies HEAT_DECAY_PER_EDITION, clamped at zero', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  stageVerifiedAtDarkroom(w);
  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);

  const heatBeforeAck = w.snapshot().hud.resources.heat;
  assert.equal(heatBeforeAck, HEAT_BY_FLAVOR.vice);

  w.ackDebrief();
  const heatAfterAck = w.snapshot().hud.resources.heat;
  // vice (8) - decay (8) = 0; clamp keeps it non-negative.
  assert.equal(heatAfterAck, Math.max(0, heatBeforeAck - HEAT_DECAY_PER_EDITION));
  assert.ok(heatAfterAck >= 0);
});

// 0.9.3 (PR-A audit D-04) — §19 heat decay nuances. Three branches:
//   1. controversial edition (heat_applied > 0)         → baseline decay (8)
//   2. quiet edition (heat_applied === 0)               → bonus decay (12)
//   3. heat > 80 pre-decay                              → decay stalls (0)
test('D-04: quiet edition (no controversial stories) → bonus decay (12)', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  // No verified story → DEADLINE_FIRE prints nothing → heat_applied === 0.
  w.resources.heat = 20;
  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);
  assert.equal(w.snapshot().hud.resources.heat, 20, 'no print → no heat applied this edition');
  w.ackDebrief();
  assert.equal(
    w.snapshot().hud.resources.heat,
    20 - HEAT_DECAY_QUIET_EDITION,
    'quiet edition → bonus decay',
  );
});

test('D-04: controversial edition → baseline decay (8)', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  // Seed pre-edition heat so we have something to decay from.
  w.resources.heat = 20;
  stageVerifiedAtDarkroom(w);
  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);
  const heatAtDebrief = w.snapshot().hud.resources.heat;
  assert.equal(heatAtDebrief, 20 + HEAT_BY_FLAVOR.vice, 'controversial print added heat_applied');
  w.ackDebrief();
  assert.equal(
    w.snapshot().hud.resources.heat,
    heatAtDebrief - HEAT_DECAY_PER_EDITION,
    'controversial edition → baseline decay',
  );
});

test('D-04: heat > 80 pre-decay → decay stalls at 0 ("room won\'t cool")', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  // Push heat above the stall threshold. The branch checks heat ≤ 80, so
  // heat === 81 already stalls.
  w.resources.heat = 90;
  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);
  w.ackDebrief();
  assert.equal(w.snapshot().hud.resources.heat, 90, 'no decay when heat > 80 pre-decay');
  assert.ok(HEAT_DECAY_STALL_THRESHOLD === 80, 'stall threshold is the §19 number');
});

test('D-04: decay still clamps at zero (low heat + quiet edition)', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  w.resources.heat = 5; // less than the quiet-edition decay (12)
  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);
  w.ackDebrief();
  assert.equal(w.snapshot().hud.resources.heat, 0, 'heat clamps non-negative');
});

test('StoryDigest.cash carries the non-zero yield to the debrief panel', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  stageVerifiedAtDarkroom(w);

  const events = [];
  w.subscribeCycle((ev) => events.push(ev));
  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);

  const begin = events.find((ev) => ev.kind === 'EDITION_DEBRIEF_BEGIN');
  assert.equal(begin.summary.stories_printed[0].cash, CASH_BY_TIER.whisper);
});
