// Phase 2n-2 — combat effects (screen shake + per-unit hit flash).
//
// Pure render-side helpers; no DOM, no game state. The test pins the
// time-dependent read side via the optional `now` argument so we can
// assert the decay curve without relying on real elapsed wall-clock.

import { afterEach, describe, expect, it } from 'vitest';
import {
  clearCombatEffects,
  getShakeOffset,
  getUnitFlashColor,
  startCombatShake,
  startUnitFlash,
} from '../src/render/combatEffects';

afterEach(() => {
  clearCombatEffects();
});

describe('getShakeOffset', () => {
  it('returns {0,0} when no shake is active', () => {
    expect(getShakeOffset()).toEqual({ dx: 0, dy: 0 });
  });

  it('returns a non-zero offset while a shake is in flight', () => {
    const t0 = performance.now();
    startCombatShake(200, 8);
    const o = getShakeOffset(t0 + 50);
    expect(Math.abs(o.dx) + Math.abs(o.dy)).toBeGreaterThan(0);
    expect(Math.abs(o.dx)).toBeLessThanOrEqual(8);
    expect(Math.abs(o.dy)).toBeLessThanOrEqual(8);
  });

  it('decays to zero past the shake duration', () => {
    const t0 = performance.now();
    startCombatShake(120, 6);
    expect(getShakeOffset(t0 + 200)).toEqual({ dx: 0, dy: 0 });
  });
});

describe('getUnitFlashColor', () => {
  it('returns baseHex unchanged when no flash is active', () => {
    expect(getUnitFlashColor(42, '#ffaa00')).toBe('#ffaa00');
  });

  it('blends toward the flash color at flash start', () => {
    const t0 = performance.now();
    startUnitFlash(42, 200, '#ff0000');
    // At t≈t0 intensity is near 1 — color should be very close to the
    // flash color rather than the base.
    const c = getUnitFlashColor(42, '#0000ff', t0 + 1);
    // Strong red component, weak blue component.
    const r = parseInt(c.slice(1, 3), 16);
    const b = parseInt(c.slice(5, 7), 16);
    expect(r).toBeGreaterThan(200);
    expect(b).toBeLessThan(50);
  });

  it('returns to baseHex past the flash duration', () => {
    const t0 = performance.now();
    startUnitFlash(7, 100, '#ff0000');
    expect(getUnitFlashColor(7, '#123456', t0 + 200)).toBe('#123456');
  });

  it('keeps multiple unit flashes independent', () => {
    const t0 = performance.now();
    startUnitFlash(1, 200, '#ff0000');
    // Unit 2 has no flash — should pass through.
    expect(getUnitFlashColor(2, '#00ff00', t0 + 50)).toBe('#00ff00');
    // Unit 1 has a flash — should NOT be the base.
    expect(getUnitFlashColor(1, '#0000ff', t0 + 50)).not.toBe('#0000ff');
  });
});
