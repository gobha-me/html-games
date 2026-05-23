import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Herald, BUYOUT_OFFER_AMOUNT } from '../js/sim/herald.js';

// 1.5.0 (ICD-02 v0.3.4 §Herald §BUYOUT body). On WIRED→BUYOUT entry Herald
// emits OFFER_BUYOUT { amount: 50_000 } one-time; subsequent BUYOUT ticks
// PASS until the caller accepts (returns true; World handles Establishment
// ending) or declines (sets buyoutDeclined, flips to PUNISH for the run).

function makeView({ edition = 1, heat = 0, remainingMs = 720_000 } = {}) {
  return {
    cycle: { edition, remaining_ms: remainingMs },
    player: { heat_noisy: heat, visible_leads: [], visible_reporters: [] },
    own: { state: 'IDLE', posture: 'calm', past_intents: [] },
    edition_history: [],
  };
}

test('Herald BUYOUT_OFFER_AMOUNT is 50_000 (design HTML §03 "$50k flat")', () => {
  assert.equal(BUYOUT_OFFER_AMOUNT, 50_000);
});

test('Herald WIRED→BUYOUT transition emits OFFER_BUYOUT { amount: 50_000 } once', () => {
  const h = new Herald();
  h.state = 'WIRED';
  h.isWired = true;
  const intents = h.onEditionEnd(makeView({ edition: 25, heat: 20 }));
  assert.equal(h.state, 'BUYOUT');
  assert.equal(intents.length, 1);
  assert.equal(intents[0].kind, 'OFFER_BUYOUT');
  assert.equal(intents[0].amount, 50_000);
  assert.equal(h.buyoutOfferEmitted, true);
});

test('Herald BUYOUT self-loops PASS after the one-time OFFER_BUYOUT emit', () => {
  const h = new Herald();
  h.state = 'WIRED';
  h.isWired = true;
  h.onEditionEnd(makeView({ edition: 25, heat: 20 })); // emits OFFER_BUYOUT
  const intents = h.onEditionEnd(makeView({ edition: 26, heat: 20 }));
  assert.equal(h.state, 'BUYOUT');
  assert.equal(intents[0].kind, 'PASS');
});

test('Herald BUYOUT acceptBuyout() returns true and leaves state in BUYOUT (World owns the ending)', () => {
  const h = new Herald();
  h.state = 'BUYOUT';
  h.buyoutOfferEmitted = true;
  assert.equal(h.acceptBuyout(), true);
  // Herald state stays BUYOUT — World.acceptBuyout drives the
  // CYCLE_ESTABLISHMENT_ENDING emit + gameOver flip; Herald is just the gate.
  assert.equal(h.state, 'BUYOUT');
});

test('Herald acceptBuyout() refuses when not in BUYOUT', () => {
  const h = new Herald();
  assert.equal(h.acceptBuyout(), false);
  h.state = 'WIRED';
  assert.equal(h.acceptBuyout(), false);
  h.state = 'PUNISH';
  assert.equal(h.acceptBuyout(), false);
});

test('Herald declineBuyout() flips state to PUNISH and latches buyoutDeclined=true', () => {
  const h = new Herald();
  h.state = 'BUYOUT';
  h.buyoutOfferEmitted = true;
  assert.equal(h.declineBuyout(), true);
  assert.equal(h.state, 'PUNISH');
  assert.equal(h.buyoutDeclined, true);
  assert.equal(h.editionsInPunish, 0);
});

test('Herald declineBuyout() refuses when not in BUYOUT', () => {
  const h = new Herald();
  assert.equal(h.declineBuyout(), false);
  h.state = 'WIRED';
  assert.equal(h.declineBuyout(), false);
});

test('Herald buyoutDeclined forces PUNISH even if state drifts (defensive)', () => {
  const h = new Herald();
  h.buyoutDeclined = true;
  h.state = 'IDLE';
  h.onEditionEnd(makeView({ edition: 30, heat: 40 }));
  assert.equal(h.state, 'PUNISH', 'buyoutDeclined re-asserts PUNISH every edition');
});

test('Herald BUYOUT entry guard — heat < 30 AND edition >= 25 required', () => {
  const h = new Herald();
  h.state = 'WIRED';
  h.isWired = true;
  // Heat too high
  h.onEditionEnd(makeView({ edition: 30, heat: 40 }));
  assert.equal(h.state, 'WIRED');
  // Edition too low
  h.state = 'WIRED';
  h.isWired = true;
  h.onEditionEnd(makeView({ edition: 24, heat: 10 }));
  assert.equal(h.state, 'WIRED');
});
