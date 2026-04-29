// Phase 2n-2 — combat effects: brief screen shake + per-unit hit-flash
// pulse. Pure render-side, mutates no game state, never touches the
// seeded RNG (replay parity carry-forward, decision-log item 2 in
// core/state.ts + core/rng.ts header).
//
// Follows the same hook pattern as render/unitTweens.ts: a self-managed
// RAF loop runs only while at least one effect is active and calls a
// render hook (registered from main.ts) once per frame. We can't import
// render/pixi.ts directly because that pulls pixi.ts (and its
// #map-canvas requirement) into the test environment via every module
// that transitively imports systems/combat.ts.

const SHAKE_DURATION_MS = 180;
const SHAKE_MAGNITUDE_PX = 6;
const FLASH_DURATION_MS = 220;
const FLASH_COLOR_HEX = '#ff4040';

interface Flash {
  startedAt: number;
  duration: number;
  colorHex: string;
}

let shakeStartedAt = 0;
let shakeDuration = 0;
let shakeMagnitude = 0;

const flashes = new Map<number, Flash>();

let renderHook: (() => void) | null = null;
let rafId: number | null = null;

export function setCombatEffectsRenderHook(fn: () => void): void {
  renderHook = fn;
}

export function startCombatShake(
  durationMs: number = SHAKE_DURATION_MS,
  magnitudePx: number = SHAKE_MAGNITUDE_PX
): void {
  shakeStartedAt = performance.now();
  shakeDuration = durationMs;
  shakeMagnitude = magnitudePx;
  ensureLoop();
}

/** Pixel offset to add to worldLayer.position for the in-progress shake.
 * Returns {0,0} when no shake is active. Decays linearly so the camera
 * settles smoothly. */
export function getShakeOffset(now: number = performance.now()): { dx: number; dy: number } {
  if (shakeDuration <= 0) return { dx: 0, dy: 0 };
  const elapsed = now - shakeStartedAt;
  if (elapsed >= shakeDuration) {
    shakeDuration = 0;
    return { dx: 0, dy: 0 };
  }
  const decay = 1 - elapsed / shakeDuration;
  const phase = elapsed * 0.07;
  const dx = Math.sin(phase * 3.7) * shakeMagnitude * decay;
  const dy = Math.cos(phase * 4.1) * shakeMagnitude * decay;
  return { dx, dy };
}

export function startUnitFlash(
  unitId: number,
  durationMs: number = FLASH_DURATION_MS,
  colorHex: string = FLASH_COLOR_HEX
): void {
  flashes.set(unitId, { startedAt: performance.now(), duration: durationMs, colorHex });
  ensureLoop();
}

/** Returns a CSS hex color blended from baseHex toward the flash color
 * for the in-progress pulse, or baseHex unchanged when no flash is active.
 * Quadratic ease-out so the flash stabs in and fades quickly. */
export function getUnitFlashColor(
  unitId: number,
  baseHex: string,
  now: number = performance.now()
): string {
  const f = flashes.get(unitId);
  if (!f) return baseHex;
  const elapsed = now - f.startedAt;
  if (elapsed >= f.duration) {
    flashes.delete(unitId);
    return baseHex;
  }
  const t = elapsed / f.duration;
  const intensity = (1 - t) * (1 - t);
  return blendHex(baseHex, f.colorHex, intensity);
}

/** Drop all in-flight effects. Called by the passover curtain so the
 * incoming player doesn't see leftover shake/flash from the previous
 * player's turn. Mirrors clearAllUnitTweens. */
export function clearCombatEffects(): void {
  shakeDuration = 0;
  flashes.clear();
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function ensureLoop(): void {
  if (rafId !== null) return;
  const tick = (): void => {
    const now = performance.now();
    let active = shakeDuration > 0 && now - shakeStartedAt < shakeDuration;
    for (const [id, f] of flashes) {
      if (now - f.startedAt < f.duration) active = true;
      else flashes.delete(id);
    }
    renderHook?.();
    if (!active) {
      rafId = null;
      return;
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  let s = hex.replace(/^#/, '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function toHex(r: number, g: number, b: number): string {
  const h = (v: number): string => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function blendHex(aHex: string, bHex: string, t: number): string {
  const a = parseHex(aHex);
  const b = parseHex(bHex);
  return toHex(
    Math.round(a.r * (1 - t) + b.r * t),
    Math.round(a.g * (1 - t) + b.g * t),
    Math.round(a.b * (1 - t) + b.b * t)
  );
}
