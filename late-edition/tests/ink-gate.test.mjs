import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, BUREAU_TILE, DARKROOM_TILE, LEAD_SPAWN_TILE } from '../js/sim/world-state.js';
import { INK_BY_TIER, STARTING_INK } from '../js/sim/resources.js';

// Milestone 0.7.1 — ink plate-time hard gate (ICD-05 v0.4 §Notes).
// `verified → plated` is rejected when ink would go negative. The Story stays
// 'verified' at the Darkroom and tries again the next edition (where the
// player may have restocked ink). The Editor's presence at the Bureau is the
// permission to plate; the gate is enforced at the plating step inside
// World._fireDebrief.

function reporter(w) { return w.units.find((u) => u.kind === 'reporter'); }
function photog(w)   { return w.units.find((u) => u.kind === 'photog'); }
function darkroom(w) { return w.buildings.find((b) => b.kind === 'darkroom'); }
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

// Force-stage an extra verified story at the Darkroom without a ferry — useful
// for the multi-story gate tests where we want a predictable queue order.
function injectVerifiedAtDarkroom(w, { flavor = 'vice', tier = 'whisper', truthful = true } = {}) {
  const d = darkroom(w);
  const id = `s-inj-${w.stories.length + 1}`;
  w.stories.push({
    id,
    state: 'verified',
    district: 'd-default',
    flavor,
    tier,
    truthful,
    spawned_at_ms: 0,
    tile: { ...DARKROOM_TILE },
    picked_up_by: null,
    held_by_building: d.id,
    verified_by: 'test-photog',
  });
  return id;
}

test('insufficient ink — verified story stays at Darkroom, ink unchanged', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  stageVerifiedAtDarkroom(w);
  // Drain ink so the whisper story (cost INK_BY_TIER.whisper = 1) cannot be plated.
  w.resources.ink = 0;

  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);

  const story = w.stories[0];
  // 0.7.1 gate: story stays in 'verified' state, untouched at the Darkroom.
  assert.equal(story.state, 'verified', 'story must NOT advance past verified');
  assert.equal(story.held_by_building, darkroom(w).id, 'story stays held at the Darkroom');
  assert.equal(story.plated_by, undefined, 'plated_by must not be set on a gated story');
  assert.equal(w.resources.ink, 0, 'ink balance must be unchanged when nothing prints');
});

test('sufficient ink — story prints and ink decrements by ink_cost', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  stageVerifiedAtDarkroom(w);
  const inkBefore = w.resources.ink;
  assert.equal(inkBefore, STARTING_INK);

  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);

  const story = w.stories[0];
  assert.equal(story.state, 'printed');
  assert.equal(w.resources.ink, inkBefore - INK_BY_TIER.whisper, 'ink decremented by per-story cost');
});

test('partial budget — first story prints, second stays verified', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  stageVerifiedAtDarkroom(w);
  // Inject a second verified story — also whisper (cost 1). Set ink so exactly
  // one whisper fits (ink = 1; 1 - 1 = 0 ≥ 0 admit; second story 0 - 1 = -1 reject).
  const injectedId = injectVerifiedAtDarkroom(w);
  w.resources.ink = 1;

  const events = [];
  w.subscribeCycle((ev) => events.push(ev));
  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);

  // The seeded story is index 0; the injected story is index 1. The gate
  // admits stories in iteration order — seeded prints, injected stays.
  const seeded = w.stories[0];
  const injected = w.stories.find((s) => s.id === injectedId);
  assert.equal(seeded.state, 'printed', 'first story should print');
  assert.equal(injected.state, 'verified', 'second story should stay verified');
  assert.equal(injected.held_by_building, darkroom(w).id);
  assert.equal(w.resources.ink, 0, 'ink decremented by one story\'s cost only');

  const begin = events.find((ev) => ev.kind === 'EDITION_DEBRIEF_BEGIN');
  assert.equal(begin.summary.stories_printed.length, 1, 'EditionSummary lists only the printed story');
  assert.equal(begin.summary.ink_consumed, INK_BY_TIER.whisper, 'ink_consumed reflects gated set only');
});

test('held-over story prints next edition when ink is restocked', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  stageVerifiedAtDarkroom(w);
  w.resources.ink = 0;

  // Edition 1: gate rejects.
  let remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);
  assert.equal(w.stories[0].state, 'verified', 'edition 1: gate rejects');

  // Player "restocks" ink (the actual purchase verb lands later).
  w.ackDebrief();
  w.resources.ink = 100;

  // Edition 2: same verified story plates and prints.
  remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);
  const story = w.stories[0];
  assert.equal(story.state, 'printed', 'edition 2: gate passes, story prints');
  assert.equal(story.printed_in, 2);
  assert.equal(story.plated_by, editor(w).id, 'plated by the Editor on retry');
});
