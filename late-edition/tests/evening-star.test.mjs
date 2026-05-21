import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EveningStar,
  EVENING_STAR_TICK_INTERVAL_MS,
  PAST_INTENTS_BUFFER_CAP,
} from '../js/sim/evening-star.js';

// ICD-02 v0.2 — Evening Star state machine in isolation. Tests pin the
// SCAVENGE → RAID predicate, the goon-count band table, past-intents
// buffer/projection caps, and the RAID → SCAVENGE recovery on EDITION_DEBRIEF_END.
// Determinism: a seeded RNG drives the state machine — same seed → same intents.

function mkView({ edition = 1, remaining_ms = 600_000, heat_noisy = 50 } = {}) {
  return {
    cycle: { edition, remaining_ms },
    player: { heat_noisy, visible_leads: [], visible_reporters: [] },
    own: { state: 'SCAVENGE', posture: 'calm', past_intents: [] },
    edition_history: [],
  };
}

function advanceUntilTick(rival, view, ticks = 1) {
  const intents = [];
  for (let i = 0; i < ticks; i++) {
    const next = rival.advance(view, EVENING_STAR_TICK_INTERVAL_MS);
    intents.push(...next);
  }
  return intents;
}

test('tick interval — accumulator fires once per 20s elapsed', () => {
  const r = new EveningStar({ seed: 1, bureauId: 'b-1' });
  // 19.9s — no tick.
  const before = r.advance(mkView({ heat_noisy: 10 }), 19_900);
  assert.equal(before.length, 0);
  // +200ms — crosses 20s, fires one tick.
  const after = r.advance(mkView({ heat_noisy: 10 }), 200);
  assert.equal(after.length, 1);
  assert.equal(after[0].kind, 'PASS');
});

test('SCAVENGE → PASS when heat ≤ 40 — RAID predicate fails on heat alone', () => {
  const r = new EveningStar({ seed: 1, bureauId: 'b-1' });
  const intents = advanceUntilTick(r, mkView({ heat_noisy: 40 }), 10);
  assert.ok(intents.every((i) => i.kind === 'PASS'),
    `expected only PASS at heat ≤ 40, got: ${intents.map((i) => i.kind).join(',')}`);
});

test('SCAVENGE → RAID fires under seeded RNG when heat > 40 and cooldown clear', () => {
  // editionsSinceRaid default is large, so cooldown is satisfied immediately.
  // With seed=1 and heat 80, ~9 ticks gives high probability the rng.chance(0.18)
  // hits at least once. Determinism — assert reproducibility via two runs.
  const a = new EveningStar({ seed: 1, bureauId: 'b-7' });
  const a_intents = advanceUntilTick(a, mkView({ heat_noisy: 80 }), 12);
  const raidA = a_intents.find((i) => i.kind === 'RAID_BUREAU');
  assert.ok(raidA, 'expected at least one RAID_BUREAU within 12 ticks at heat 80');

  const b = new EveningStar({ seed: 1, bureauId: 'b-7' });
  const b_intents = advanceUntilTick(b, mkView({ heat_noisy: 80 }), 12);
  assert.deepEqual(b_intents, a_intents, 'same seed must produce identical intent stream');
});

test('RAID_BUREAU intent — goon count bands by heat (1/2/3)', () => {
  // We can't easily force a raid at a specific heat without lots of RNG advance,
  // so test the band table directly through the public goon emit when raid fires.
  // The simpler path: keep advancing until RAID; assert the goon count matches band.
  for (const { heat, goons } of [
    { heat: 50, goons: 1 },
    { heat: 70, goons: 2 },
    { heat: 90, goons: 3 },
  ]) {
    const r = new EveningStar({ seed: 1, bureauId: 'b-1' });
    let raid = null;
    for (let i = 0; i < 50 && !raid; i++) {
      const out = r.advance(mkView({ heat_noisy: heat }), EVENING_STAR_TICK_INTERVAL_MS);
      raid = out.find((it) => it.kind === 'RAID_BUREAU') ?? null;
    }
    assert.ok(raid, `RAID_BUREAU should eventually fire at heat ${heat}`);
    assert.equal(raid.goons, goons, `heat ${heat} should produce ${goons} goon(s)`);
    assert.equal(raid.target, 'b-1');
  }
});

test('RAID_BUREAU eta_ms is clamped to (remaining_ms - 1000) — multi-edition transit deferred', () => {
  const r = new EveningStar({ seed: 1, bureauId: 'b-1' });
  let raid = null;
  for (let i = 0; i < 50 && !raid; i++) {
    const out = r.advance(mkView({ heat_noisy: 80, remaining_ms: 5_000 }), EVENING_STAR_TICK_INTERVAL_MS);
    raid = out.find((it) => it.kind === 'RAID_BUREAU') ?? null;
  }
  assert.ok(raid);
  assert.equal(raid.eta_ms, 4_000, 'eta clamps to remaining - 1000');
});

test('past_intents buffer caps at 20 (ICD-02 §RivalView)', () => {
  const r = new EveningStar({ seed: 5, bureauId: 'b-1' });
  // Force many PASS emits.
  advanceUntilTick(r, mkView({ heat_noisy: 10 }), 30);
  assert.equal(r.pastIntents.length, PAST_INTENTS_BUFFER_CAP);
});

test('onEditionEnd transitions RAID → SCAVENGE and resets editionsSinceRaid', () => {
  const r = new EveningStar({ seed: 1, bureauId: 'b-1' });
  // Push the rival into RAID by replaying enough ticks at high heat.
  for (let i = 0; i < 50 && r.state !== 'RAID'; i++) {
    r.advance(mkView({ heat_noisy: 80 }), EVENING_STAR_TICK_INTERVAL_MS);
  }
  assert.equal(r.state, 'RAID');

  r.onEditionEnd();
  assert.equal(r.state, 'SCAVENGE');
  assert.equal(r.editionsSinceRaid, 0);
});

test('cooldown — RAID not re-entered until editionsSinceRaid > 1', () => {
  const r = new EveningStar({ seed: 1, bureauId: 'b-1' });
  for (let i = 0; i < 50 && r.state !== 'RAID'; i++) {
    r.advance(mkView({ heat_noisy: 80 }), EVENING_STAR_TICK_INTERVAL_MS);
  }
  r.onEditionEnd(); // RAID → SCAVENGE, editionsSinceRaid = 0
  // editionsSinceRaid = 0; predicate `editionsSinceRaid > 1` is false → no RAID.
  for (let i = 0; i < 30; i++) {
    const out = r.advance(mkView({ heat_noisy: 80 }), EVENING_STAR_TICK_INTERVAL_MS);
    assert.ok(out.every((it) => it.kind === 'PASS'),
      'no RAID allowed while editionsSinceRaid ≤ 1');
  }
  r.onEditionEnd(); // editionsSinceRaid = 1 (rival not in RAID, increments)
  r.onEditionEnd(); // editionsSinceRaid = 2 (now > 1)
  let raid = null;
  for (let i = 0; i < 50 && !raid; i++) {
    const out = r.advance(mkView({ heat_noisy: 80 }), EVENING_STAR_TICK_INTERVAL_MS);
    raid = out.find((it) => it.kind === 'RAID_BUREAU') ?? null;
  }
  assert.ok(raid, 'after two editions of rest, RAID becomes eligible again');
});

test('posture mapping — SCAVENGE → calm, RAID → hostile', () => {
  const r = new EveningStar({ seed: 1, bureauId: 'b-1' });
  assert.equal(r.state, 'SCAVENGE');
  assert.equal(r.posture, 'calm');
  r.state = 'RAID';
  assert.equal(r.posture, 'hostile');
  r.state = 'BRIBE';
  assert.equal(r.posture, 'scheming');
});
