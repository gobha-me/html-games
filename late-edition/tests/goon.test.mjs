import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  World,
  GOON_SPAWN_TILE,
  GOON_DAMAGE_PER_SECOND,
  PRESS_HP,
} from '../js/sim/world-state.js';

// Milestone 0.7.0 — Goon unit. Spawned by RAID_BUREAU reconciliation, walks
// from district edge to a Bureau-adjacent tile, damages Press at 1 dmg/s on
// contact. Press HP fail-state lives in tests/press-hp.test.mjs.

function bureau(w) { return w.buildings.find((b) => b.kind === 'bureau'); }
function goons(w)  { return w.units.filter((u) => u.kind === 'goon'); }

// Drive a rival raid by hand-feeding a RAID_BUREAU intent through the
// reconciler. Bypasses RNG / heat / cooldown.
function spawnRaid(w, goonCount) {
  const rival = w.rivals[0];
  const target = bureau(w);
  w._reconcileIntent(rival, {
    kind: 'RAID_BUREAU',
    goons: goonCount,
    eta_ms: 60_000,
    target: target.id,
  });
}

function advanceSeconds(w, seconds, dt = 1 / 30) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) w.tick(dt);
}

test('RAID_BUREAU spawns N goons at GOON_SPAWN_TILE, each with a path toward Bureau', () => {
  // Long cycle so DEADLINE_FIRE doesn't trip mid-test.
  const w = new World({ cycle: { editionDurationMs: 600_000, warningOffsetMs: 30_000 } });
  assert.equal(goons(w).length, 0, 'no goons at construction');
  spawnRaid(w, 2);
  const gs = goons(w);
  assert.equal(gs.length, 2);
  for (const g of gs) {
    assert.equal(g.kind, 'goon');
    assert.equal(g.hp, 1);
    assert.deepEqual(g.tile, GOON_SPAWN_TILE);
    assert.equal(g.state, 'walking');
    assert.ok(g.path.length > 1, 'goon should have a path toward Bureau');
  }
});

test('Goon walks to a Bureau-adjacent tile and goes idle', () => {
  const w = new World({ cycle: { editionDurationMs: 600_000, warningOffsetMs: 30_000 } });
  // Remove the fixer from this scenario — pure goon-vs-bureau dynamics.
  w.units = w.units.filter((u) => u.kind !== 'fixer');
  spawnRaid(w, 1);
  const g = goons(w)[0];
  // Goon at (0,0) → walks to (4,5). At 2.5 u/s and a Manhattan-9 path
  // = 54 world units → ~21.6 s. Add cushion.
  advanceSeconds(w, 30);
  assert.equal(g.state, 'idle', 'goon should reach destination and idle');
  const d = Math.abs(g.tile.x - bureau(w).tile.x) + Math.abs(g.tile.y - bureau(w).tile.y);
  assert.equal(d, 1, 'goon ends adjacent to Bureau');
});

test('Adjacent Goon damages Press at 1 dmg/s while idle', () => {
  const w = new World({ cycle: { editionDurationMs: 600_000, warningOffsetMs: 30_000 } });
  w.units = w.units.filter((u) => u.kind !== 'fixer');
  spawnRaid(w, 1);
  const g = goons(w)[0];
  // Walk to adjacency.
  advanceSeconds(w, 30);
  const hpAfterArrival = bureau(w).hp;
  // Burn 5 seconds of damage tick.
  advanceSeconds(w, 5);
  const hpDelta = hpAfterArrival - bureau(w).hp;
  // 1 goon × 1 dmg/s × 5 s = 5. Allow ±1 for tick boundaries.
  assert.ok(Math.abs(hpDelta - 5) <= 1.1, `expected ~5 HP lost, got ${hpDelta}`);
  assert.equal(g.kind, 'goon', 'goon still alive');
});

test('Non-adjacent Goon does not damage Press', () => {
  const w = new World({ cycle: { editionDurationMs: 600_000, warningOffsetMs: 30_000 } });
  w.units = w.units.filter((u) => u.kind !== 'fixer');
  spawnRaid(w, 1);
  const hpBefore = bureau(w).hp;
  // Tick once before the goon has walked anywhere.
  advanceSeconds(w, 0.1);
  assert.equal(bureau(w).hp, hpBefore, 'no damage from a far-away goon');
});

test('Two adjacent goons stack their damage (heat-band → 2 goons at heat 60-80)', () => {
  const w = new World({ cycle: { editionDurationMs: 600_000, warningOffsetMs: 30_000 } });
  w.units = w.units.filter((u) => u.kind !== 'fixer');
  spawnRaid(w, 2);
  advanceSeconds(w, 30); // both arrive adjacent
  const hpAfterArrival = bureau(w).hp;
  advanceSeconds(w, 5);
  const hpDelta = hpAfterArrival - bureau(w).hp;
  // 2 goons × 1 dmg/s × 5 s = 10. Tolerance ±1.5 for tick boundary slack.
  assert.ok(hpDelta >= 8.5 && hpDelta <= 11.5, `expected ~10 HP, got ${hpDelta}`);
});

test('Bureau HP is initialized to PRESS_HP (90)', () => {
  const w = new World();
  assert.equal(bureau(w).hp, PRESS_HP);
  assert.equal(bureau(w).hp_max, PRESS_HP);
  // sanity-check the constant matches the design doc value
  assert.equal(PRESS_HP, 90);
  // and the damage rate constant
  assert.equal(GOON_DAMAGE_PER_SECOND, 1);
});

test('Goon does NOT pick up leads (reuses arrival but no pickup branch)', () => {
  const w = new World({ cycle: { editionDurationMs: 600_000, warningOffsetMs: 30_000 } });
  w.units = w.units.filter((u) => u.kind !== 'fixer');
  spawnRaid(w, 1);
  // No-op pickup expectation — the goon's path target is (4,5), not the lead.
  advanceSeconds(w, 30);
  const g = goons(w)[0];
  assert.equal(g.carrying, null);
  assert.equal(g.carryingStoryId, null);
});
