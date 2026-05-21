import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, PRESS_HP } from '../js/sim/world-state.js';

// Milestone 0.7.0 — Press HP fail-state. Goons damage Bureau HP at 1 dmg/s;
// HP at 0 emits CYCLE_GAME_OVER (ICD-06 v0.3) and freezes the sim. Overlay
// DOM lives in js/game-over-overlay.js — this test exercises the sim layer.

function bureau(w) { return w.buildings.find((b) => b.kind === 'bureau'); }

function spawnRaid(w, goonCount) {
  const rival = w.rivals[0];
  w._reconcileIntent(rival, {
    kind: 'RAID_BUREAU',
    goons: goonCount,
    eta_ms: 60_000,
    target: bureau(w).id,
  });
}

function advanceSeconds(w, seconds, dt = 1 / 30) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) w.tick(dt);
}

test('Bureau HP at 0 → CYCLE_GAME_OVER fires once, world.gameOver is true', () => {
  const w = new World({ cycle: { editionDurationMs: 600_000, warningOffsetMs: 30_000 } });
  w.units = w.units.filter((u) => u.kind !== 'fixer');
  spawnRaid(w, 1);
  // Walk to adjacency then drain HP. PRESS_HP = 90, 1 dmg/s → ~90s after arrival.
  // Goon path takes ~22s; total ~115s. Run a bit longer to be safe.
  const events = [];
  w.subscribeCycle((ev) => events.push(ev));
  advanceSeconds(w, 130);
  const gameOverEvents = events.filter((ev) => ev.kind === 'CYCLE_GAME_OVER');
  assert.equal(gameOverEvents.length, 1, 'CYCLE_GAME_OVER must fire exactly once');
  assert.equal(gameOverEvents[0].edition, 1);
  assert.equal(gameOverEvents[0].reason, 'press_destroyed');
  assert.equal(w.gameOver, true);
  assert.equal(bureau(w).hp, 0);
});

test('After CYCLE_GAME_OVER, World.tick() short-circuits (sim freezes)', () => {
  const w = new World({ cycle: { editionDurationMs: 600_000, warningOffsetMs: 30_000 } });
  w.units = w.units.filter((u) => u.kind !== 'fixer');
  spawnRaid(w, 3); // faster drain via heavier raid (intent is hand-built, ignores band table)
  advanceSeconds(w, 60); // walk + ~38s damage = ~110 HP drained at 3 dmg/s
  assert.equal(w.gameOver, true);

  // Now further ticks should be inert — cycle clock should not advance.
  const remainingBefore = w.cycle.remainingMs;
  advanceSeconds(w, 5);
  const remainingAfter = w.cycle.remainingMs;
  assert.equal(remainingAfter, remainingBefore, 'cycle clock must freeze on game-over');
});

test('Bureau HP at 0 is clamped (never goes negative)', () => {
  const w = new World({ cycle: { editionDurationMs: 600_000, warningOffsetMs: 30_000 } });
  w.units = w.units.filter((u) => u.kind !== 'fixer');
  spawnRaid(w, 3);
  advanceSeconds(w, 90);
  assert.equal(w.gameOver, true);
  assert.ok(bureau(w).hp >= 0, `bureau.hp should be ≥ 0, got ${bureau(w).hp}`);
});
