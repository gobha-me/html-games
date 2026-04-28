// Phase 2j-1: telemetry module unit tests. Trigger-site cases are appended
// in 2j-2 / 2j-3 / 2j-4 commits as each hook lands; this file starts as
// a pure module test so 2j-1 commits cleanly with no call sites yet.

import { describe, expect, it, beforeEach } from 'vitest';
import { G } from '../src/core/state';
import {
  clearTelemetryLog,
  dumpTelemetry,
  getTelemetryLog,
  isTelemetryEnabled,
  recordTelemetry,
  setTelemetryEnabled,
} from '../src/systems/telemetry';

describe('telemetry module', () => {
  beforeEach(() => {
    clearTelemetryLog();
    setTelemetryEnabled(true);
    G.seed = 42;
    G.turn = 1;
  });

  it('records an event into the log', () => {
    recordTelemetry({ kind: 'aiTurn', turn: 1, faction: 1, durationMs: 12.4 });
    expect(getTelemetryLog()).toEqual([
      { kind: 'aiTurn', turn: 1, faction: 1, durationMs: 12.4 },
    ]);
  });

  it('is a no-op when disabled', () => {
    setTelemetryEnabled(false);
    expect(isTelemetryEnabled()).toBe(false);
    recordTelemetry({
      kind: 'combat',
      turn: 1,
      attacker: 0,
      defender: 1,
      dmg: 5,
      vsCity: false,
    });
    expect(getTelemetryLog()).toEqual([]);
  });

  it('clearTelemetryLog wipes the log', () => {
    recordTelemetry({ kind: 'aiTurn', turn: 1, faction: 1, durationMs: 1 });
    recordTelemetry({ kind: 'aiTurn', turn: 1, faction: 2, durationMs: 2 });
    expect(getTelemetryLog().length).toBe(2);
    clearTelemetryLog();
    expect(getTelemetryLog()).toEqual([]);
  });

  it('dumpTelemetry produces version + seed + turn + events shape', () => {
    G.seed = 99;
    G.turn = 7;
    recordTelemetry({ kind: 'build', turn: 7, faction: 1, cityId: 3, pick: 'walls' });
    const dump = dumpTelemetry();
    expect(dump.version).toBe(1);
    expect(dump.seed).toBe(99);
    expect(dump.turn).toBe(7);
    expect(dump.events).toEqual([
      { kind: 'build', turn: 7, faction: 1, cityId: 3, pick: 'walls' },
    ]);
  });

  it('persists the enabled flag to localStorage', () => {
    setTelemetryEnabled(false);
    expect(localStorage.getItem('cogfall:telemetry:enabled')).toBe('0');
    setTelemetryEnabled(true);
    expect(localStorage.getItem('cogfall:telemetry:enabled')).toBe('1');
  });
});
