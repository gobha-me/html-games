import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, BUYOUT_OFFER_AMOUNT } from '../js/sim/world-state.js';

// 1.5.0 (ICD-02 v0.3.4 §Herald §BUYOUT body · ICD-06 §Notes addendum).
// World.acceptBuyout adds the offer amount to player cash, sets
// World.endingState='establishment', sets gameOver=true, and emits
// CYCLE_ESTABLISHMENT_ENDING — the game-over overlay subscribes alongside
// CYCLE_GAME_OVER to mount the win banner. World.declineBuyout clears the
// offer + locks Herald into PUNISH via Herald.declineBuyout.

function getHerald(w) { return w.rivals.find((r) => r.id === 'herald'); }

// Helper: put Herald in BUYOUT with an outstanding offer.
function primeBuyoutOffer(w) {
  const herald = getHerald(w);
  herald.state = 'BUYOUT';
  herald.buyoutOfferEmitted = false;
  w._reconcileIntent(herald, { kind: 'OFFER_BUYOUT', amount: BUYOUT_OFFER_AMOUNT });
}

test('OFFER_BUYOUT reconciler sets World.buyoutOffer', () => {
  const w = new World();
  primeBuyoutOffer(w);
  assert.ok(w.buyoutOffer);
  assert.equal(w.buyoutOffer.amount, BUYOUT_OFFER_AMOUNT);
  assert.equal(w.buyoutOffer.editionEmitted, w.cycle.edition);
  const ev = w._pendingRivalEvents.find((e) => e.kind === 'buyout_offer');
  assert.ok(ev, 'reconciler should push a buyout_offer event');
});

test('acceptBuyout refuses when no offer is pending', () => {
  const w = new World();
  const r = w.acceptBuyout();
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no_offer');
});

test('acceptBuyout adds offer amount to cash, sets endingState, sets gameOver, emits CYCLE_ESTABLISHMENT_ENDING', () => {
  const w = new World();
  const events = [];
  w.subscribeCycle((ev) => events.push(ev));
  primeBuyoutOffer(w);
  const cashBefore = w.resources.cash;
  const r = w.acceptBuyout();
  assert.equal(r.ok, true);
  assert.equal(w.resources.cash, cashBefore + BUYOUT_OFFER_AMOUNT, 'player banked the buyout');
  assert.equal(w.endingState, 'establishment');
  assert.equal(w.gameOver, true, 'sim freezes via gameOver flag');
  assert.equal(w.buyoutOffer, null, 'pending offer clears');
  const ending = events.find((e) => e.kind === 'CYCLE_ESTABLISHMENT_ENDING');
  assert.ok(ending, 'should emit CYCLE_ESTABLISHMENT_ENDING');
  assert.equal(ending.edition, w.cycle.edition);
});

test('acceptBuyout refuses when Herald is not in BUYOUT (defensive)', () => {
  const w = new World();
  primeBuyoutOffer(w);
  // Drag Herald out of BUYOUT out-of-band — simulates an out-of-band
  // state mutation between OFFER_BUYOUT and acceptance.
  getHerald(w).state = 'IDLE';
  const r = w.acceptBuyout();
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'herald_not_buyout');
  assert.equal(w.buyoutOffer, null, 'stale offer is cleared on refusal');
});

test('declineBuyout refuses when no offer is pending', () => {
  const w = new World();
  const r = w.declineBuyout();
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no_offer');
});

test('declineBuyout clears offer with no cash change, locks Herald into PUNISH', () => {
  const w = new World();
  primeBuyoutOffer(w);
  const cashBefore = w.resources.cash;
  const r = w.declineBuyout();
  assert.equal(r.ok, true);
  assert.equal(w.resources.cash, cashBefore, 'no cash transfer on decline');
  assert.equal(w.buyoutOffer, null);
  const herald = getHerald(w);
  assert.equal(herald.state, 'PUNISH');
  assert.equal(herald.buyoutDeclined, true);
  // No ending state — game continues.
  assert.equal(w.endingState, null);
  assert.equal(w.gameOver, false);
});

test('WorldFrame.buyoutOffer projects amount only (no editionEmitted)', () => {
  const w = new World();
  const f0 = w.snapshot();
  assert.equal(f0.buyoutOffer, null);
  primeBuyoutOffer(w);
  const f1 = w.snapshot();
  assert.deepEqual(f1.buyoutOffer, { amount: BUYOUT_OFFER_AMOUNT });
});

test('World.endingState defaults to null on a fresh world', () => {
  const w = new World();
  assert.equal(w.endingState, null);
});
