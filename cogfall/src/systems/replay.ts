// Phase 2k Replay viewer. Runtime-only per-turn snapshots that mirror the
// save format. Mirrors the audio.ts sfxLog / telemetry.ts log pattern:
// array + push helper + getter + clear + a small dump-format helper.
//
// `recordReplaySnapshot` short-circuits on the disabled flag so the cost
// is a single boolean read at the turn boundary. Snapshots live in
// process memory only — never serialized into saves, never persisted
// across reloads. Downloadable as JSON for offline scrubbing or sharing.
//
// A snapshot is structurally identical to a save's `state` field
// (SerializedGameState). The replay viewer applies a snapshot via
// applySerializedStateToG — bypassing loadGameState's RNG re-init and
// telemetry-clear so scrubbing stays read-only.

import { G } from '../core/state';
import {
  applySerializedStateToG,
  serializeGameState,
  validateSaveAgainstData,
  type SerializedGameState,
} from '../core/save';
import { getTelemetryLog, type TelemetryEvent } from './telemetry';

const ENABLED_KEY = 'cogfall:replay:enabled';

export interface ReplayDump {
  version: 1;
  seed: number;
  factionName: string;
  turns: SerializedGameState[];
  /** Optional — when present, replay viewer can show a "what happened on
   * turn N" panel by filtering events by `event.turn`. */
  telemetry?: TelemetryEvent[];
}

export class ReplayValidationError extends Error {
  constructor(reason: string) {
    super(`Invalid replay: ${reason}`);
    this.name = 'ReplayValidationError';
  }
}

/** Hard cap on retained per-turn snapshots. A medium-map serialized state
 * runs ~100-200 KB; without a cap the log grew unbounded and a campaign
 * past a few hundred turns slowed (GC pressure) then OOM-killed the tab.
 * 200 keeps memory bounded at ~30 MB and covers the recent-history use
 * case the replay viewer was built for. When the cap is hit we drop the
 * oldest snapshot (FIFO) — the modal slider labels by snapshot.turn, not
 * array index, so the rolling window renders correctly without UI work. */
export const MAX_REPLAY_TURNS = 200;

const replayLog: SerializedGameState[] = [];
let enabled = readEnabled();

export function isReplayEnabled(): boolean {
  return enabled;
}

export function setReplayEnabled(b: boolean): void {
  enabled = b;
  try {
    localStorage.setItem(ENABLED_KEY, b ? '1' : '0');
  } catch {
    // localStorage unavailable; keep in-memory state.
  }
}

/** Append a snapshot of current G to the in-memory log. Called from
 * setupGame (turn 1 baseline) and from endTurn at each game-turn boundary
 * (when G.currentFactionIdx wraps back to 0). Early-returns when disabled
 * so the hot-path cost is one boolean read. */
export function recordReplaySnapshot(): void {
  if (!enabled) return;
  // serializeGameState() returns SaveData; replay only needs the state.
  // Calling through it (instead of duplicating the serialize logic) keeps
  // the snapshot format byte-equal to the save format, so dumpReplay can
  // ship snapshots directly without a separate format spec.
  replayLog.push(serializeGameState().state);
  // FIFO drop oldest once we cross the cap — see MAX_REPLAY_TURNS doc.
  if (replayLog.length > MAX_REPLAY_TURNS) replayLog.shift();
}

/** True once the replay log is at MAX_REPLAY_TURNS — the next push will
 * evict the oldest snapshot. The replay modal reads this to surface a
 * "Showing last N turns" hint so a player who scrubs in a long game
 * doesn't wonder why turn 1 isn't there. */
export function isReplayLogCapped(): boolean {
  return replayLog.length >= MAX_REPLAY_TURNS;
}

/** Snapshot of the in-memory replay log. Production callers usually want
 * dumpReplay; this exists so unit tests can verify trigger sites. */
export function getReplayLog(): readonly SerializedGameState[] {
  return replayLog.slice();
}

/** Wipes the log so each game / save-load starts from an empty state.
 * Mirrors clearTelemetryLog — wired into setupGame (game start) and
 * loadGameState (timeline switch) in 2k-4. */
export function clearReplayLog(): void {
  replayLog.length = 0;
}

/** Snapshot the current log as a downloadable payload. The save-modal
 * Download button calls this and writes it as
 * cogfall-replay-seed{N}-turn{N}.json. Telemetry is bundled in only when
 * the telemetry log has events (avoids inflating the JSON for users who
 * disabled telemetry mid-game). */
export function dumpReplay(): ReplayDump {
  const player = G.factions[G.playerFactionIdx];
  const tele = getTelemetryLog();
  const dump: ReplayDump = {
    version: 1,
    seed: G.seed,
    factionName: player?.name ?? 'Unknown',
    turns: replayLog.slice(),
  };
  if (tele.length > 0) dump.telemetry = tele.slice();
  return dump;
}

/** Validate + parse an externally-loaded replay JSON. Throws
 * ReplayValidationError on shape mismatch. Does NOT mutate G — call
 * applyReplayTurn separately. */
export function loadReplay(json: unknown): ReplayDump {
  if (!json || typeof json !== 'object') throw new ReplayValidationError('not an object');
  const o = json as Record<string, unknown>;
  if (o.version !== 1) throw new ReplayValidationError(`unknown version ${String(o.version)}`);
  if (typeof o.seed !== 'number') throw new ReplayValidationError('missing numeric seed');
  if (typeof o.factionName !== 'string')
    throw new ReplayValidationError('missing factionName');
  if (!Array.isArray(o.turns)) throw new ReplayValidationError('turns is not an array');
  if (o.turns.length === 0) throw new ReplayValidationError('turns array is empty');
  if (o.telemetry !== undefined && !Array.isArray(o.telemetry))
    throw new ReplayValidationError('telemetry must be an array if present');
  for (let i = 0; i < o.turns.length; i++) {
    if (!o.turns[i] || typeof o.turns[i] !== 'object')
      throw new ReplayValidationError(`turn ${i} is not an object`);
  }
  return o as unknown as ReplayDump;
}

/** Mutate live G to the state captured at replay.turns[turnIdx]. Caller
 * (replayModal.ts in 2k-3) is responsible for stashing the live G first
 * and restoring it on close.
 *
 * Throws ReplayValidationError on out-of-range index, or if the snapshot
 * references unit / building / tech IDs no longer present in the active
 * data tables (e.g. a mod was swapped between recording and replay). */
export function applyReplayTurn(replay: ReplayDump, turnIdx: number): void {
  if (turnIdx < 0 || turnIdx >= replay.turns.length)
    throw new ReplayValidationError(`turnIdx ${turnIdx} out of range`);
  const snapshot = replay.turns[turnIdx];
  const missing = validateSaveAgainstData(snapshot);
  if (missing.length > 0) {
    const summary = missing
      .slice(0, 3)
      .map((m) => `${m.kind}:${m.id}`)
      .join(', ');
    throw new ReplayValidationError(
      `snapshot turn ${turnIdx} references ${missing.length} unknown ID(s): ${summary}`
    );
  }
  applySerializedStateToG(snapshot);
}

function readEnabled(): boolean {
  try {
    const v = localStorage.getItem(ENABLED_KEY);
    if (v === null) return true;
    return v === '1';
  } catch {
    return true;
  }
}
