// Late Edition — Herald rival (ICD-02 v0.3.4).
// The low-aggression / high-reach rival — paper of record, slow thinker,
// genteel knife (rival-ai-spec.html §03). State machine lifted verbatim from
// §03 FIG. H1 + state-definition + transition tables.
//
// Cadence: 1/EDITION. Unlike Evening Star's 20s wall-clock cadence, Herald
// ticks on the edition boundary — advance() always returns [], and onEditionEnd
// does the entire state-machine pass. The world dispatcher calls onEditionEnd
// per rival inside ackDebrief() (see world-state.js).
//
// 1.0.0 scope (ICD-02 v0.3):
//   - States with bodies: IDLE, COURT, WIRED (entry to the adversarial
//     triangle without endgame mechanics).
//   - States shape-committed but caller-triggered: PUNISH, BUYOUT.
//
// 1.5.0 scope (ICD-02 v0.3.4):
//   - PUNISH body wires: on entry to PUNISH (heat-driven IDLE→PUNISH OR
//     caller-driven COURT→PUNISH / WIRED→PUNISH / BUYOUT-decline → PUNISH)
//     Herald emits FILE_STORY { district, tier:'investigation', source:'herald' }
//     subject to a 3-edition cooldown via `lastScoopEdition` (design HTML §03
//     "Once per 3 editions, files a competing story that scoops the player's
//     queued Investigation tier"). District nomination is argmax(district_heat)
//     with DISTRICTS-declaration-order tie-break (the Observer's helper
//     re-exported from observer.js — same Tier-1.x argmax shape).
//   - BUYOUT body wires: on WIRED→BUYOUT entry Herald emits
//     OFFER_BUYOUT { amount: 50_000 } one-time. Subsequent BUYOUT ticks PASS
//     until the player accepts (Establishment ending) or declines (Herald
//     locks into PUNISH for the rest of the run via `buyoutDeclined`).
//   - `buyoutDeclined: boolean` permanent flag: when true, the state-machine
//     forces PUNISH every edition regardless of other predicates and skips
//     PUNISH→IDLE cooldown so Herald stays in PUNISH (rival-ai-spec.html §03
//     "Rejection = Herald flips to PUNISH for the rest of the run").
//
// Entry-detection invariant: PUNISH state with editionsInPunish === 0 is
// treated as "fresh entry this tick" — emit FILE_STORY (cooldown permitting),
// then the cascade's resident-PUNISH branch increments + cools to IDLE. This
// catches both the inline IDLE→PUNISH cascade transition (set state then run
// body) AND the caller-driven entries (declineWire/breakDeal/declineBuyout
// set state='PUNISH' between calls so the NEXT onEditionEnd's top check
// catches the entry).

import { SeededRng } from './seeded-rng.js';
import { pickHotterDistrict } from './observer.js';

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

// 1.5.0 (ICD-02 v0.3.4 §Herald §PUNISH body). Minimum editions between
// scoop emissions (design HTML §03 "Once per 3 editions"). Applied as a
// re-arm gate on FILE_STORY in the PUNISH body; PUNISH state entry itself
// is unconstrained, but a re-entry within the cooldown window emits PASS.
export const PUNISH_SCOOP_COOLDOWN = 3;
// 1.5.0 (ICD-02 v0.3.4 §Herald §BUYOUT body). One-time offer amount on
// WIRED → BUYOUT entry (design HTML §03 "$50k flat to absorb the paper").
export const BUYOUT_OFFER_AMOUNT = 50_000;

export class Herald {
  constructor({ id = HERALD_ID, seed = 1 } = {}) {
    this.id = id;
    this.kind = HERALD_KIND;
    this.tickInterval = ONE_EDITION;   // sentinel — world dispatcher routes accordingly
    this.rng = new SeededRng(seed);
    this.state = 'IDLE';
    this.consecutiveHighHeatEditions = 0; // counter for IDLE → COURT predicate
    this.editionsInCourt = 0;             // counter for COURT → IDLE timeout
    this.editionsInPunish = 0;            // counter for PUNISH → IDLE cooldown
    this.isWired = false;                 // sticky flag; set on COURT → WIRED, cleared on exit from WIRED
    this.pastIntents = [];
    // 1.5.0 (ICD-02 v0.3.4 §PUNISH body): edition the last scoop fired. Gates
    // re-emission via PUNISH_SCOOP_COOLDOWN; null until the first scoop.
    this.lastScoopEdition = null;
    // 1.5.0 (ICD-02 v0.3.4 §BUYOUT body): one-time emit guard for OFFER_BUYOUT.
    // Set to true on first emit; reset to false on WIRED→BUYOUT entry so a
    // post-buyout-fall-back re-entry would re-emit (the design rules say
    // BUYOUT is unreachable post-decline due to buyoutDeclined → PUNISH lock).
    this.buyoutOfferEmitted = false;
    // 1.5.0 (ICD-02 v0.3.4 §BUYOUT body): post-decline permanent PUNISH lock.
    // Set true by declineBuyout(); read by the cascade to skip PUNISH→IDLE
    // cooldown and re-assert PUNISH every edition.
    this.buyoutDeclined = false;
  }

  // Restore from a HeraldSnap (ICD-04 v0.1.6 §Per-rival §Herald).
  static fromSnap(snap) {
    const h = new Herald({ id: snap.id, seed: 1 });
    h.state = snap.state;
    h.consecutiveHighHeatEditions = snap.consecutive_high_heat_editions;
    h.editionsInCourt = snap.editions_in_court;
    h.editionsInPunish = snap.editions_in_punish;
    h.isWired = snap.is_wired;
    h.pastIntents = snap.past_intents.slice();
    h.rng.state = snap.rng.state;
    // 1.5.0 (ICD-04 v0.1.6): optional fields — pre-1.5.0 snaps resume cleanly
    // with the defaults the constructor set (null / false / false).
    h.lastScoopEdition = snap.last_scoop_edition ?? null;
    h.buyoutOfferEmitted = snap.buyout_offer_emitted ?? false;
    h.buyoutDeclined = snap.buyout_declined ?? false;
    return h;
  }

  get posture() {
    return POSTURE_BY_STATE[this.state] ?? 'calm';
  }

  advance(_rivalView, _dtMs) {
    return [];
  }

  // World calls this once per edition inside ackDebrief(). Runs the state
  // machine pass — checks for caller-entry scoop, runs cascade transitions,
  // fires resident-state bodies, returns Intent[] for the reconciler.
  onEditionEnd(view) {
    const heat = view.player.heat_noisy;
    const edition = view.cycle.edition;

    if (heat > HIGH_HEAT_THRESHOLD) {
      this.consecutiveHighHeatEditions += 1;
    } else {
      this.consecutiveHighHeatEditions = 0;
    }

    // Intent slot — set by an emit branch below; defaults to PASS at the
    // bottom return.
    let intent = null;

    // STEP 1 — caller-driven PUNISH entry. The caller methods (declineWire,
    // breakDeal, declineBuyout) set state='PUNISH' between onEditionEnd
    // calls; the next call sees state=PUNISH with editionsInPunish=0 at the
    // top. Emit the scoop here (cooldown permitting); the cascade below
    // then ticks the resident cooldown counter and flips to IDLE. Skipped
    // while buyoutDeclined holds Herald in locked-PUNISH (locked branch in
    // the cascade emits its own scoop on the cooldown re-arm).
    if (this.state === 'PUNISH' && this.editionsInPunish === 0 && !this.buyoutDeclined) {
      intent = this._tryScoopEmit(edition, view);
    }

    // STEP 2 — buyoutDeclined lock re-assertion. Defensive against
    // out-of-band state mutations (shouldn't happen in normal flow).
    if (this.buyoutDeclined && this.state !== 'PUNISH') {
      this.state = 'PUNISH';
      this.editionsInPunish = 0;
      this.isWired = false;
    }

    // STEP 3 — transition cascade per ICD-02 v0.3.4 §Herald table.
    if (this.state === 'IDLE') {
      if (this.consecutiveHighHeatEditions >= 2) {
        this.state = 'COURT';
        this.editionsInCourt = 0;
      } else if (edition >= PUNISH_EDITION_FLOOR && heat > PUNISH_HEAT_THRESHOLD && !this.isWired) {
        // IDLE → PUNISH heat-driven entry. Emit scoop inline (cooldown
        // permitting) — same-edition emission mirrors Observer's
        // INVESTIGATE → DESPERATE PARTNER_REQUEST inline.
        this.state = 'PUNISH';
        this.editionsInPunish = 0;
        intent = this._tryScoopEmit(edition, view);
      }
    } else if (this.state === 'COURT') {
      this.editionsInCourt += 1;
      if (this.editionsInCourt >= COURT_PATIENCE_EDITIONS) {
        // No caller response — auto-decline (COURT → IDLE on timeout).
        this.state = 'IDLE';
        this.editionsInCourt = 0;
      }
    } else if (this.state === 'PUNISH') {
      // Resident PUNISH — cascade fires only if STEP 1 didn't already
      // detect a fresh entry (editionsInPunish === 0 → STEP 1's check fires
      // AND the cascade increments here on the same tick, which gives the
      // "1-edition state then cools to IDLE" lifecycle: enter (E1, scoop),
      // then increment-and-cool on E2).
      if (this.buyoutDeclined) {
        // Locked-PUNISH branch — try the cooldown re-arm; never cool to IDLE.
        const lockedScoop = this._tryScoopEmit(edition, view);
        if (lockedScoop) intent = lockedScoop;
      } else {
        // Normal cooldown — increment, flip to IDLE at the threshold. The
        // STEP 1 entry-detection fires its own scoop BEFORE this branch
        // runs on the same tick, so the entry edition emits + cools in a
        // single call (matches the v1.0.0 "Herald PUNISH → IDLE after 1
        // edition cooldown" test semantics).
        this.editionsInPunish += 1;
        if (this.editionsInPunish >= PUNISH_COOLDOWN_EDITIONS) {
          this.state = 'IDLE';
          this.editionsInPunish = 0;
        }
      }
    } else if (this.state === 'WIRED') {
      if (edition >= BUYOUT_EDITION_FLOOR && heat < BUYOUT_HEAT_CEILING) {
        this.state = 'BUYOUT';
        this.isWired = false;
        this.buyoutOfferEmitted = false;  // re-arm body emit
      }
    }

    // STEP 4 — BUYOUT body emit. One-time on entry; subsequent BUYOUT ticks
    // PASS until the caller accepts or declines.
    if (this.state === 'BUYOUT' && !this.buyoutOfferEmitted) {
      this.buyoutOfferEmitted = true;
      intent = { kind: 'OFFER_BUYOUT', amount: BUYOUT_OFFER_AMOUNT };
    }

    return [this._emit(intent ?? { kind: 'PASS' })];
  }

  // 1.5.0 (ICD-02 v0.3.4 §Herald §PUNISH body). Cooldown-gated scoop emit.
  // Returns the FILE_STORY intent on cooldown clear (and updates
  // lastScoopEdition), or null if blocked. Caller assigns into the intent
  // slot; nothing is emitted on null.
  _tryScoopEmit(edition, view) {
    const sinceLastScoop = this.lastScoopEdition === null
      ? Infinity
      : edition - this.lastScoopEdition;
    if (sinceLastScoop < PUNISH_SCOOP_COOLDOWN) return null;
    this.lastScoopEdition = edition;
    const district = pickHotterDistrict(view.world?.district_heat);
    return { kind: 'FILE_STORY', district, tier: 'investigation', source: 'herald' };
  }

  // Caller-triggered transition: player accepts the wire deal (COURT → WIRED).
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
  breakDeal() {
    if (this.state !== 'WIRED') return false;
    this.state = 'PUNISH';
    this.isWired = false;
    this.editionsInPunish = 0;
    return true;
  }

  // 1.5.0 (ICD-02 v0.3.4 §BUYOUT body): caller-triggered acceptance — the
  // player takes the Herald's $50k buyout. The state remains BUYOUT (no
  // automatic exit — the World transitions the run to the Establishment
  // ending via World.acceptBuyout, which emits CYCLE_ESTABLISHMENT_ENDING
  // and freezes the sim). Returning true lets the caller atomically gate the
  // world-side ending emit on a successful state-side acceptance.
  acceptBuyout() {
    if (this.state !== 'BUYOUT') return false;
    return true;
  }

  // 1.5.0 (ICD-02 v0.3.4 §BUYOUT body): caller-triggered decline — Herald
  // flips to PUNISH for the rest of the run (design HTML §03 line 510).
  // buyoutDeclined latches true so the cascade re-asserts PUNISH every
  // edition and the PUNISH→IDLE cooldown is skipped (locked branch).
  declineBuyout() {
    if (this.state !== 'BUYOUT') return false;
    this.state = 'PUNISH';
    this.editionsInPunish = 0;
    this.buyoutDeclined = true;
    return true;
  }

  _emit(intent) {
    this.pastIntents.push(intent);
    while (this.pastIntents.length > PAST_INTENTS_BUFFER_CAP) this.pastIntents.shift();
    return intent;
  }
}
