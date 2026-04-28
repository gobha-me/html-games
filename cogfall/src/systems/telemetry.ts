// Phase 2j Telemetry. Runtime-only event log: AI turn duration, combat
// damage, AI build choices. The user can dump it as JSON from the save
// modal. Piggybacks on Phase 2b's seed determinism — given the same seed
// and identical input the event sequence is identical (no Date.now /
// Math.random in the payload). Mirrors the audio.ts sfxLog pattern:
// array + push helper + getter + clear + a small dump-format helper.
//
// `recordTelemetry` short-circuits on the disabled flag so the cost is a
// single boolean read in the hot path. The log lives only in process
// memory — never serialized into saves, never persisted across reloads.

import { G } from '../core/state';

const ENABLED_KEY = 'cogfall:telemetry:enabled';

export type TelemetryEvent =
  | { kind: 'aiTurn'; turn: number; faction: number; durationMs: number }
  | {
      kind: 'combat';
      turn: number;
      attacker: number;
      defender: number;
      dmg: number;
      vsCity: boolean;
    }
  | { kind: 'build'; turn: number; faction: number; cityId: number; pick: string };

export interface TelemetryDump {
  version: 1;
  seed: number;
  turn: number;
  events: TelemetryEvent[];
}

const telemetryLog: TelemetryEvent[] = [];
let enabled = readEnabled();

export function isTelemetryEnabled(): boolean {
  return enabled;
}

export function setTelemetryEnabled(b: boolean): void {
  enabled = b;
  try {
    localStorage.setItem(ENABLED_KEY, b ? '1' : '0');
  } catch {
    // localStorage unavailable; keep in-memory state.
  }
}

export function recordTelemetry(event: TelemetryEvent): void {
  if (!enabled) return;
  telemetryLog.push(event);
}

/** Returns a snapshot of the telemetry log. Production callers should
 * prefer dumpTelemetry; this exists so unit tests can verify trigger
 * sites without mocking the dump format. */
export function getTelemetryLog(): readonly TelemetryEvent[] {
  return telemetryLog.slice();
}

/** Wipes the log so each game / save-load starts from an empty state.
 * Called on game start and on save-load (see main.ts) so the log scopes
 * to the current timeline. Also doubles as a test helper. */
export function clearTelemetryLog(): void {
  telemetryLog.length = 0;
}

/** Snapshot the current log into a JSON-serializable dump. The save-
 * modal Download button calls this and writes it out as
 * cogfall-telemetry-seed{N}-turn{N}.json. */
export function dumpTelemetry(): TelemetryDump {
  return {
    version: 1,
    seed: G.seed,
    turn: G.turn,
    events: telemetryLog.slice(),
  };
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
