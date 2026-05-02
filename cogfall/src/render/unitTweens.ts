// Phase 2n-1 unit move tween. Render-only — the model still mutates
// instantly inside moveUnit. We just paint the unit at an interpolated
// position for ~180ms after the move.
//
// Pixi's ticker is stopped (pixi.ts:62 — render-on-demand is the project
// pattern). We don't restart it. A self-managed requestAnimationFrame
// loop runs only while at least one tween is active and calls render()
// once per frame; when the last tween ends, the loop stops.
//
// Replay scrubbing doesn't go through moveUnit — applyReplayTurn copies
// state directly — so scrubbing won't trigger tweens. Save load is
// likewise tween-free. The curtain (passover) flow clears any
// outstanding tweens so the next player doesn't see a catchup-animation
// when the curtain comes down.
//
// Phase 3 S1 — driven by the animation bus (render/animations.ts).
// systems/movement.ts emits 'unitMoved'; subscribeUnitTweens() (called
// from main.ts at boot) resolves the unit by id from G and forwards to
// startUnitTween. The startUnitTween export stays public so the curtain
// path (clearAllUnitTweens) and any future direct caller still work.

import { hexToPixel } from '../core/hex';
import type { Unit } from '../core/types';
import { G } from '../core/state';
import { on } from './animations';

// Render hook — pixi.ts registers its render() at app boot. We can't
// import render directly because that pulls pixi.ts into the test
// environment (which has no #map-canvas) on every module that imports
// movement.ts → unitTweens.ts. The hook keeps tests pixi-free.
let renderHook: (() => void) | null = null;
export function setUnitTweenRenderHook(fn: () => void): void {
  renderHook = fn;
}

const TWEEN_DURATION_MS = 180;

interface Tween {
  fromX: number;
  fromY: number;
  t0: number;
  duration: number;
}

const tweens = new Map<number, Tween>();
let rafId: number | null = null;

/** Begin a render-only slide for `unit` from (fromQ, fromR) → its current
 * (q, r). Call after the model mutation in moveUnit. Skipped while the
 * hot-seat curtain is up. */
export function startUnitTween(unit: Unit, fromQ: number, fromR: number): void {
  if (G.passoverActive) return;
  if (fromQ === unit.q && fromR === unit.r) return;
  const { x, y } = hexToPixel(fromQ, fromR);
  tweens.set(unit.id, {
    fromX: x,
    fromY: y,
    t0: performance.now(),
    duration: TWEEN_DURATION_MS,
  });
  if (rafId === null) startLoop();
}

/** Pixel offset to add to the unit's canonical (current-hex) draw position
 * to reflect the in-progress tween. Returns null when no tween is active.
 * Called from drawUnit each frame; deletes the tween when it expires. */
export function getUnitTweenOffset(unit: Unit): { dx: number; dy: number } | null {
  const t = tweens.get(unit.id);
  if (!t) return null;
  const elapsed = performance.now() - t.t0;
  if (elapsed >= t.duration) {
    tweens.delete(unit.id);
    return null;
  }
  const tn = elapsed / t.duration;
  const ease = 1 - Math.pow(1 - tn, 3);
  const { x: endX, y: endY } = hexToPixel(unit.q, unit.r);
  return { dx: (1 - ease) * (t.fromX - endX), dy: (1 - ease) * (t.fromY - endY) };
}

/** Wire unitTweens as a subscriber on the animation bus. Call once at
 * boot from main.ts. Resolves the unit by id from G (movement.ts emits
 * primitive payloads only) and forwards to startUnitTween, which in
 * turn no-ops if the curtain is up or the move is in-place. */
export function subscribeUnitTweens(): void {
  on('unitMoved', (e) => {
    const unit = G.units.find((u) => u.id === e.unitId);
    if (!unit) return;
    startUnitTween(unit, e.fromQ, e.fromR);
  });
}

/** Drop all in-flight tweens. Used by the passover curtain so the
 * incoming player doesn't see leftover animations. */
export function clearAllUnitTweens(): void {
  tweens.clear();
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function startLoop(): void {
  const tick = (): void => {
    const now = performance.now();
    for (const [id, t] of tweens) {
      if (now - t.t0 >= t.duration) tweens.delete(id);
    }
    if (tweens.size === 0) {
      rafId = null;
      renderHook?.();
      return;
    }
    renderHook?.();
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}
