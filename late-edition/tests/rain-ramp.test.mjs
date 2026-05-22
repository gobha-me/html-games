import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../js/sim/world-state.js';

// Milestone 0.10.2 (audit C-06) — frame.rain.intensity ramps from 1 to 2
// across the last 30 s of an edition. ICD-01 v0.6.2 §Notes: ramp lives in
// World.snapshot() derived from cycle.remainingMs. Renderer scales line
// density by this value and caps at 1500 lines (Design Doc §15).

function advanceSeconds(w, seconds, dt = 1 / 30) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) w.tick(dt);
}

test('fresh edition (T-12min) → intensity ≈ 1', () => {
  const w = new World();
  const frame = w.snapshot();
  assert.ok(Math.abs(frame.rain.intensity - 1) < 1e-6, `expected 1, got ${frame.rain.intensity}`);
});

test('T-30s (ramp start) → intensity ≈ 1', () => {
  // Default cycle: 720_000ms. Burn 11.5 min so 30s remain.
  const w = new World();
  advanceSeconds(w, 690);
  const frame = w.snapshot();
  // Allow slack for tick-boundary jitter.
  assert.ok(frame.rain.intensity >= 0.99 && frame.rain.intensity <= 1.05,
    `at ~T-30s expected ~1.0, got ${frame.rain.intensity}`);
});

test('T-15s → intensity ≈ 1.5', () => {
  const w = new World();
  advanceSeconds(w, 705); // 15s remaining
  const frame = w.snapshot();
  assert.ok(frame.rain.intensity >= 1.4 && frame.rain.intensity <= 1.6,
    `at ~T-15s expected ~1.5, got ${frame.rain.intensity}`);
});

test('T-0 (deadline boundary) → intensity reaches 2', () => {
  // 0.10.2: at remaining=0 the ramp is at its cap. The deadline fires and the
  // debrief opens — we snapshot before ackDebrief so the cycle clock still
  // reads remaining_ms = 0 / very small.
  const w = new World({ cycle: { editionDurationMs: 30_000, warningOffsetMs: 5_000 } });
  // Burn to the deadline.
  advanceSeconds(w, 30);
  const frame = w.snapshot();
  assert.ok(frame.rain.intensity >= 1.95 && frame.rain.intensity <= 2.0,
    `at deadline expected ~2.0, got ${frame.rain.intensity}`);
});

test('intensity is clamped to [1, 2] — never overshoots or undershoots', () => {
  const w = new World({ cycle: { editionDurationMs: 5_000, warningOffsetMs: 1_000 } });
  // Sample at many points across the cycle.
  for (let i = 0; i < 50; i++) {
    const frame = w.snapshot();
    assert.ok(frame.rain.intensity >= 1.0, `intensity dipped below 1: ${frame.rain.intensity}`);
    assert.ok(frame.rain.intensity <= 2.0, `intensity overshot 2: ${frame.rain.intensity}`);
    advanceSeconds(w, 0.1);
  }
});
