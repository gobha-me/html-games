import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../js/sim/world-state.js';

// 1.0.0: end-to-end integration for the three-rival adversarial triangle.
// Verifies iteration order, per-rival cadence, reconciler effects, and
// frame.rivals projection.

test('World seeds three rivals in pinned order: evening_star, herald, observer', () => {
  const w = new World();
  const ids = w.rivals.map((r) => r.id);
  assert.deepEqual(ids, ['evening_star', 'herald', 'observer']);
});

test('frame.rivals projects all three RivalStatusView entries', () => {
  const w = new World();
  const f = w.snapshot();
  assert.equal(f.rivals.length, 3);
  for (const r of f.rivals) {
    assert.ok(['evening_star', 'herald', 'observer'].includes(r.id));
    assert.ok(['calm', 'scheming', 'hostile'].includes(r.posture));
  }
});

test('Herald + Observer never reach hostile posture (rival-ai-spec §03 + §05)', () => {
  const w = new World();
  const herald = w.rivals.find((r) => r.id === 'herald');
  const observer = w.rivals.find((r) => r.id === 'observer');
  for (const state of ['IDLE', 'COURT', 'WIRED', 'PUNISH', 'BUYOUT']) {
    herald.state = state;
    assert.notEqual(herald.posture, 'hostile');
  }
  for (const state of ['INVESTIGATE', 'PUBLISH', 'WARN', 'DESPERATE', 'SILENCED']) {
    observer.state = state;
    assert.notEqual(observer.posture, 'hostile');
  }
});

test('PUBLISH_COUNTER reconciler applies +25 heat to world', () => {
  const w = new World();
  const observer = w.rivals.find((r) => r.id === 'observer');
  const startHeat = w.resources.heat;
  // Directly call reconciler with a PUBLISH_COUNTER intent.
  w._reconcileIntent(observer, { kind: 'PUBLISH_COUNTER', storyId: 's-unknown' });
  assert.equal(w.resources.heat, startHeat + 25);
  // The digest gets pushed to pendingRivalEvents.
  assert.ok(w._pendingRivalEvents.some((e) => e.kind === 'publish_counter'));
});

test('INVESTIGATE_LEAD reconciler logs digest without world-side effect at 1.0.0', () => {
  const w = new World();
  const observer = w.rivals.find((r) => r.id === 'observer');
  const startHeat = w.resources.heat;
  w._reconcileIntent(observer, { kind: 'INVESTIGATE_LEAD', leadId: 'L1', editions: 3 });
  assert.equal(w.resources.heat, startHeat);
  assert.ok(w._pendingRivalEvents.some((e) => e.kind === 'investigate_lead'));
});

test('POISON_LEAD reconciler logs digest without world-side effect at 1.0.0', () => {
  const w = new World();
  const observer = w.rivals.find((r) => r.id === 'observer');
  const startHeat = w.resources.heat;
  w._reconcileIntent(observer, { kind: 'POISON_LEAD', leadId: 'L1' });
  assert.equal(w.resources.heat, startHeat);
  assert.ok(w._pendingRivalEvents.some((e) => e.kind === 'poison_lead'));
});

test('All three rivals receive onEditionEnd in order via ackDebrief', () => {
  const w = new World();
  // Stub each rival's onEditionEnd to record the call order.
  const calls = [];
  for (const rival of w.rivals) {
    const original = rival.onEditionEnd.bind(rival);
    rival.onEditionEnd = (view) => {
      calls.push(rival.id);
      return original(view);
    };
  }
  // Force a deadline + debrief cycle.
  w.cycle.remainingMs = 100;
  w.tick(0.2);
  w.ackDebrief();
  assert.deepEqual(calls, ['evening_star', 'herald', 'observer']);
});

test('RivalView projects printed_lies for player-side recent lies (v0.3.1)', () => {
  const w = new World();
  // Synthesize a printed lie in the recent past.
  w.stories.push({
    id: 's-lie',
    state: 'printed',
    district: 'docks',
    flavor: 'vice',
    tier: 'whisper',
    truthful: false,
    spawned_at_ms: 0,
    tile: { x: 0, y: 0 },
    picked_up_by: null,
    held_by_building: null,
    printed_in: w.cycle.edition,
    heat_yield: 12,
  });
  const observer = w.rivals.find((r) => r.id === 'observer');
  const view = w._buildRivalView(observer);
  assert.ok(view.player.printed_lies);
  assert.equal(view.player.printed_lies.length, 1);
  assert.equal(view.player.printed_lies[0].id, 's-lie');
  assert.equal(view.player.printed_lies[0].heat_yield, 12);
});
