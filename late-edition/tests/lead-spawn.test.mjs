import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LeadSpawner,
  SPAWN_INTERVAL_MS,
  LEAD_DECAY_MS,
  UNCOVERED_RATE_MULT,
  TIER_WEIGHTS,
} from '../js/sim/lead-spawner.js';
import { DISTRICTS } from '../js/sim/districts.js';
import { SeededRng } from '../js/sim/seeded-rng.js';

// 0.10.0 (audit C-04): the spawner replaces the 0.3 hard-coded single-lead
// seed. Locks the cadence + decay + tier roll against Design Doc §19.

test('LeadSpawner produces no spawns inside the first SPAWN_INTERVAL_MS (covered district)', () => {
  const ctx = baseCtx({ coveredKinds: ['bureau', 'branch_bureau'] });
  const sp = new LeadSpawner();
  const result = sp.tick(SPAWN_INTERVAL_MS - 1, ctx);
  assert.equal(result.spawns.length, 0);
});

test('LeadSpawner produces exactly one spawn per district per SPAWN_INTERVAL_MS step (covered)', () => {
  const ctx = baseCtx({ coveredKinds: ['bureau', 'branch_bureau'] });
  const sp = new LeadSpawner();
  // Single tick of one interval should drop one spawn in each covered district.
  const result = sp.tick(SPAWN_INTERVAL_MS, ctx);
  assert.equal(result.spawns.length, DISTRICTS.length);
});

test('LeadSpawner halves the spawn rate for uncovered districts', () => {
  // Cover neither district. Two interval steps should produce one spawn per
  // district (since rate is ×0.5).
  const ctx = baseCtx({ coveredKinds: [] });
  const sp = new LeadSpawner();
  const r1 = sp.tick(SPAWN_INTERVAL_MS, ctx);
  assert.equal(r1.spawns.length, 0, 'one interval at ×0.5 rate not enough');
  const r2 = sp.tick(SPAWN_INTERVAL_MS, ctx);
  assert.equal(r2.spawns.length, DISTRICTS.length, 'two intervals at ×0.5 yields one per district');
  assert.equal(UNCOVERED_RATE_MULT, 0.5);
});

test('LeadSpawner stamps spawned_at_ms from ctx and includes a headline', () => {
  const ctx = { ...baseCtx({ coveredKinds: ['bureau'] }), simTimeMs: 12345 };
  const sp = new LeadSpawner();
  const { spawns } = sp.tick(SPAWN_INTERVAL_MS, ctx);
  assert.ok(spawns.length >= 1);
  for (const s of spawns) {
    assert.equal(s.spawned_at_ms, 12345);
    assert.equal(typeof s.headline, 'string');
    assert.ok(s.headline.length > 0);
    assert.ok(['whisper', 'investigation'].includes(s.tier), 'arc remaps to investigation at Tier-0');
  }
});

test('LeadSpawner tier roll follows TIER_WEIGHTS (with arc → investigation)', () => {
  const ctx = baseCtx({ coveredKinds: ['bureau', 'branch_bureau'] });
  const sp = new LeadSpawner();
  const counts = { whisper: 0, investigation: 0 };
  // 2000 spawns total across both districts; sample size large enough for ±5% tolerance.
  for (let i = 0; i < 1000; i++) {
    const { spawns } = sp.tick(SPAWN_INTERVAL_MS, ctx);
    for (const s of spawns) counts[s.tier]++;
  }
  const total = counts.whisper + counts.investigation;
  // Investigation absorbs the 5% arc remap → expected ratio is 70 / 30.
  const expectedW = TIER_WEIGHTS.whisper / (TIER_WEIGHTS.whisper + TIER_WEIGHTS.investigation + TIER_WEIGHTS.arc);
  const observedW = counts.whisper / total;
  assert.ok(Math.abs(observedW - expectedW) < 0.04, `whisper ratio: ${observedW}`);
});

test('LeadSpawner._collectExpired returns leads older than LEAD_DECAY_MS', () => {
  const ctx = baseCtx({
    coveredKinds: ['bureau'],
    stories: [
      { id: 's-1', state: 'lead', spawned_at_ms: 0, picked_up_by: null, held_by_building: null },
      { id: 's-2', state: 'lead', spawned_at_ms: 0, picked_up_by: 'u-1', held_by_building: null }, // picked up — exempt
      { id: 's-3', state: 'verified', spawned_at_ms: 0, picked_up_by: null, held_by_building: 'b-1' },
    ],
    simTimeMs: LEAD_DECAY_MS + 100,
  });
  const sp = new LeadSpawner();
  const { expiredIds } = sp.tick(0, ctx);
  assert.deepEqual(expiredIds, ['s-1']);
});

test('LeadSpawner snap/restore preserves per-district accumulators', () => {
  const ctx = baseCtx({ coveredKinds: ['bureau'] });
  const sp = new LeadSpawner();
  sp.tick(SPAWN_INTERVAL_MS / 2, ctx);
  const snap = sp.snap();
  // First district accumulator should reflect the partial tick.
  const firstId = DISTRICTS.find((d) => d.coveredByKind === 'bureau').id;
  assert.ok(snap.accum_by_district[firstId] >= SPAWN_INTERVAL_MS / 2 - 1);

  const restored = LeadSpawner.fromSnap(snap);
  // After restore, another half-interval should fire one spawn in the
  // covered district (accumulators saturated to one full interval).
  const result = restored.tick(SPAWN_INTERVAL_MS / 2, ctx);
  const fromCovered = result.spawns.filter((s) => s.district === firstId);
  assert.equal(fromCovered.length, 1);
});

function baseCtx({ coveredKinds = [], stories = [], simTimeMs = 0 } = {}) {
  const grid = makeGrid(10, 10);
  const buildings = coveredKinds.map((kind, i) => ({
    id: `b-${i}`,
    kind,
    hp: 90,
    tile: { x: 5, y: 5 },
  }));
  return {
    grid,
    buildings,
    stories,
    simTimeMs,
    rng: new SeededRng(0xCAFE),
    occupiedTiles: new Set(),
  };
}

function makeGrid(w, h) {
  const walkable = Array.from({ length: h }, () => Array(w).fill(true));
  return { width: w, height: h, walkable };
}
