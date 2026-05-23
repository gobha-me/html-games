import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../js/sim/world-state.js';
import { PAST_INTENTS_PROJECTION_CAP } from '../js/sim/evening-star.js';

// ICD-02 v0.2 §RivalView — the read-only snapshot World hands the rival each
// tick. Tests pin field shape, projection caps, and noisy-heat behavior.

function buildView(w) {
  return w._buildRivalView(w.rivals[0]);
}

test('RivalView shape — cycle / player / own / world / edition_history keys', () => {
  const w = new World();
  const v = buildView(w);
  // 1.2.0 (ICD-02 v0.3.3): RivalView adds a top-level `world` block carrying
  // district_heat (Observer DESPERATE district nomination) and
  // observer_publish_suppressed (Observer PUBLISH gate during an active
  // partner deal). Shared across all rivals; non-Observer rivals ignore it.
  assert.deepEqual(Object.keys(v).sort(), ['cycle', 'edition_history', 'own', 'player', 'world']);
  assert.deepEqual(Object.keys(v.cycle).sort(), ['edition', 'remaining_ms']);
  // v0.3.1 (1.0.0 · ICD-02): player.printed_lies surfaces recent player lies
  // for Observer's INVESTIGATE → PUBLISH transition.
  assert.deepEqual(
    Object.keys(v.player).sort(),
    ['heat_noisy', 'printed_lies', 'visible_leads', 'visible_reporters'],
  );
  assert.deepEqual(Object.keys(v.own).sort(), ['past_intents', 'posture', 'state']);
  assert.deepEqual(Object.keys(v.world).sort(), ['district_heat', 'observer_publish_suppressed']);
});

test('cycle.edition matches CYCLE_BEGIN edition; remaining_ms matches HUD deadline', () => {
  const w = new World();
  const v = buildView(w);
  const f = w.snapshot();
  assert.equal(v.cycle.edition, 1);
  assert.equal(v.cycle.remaining_ms, f.hud.deadline_ms);
});

test('heat_noisy is heat ± 20 (bounded by per-rival seeded RNG)', () => {
  const w = new World();
  w.resources.heat = 50;
  const v = buildView(w);
  // Heat 50 ± 20 → [30, 70].
  assert.ok(v.player.heat_noisy >= 30 && v.player.heat_noisy <= 70,
    `heat_noisy ${v.player.heat_noisy} outside ±20 envelope`);
});

test('visible_leads filter — only Stories in lead state, not picked/held', () => {
  const w = new World();
  const v = buildView(w);
  // Seeded story at LEAD_SPAWN_TILE; in lead state; not picked, not held.
  assert.equal(v.player.visible_leads.length, 1);
  assert.equal(v.player.visible_leads[0].id, w.stories[0].id);
  // Mutate the story state — it should leave the visible_leads list.
  w.stories[0].state = 'verified';
  const v2 = buildView(w);
  assert.equal(v2.player.visible_leads.length, 0);
});

test('visible_reporters filter — only reporter-kind units', () => {
  const w = new World();
  const v = buildView(w);
  assert.equal(v.player.visible_reporters.length, 1);
  assert.equal(v.player.visible_reporters[0].id, w.units.find((u) => u.kind === 'reporter').id);
});

test('own.state and own.posture come from the rival object', () => {
  const w = new World();
  const v = buildView(w);
  assert.equal(v.own.state, 'SCAVENGE');
  assert.equal(v.own.posture, 'calm');
});

test('own.past_intents is bounded to last 8 (ICD-02 §RivalView)', () => {
  const w = new World();
  const rival = w.rivals[0];
  // Force 15 intents into the rival's RingBuffer.
  for (let i = 0; i < 15; i++) rival._emit({ kind: 'PASS' });
  const v = buildView(w);
  assert.equal(v.own.past_intents.length, PAST_INTENTS_PROJECTION_CAP);
  assert.equal(PAST_INTENTS_PROJECTION_CAP, 8);
});

test('edition_history bounded to last 10', () => {
  const w = new World();
  // Manually push 15 entries to test the cap.
  for (let i = 0; i < 15; i++) {
    w.editionHistory.push({ edition: i, player_cash_delta: 0, raids_attempted: 0, raids_succeeded: 0 });
  }
  const v = buildView(w);
  assert.ok(v.edition_history.length <= 10);
});
