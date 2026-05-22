import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Herald, ONE_EDITION } from '../js/sim/herald.js';
import { World } from '../js/sim/world-state.js';

// ICD-02 v0.3 §Herald state machine. Five states (IDLE | COURT | WIRED |
// PUNISH | BUYOUT), 1/EDITION tick cadence. All 8 transitions encoded; the
// IDLE / COURT / WIRED bodies wire at 1.0.0, the PUNISH / BUYOUT bodies are
// shape-committed but caller-triggered (acceptance UI lands at Tier-1.x).

function makeView({ edition = 1, heat = 0, remainingMs = 720_000 } = {}) {
  return {
    cycle: { edition, remaining_ms: remainingMs },
    player: { heat_noisy: heat, visible_leads: [], visible_reporters: [] },
    own: { state: 'IDLE', posture: 'calm', past_intents: [] },
    edition_history: [],
  };
}

test('Herald starts in IDLE state with calm posture', () => {
  const h = new Herald();
  assert.equal(h.state, 'IDLE');
  assert.equal(h.posture, 'calm');
  assert.equal(h.isWired, false);
  assert.equal(h.tickInterval, ONE_EDITION);
});

test('Herald advance() returns [] on every wall-clock frame (1/EDITION cadence)', () => {
  const h = new Herald();
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(h.advance(makeView(), 1000), []);
  }
});

test('Herald onEditionEnd emits PASS at 1.0.0 (intent vocabulary deferred)', () => {
  const h = new Herald();
  const intents = h.onEditionEnd(makeView({ edition: 1, heat: 0 }));
  assert.equal(intents.length, 1);
  assert.equal(intents[0].kind, 'PASS');
});

test('Herald IDLE → COURT fires after 2 consecutive editions of heat > 60', () => {
  const h = new Herald();
  h.onEditionEnd(makeView({ edition: 1, heat: 65 }));
  assert.equal(h.state, 'IDLE'); // one edition of high heat, not yet
  h.onEditionEnd(makeView({ edition: 2, heat: 70 }));
  assert.equal(h.state, 'COURT');
});

test('Herald IDLE → COURT predicate resets on a cool edition', () => {
  const h = new Herald();
  h.onEditionEnd(makeView({ edition: 1, heat: 65 }));
  h.onEditionEnd(makeView({ edition: 2, heat: 40 })); // counter resets
  h.onEditionEnd(makeView({ edition: 3, heat: 65 })); // counter restarts
  assert.equal(h.state, 'IDLE');
});

test('Herald COURT → IDLE after 2 editions of no caller response', () => {
  const h = new Herald();
  h.state = 'COURT';
  h.onEditionEnd(makeView({ edition: 5, heat: 70 }));
  assert.equal(h.state, 'COURT'); // 1 edition in court
  h.onEditionEnd(makeView({ edition: 6, heat: 70 }));
  assert.equal(h.state, 'IDLE'); // 2 editions → auto-decline
});

test('Herald COURT → WIRED via acceptWire() public method', () => {
  const h = new Herald();
  h.state = 'COURT';
  assert.equal(h.acceptWire(), true);
  assert.equal(h.state, 'WIRED');
  assert.equal(h.isWired, true);
  assert.equal(h.posture, 'calm');
});

test('Herald COURT → PUNISH via declineWire() public method', () => {
  const h = new Herald();
  h.state = 'COURT';
  assert.equal(h.declineWire(), true);
  assert.equal(h.state, 'PUNISH');
  assert.equal(h.isWired, false);
  assert.equal(h.posture, 'scheming');
});

test('Herald acceptWire() rejects when not in COURT', () => {
  const h = new Herald();
  assert.equal(h.acceptWire(), false);
  assert.equal(h.state, 'IDLE');
});

test('Herald PUNISH → IDLE after 1 edition cooldown', () => {
  const h = new Herald();
  h.state = 'PUNISH';
  h.onEditionEnd(makeView({ edition: 5, heat: 40 }));
  assert.equal(h.state, 'IDLE');
});

test('Herald IDLE → PUNISH on edition ≥ 10 AND heat > 80 AND !isWired', () => {
  const h = new Herald();
  h.onEditionEnd(makeView({ edition: 11, heat: 85 }));
  assert.equal(h.state, 'PUNISH');
});

test('Herald IDLE → PUNISH suppressed when isWired', () => {
  const h = new Herald();
  h.isWired = true;
  h.onEditionEnd(makeView({ edition: 11, heat: 85 }));
  // High-heat counter still bumps; consecutiveHighHeatEditions == 1; would need
  // a second high-heat edition to trigger IDLE → COURT (which itself is gated
  // by isWired? actually no — IDLE → COURT is heat-only). But IDLE → PUNISH is
  // blocked.
  assert.notEqual(h.state, 'PUNISH');
});

test('Herald WIRED → BUYOUT on edition ≥ 25 AND heat < 30', () => {
  const h = new Herald();
  h.state = 'WIRED';
  h.isWired = true;
  h.onEditionEnd(makeView({ edition: 25, heat: 20 }));
  assert.equal(h.state, 'BUYOUT');
  assert.equal(h.isWired, false);
  assert.equal(h.posture, 'scheming');
});

test('Herald WIRED → PUNISH via breakDeal() public method', () => {
  const h = new Herald();
  h.state = 'WIRED';
  h.isWired = true;
  assert.equal(h.breakDeal(), true);
  assert.equal(h.state, 'PUNISH');
  assert.equal(h.isWired, false);
});

test('Herald posture mapping never returns hostile', () => {
  const h = new Herald();
  for (const state of ['IDLE', 'COURT', 'WIRED', 'PUNISH', 'BUYOUT']) {
    h.state = state;
    assert.notEqual(h.posture, 'hostile', `state ${state} must not map to hostile (rival-ai-spec §03 — never sends goons)`);
  }
});

test('World seeds Herald into rivals array (frame.rivals includes herald)', () => {
  const w = new World();
  const f = w.snapshot();
  const ids = f.rivals.map((r) => r.id);
  assert.ok(ids.includes('herald'), 'expected herald in frame.rivals');
});

test('Herald iteration order is pinned: evening_star then herald (then observer)', () => {
  const w = new World();
  assert.equal(w.rivals[0].id, 'evening_star');
  assert.equal(w.rivals[1].id, 'herald');
});

test('World.ackDebrief invokes Herald.onEditionEnd per edition boundary', () => {
  const w = new World();
  const herald = w.rivals.find((r) => r.id === 'herald');
  // Push heat well above the noise band (RivalView applies ±20 noise; heat=100
  // keeps heat_noisy comfortably > 60 regardless of the rng roll).
  w.resources.heat = 100;
  // Drain to deadline + debrief.
  w.cycle.remainingMs = 100;
  w.tick(0.2);
  w.ackDebrief();
  // One edition processed; counter at 1.
  assert.equal(herald.consecutiveHighHeatEditions, 1);
  // Second edition.
  w.cycle.remainingMs = 100;
  w.tick(0.2);
  w.ackDebrief();
  // Two consecutive high-heat editions → Herald should be in COURT.
  assert.equal(herald.state, 'COURT');
});
