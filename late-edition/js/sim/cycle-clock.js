// Late Edition — print cycle clock (ICD-06 v0.2).
// Pure module. World owns the lifecycle and dispatches the events this returns.
//
// The 12-minute edition is strong-band (Design Doc §05); the T-30s warning is
// strong-band (ICD-06 v0.2 §Cycle timing). Both are tunable via the constructor
// so tests don't have to chew through real time.

const DEFAULT_EDITION_MS = 720_000;  // 12 minutes
const DEFAULT_WARNING_MS = 30_000;   // T-30s

export class CycleClock {
  constructor({ editionDurationMs = DEFAULT_EDITION_MS, warningOffsetMs = DEFAULT_WARNING_MS } = {}) {
    this.editionDurationMs = editionDurationMs;
    this.warningOffsetMs = warningOffsetMs;
    this.edition = 0;
    this.remainingMs = 0;
    this._warningFired = false;
    this._fireFired = false;
  }

  // Begin a new edition. Returns the CYCLE_BEGIN event for the caller to
  // dispatch — leaves dispatch routing to World.
  start(edition) {
    this.edition = edition;
    this.remainingMs = this.editionDurationMs;
    this._warningFired = false;
    this._fireFired = false;
    return { kind: 'CYCLE_BEGIN', edition };
  }

  // Step the clock forward. Returns events emitted this step (in order):
  //   CYCLE_TICK always (when an edition is open), then optionally
  //   DEADLINE_WARNING when remaining first crosses the warning threshold,
  //   then optionally DEADLINE_FIRE when remaining first crosses zero.
  // After DEADLINE_FIRE the clock idles at 0 until start() opens the next edition.
  advance(dtMs) {
    if (this.edition === 0) return [];
    if (this._fireFired) return [];
    const events = [{ kind: 'CYCLE_TICK', dt_ms: dtMs }];
    this.remainingMs = Math.max(0, this.remainingMs - dtMs);
    if (!this._warningFired && this.remainingMs <= this.warningOffsetMs) {
      this._warningFired = true;
      events.push({ kind: 'DEADLINE_WARNING', remaining_ms: this.warningOffsetMs });
    }
    if (!this._fireFired && this.remainingMs <= 0) {
      this._fireFired = true;
      events.push({ kind: 'DEADLINE_FIRE', edition: this.edition });
    }
    return events;
  }
}
