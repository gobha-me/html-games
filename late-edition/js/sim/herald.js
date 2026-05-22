// Late Edition — Herald rival (ICD-02 v0.3).
// The low-aggression / high-reach rival — paper of record, slow thinker,
// genteel knife (rival-ai-spec.html §03). State machine lifted verbatim from
// §03 FIG. H1 + state-definition + transition tables.
//
// Cadence: 1/EDITION. Unlike Evening Star's 20s wall-clock cadence, Herald
// ticks on the edition boundary — advance() always returns [], and onEditionEnd
// does the entire state-machine pass. The world dispatcher calls onEditionEnd
// per rival inside ackDebrief() (see world-state.js).
//
// 1.0.0 scope per issue #317 + ICD-02 v0.3:
//   - States with bodies: IDLE, COURT, WIRED (entry to the adversarial
//     triangle without endgame mechanics).
//   - States shape-committed but caller-triggered: PUNISH (needs the player
//     Investigation queue surface), BUYOUT (needs the run-meta edition
//     counter at edition ≥ 25 plus the acceptance-flow UI).
//   - Intent emission: PASS only at 1.0.0. Herald's design-spec emissions
//     (FILE_STORY in IDLE, OFFER_WIRE_DEAL in COURT) need consumer surfaces
//     that don't exist yet (rival-ambient news for IDLE; wire-deal UI for
//     COURT). The state machine is the spine — the dialogue is the flesh
//     at Tier-1.x (rival-ai-spec.html §03 authoring note).

import { SeededRng } from './seeded-rng.js';

export const HERALD_ID = 'herald';
export const HERALD_KIND = 'herald';
// Cadence sentinel — distinguishes edition-cadence rivals from wall-cadence
// ones. ICD-02 v0.3 §Herald state machine: "tickInterval = ONE_EDITION".
export const ONE_EDITION = 'ONE_EDITION';
export const PAST_INTENTS_BUFFER_CAP = 20;

// State→posture mapping (ICD-02 v0.3 §RivalStatusView — Herald). Herald
// never reaches `hostile` — design-load-bearing §03 "Never sends goons".
const POSTURE_BY_STATE = {
  IDLE:   'calm',
  COURT:  'calm',
  WIRED:  'calm',
  PUNISH: 'scheming',
  BUYOUT: 'scheming',
};

// Transition predicate thresholds — ICD-02 v0.3 §Herald state machine.
const HIGH_HEAT_THRESHOLD = 60;        // IDLE → COURT predicate
const COURT_PATIENCE_EDITIONS = 2;     // COURT → IDLE no-response timeout
const PUNISH_COOLDOWN_EDITIONS = 1;    // PUNISH → IDLE cooldown
const PUNISH_HEAT_THRESHOLD = 80;      // IDLE → PUNISH predicate
const PUNISH_EDITION_FLOOR = 10;       // IDLE → PUNISH predicate
const BUYOUT_HEAT_CEILING = 30;        // WIRED → BUYOUT predicate
const BUYOUT_EDITION_FLOOR = 25;       // WIRED → BUYOUT predicate

export class Herald {
  constructor({ id = HERALD_ID, seed = 1 } = {}) {
    this.id = id;
    this.kind = HERALD_KIND;
    this.tickInterval = ONE_EDITION;   // sentinel — world dispatcher routes accordingly
    this.rng = new SeededRng(seed);
    // Rival-internal state (ICD-02 §Notes — not on RivalView).
    this.state = 'IDLE';
    this.consecutiveHighHeatEditions = 0; // counter for IDLE → COURT predicate
    this.editionsInCourt = 0;             // counter for COURT → IDLE timeout
    this.editionsInPunish = 0;            // counter for PUNISH → IDLE cooldown
    this.isWired = false;                 // sticky flag; set on COURT → WIRED, cleared on exit from WIRED
    this.pastIntents = [];
  }

  // Restore from a HeraldSnap (ICD-04 §Per-rival §Herald — pending v0.1.2 bump).
  static fromSnap(snap) {
    const h = new Herald({ id: snap.id, seed: 1 });
    h.state = snap.state;
    h.consecutiveHighHeatEditions = snap.consecutive_high_heat_editions;
    h.editionsInCourt = snap.editions_in_court;
    h.editionsInPunish = snap.editions_in_punish;
    h.isWired = snap.is_wired;
    h.pastIntents = snap.past_intents.slice();
    h.rng.state = snap.rng.state;
    return h;
  }

  // Player-facing posture (ICD-02 v0.3 §RivalStatusView — Herald mapping).
  get posture() {
    return POSTURE_BY_STATE[this.state] ?? 'calm';
  }

  // Wall-cadence advance is a no-op — Herald ticks per edition only.
  // The world dispatcher's per-tick loop calls this every frame; returning
  // [] preserves the existing iteration order without special-casing.
  advance(_rivalView, _dtMs) {
    return [];
  }

  // World calls this once per edition inside ackDebrief() (after the
  // EDITION_DEBRIEF_END emit, before cycle.start(next)). Runs the state
  // machine pass — checks transitions, fires the state body, returns
  // Intent[] for the reconciler. ICD-02 v0.3 §Herald state machine.
  onEditionEnd(view) {
    const heat = view.player.heat_noisy;
    const edition = view.cycle.edition;

    // High-heat counter update — feeds the IDLE → COURT predicate.
    if (heat > HIGH_HEAT_THRESHOLD) {
      this.consecutiveHighHeatEditions += 1;
    } else {
      this.consecutiveHighHeatEditions = 0;
    }

    // Transition evaluation — predicates per ICD-02 v0.3 §Herald table.
    if (this.state === 'IDLE') {
      if (this.consecutiveHighHeatEditions >= 2) {
        this.state = 'COURT';
        this.editionsInCourt = 0;
      } else if (edition >= PUNISH_EDITION_FLOOR && heat > PUNISH_HEAT_THRESHOLD && !this.isWired) {
        // IDLE → PUNISH transition fires; PUNISH body remains caller-triggered
        // (no FILE_STORY scoop at 1.0.0 — needs the player Investigation queue
        // surface). The state exists; the punish-emission lands at Tier-1.x.
        this.state = 'PUNISH';
        this.editionsInPunish = 0;
      }
    } else if (this.state === 'COURT') {
      this.editionsInCourt += 1;
      if (this.editionsInCourt >= COURT_PATIENCE_EDITIONS) {
        // No caller response — auto-decline. Drops back to IDLE rather than
        // PUNISH (per ICD-02 v0.3 transition table — COURT → IDLE on timeout).
        this.state = 'IDLE';
        this.editionsInCourt = 0;
      }
    } else if (this.state === 'PUNISH') {
      this.editionsInPunish += 1;
      if (this.editionsInPunish >= PUNISH_COOLDOWN_EDITIONS) {
        this.state = 'IDLE';
        this.editionsInPunish = 0;
      }
    } else if (this.state === 'WIRED') {
      if (edition >= BUYOUT_EDITION_FLOOR && heat < BUYOUT_HEAT_CEILING) {
        this.state = 'BUYOUT';
        this.isWired = false;
      }
    }
    // BUYOUT self-loops at 1.0.0 — exit is caller-triggered (acceptance UI).

    // State body — all states emit PASS at 1.0.0. The full intent vocabulary
    // (FILE_STORY · OFFER_WIRE_DEAL · OFFER_BUYOUT) is shape-committed in
    // ICD-02 v0.3 but caller-triggered until consumer surfaces land at
    // Tier-1.x. Returning PASS keeps past_intents non-empty so the rival's
    // own posture surface reads continuously.
    return [this._emit({ kind: 'PASS' })];
  }

  // Caller-triggered transition: player accepts the wire deal (COURT → WIRED).
  // Wire-deal UI hooks here at Tier-1.x; 1.0.0 exposes the method so tests
  // can drive the transition through the public surface.
  acceptWire() {
    if (this.state !== 'COURT') return false;
    this.state = 'WIRED';
    this.isWired = true;
    this.editionsInCourt = 0;
    return true;
  }

  // Caller-triggered transition: player declines the wire deal (COURT → PUNISH).
  declineWire() {
    if (this.state !== 'COURT') return false;
    this.state = 'PUNISH';
    this.editionsInCourt = 0;
    this.editionsInPunish = 0;
    return true;
  }

  // Caller-triggered transition: player breaks the wire deal (WIRED → PUNISH).
  // Triggered when the player files a story the Herald flagged off-limits.
  breakDeal() {
    if (this.state !== 'WIRED') return false;
    this.state = 'PUNISH';
    this.isWired = false;
    this.editionsInPunish = 0;
    return true;
  }

  _emit(intent) {
    this.pastIntents.push(intent);
    while (this.pastIntents.length > PAST_INTENTS_BUFFER_CAP) this.pastIntents.shift();
    return intent;
  }
}
