// Event log. log() appends to G.events and immediately re-renders the
// event-log panel; renderLog() is exposed for cases where state changed
// outside of a log call (e.g. turn advance) and the panel needs a refresh.
//
// Touches the DOM directly. Long-term this could be split (state side in
// core/, render side in ui/), but for Phase 1 the coupling matches the
// prototype and keeps the log surface area tiny.

import { G } from './state';
import { DOM_IDS } from './dom';
import type { LogEntryType } from './types';

const MAX_LOG_ENTRIES = 100;
const VISIBLE_LOG_ENTRIES = 20;

// Phase 2n-2 — monotonic counter of player-visible log() calls since
// startup. Survives the MAX_LOG_ENTRIES cap, so callers (turn.ts) can
// snapshot before/after an AI turn and recover *how many* entries
// were emitted even if the array overflowed and popped older ones.
let totalLogs = 0;

export function totalLogCount(): number {
  return totalLogs;
}

export function log(msg: string, type: LogEntryType = '', visibleToPlayer = true): void {
  if (!visibleToPlayer) return;
  totalLogs++;
  G.events.unshift({ turn: G.turn, msg, type });
  if (G.events.length > MAX_LOG_ENTRIES) G.events.pop();
  renderLog();
}

export function renderLog(): void {
  const el = document.getElementById(DOM_IDS.EVENT_LOG);
  if (!el) return;
  el.innerHTML = G.events
    .slice(0, VISIBLE_LOG_ENTRIES)
    .map(
      (e) =>
        `<div class="log-entry ${e.type}"><span class="turn-tag">T${e.turn}</span>${e.msg}</div>`
    )
    .join('');
}
