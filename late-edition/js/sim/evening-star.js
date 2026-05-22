// Late Edition — Evening Star rival (ICD-02 v0.2).
// Implements the tick(world, dt_ms) → Intent[] contract for the Evening Star
// paper. Strong-band state machine lifted from design/rival-ai-spec.html §04+§08.
//
// 0.7 slice scope per ICD-02 v0.2 §Notes:
//   - States with bodies: SCAVENGE, RAID (and PASS as the SCAVENGE no-op).
//   - States shape-committed but caller-triggered: BRIBE, RUSH, PANIC, BURNOUT.
//     Their bodies fill in when the unit/system they depend on lands at Tier-1.
//
// Determinism (ICD-02 §Determinism): all rng calls flow through SeededRng so
// the same world state + same seed produces the same decisions. Critical for
// replay, telemetry, bug repro, and the PRE-0.8 save schema.
//
// Rival-internal state lives here, not on RivalView (ICD-02 §Notes).

import { SeededRng } from './seeded-rng.js';

export const EVENING_STAR_TICK_INTERVAL_MS = 20_000; // ICD-02 §Tick cadence
export const PAST_INTENTS_BUFFER_CAP = 20;           // ICD-02 §RivalView past-intents — storage cap
export const PAST_INTENTS_PROJECTION_CAP = 8;        // ICD-02 §RivalView past-intents — projection cap

// State→posture mapping (ICD-02 §RivalStatusView — Evening Star mapping).
const POSTURE_BY_STATE = {
  SCAVENGE: 'calm',
  RUSH:     'calm',
  BURNOUT:  'calm',
  BRIBE:    'scheming',
  RAID:     'hostile',
  PANIC:    'hostile',
};

// Goon-count band table (ICD-02 §`RAID_BUREAU` Intent shape detail).
// Below 40 the SCAVENGE→RAID predicate fails — goons=0 is never emitted.
function goonCountForHeat(heat) {
  if (heat >= 80) return 3;
  if (heat >= 60) return 2;
  if (heat >= 40) return 1;
  return 0;
}

export class EveningStar {
  constructor({ id = 'evening_star', seed = 1, bureauId, tickInterval = EVENING_STAR_TICK_INTERVAL_MS } = {}) {
    this.id = id;
    this.tickInterval = tickInterval;
    this.bureauId = bureauId;
    this.rng = new SeededRng(seed);

    // Rival-internal state — not on RivalView (ICD-02 §Notes).
    this.state = 'SCAVENGE';
    this.editionsSinceRaid = 99; // unbounded large at session start so first RAID is gated only by heat + rng
    this.pastIntents = []; // RingBuffer, capped at PAST_INTENTS_BUFFER_CAP

    // Tick scheduling — World drives the cadence via advance(dtMs).
    this._tickAccumMs = 0;
  }

  // 0.8 (ICD-04 v0.1) — restore from an EveningStarSnap. Re-creates the rival
  // and overwrites rng.state + _tickAccumMs so post-load decisions match the
  // pre-save run (replay determinism, ICD §Notes — Determinism contract).
  static fromSnap(snap) {
    const star = new EveningStar({
      id:           snap.id,
      bureauId:     snap.bureau_id,
      tickInterval: snap.tick_interval_ms,
      seed:         1, // overwritten immediately
    });
    star.state = snap.state;
    star.editionsSinceRaid = snap.editions_since_raid;
    star.pastIntents = snap.past_intents.slice();
    star._tickAccumMs = snap.tick_accum_ms;
    star.rng.state = snap.rng.state;
    return star;
  }

  // Player-facing posture (ICD-02 §RivalStatusView).
  get posture() {
    return POSTURE_BY_STATE[this.state] ?? 'calm';
  }

  // World drives this every frame. Internal accumulator fires the rival's
  // 20s tick at most once per advance() call. Returns Intent[] this tick (or [])
  // — World reconciles them in order at end-of-tick (ICD-02 §Per-tick contract).
  advance(rivalView, dtMs) {
    if (dtMs <= 0) return [];
    this._tickAccumMs += dtMs;
    if (this._tickAccumMs < this.tickInterval) return [];
    this._tickAccumMs -= this.tickInterval;
    return this._tick(rivalView);
  }

  // Single state-machine tick. ICD-02 §Evening Star state machine §State definitions.
  _tick(rivalView) {
    if (this.state === 'SCAVENGE') return this._scavengeTick(rivalView);
    if (this.state === 'RAID')     return this._raidTick(rivalView);
    // BRIBE, RUSH, PANIC, BURNOUT bodies caller-triggered (ICD-02 v0.2 §Caller-triggered).
    return [this._emit({ kind: 'PASS' })];
  }

  // SCAVENGE: tries SCAVENGE→RAID transition; otherwise emits PASS.
  // SCAVENGE→BRIBE and SCAVENGE→RUSH bodies caller-triggered — not emitted at 0.7.
  _scavengeTick(rivalView) {
    const heat = rivalView.player.heat_noisy;
    if (heat > 40 && this.editionsSinceRaid > 1 && this.rng.chance(0.18)) {
      this.state = 'RAID';
      return this._raidEntryIntents(rivalView);
    }
    return [this._emit({ kind: 'PASS' })];
  }

  // RAID body: once entered, the rival emits PASS on subsequent ticks until
  // the goon team resolves (end of edition — see onEditionEnd below). The
  // RAID→PANIC transition is caller-triggered (needs consecutiveFailedRaids).
  _raidTick(_rivalView) {
    return [this._emit({ kind: 'PASS' })];
  }

  // ICD-02 v0.2 §`RAID_BUREAU` Intent shape detail.
  _raidEntryIntents(rivalView) {
    const heat = rivalView.player.heat_noisy;
    const goons = goonCountForHeat(heat);
    // eta_ms clamp per ICD-02 §`RAID_BUREAU` — multi-edition transit deferred.
    const eta_ms = Math.max(0, rivalView.cycle.remaining_ms - 1000);
    return [this._emit({
      kind:   'RAID_BUREAU',
      goons,
      eta_ms,
      target: this.bureauId,
    })];
  }

  // World calls this on EDITION_DEBRIEF_END. Bumps editionsSinceRaid and, if
  // a RAID was emitted this edition, transitions RAID → SCAVENGE (the goon
  // team resolved one way or another over the edition boundary). Returns
  // Intent[] for the world's per-rival reconciler — Evening Star does its
  // intent emission on the 20s wall-tick (advance), so this hook returns []
  // unconditionally. Edition-cadence rivals (Herald + Observer at 1.0.0+) do
  // their entire state machine here and return intents from this same hook.
  // The `view` argument is ignored by Evening Star but accepted for shape
  // parity with edition-cadence rivals.
  onEditionEnd(_view) {
    if (this.state === 'RAID') {
      this.editionsSinceRaid = 0; // reset; will tick up at subsequent EDITION_DEBRIEF_END calls
      this.state = 'SCAVENGE';
    } else {
      this.editionsSinceRaid += 1;
    }
    return [];
  }

  // Push to the RingBuffer (capped). Returns the intent for the caller chain.
  _emit(intent) {
    this.pastIntents.push(intent);
    while (this.pastIntents.length > PAST_INTENTS_BUFFER_CAP) this.pastIntents.shift();
    return intent;
  }
}
