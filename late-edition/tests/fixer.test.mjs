import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, FIXER_SPAWN_TILE, UNIT_SPEED } from '../js/sim/world-state.js';

// Milestone 0.7.0 — Fixer unit. Spawned at FIXER_SPAWN_TILE; player-dispatched
// via right-click; on contact with a Goon, kills the Goon (1-hit per Design
// Doc §17). Two goons adjacent → Fixer also dies (Design Doc §rivals).

function fixer(w)  { return w.units.find((u) => u.kind === 'fixer'); }
function bureau(w) { return w.buildings.find((b) => b.kind === 'bureau'); }
function goons(w)  { return w.units.filter((u) => u.kind === 'goon'); }

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

function tickUntilIdle(w, unit, maxSeconds = 60) {
  const dt = 0.05;
  for (let i = 0; i < maxSeconds / dt; i++) {
    w.tick(dt);
    if (unit.state === 'idle') return;
  }
  throw new Error(`${unit.kind} did not reach idle within budget`);
}

test('Fixer spawns at FIXER_SPAWN_TILE — idle, kind fixer, HP 3', () => {
  const w = new World();
  const f = fixer(w);
  assert.ok(f, 'a fixer unit must exist at construction');
  assert.equal(f.kind, 'fixer');
  assert.equal(f.state, 'idle');
  assert.deepEqual(f.tile, FIXER_SPAWN_TILE);
  assert.equal(f.hp, 3);
  assert.equal(f.hp_max, 3);
  // Design Doc §17 walk 3.0 u/s.
  assert.equal(UNIT_SPEED.fixer, 3.0);
});

test('Fixer is dispatchable via the existing input model (no new Intent kind)', () => {
  const w = new World();
  const f = fixer(w);
  assert.equal(w.dispatch(f.id, { x: 4, y: 5 }), true);
  assert.equal(f.state, 'walking');
  tickUntilIdle(w, f);
  assert.deepEqual(f.tile, { x: 4, y: 5 });
});

test('Fixer adjacent to one goon kills it (1-hit kill, fixer survives)', () => {
  const w = new World({ cycle: { editionDurationMs: 600_000, warningOffsetMs: 30_000 } });
  spawnRaid(w, 1);
  const g = goons(w)[0];
  const f = fixer(w);
  // Walk the goon up to (4,5) (Bureau-adjacent) so we have a stationary target.
  advanceSeconds(w, 30);
  assert.equal(g.state, 'idle');
  // Dispatch fixer to a tile adjacent to the goon.
  w.dispatch(f.id, { x: 4, y: 4 }); // adjacent to (4,5)
  tickUntilIdle(w, f);
  // The next combat tick should kill the goon.
  advanceSeconds(w, 0.1);
  assert.equal(goons(w).length, 0, 'goon should be killed by adjacent fixer');
  assert.ok(w.units.includes(f), 'fixer should still be alive after killing 1 goon');
});

test('Two adjacent goons kill the fixer and one goon (Design Doc §rivals)', () => {
  const w = new World({ cycle: { editionDurationMs: 600_000, warningOffsetMs: 30_000 } });
  spawnRaid(w, 2);
  advanceSeconds(w, 30); // both goons end at (4,5)
  const f = fixer(w);
  // Walk fixer onto goons' tile.
  w.dispatch(f.id, { x: 4, y: 4 });
  tickUntilIdle(w, f);
  advanceSeconds(w, 0.1);
  // After the trade: fixer dead, 1 goon dead, 1 goon alive.
  const remainingGoons = goons(w);
  assert.equal(remainingGoons.length, 1, 'one goon should remain after the trade');
  assert.equal(w.units.find((u) => u.kind === 'fixer'), undefined,
    'fixer should be dead after 2 goons attack');
});

test('Standing fixer is intercepted by a walking goon (combat is continuous)', () => {
  // Fixer doesn't have to walk to the goon — the goon's path takes it past the
  // fixer's spawn tile. Verify the combat tick catches them on the same step.
  const w = new World({ cycle: { editionDurationMs: 600_000, warningOffsetMs: 30_000 } });
  const f = fixer(w);
  // Walk the fixer to (1, 0) — directly on the goon's likely path edge.
  w.dispatch(f.id, { x: 1, y: 0 });
  tickUntilIdle(w, f);
  // Now spawn a raid; the goon at (0,0) will path toward Bureau.
  spawnRaid(w, 1);
  // Goon at (0,0); fixer at (1,0). Adjacent immediately on the next tick.
  advanceSeconds(w, 0.1);
  assert.equal(goons(w).length, 0, 'goon killed by adjacent fixer on same tick');
});
