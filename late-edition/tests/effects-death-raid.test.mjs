import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, GOON_SPAWN_TILE } from '../js/sim/world-state.js';

// Milestone 0.10.2 (audit C-07) — sim emits `death` when a goon/fixer hits
// HP 0 and is pruned, and `raid_warning` once per RAID_BUREAU intent at the
// reconciler. ICD-01 v0.6 §FxEvent.

function bureau(w) { return w.buildings.find((b) => b.kind === 'bureau'); }
function goons(w)  { return w.units.filter((u) => u.kind === 'goon'); }

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

test('RAID_BUREAU reconciliation emits one raid_warning FxEvent at the goon spawn', () => {
  const w = new World({ cycle: { editionDurationMs: 600_000, warningOffsetMs: 30_000 } });
  spawnRaid(w, 2);
  const frame = w.snapshot();
  const warnings = frame.effects.filter((e) => e.kind === 'raid_warning');
  assert.equal(warnings.length, 1, 'one raid_warning per RAID_BUREAU intent, not per goon');
  assert.equal(warnings[0].rival, 'evening_star');
  // Anchor at GOON_SPAWN_TILE (0,0) → world (-27, 0, -27).
  const expected = { x: GOON_SPAWN_TILE.x * 6 - 27, z: GOON_SPAWN_TILE.y * 6 - 27 };
  assert.equal(warnings[0].at.x, expected.x);
  assert.equal(warnings[0].at.z, expected.z);
});

test('goon dying from fixer intercept emits one death FxEvent with unit_kind:goon', () => {
  const w = new World({ cycle: { editionDurationMs: 600_000, warningOffsetMs: 30_000 } });
  const fixer = w.units.find((u) => u.kind === 'fixer');
  // Park the fixer at goon-spawn-adjacent so the first tick after raid is a kill.
  fixer.tile = { x: 0, y: 1 };
  fixer.pos = { x: 0 * 6 - 27, y: 0, z: 1 * 6 - 27 };
  spawnRaid(w, 1);
  // Drain the raid_warning emit so we read death cleanly.
  w.snapshot();
  advanceSeconds(w, 0.1);

  const frame = w.snapshot();
  const deaths = frame.effects.filter((e) => e.kind === 'death');
  assert.equal(deaths.length, 1, 'one death event per pruned goon');
  assert.equal(deaths[0].unit_kind, 'goon');
  assert.equal(typeof deaths[0].at.x, 'number');
  // No goons left in the world.
  assert.equal(goons(w).length, 0);
});

test('two goons killed in the same tick emit two death FxEvents', () => {
  const w = new World({ cycle: { editionDurationMs: 600_000, warningOffsetMs: 30_000 } });
  w.units = w.units.filter((u) => u.kind !== 'fixer');
  spawnRaid(w, 2);
  w.snapshot(); // drain raid_warning
  // Hand-kill both goons so the next tick's prune sees them.
  for (const g of goons(w)) g.hp = 0;
  advanceSeconds(w, 0.05);

  const frame = w.snapshot();
  const deaths = frame.effects.filter((e) => e.kind === 'death');
  assert.equal(deaths.length, 2, 'one death per pruned unit');
  for (const d of deaths) assert.equal(d.unit_kind, 'goon');
});

test('reporter/photog death (HP→0) does NOT emit a death FxEvent at Tier-0', () => {
  // The prune filter skips reporter+photog (their HP path is sim-internal at
  // 0.9.3, no death fx). This test pins that contract.
  const w = new World({ cycle: { editionDurationMs: 600_000, warningOffsetMs: 30_000 } });
  const reporter = w.units.find((u) => u.kind === 'reporter');
  reporter.hp = 0;
  advanceSeconds(w, 0.05);
  const frame = w.snapshot();
  const deaths = frame.effects.filter((e) => e.kind === 'death');
  assert.equal(deaths.length, 0, 'reporter death is silent at Tier-0');
  // Reporter is still in the units array — the prune filter explicitly keeps them.
  assert.ok(w.units.some((u) => u.kind === 'reporter'));
});
