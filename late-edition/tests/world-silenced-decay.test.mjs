import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, SILENCED_DECAY_FACTOR } from '../js/sim/world-state.js';
import { HEAT_DECAY_PER_EDITION, HEAT_DECAY_QUIET_EDITION } from '../js/sim/resources.js';

// 1.2.0 (ICD-02 v0.3.3 §SILENCED body): while ANY rival has state === 'SILENCED'
// the player's per-edition heat decay (Design Doc §19, ackDebrief()) is
// multiplied by SILENCED_DECAY_FACTOR (< 1). Heat persists longer — the city
// notices the silence and the player carries the suspicion. Tests pin the
// multiplier behavior and the no-rival-silenced baseline.

function getObserver(w) { return w.rivals.find((r) => r.id === 'observer'); }

// Drive a fire→ack cycle without leads/stories so heat_applied stays 0 and
// the QUIET decay branch is exercised. Returns the heat delta this edition.
function quietEdition(w) {
  const before = w.resources.heat;
  w._fireDebrief();
  w.ackDebrief();
  return before - w.resources.heat;
}

test('baseline — quiet-edition decay matches HEAT_DECAY_QUIET_EDITION when no rival is SILENCED', () => {
  const w = new World();
  w.resources.heat = 40; // well below the stall threshold (80)
  const delta = quietEdition(w);
  assert.equal(delta, HEAT_DECAY_QUIET_EDITION);
});

test('SILENCED — quiet-edition decay scales by SILENCED_DECAY_FACTOR', () => {
  const w = new World();
  w.resources.heat = 40;
  getObserver(w).state = 'SILENCED';
  const delta = quietEdition(w);
  const expected = HEAT_DECAY_QUIET_EDITION * SILENCED_DECAY_FACTOR;
  assert.equal(delta, expected);
});

test('SILENCED multiplier reverts when the Observer leaves SILENCED', () => {
  const w = new World();
  w.resources.heat = 80; // headroom to absorb both editions
  getObserver(w).state = 'SILENCED';
  const silencedDelta = quietEdition(w);
  getObserver(w).state = 'INVESTIGATE';
  const normalDelta = quietEdition(w);
  // Sanity: silenced was less than normal.
  assert.ok(silencedDelta < normalDelta,
    `silenced ${silencedDelta} should be < normal ${normalDelta}`);
  assert.equal(normalDelta, HEAT_DECAY_QUIET_EDITION);
});

test('decay still stalls when heat exceeds the stall threshold (SILENCED does not bypass)', () => {
  const w = new World();
  w.resources.heat = 95; // > HEAT_DECAY_STALL_THRESHOLD (80)
  getObserver(w).state = 'SILENCED';
  const delta = quietEdition(w);
  assert.equal(delta, 0, 'stall rule must still hold while SILENCED');
});

test('SILENCED — controversial-edition decay also scales (the city watches every column)', () => {
  // _fireDebrief writes _lastSummary; we shortcut that by stubbing it
  // directly. Heat_applied > 0 selects the HEAT_DECAY_PER_EDITION branch.
  const w = new World();
  w.resources.heat = 40;
  w._lastSummary = { heat_applied: 10 };
  w.debriefOpen = true; // ackDebrief early-returns when this is false
  getObserver(w).state = 'SILENCED';
  const before = w.resources.heat;
  w.ackDebrief();
  const delta = before - w.resources.heat;
  assert.equal(delta, HEAT_DECAY_PER_EDITION * SILENCED_DECAY_FACTOR);
});
