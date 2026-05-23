// Late Edition — Observer rival (ICD-02 v0.3 — Observer state machine).
// The zero-aggression / low-reach rival — worker-owned, broke, honest, slow
// (rival-ai-spec.html §05). State machine lifted verbatim from §05 FIG. O1.
//
// Cadence: 1/2 EDITIONS. Slowest of the three rivals by design — the Observer
// is the moral landscape, not the adversary. advance() returns []; the state
// machine pass happens inside onEditionEnd(view), gated to every other call.
//
// 1.0.0 scope per issue #317 + ICD-02 v0.3:
//   - States with bodies: INVESTIGATE, PUBLISH, WARN.
//   - States shape-committed but caller-triggered: DESPERATE (needs partner-
//     acceptance UI), SILENCED (needs Tier-IV "Frame the Observer" arc).
//   - Intent emission: INVESTIGATE → INVESTIGATE_LEAD; PUBLISH entry →
//     PUBLISH_COUNTER (with +25 player heat applied by the world reconciler);
//     WARN entry → POISON_LEAD. POISON_LEAD has no world-side effect at 1.0.0
//     (the +5 heat-on-pickup penalty needs `story.poisoned` infra at Tier-1.x).
//   - INVESTIGATE → WARN detection: the lead Observer is tracking falls out
//     of view.player.visible_leads (picked up by player OR expired — both
//     fire WARN at 1.0.0; Tier-1.x distinguishes via a `picked_up` flag).
//
// 1.2.0 scope (ICD-02 v0.3.3):
//   - DESPERATE body wires: INVESTIGATE → DESPERATE transition emits
//     PARTNER_REQUEST one-time with `district = argmax(view.world.district_heat)`
//     (the Observer punishes where the player has accumulated the most heat;
//     deterministic tie-break by DISTRICTS declaration order via the
//     argmax helper). The World reconciler reads PARTNER_REQUEST and surfaces
//     it through WorldFrame.partnerOffer. acceptPartner / declinePartner stay
//     the caller exit. Subsequent DESPERATE editions still PASS — emission is
//     transition-once by construction (we emit on the INVESTIGATE branch, the
//     persistent DESPERATE/SILENCED branch below never reaches the emit).
//   - SILENCED body wires world-side: see SILENCED_DECAY_FACTOR in
//     world-state.js. Observer body itself stays PASS-only while SILENCED —
//     the "cannot publish/warn/investigate" rule is enforced by the
//     INVESTIGATE branch only being reached from `this.state === 'INVESTIGATE'`.
//   - PUBLISH suppression: when the player has accepted an active partner deal
//     the World projects `view.world.observer_publish_suppressed > 0` and the
//     INVESTIGATE → PUBLISH predicate skips. Observer still PASSes (and
//     accrues editionsInState) so the deal expiry returns it to normal cadence.

import { SeededRng } from './seeded-rng.js';
import { DISTRICTS, DEFAULT_DISTRICT_ID } from './districts.js';

// 1.2.0 (ICD-02 v0.3.3 §DESPERATE body): district nomination heuristic. Picks
// the district with the highest accumulated player heat (World.districtHeat).
// Tie-break is deterministic via DISTRICTS declaration order — the first
// district with the max value wins. Returns DEFAULT_DISTRICT_ID when the map
// is missing or all zero, so test fixtures without a world block still
// produce a valid PARTNER_REQUEST shape.
function pickHotterDistrict(districtHeat) {
  if (!districtHeat) return DEFAULT_DISTRICT_ID;
  let bestId = DEFAULT_DISTRICT_ID;
  let bestHeat = -Infinity;
  for (const d of DISTRICTS) {
    const h = districtHeat[d.id] ?? 0;
    if (h > bestHeat) {
      bestHeat = h;
      bestId = d.id;
    }
  }
  return bestId;
}

export const OBSERVER_ID = 'observer';
export const OBSERVER_KIND = 'observer';
export const TWO_EDITIONS = 'TWO_EDITIONS';
export const PAST_INTENTS_BUFFER_CAP = 20;
// 1.1.0 (ICD-02 v0.3.2 §Notes · ICD-10 v0.1.1 observer_silent_n_editions):
// rolling per-edition state ring. Pushed unconditionally inside onEditionEnd
// (before the 1/2-EDITIONS cadence gate) so every edition contributes one
// entry. Read by the arc trigger evaluator via ctx.observerRecentStates.
export const RECENT_STATES_BUFFER_CAP = 5;

// State→posture mapping (ICD-02 v0.3 §RivalStatusView — Observer).
// Observer never reaches `hostile` — §05 "never hostile except via information."
const POSTURE_BY_STATE = {
  INVESTIGATE: 'calm',
  PUBLISH:     'scheming',
  WARN:        'scheming',
  DESPERATE:   'scheming',
  SILENCED:    'calm',
};

// Cash model — ICD-02 v0.3 §Observer state machine §Notes "observer_cash":
//   start = $500 · +$80/edition ambient revenue · -$150 per PUBLISH_COUNTER cost.
// DESPERATE predicate: cash < $200. Stable in steady state — DESPERATE only
// fires after several rapid publishes against the player.
export const OBSERVER_START_CASH = 500;
export const OBSERVER_AMBIENT_REVENUE_PER_EDITION = 80;
export const OBSERVER_PUBLISH_COST = 150;
export const OBSERVER_DESPERATE_THRESHOLD = 200;
// Transition thresholds — ICD-02 v0.3 §Observer state machine.
export const INVESTIGATE_TO_PUBLISH_EDITIONS = 3;
export const SILENCED_DURATION_EDITIONS = 3;
export const INVESTIGATE_LEAD_DURATION = 3;

export class Observer {
  constructor({ id = OBSERVER_ID, seed = 1 } = {}) {
    this.id = id;
    this.kind = OBSERVER_KIND;
    this.tickInterval = TWO_EDITIONS;
    this.rng = new SeededRng(seed);
    this.state = 'INVESTIGATE';
    this.cash = OBSERVER_START_CASH;
    this.observingLeadId = null;
    this.editionsInState = 0;       // resets on every state transition
    this._editionTick = 0;          // counter for 1/2 editions cadence
    this.pastIntents = [];
    this.recentStates = [];         // 1.1.0 — per-edition state ring (cap 5)
  }

  static fromSnap(snap) {
    const o = new Observer({ id: snap.id, seed: 1 });
    o.state = snap.state;
    o.cash = snap.cash;
    o.observingLeadId = snap.observing_lead_id;
    o.editionsInState = snap.editions_in_state;
    o._editionTick = snap.edition_tick;
    o.pastIntents = snap.past_intents.slice();
    o.rng.state = snap.rng.state;
    o.recentStates = (snap.recent_states ?? []).slice();   // 1.1.0 (ICD-02 v0.3.2)
    return o;
  }

  get posture() {
    return POSTURE_BY_STATE[this.state] ?? 'calm';
  }

  advance(_rivalView, _dtMs) {
    return [];
  }

  // World calls this once per edition. Cadence gate at the top — Observer's
  // state-machine pass runs every 2nd call (rival-ai-spec.html §05 "tick 1/2
  // editions"). Returns Intent[] for the world's reconciler.
  //
  // The one-edition states (PUBLISH, WARN) auto-flip back to INVESTIGATE
  // at the top of the next tick — the entry tick is where the intent emits
  // happen (PUBLISH_COUNTER, POISON_LEAD). This keeps the state visible to
  // posture / debrief reads for the full tick.
  onEditionEnd(view) {
    this._editionTick += 1;
    // 1.1.0 (ICD-02 v0.3.2): record the state visible during this edition for
    // arc trigger predicates. Pushed every edition (not gated by the 2-edition
    // cadence) — the player perceives Observer's current state regardless of
    // whether its state machine ticked. State transitions below this gate
    // affect the NEXT edition's entry; this one captures what just was.
    this.recentStates.push(this.state);
    while (this.recentStates.length > RECENT_STATES_BUFFER_CAP) this.recentStates.shift();

    if (this._editionTick % 2 !== 0) return [];

    // Auto-flip one-edition states back to INVESTIGATE on the next tick.
    if (this.state === 'PUBLISH' || this.state === 'WARN') {
      this.state = 'INVESTIGATE';
      this.editionsInState = 0;
      this.observingLeadId = null;
    } else if (this.state === 'SILENCED' && this.editionsInState >= SILENCED_DURATION_EDITIONS) {
      this.state = 'INVESTIGATE';
      this.editionsInState = 0;
      this.observingLeadId = null;
    }

    // Ambient revenue per state-machine tick (ICD-02 v0.3 §Notes).
    this.cash += OBSERVER_AMBIENT_REVENUE_PER_EDITION;

    // Detect "the lead Observer is tracking has fallen out of visible_leads."
    let leadDisappeared = false;
    if (this.observingLeadId) {
      const stillVisible = view.player.visible_leads.some((l) => l.id === this.observingLeadId);
      if (!stillVisible) leadDisappeared = true;
    }

    // INVESTIGATE transitions — order: WARN (most specific, most recent
    // player action) → PUBLISH (medium specific, multi-edition build-up) →
    // DESPERATE (cash floor). Each emits its entry intent in the same tick.
    if (this.state === 'INVESTIGATE') {
      if (leadDisappeared) {
        const leadId = this.observingLeadId;
        this.state = 'WARN';
        this.editionsInState = 0;
        this.observingLeadId = null;
        return [this._emit({ kind: 'POISON_LEAD', leadId })];
      }
      // 1.2.0: PUBLISH gated by partner-deal suppression. While the player's
      // accepted deal is active the Observer can't file PUBLISH_COUNTER (the
      // deal contract — see ICD-02 v0.3.3 §DESPERATE). The Observer still
      // PASSes through the edition; the deal counter ticks down world-side.
      const publishSuppressed = (view.world?.observer_publish_suppressed ?? 0) > 0;
      if (this.editionsInState >= INVESTIGATE_TO_PUBLISH_EDITIONS &&
          (view.player.printed_lies?.length ?? 0) > 0 &&
          !publishSuppressed) {
        // Pick the lie with highest heat_yield (ICD-02 v0.3 §Notes
        // "weighted by heat_yield" — at 1.0.0 we take the top one).
        const sorted = [...view.player.printed_lies].sort(
          (a, b) => (b.heat_yield ?? 0) - (a.heat_yield ?? 0),
        );
        const worst = sorted[0];
        this.state = 'PUBLISH';
        this.editionsInState = 0;
        this.cash -= OBSERVER_PUBLISH_COST;
        return [this._emit({ kind: 'PUBLISH_COUNTER', storyId: worst.id })];
      }
      if (this.cash < OBSERVER_DESPERATE_THRESHOLD) {
        this.state = 'DESPERATE';
        this.editionsInState = 0;
        // 1.2.0 (ICD-02 v0.3.3 §DESPERATE body): emit PARTNER_REQUEST one-time
        // on the INVESTIGATE → DESPERATE transition. District nomination is the
        // highest-`world.district_heat` district (tie-break by declaration
        // order). Fallback to the default district when the world projection
        // omits district_heat (test fixtures without world block).
        const district = pickHotterDistrict(view.world?.district_heat);
        return [this._emit({ kind: 'PARTNER_REQUEST', district })];
      }
      // No transition fired — pick a fresh lead if we don't have one.
      this.editionsInState += 1;
      if (this.observingLeadId === null && view.player.visible_leads.length > 0) {
        const idx = this.rng.range(0, view.player.visible_leads.length);
        const lead = view.player.visible_leads[idx];
        this.observingLeadId = lead.id;
        return [this._emit({
          kind:     'INVESTIGATE_LEAD',
          leadId:   lead.id,
          editions: INVESTIGATE_LEAD_DURATION,
        })];
      }
      return [this._emit({ kind: 'PASS' })];
    }

    // DESPERATE and SILENCED self-loop emitting PASS until a caller exit.
    this.editionsInState += 1;
    return [this._emit({ kind: 'PASS' })];
  }

  // Caller-triggered: player accepts partner request (DESPERATE → INVESTIGATE).
  // Per rival-ai-spec.html §05: $500 keeps the Observer alive 5 editions.
  acceptPartner() {
    if (this.state !== 'DESPERATE') return false;
    this.state = 'INVESTIGATE';
    this.editionsInState = 0;
    this.cash += 500;
    return true;
  }

  // Caller-triggered: player declines partner request (DESPERATE → INVESTIGATE).
  declinePartner() {
    if (this.state !== 'DESPERATE') return false;
    this.state = 'INVESTIGATE';
    this.editionsInState = 0;
    return true;
  }

  // Caller-triggered: player completes the "Frame the Observer" arc.
  // Shape-committed at 1.0.0 for Tier-1.x arc-content callers.
  frame() {
    this.state = 'SILENCED';
    this.editionsInState = 0;
    this.observingLeadId = null;
    return true;
  }

  _emit(intent) {
    this.pastIntents.push(intent);
    while (this.pastIntents.length > PAST_INTENTS_BUFFER_CAP) this.pastIntents.shift();
    return intent;
  }
}
