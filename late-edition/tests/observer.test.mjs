import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Observer,
  TWO_EDITIONS,
  OBSERVER_START_CASH,
  OBSERVER_AMBIENT_REVENUE_PER_EDITION,
  OBSERVER_PUBLISH_COST,
  OBSERVER_DESPERATE_THRESHOLD,
  INVESTIGATE_TO_PUBLISH_EDITIONS,
  INVESTIGATE_LEAD_DURATION,
} from '../js/sim/observer.js';

// ICD-02 v0.3 §Observer state machine. Five states (INVESTIGATE | PUBLISH |
// WARN | DESPERATE | SILENCED) on a 1/2 EDITIONS tick cadence. 1.0.0 ships
// the INVESTIGATE / PUBLISH / WARN bodies; DESPERATE / SILENCED are
// shape-committed but caller-triggered.

function makeView({ edition = 1, heat = 0, leads = [], lies = [] } = {}) {
  return {
    cycle: { edition, remaining_ms: 720_000 },
    player: {
      heat_noisy: heat,
      visible_leads: leads.map((id) => ({ id, district: 'docks', tier: 'whisper', flavor: 'vice' })),
      visible_reporters: [],
      printed_lies: lies.map((lie) => ({ id: lie.id, heat_yield: lie.heat_yield, printed_in: lie.edition ?? 1 })),
    },
    own: { state: 'INVESTIGATE', posture: 'calm', past_intents: [] },
    edition_history: [],
  };
}

test('Observer starts in INVESTIGATE with calm posture and $500 cash', () => {
  const o = new Observer();
  assert.equal(o.state, 'INVESTIGATE');
  assert.equal(o.posture, 'calm');
  assert.equal(o.cash, OBSERVER_START_CASH);
  assert.equal(o.tickInterval, TWO_EDITIONS);
});

test('Observer advance() returns [] (cadence is 1/2 editions on the edition-end hook)', () => {
  const o = new Observer();
  assert.deepEqual(o.advance(makeView(), 1000), []);
});

test('Observer onEditionEnd is gated 1/2 editions (first run on 2nd call)', () => {
  const o = new Observer();
  const first = o.onEditionEnd(makeView({ leads: [] }));
  assert.deepEqual(first, []); // skipped
  const second = o.onEditionEnd(makeView({ leads: [] }));
  assert.equal(second.length, 1); // ran
});

test('Observer in INVESTIGATE emits INVESTIGATE_LEAD when a visible lead exists', () => {
  const o = new Observer();
  o.onEditionEnd(makeView({ leads: ['L1', 'L2'] })); // skipped
  const intents = o.onEditionEnd(makeView({ leads: ['L1', 'L2'] })); // ran
  assert.equal(intents.length, 1);
  assert.equal(intents[0].kind, 'INVESTIGATE_LEAD');
  assert.ok(['L1', 'L2'].includes(intents[0].leadId));
  assert.equal(intents[0].editions, INVESTIGATE_LEAD_DURATION);
  assert.equal(o.observingLeadId, intents[0].leadId);
});

test('Observer in INVESTIGATE emits PASS when no leads visible', () => {
  const o = new Observer();
  o.onEditionEnd(makeView({ leads: [] }));
  const intents = o.onEditionEnd(makeView({ leads: [] }));
  assert.equal(intents.length, 1);
  assert.equal(intents[0].kind, 'PASS');
});

test('Observer INVESTIGATE_LEAD targeting is deterministic across seeds', () => {
  const a = new Observer({ seed: 42 });
  const b = new Observer({ seed: 42 });
  a.onEditionEnd(makeView({ leads: ['L1', 'L2', 'L3'] })); a.onEditionEnd(makeView({ leads: ['L1', 'L2', 'L3'] }));
  b.onEditionEnd(makeView({ leads: ['L1', 'L2', 'L3'] })); b.onEditionEnd(makeView({ leads: ['L1', 'L2', 'L3'] }));
  assert.equal(a.observingLeadId, b.observingLeadId);
});

test('Observer cash grows by +$80/edition ambient revenue', () => {
  const o = new Observer();
  // Burn one skip + run the body
  o.onEditionEnd(makeView({ leads: ['L1'] }));
  o.onEditionEnd(makeView({ leads: ['L1'] }));
  assert.equal(o.cash, OBSERVER_START_CASH + OBSERVER_AMBIENT_REVENUE_PER_EDITION);
});

test('Observer transitions INVESTIGATE → WARN when tracked lead disappears (and emits POISON_LEAD)', () => {
  const o = new Observer();
  // First Observer-tick (with skip): emits INVESTIGATE_LEAD targeting L1.
  o.onEditionEnd(makeView({ leads: ['L1'] }));
  o.onEditionEnd(makeView({ leads: ['L1'] }));
  assert.equal(o.observingLeadId, 'L1');
  // Next ticks: lead removed → triggers WARN + POISON_LEAD.
  o.onEditionEnd(makeView({ leads: [] }));
  const intents = o.onEditionEnd(makeView({ leads: [] }));
  assert.equal(o.state, 'WARN');
  assert.equal(intents.length, 1);
  assert.equal(intents[0].kind, 'POISON_LEAD');
  assert.equal(intents[0].leadId, 'L1');
});

test('Observer WARN → INVESTIGATE auto-flip on next tick', () => {
  const o = new Observer();
  o.state = 'WARN';
  o.editionsInState = 0;
  // Skip + run.
  o.onEditionEnd(makeView({ leads: ['L1'] }));
  o.onEditionEnd(makeView({ leads: ['L1'] }));
  assert.equal(o.state, 'INVESTIGATE');
});

test('Observer transitions INVESTIGATE → PUBLISH after 3 ticks + printed_lies (and emits PUBLISH_COUNTER)', () => {
  const o = new Observer();
  o.observingLeadId = 'L-keep-me'; // pre-seed so lead-disappearance doesn't fire WARN
  const lies = [
    { id: 'S1', heat_yield: 5,  edition: 1 },
    { id: 'S2', heat_yield: 20, edition: 2 },
    { id: 'S3', heat_yield: 10, edition: 3 },
  ];
  // Need editionsInState to climb to >= 3.
  o.editionsInState = INVESTIGATE_TO_PUBLISH_EDITIONS;
  // Skip + run.
  o.onEditionEnd(makeView({ leads: [{ id: 'L-keep-me' }].map((l) => l.id), lies }));
  const intents = o.onEditionEnd(makeView({ leads: ['L-keep-me'], lies }));
  assert.equal(o.state, 'PUBLISH');
  assert.equal(intents.length, 1);
  assert.equal(intents[0].kind, 'PUBLISH_COUNTER');
  assert.equal(intents[0].storyId, 'S2'); // worst heat_yield
});

test('Observer PUBLISH_COUNTER costs $150 from cash', () => {
  const o = new Observer();
  o.state = 'INVESTIGATE';
  o.observingLeadId = 'L-keep-me';
  o.editionsInState = INVESTIGATE_TO_PUBLISH_EDITIONS;
  o.onEditionEnd(makeView({ leads: ['L-keep-me'], lies: [{ id: 'S1', heat_yield: 5 }] }));
  o.onEditionEnd(makeView({ leads: ['L-keep-me'], lies: [{ id: 'S1', heat_yield: 5 }] }));
  // +80 ambient -150 publish cost = net -70
  assert.equal(o.cash, OBSERVER_START_CASH + OBSERVER_AMBIENT_REVENUE_PER_EDITION - OBSERVER_PUBLISH_COST);
});

test('Observer PUBLISH → INVESTIGATE auto-flip on next tick', () => {
  const o = new Observer();
  o.state = 'PUBLISH';
  o.editionsInState = 0;
  o.onEditionEnd(makeView({ leads: ['L1'] }));
  o.onEditionEnd(makeView({ leads: ['L1'] }));
  assert.equal(o.state, 'INVESTIGATE');
});

test('Observer INVESTIGATE → DESPERATE when cash drops below $200', () => {
  const o = new Observer();
  o.cash = OBSERVER_DESPERATE_THRESHOLD - OBSERVER_AMBIENT_REVENUE_PER_EDITION - 1; // 200-80-1 = 119
  o.onEditionEnd(makeView({ leads: [] })); // skip
  o.onEditionEnd(makeView({ leads: [] })); // run — cash += 80 → 199, still < 200
  assert.equal(o.state, 'DESPERATE');
});

// 1.2.0 (ICD-02 v0.3.3 §DESPERATE body): the INVESTIGATE → DESPERATE transition
// emits a PARTNER_REQUEST one-time. Subsequent DESPERATE editions PASS by
// virtue of the self-loop branch never reaching the emit — no explicit
// emitted-flag is needed because the emission is bound to the transition.
test('Observer INVESTIGATE → DESPERATE emits PARTNER_REQUEST with the world.district_heat argmax district', () => {
  const o = new Observer();
  o.cash = OBSERVER_DESPERATE_THRESHOLD - OBSERVER_AMBIENT_REVENUE_PER_EDITION - 1;
  const view = makeView({ leads: [] });
  view.world = { district_heat: { docks: 10, hillside: 45 }, observer_publish_suppressed: 0 };
  o.onEditionEnd(view); // skip
  const intents = o.onEditionEnd(view); // run — fires DESPERATE
  assert.equal(o.state, 'DESPERATE');
  assert.equal(intents.length, 1);
  assert.equal(intents[0].kind, 'PARTNER_REQUEST');
  assert.equal(intents[0].district, 'hillside');
});

test('Observer DESPERATE body emits PASS on subsequent editions (PARTNER_REQUEST is transition-once)', () => {
  const o = new Observer();
  o.state = 'DESPERATE';
  o.cash = 50;
  // Burn the cadence skip + run; should PASS.
  o.onEditionEnd(makeView());
  const intents = o.onEditionEnd(makeView());
  assert.equal(intents.length, 1);
  assert.equal(intents[0].kind, 'PASS');
});

test('Observer skips PUBLISH while world.observer_publish_suppressed > 0', () => {
  const o = new Observer();
  o.state = 'INVESTIGATE';
  o.observingLeadId = 'L-keep-me';
  o.editionsInState = INVESTIGATE_TO_PUBLISH_EDITIONS;
  const view = makeView({ leads: ['L-keep-me'], lies: [{ id: 'S1', heat_yield: 100 }] });
  view.world = { district_heat: {}, observer_publish_suppressed: 3 };
  o.onEditionEnd(view); // skip
  const intents = o.onEditionEnd(view); // run — would normally PUBLISH
  assert.notEqual(o.state, 'PUBLISH');
  assert.notEqual(intents[0].kind, 'PUBLISH_COUNTER');
});

test('Observer DESPERATE → INVESTIGATE via acceptPartner()', () => {
  const o = new Observer();
  o.state = 'DESPERATE';
  o.cash = 50;
  assert.equal(o.acceptPartner(), true);
  assert.equal(o.state, 'INVESTIGATE');
  assert.equal(o.cash, 550); // +$500 partner payment
});

test('Observer DESPERATE → INVESTIGATE via declinePartner()', () => {
  const o = new Observer();
  o.state = 'DESPERATE';
  o.cash = 50;
  assert.equal(o.declinePartner(), true);
  assert.equal(o.state, 'INVESTIGATE');
  assert.equal(o.cash, 50); // no payment on decline
});

test('Observer * → SILENCED via frame() caller method', () => {
  const o = new Observer();
  o.state = 'INVESTIGATE';
  o.observingLeadId = 'L1';
  assert.equal(o.frame(), true);
  assert.equal(o.state, 'SILENCED');
  assert.equal(o.observingLeadId, null);
});

test('Observer SILENCED → INVESTIGATE after 3 editions pass', () => {
  const o = new Observer();
  o.state = 'SILENCED';
  o.editionsInState = 0;
  // The auto-flip fires at the top of the 4th tick (the predicate checks
  // editionsInState >= 3, and the counter increments at the end of each tick).
  // So we need 3 ticks to accumulate the count, plus one more to flip.
  for (let i = 0; i < 4; i++) {
    o.onEditionEnd(makeView()); // skip
    o.onEditionEnd(makeView()); // run
  }
  assert.equal(o.state, 'INVESTIGATE');
});

test('Observer posture mapping never returns hostile', () => {
  const o = new Observer();
  for (const state of ['INVESTIGATE', 'PUBLISH', 'WARN', 'DESPERATE', 'SILENCED']) {
    o.state = state;
    assert.notEqual(o.posture, 'hostile', `state ${state} must not map to hostile (rival-ai-spec §05 — never hostile except via information)`);
  }
});

// 1.1.0 (ICD-02 v0.3.2 §Notes · ICD-10 v0.1.1 observer_silent_n_editions).
test('Observer recentStates pushes each edition and caps at 5', () => {
  const o = new Observer();
  for (let i = 0; i < 7; i++) o.onEditionEnd(makeView({ edition: i + 1, leads: [] }));
  assert.equal(o.recentStates.length, 5);
  // All entries should be valid state names (no PASS / intent kinds).
  for (const s of o.recentStates) {
    assert.ok(
      ['INVESTIGATE', 'PUBLISH', 'WARN', 'DESPERATE', 'SILENCED'].includes(s),
      `unexpected entry: ${s}`,
    );
  }
});

test('Observer recentStates round-trips via snap (save.js shape)', () => {
  const o = new Observer();
  o.recentStates = ['INVESTIGATE', 'PUBLISH', 'INVESTIGATE'];
  // Manually round-trip through the snap shape (the save.js helper writes
  // recent_states; restore reads it).
  const restored = Observer.fromSnap({
    id: 'observer',
    state: o.state,
    cash: o.cash,
    observing_lead_id: o.observingLeadId,
    editions_in_state: o.editionsInState,
    edition_tick: o._editionTick,
    past_intents: o.pastIntents,
    rng: { state: o.rng.state },
    recent_states: o.recentStates,
  });
  assert.deepEqual(restored.recentStates, ['INVESTIGATE', 'PUBLISH', 'INVESTIGATE']);
});

test('Observer fromSnap defaults recentStates to [] for pre-1.1.0 saves', () => {
  const restored = Observer.fromSnap({
    id: 'observer',
    state: 'INVESTIGATE',
    cash: 500,
    observing_lead_id: null,
    editions_in_state: 0,
    edition_tick: 0,
    past_intents: [],
    rng: { state: 1 },
    // recent_states intentionally absent
  });
  assert.deepEqual(restored.recentStates, []);
});
