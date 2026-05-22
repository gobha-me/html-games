import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newSlowMoState,
  triggerSlowMo,
  speedFactor,
  activeRemainingMs,
  SLOW_MO_ACTIVE_MS,
  SLOW_MO_COOLDOWN_MS,
  SLOW_MO_FACTOR,
} from '../js/slow-mo.js';

// 0.10.1 (audit G-07): slow-mo Space-key controller. Pure helpers — the
// main loop holds one state object; pass `performance.now()` in production,
// arbitrary monotonic numbers in tests.

test('fresh state has factor 1 and zero remaining', () => {
  const s = newSlowMoState();
  assert.equal(speedFactor(s, 1000), 1);
  assert.equal(activeRemainingMs(s, 1000), 0);
});

test('trigger immediately drops sim speed to 0.5', () => {
  const now = 10_000;
  const s = triggerSlowMo(newSlowMoState(), now);
  assert.equal(speedFactor(s, now), SLOW_MO_FACTOR);
  assert.equal(speedFactor(s, now + 1), SLOW_MO_FACTOR);
});

test('active window is exactly SLOW_MO_ACTIVE_MS', () => {
  const now = 10_000;
  const s = triggerSlowMo(newSlowMoState(), now);
  assert.equal(speedFactor(s, now + SLOW_MO_ACTIVE_MS - 1), SLOW_MO_FACTOR, 'still active 1ms before expiry');
  assert.equal(speedFactor(s, now + SLOW_MO_ACTIVE_MS), 1, 'inactive at the expiry boundary');
});

test('cooldown blocks re-trigger until SLOW_MO_COOLDOWN_MS elapses', () => {
  const t0 = 10_000;
  let s = triggerSlowMo(newSlowMoState(), t0);
  // Try to re-trigger during the active window — blocked.
  const sMid = triggerSlowMo(s, t0 + 2_000);
  assert.strictEqual(sMid, s, 'mid-active re-trigger returns same state reference');
  // Try after active but still inside cooldown — blocked.
  const sAfterActive = triggerSlowMo(s, t0 + SLOW_MO_ACTIVE_MS + 1_000);
  assert.strictEqual(sAfterActive, s, 'post-active cooldown re-trigger returns same state reference');
  // Try after full cooldown — succeeds.
  const sReady = triggerSlowMo(s, t0 + SLOW_MO_COOLDOWN_MS);
  assert.notStrictEqual(sReady, s, 'cooldown-expired re-trigger produces fresh state');
  assert.equal(speedFactor(sReady, t0 + SLOW_MO_COOLDOWN_MS), SLOW_MO_FACTOR);
});

test('activeRemainingMs counts down across the active window', () => {
  const t0 = 1_000;
  const s = triggerSlowMo(newSlowMoState(), t0);
  assert.equal(activeRemainingMs(s, t0), SLOW_MO_ACTIVE_MS);
  assert.equal(activeRemainingMs(s, t0 + 2_000), SLOW_MO_ACTIVE_MS - 2_000);
  assert.equal(activeRemainingMs(s, t0 + SLOW_MO_ACTIVE_MS + 5_000), 0, 'never negative');
});

test('SLOW_MO_FACTOR is 0.5 per Design Doc §19', () => {
  assert.equal(SLOW_MO_FACTOR, 0.5);
});

test('window/cooldown constants match the §19 5s / 30s spec', () => {
  assert.equal(SLOW_MO_ACTIVE_MS, 5_000);
  assert.equal(SLOW_MO_COOLDOWN_MS, 30_000);
});
