import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Herald,
  PUNISH_SCOOP_COOLDOWN,
} from '../js/sim/herald.js';

// 1.5.0 (ICD-02 v0.3.4 §Herald §PUNISH body). On entry to PUNISH (heat-driven
// IDLE→PUNISH, caller-driven decline paths, or buyoutDeclined-locked re-entry)
// Herald emits FILE_STORY { district, tier:'investigation', source:'herald' }
// subject to a 3-edition cooldown via lastScoopEdition. Tests cover the
// emit-on-entry path, the cooldown gate, the district-argmax nomination, the
// caller-decline path, and the buyoutDeclined lock.

function makeView({
  edition = 1,
  heat = 0,
  remainingMs = 720_000,
  districtHeat,
} = {}) {
  const v = {
    cycle: { edition, remaining_ms: remainingMs },
    player: { heat_noisy: heat, visible_leads: [], visible_reporters: [] },
    own: { state: 'IDLE', posture: 'calm', past_intents: [] },
    edition_history: [],
  };
  if (districtHeat !== undefined) {
    v.world = { district_heat: districtHeat, observer_publish_suppressed: 0 };
  }
  return v;
}

test('Herald IDLE→PUNISH transition emits FILE_STORY scoop on entry (heat-driven)', () => {
  const h = new Herald();
  const intents = h.onEditionEnd(makeView({
    edition: 11, heat: 85,
    districtHeat: { docks: 5, hillside: 50 },
  }));
  assert.equal(intents.length, 1);
  assert.equal(intents[0].kind, 'FILE_STORY');
  assert.equal(intents[0].tier, 'investigation');
  assert.equal(intents[0].source, 'herald');
  assert.equal(intents[0].district, 'hillside');
  assert.equal(h.lastScoopEdition, 11);
  // IDLE→PUNISH cascade leaves state PUNISH; resident PUNISH cooldown fires
  // on the NEXT onEditionEnd (snapshot rendered between calls shows the
  // player Herald in PUNISH for one full edition).
  assert.equal(h.state, 'PUNISH');
});

test('Herald PUNISH scoop district is argmax(district_heat) with DISTRICTS declaration-order tie-break', () => {
  const h = new Herald();
  const intents = h.onEditionEnd(makeView({
    edition: 11, heat: 85,
    districtHeat: { docks: 50, hillside: 50 },
  }));
  // Both districts tied → first DISTRICTS entry wins (docks per districts.js).
  assert.equal(intents[0].district, 'docks');
});

test('Herald PUNISH scoop emits PASS within the 3-edition cooldown window', () => {
  const h = new Herald();
  // Manual setup: place Herald in entry-edition PUNISH at edition 11 with a
  // prior scoop already recorded — exercises STEP 1's cooldown gate
  // independent of the cascade transitions (which could otherwise carry
  // Herald into COURT via consecutiveHighHeatEditions on a heat-driven run).
  h.state = 'PUNISH';
  h.editionsInPunish = 0;
  h.lastScoopEdition = 11;  // pretend the scoop already fired at edition 11
  const intents = h.onEditionEnd(makeView({ edition: 12, heat: 0 }));
  assert.equal(intents[0].kind, 'PASS', 'sinceLastScoop=1<3 — cooldown blocks');
  // lastScoopEdition stays at the original entry — cooldown didn't reset.
  assert.equal(h.lastScoopEdition, 11);
});

test('Herald PUNISH scoop re-emits after the 3-edition cooldown elapses', () => {
  // Drive PUNISH manually across editions to isolate body cooldown logic
  // from the heat→COURT cascade (consec >= 2 promotes IDLE to COURT before
  // the IDLE→PUNISH predicate, so a heat=85 chain would jump out of PUNISH
  // into COURT). Manual reset keeps the test focused on lastScoopEdition.
  const h = new Herald();
  h.state = 'PUNISH';
  h.editionsInPunish = 0;
  h.lastScoopEdition = 11;
  // E12: sinceLastScoop=1<3 → PASS.
  let intents = h.onEditionEnd(makeView({ edition: 12, heat: 0 }));
  assert.equal(intents[0].kind, 'PASS');
  // Re-enter PUNISH manually for E13.
  h.state = 'PUNISH';
  h.editionsInPunish = 0;
  intents = h.onEditionEnd(makeView({ edition: 13, heat: 0 }));
  assert.equal(intents[0].kind, 'PASS', 'sinceLastScoop=2<3 — cooldown blocks');
  // Re-enter PUNISH manually for E14 — cooldown re-arms.
  h.state = 'PUNISH';
  h.editionsInPunish = 0;
  intents = h.onEditionEnd(makeView({ edition: 14, heat: 0 }));
  assert.equal(intents[0].kind, 'FILE_STORY', 'sinceLastScoop=3>=3 — cooldown re-arms');
  assert.equal(h.lastScoopEdition, 14);
});

test('Herald PUNISH_SCOOP_COOLDOWN constant is 3 (design HTML §03 "Once per 3 editions")', () => {
  assert.equal(PUNISH_SCOOP_COOLDOWN, 3);
});

test('Herald COURT→PUNISH via declineWire emits FILE_STORY on next edition', () => {
  const h = new Herald();
  h.state = 'COURT';
  // Caller decline between onEditionEnd calls.
  assert.equal(h.declineWire(), true);
  assert.equal(h.state, 'PUNISH');
  // First onEditionEnd after decline: body picks up the resident PUNISH state.
  const intents = h.onEditionEnd(makeView({ edition: 8, heat: 50 }));
  assert.equal(intents[0].kind, 'FILE_STORY');
  assert.equal(h.lastScoopEdition, 8);
});

test('Herald WIRED→PUNISH via breakDeal emits FILE_STORY on next edition', () => {
  const h = new Herald();
  h.state = 'WIRED';
  h.isWired = true;
  assert.equal(h.breakDeal(), true);
  assert.equal(h.state, 'PUNISH');
  const intents = h.onEditionEnd(makeView({ edition: 12, heat: 20 }));
  assert.equal(intents[0].kind, 'FILE_STORY');
});

test('Herald PUNISH→IDLE cooldown still fires after FILE_STORY emit (1-edition state)', () => {
  const h = new Herald();
  h.state = 'COURT';
  h.declineWire();
  h.onEditionEnd(makeView({ edition: 8, heat: 50 }));
  // After body emission, the PUNISH cooldown counter runs and Herald returns to IDLE.
  assert.equal(h.state, 'IDLE');
  assert.equal(h.editionsInPunish, 0);
});

test('Herald PUNISH→IDLE cooldown is SKIPPED while buyoutDeclined locks Herald in PUNISH', () => {
  const h = new Herald();
  h.state = 'BUYOUT';
  h.buyoutOfferEmitted = true;
  assert.equal(h.declineBuyout(), true);
  assert.equal(h.state, 'PUNISH');
  assert.equal(h.buyoutDeclined, true);
  // First onEditionEnd post-decline: scoop fires, Herald STAYS in PUNISH.
  const intents1 = h.onEditionEnd(makeView({ edition: 26, heat: 40 }));
  assert.equal(intents1[0].kind, 'FILE_STORY');
  assert.equal(h.state, 'PUNISH', 'buyoutDeclined must skip PUNISH→IDLE cooldown');
  // 3 editions later — scoop re-fires from the same locked state.
  h.onEditionEnd(makeView({ edition: 27, heat: 40 })); // PASS (cooldown)
  h.onEditionEnd(makeView({ edition: 28, heat: 40 })); // PASS (cooldown)
  const intents4 = h.onEditionEnd(makeView({ edition: 29, heat: 40 }));
  assert.equal(intents4[0].kind, 'FILE_STORY');
  assert.equal(h.state, 'PUNISH', 'locked Herald still in PUNISH after second scoop');
});

test('Herald PUNISH scoop without district_heat falls back to DEFAULT_DISTRICT_ID', () => {
  const h = new Herald();
  // makeView without districtHeat → view.world is undefined.
  const intents = h.onEditionEnd(makeView({ edition: 11, heat: 85 }));
  assert.equal(intents[0].kind, 'FILE_STORY');
  assert.equal(intents[0].district, 'docks', 'default district when world block omitted');
});
