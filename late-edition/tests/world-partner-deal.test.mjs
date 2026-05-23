import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, PARTNER_DEAL_COST, PARTNER_DEAL_EDITIONS } from '../js/sim/world-state.js';

// 1.2.0 (ICD-02 v0.3.3 §DESPERATE body): partner-deal lifecycle through the
// World. Tests cover Observer-side emission via the reconciler, the
// acceptPartnerOffer / declinePartnerOffer wrappers (cash transfer, PUBLISH
// suppression for PARTNER_DEAL_EDITIONS editions, plating gate in the
// nominated district, deal expiry), and the WorldFrame projection that the
// HUD reads.

function getObserver(w) { return w.rivals.find((r) => r.id === 'observer'); }
function getDarkroom(w) { return w.buildings.find((b) => b.kind === 'darkroom'); }

// Move the Observer into DESPERATE via the natural transition: low cash and
// the 1/2-edition cadence gate. Returns the PARTNER_REQUEST intent emitted.
// Mirrors how the live World.tick() exercises the reconciler.
function fireDesperateTransition(w) {
  const o = getObserver(w);
  // Push cash below the threshold so the next observer tick fires DESPERATE.
  o.cash = 50;
  // The World calls onEditionEnd inside ackDebrief; using _reconcileIntent
  // directly here keeps the test focused on the reconciler branch (the
  // observer-edition-cadence is covered in tests/observer.test.mjs).
  const view = w._buildRivalView(o);
  // Burn one edition tick to get past the 1/2 cadence gate.
  o.onEditionEnd(view);
  const view2 = w._buildRivalView(o);
  const intents = o.onEditionEnd(view2);
  for (const intent of intents) w._reconcileIntent(o, intent);
  return intents;
}

test('Observer reconciler — PARTNER_REQUEST sets World.partnerOffer', () => {
  const w = new World();
  // Seed district heat so the Observer's argmax picks a non-default district.
  w.districtHeat.docks = 0;
  w.districtHeat.hillside = 42;
  const intents = fireDesperateTransition(w);
  const partner = intents.find((i) => i.kind === 'PARTNER_REQUEST');
  assert.ok(partner, 'Observer should emit PARTNER_REQUEST on INVESTIGATE → DESPERATE');
  assert.equal(partner.district, 'hillside');
  assert.ok(w.partnerOffer);
  assert.equal(w.partnerOffer.district, 'hillside');
});

test('Observer reconciler — PARTNER_REQUEST emits a partner_request rival event', () => {
  const w = new World();
  fireDesperateTransition(w);
  const ev = w._pendingRivalEvents.find((e) => e.kind === 'partner_request');
  assert.ok(ev, 'reconciler should push a partner_request event');
  assert.equal(ev.rival, 'observer');
});

test('Observer district nomination falls back to default when district_heat is all zero', () => {
  const w = new World();
  // Default constructor sets all district heats to 0 — argmax picks the
  // first DISTRICTS entry (docks) deterministically.
  fireDesperateTransition(w);
  assert.equal(w.partnerOffer.district, 'docks');
});

test('acceptPartnerOffer — refuses when no offer is pending', () => {
  const w = new World();
  const r = w.acceptPartnerOffer();
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no_offer');
});

test('acceptPartnerOffer — refuses when player cash is insufficient', () => {
  const w = new World();
  w.resources.cash = PARTNER_DEAL_COST - 1;
  fireDesperateTransition(w);
  const r = w.acceptPartnerOffer();
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'insufficient_cash');
  // Offer should NOT be cleared — player can save up and try again.
  assert.ok(w.partnerOffer);
});

test('acceptPartnerOffer — debits PARTNER_DEAL_COST, sets activePartnerDeal, suppresses PUBLISH', () => {
  const w = new World();
  w.resources.cash = PARTNER_DEAL_COST + 100;
  fireDesperateTransition(w);
  const district = w.partnerOffer.district;
  const r = w.acceptPartnerOffer();
  assert.equal(r.ok, true);
  assert.equal(w.resources.cash, 100);
  assert.equal(w.partnerOffer, null);
  assert.ok(w.activePartnerDeal);
  assert.equal(w.activePartnerDeal.district, district);
  assert.equal(w.activePartnerDeal.editionsRemaining, PARTNER_DEAL_EDITIONS);
  assert.equal(w.observerPublishSuppressed, PARTNER_DEAL_EDITIONS);
  assert.equal(getObserver(w).state, 'INVESTIGATE');
});

test('declinePartnerOffer — clears offer with no cash change', () => {
  const w = new World();
  w.resources.cash = 1000;
  fireDesperateTransition(w);
  const r = w.declinePartnerOffer();
  assert.equal(r.ok, true);
  assert.equal(w.resources.cash, 1000);
  assert.equal(w.partnerOffer, null);
  assert.equal(w.activePartnerDeal, null);
  assert.equal(w.observerPublishSuppressed, 0);
  assert.equal(getObserver(w).state, 'INVESTIGATE');
});

test('plating gate — verified stories in the deal district stay verified across DEADLINE_FIRE', () => {
  const w = new World();
  w.resources.cash = PARTNER_DEAL_COST + 1000;
  w.resources.ink = 100;
  fireDesperateTransition(w);
  const district = w.partnerOffer.district;
  w.acceptPartnerOffer();
  // Plant a verified story in the deal district at the Darkroom.
  const darkroom = getDarkroom(w);
  const story = {
    id: 's-blocked',
    state: 'verified',
    district,
    flavor: 'vice',
    tier: 'whisper',
    truthful: true,
    spawned_at_ms: 0,
    tile: { x: 0, y: 0 },
    picked_up_by: null,
    held_by_building: darkroom.id,
    headline: 'BLOCKED HEADLINE',
  };
  w.stories.push(story);
  w._fireDebrief();
  assert.equal(story.state, 'verified', 'deal-district story must NOT plate');
});

test('plating gate — verified stories outside the deal district still plate', () => {
  const w = new World();
  w.resources.cash = PARTNER_DEAL_COST + 1000;
  w.resources.ink = 100;
  fireDesperateTransition(w);
  const dealDistrict = w.partnerOffer.district;
  const otherDistrict = dealDistrict === 'docks' ? 'hillside' : 'docks';
  w.acceptPartnerOffer();
  const darkroom = getDarkroom(w);
  const story = {
    id: 's-free',
    state: 'verified',
    district: otherDistrict,
    flavor: 'money',
    tier: 'whisper',
    truthful: true,
    spawned_at_ms: 0,
    tile: { x: 0, y: 0 },
    picked_up_by: null,
    held_by_building: darkroom.id,
    headline: 'FREE HEADLINE',
  };
  w.stories.push(story);
  w._fireDebrief();
  assert.equal(story.state, 'printed', 'non-deal-district story should plate normally');
});

test('deal expiry — activePartnerDeal clears after PARTNER_DEAL_EDITIONS editions', () => {
  const w = new World();
  w.resources.cash = PARTNER_DEAL_COST + 100;
  fireDesperateTransition(w);
  w.acceptPartnerOffer();
  // Fire the deal tick-down each edition by stepping fire → ack.
  for (let i = 0; i < PARTNER_DEAL_EDITIONS; i++) {
    w._fireDebrief();
    w.ackDebrief();
  }
  assert.equal(w.activePartnerDeal, null);
  assert.equal(w.observerPublishSuppressed, 0);
});

test('PUBLISH suppression — Observer skips PUBLISH while a deal is active', () => {
  const w = new World();
  w.resources.cash = PARTNER_DEAL_COST + 100;
  fireDesperateTransition(w);
  w.acceptPartnerOffer();
  // Prime the Observer to be one tick away from PUBLISH: editionsInState
  // at the threshold + a printed_lies entry in view. We construct the view
  // manually to skip the player-printed-lies pipeline.
  const o = getObserver(w);
  o.state = 'INVESTIGATE';
  o.observingLeadId = 'L-noop';
  o.editionsInState = 3;
  const baseView = w._buildRivalView(o);
  const view = {
    ...baseView,
    player: { ...baseView.player, printed_lies: [{ id: 'S1', heat_yield: 100, printed_in: 1 }] },
  };
  // Burn cadence + run; PUBLISH should NOT fire while suppressed.
  o.onEditionEnd(view);
  const intents = o.onEditionEnd(view);
  assert.notEqual(intents[0].kind, 'PUBLISH_COUNTER');
  assert.notEqual(o.state, 'PUBLISH');
});

test('WorldFrame.partnerOffer / activePartnerDeal project correctly', () => {
  const w = new World();
  const f0 = w.snapshot();
  assert.equal(f0.partnerOffer, null);
  assert.equal(f0.activePartnerDeal, null);

  w.resources.cash = PARTNER_DEAL_COST + 100;
  fireDesperateTransition(w);
  const district = w.partnerOffer.district;
  const f1 = w.snapshot();
  assert.deepEqual(f1.partnerOffer, {
    district,
    cost: PARTNER_DEAL_COST,
    editions: PARTNER_DEAL_EDITIONS,
  });
  assert.equal(f1.activePartnerDeal, null);

  w.acceptPartnerOffer();
  const f2 = w.snapshot();
  assert.equal(f2.partnerOffer, null);
  assert.deepEqual(f2.activePartnerDeal, {
    district,
    editionsRemaining: PARTNER_DEAL_EDITIONS,
  });
});
