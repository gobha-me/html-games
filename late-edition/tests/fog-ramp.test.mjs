import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../js/sim/world-state.js';

// Milestone 0.10.2 (audit D-09) — frame.fog.near ramps from 22 to 14 across
// the last 60 s of an edition. ICD-01 v0.6.2 §Notes: ramp lives in
// World.snapshot() derived from cycle.remainingMs. fog.far + fog.color stay
// constant — only the near plane pulls in.

function advanceSeconds(w, seconds, dt = 1 / 30) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) w.tick(dt);
}

test('fresh edition → fog.near = 22, fog.far = 60, fog.color = 0xc8c4bc', () => {
  const w = new World();
  const frame = w.snapshot();
  assert.ok(Math.abs(frame.fog.near - 22) < 1e-6, `expected 22, got ${frame.fog.near}`);
  assert.equal(frame.fog.far, 60);
  assert.equal(frame.fog.color, 0xc8c4bc);
});

test('T-60s (ramp start) → fog.near ≈ 22', () => {
  const w = new World();
  advanceSeconds(w, 660); // 60s remain
  const frame = w.snapshot();
  assert.ok(frame.fog.near >= 21.5 && frame.fog.near <= 22.0,
    `at ~T-60s expected ~22, got ${frame.fog.near}`);
});

test('T-30s → fog.near ≈ 18 (halfway)', () => {
  const w = new World();
  advanceSeconds(w, 690); // 30s remain
  const frame = w.snapshot();
  assert.ok(frame.fog.near >= 17.5 && frame.fog.near <= 18.5,
    `at ~T-30s expected ~18, got ${frame.fog.near}`);
});

test('T-0 → fog.near reaches 14', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 5_000 } });
  advanceSeconds(w, 60);
  const frame = w.snapshot();
  assert.ok(frame.fog.near >= 14.0 && frame.fog.near <= 14.5,
    `at deadline expected ~14, got ${frame.fog.near}`);
});

test('fog.far and fog.color are invariant across the ramp', () => {
  const w = new World({ cycle: { editionDurationMs: 5_000, warningOffsetMs: 1_000 } });
  for (let i = 0; i < 30; i++) {
    const frame = w.snapshot();
    assert.equal(frame.fog.far, 60);
    assert.equal(frame.fog.color, 0xc8c4bc);
    advanceSeconds(w, 0.1);
  }
});

test('fog.near is clamped to [14, 22] — never overshoots', () => {
  const w = new World({ cycle: { editionDurationMs: 5_000, warningOffsetMs: 1_000 } });
  for (let i = 0; i < 60; i++) {
    const frame = w.snapshot();
    assert.ok(frame.fog.near >= 13.99, `fog.near dipped below 14: ${frame.fog.near}`);
    assert.ok(frame.fog.near <= 22.01, `fog.near overshot 22: ${frame.fog.near}`);
    advanceSeconds(w, 0.1);
  }
});
