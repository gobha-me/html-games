// Phase 3 S6 — unit-death fade subscriber.
//
// Subscribes to 'unitKilled' from the animation bus. Captures (factionIdx,
// q, r) from the event — the unit is already removed from G.units by the
// time we paint. An entry stays active for ~350ms; pixi.ts iterates the
// active set during the post-units paint pass and draws a fading hex
// outline in the dead unit's faction color (alpha + scale-down from 1.0).
//
// Multi-kill stagger: when several units die within a single dispatch
// (e.g. an AOE chain or rapid back-to-back resolves) the start times are
// offset by ~40ms each, capped at 5, so the fades feel sequential
// instead of lockstep.
//
// Hook pattern follows render/combatEffects.ts (decision-log item 10):
// pixi-import-free at this layer; pixi.ts registers a render hook that
// our self-managed RAF loop calls each frame while at least one death
// is active. Tests can import the module without #map-canvas because
// nothing here pulls pixi.ts.
//
// prefers-reduced-motion: handler short-circuits before pushing the
// entry, so the dead unit just disappears (no fade) — same end state.

import type { FactionIdx } from '../core/types';
import { on } from './animations';
import { prefersReducedMotion } from './motion';

const DEATH_DURATION_MS = 350;
const STAGGER_MS = 40;
const STAGGER_CAP = 5;
const STAGGER_WINDOW_MS = 50;

interface DeathAnim {
  factionIdx: FactionIdx;
  q: number;
  r: number;
  startedAt: number;
  duration: number;
}

const deaths: DeathAnim[] = [];

let lastEventAt = 0;
let activeStagger = 0;

let renderHook: (() => void) | null = null;
let rafId: number | null = null;

export function setUnitKilledAnimRenderHook(fn: () => void): void {
  renderHook = fn;
}

export function subscribeUnitKilledAnim(): void {
  on('unitKilled', (e) => {
    if (prefersReducedMotion()) return;
    const now = performance.now();
    if (now - lastEventAt < STAGGER_WINDOW_MS) {
      activeStagger = Math.min(activeStagger + 1, STAGGER_CAP);
    } else {
      activeStagger = 0;
    }
    lastEventAt = now;
    deaths.push({
      factionIdx: e.factionIdx,
      q: e.q,
      r: e.r,
      startedAt: now + activeStagger * STAGGER_MS,
      duration: DEATH_DURATION_MS,
    });
    ensureLoop();
  });
}

export interface ActiveDeath {
  factionIdx: FactionIdx;
  q: number;
  r: number;
  /** 0..1 — fraction of the animation elapsed. */
  t: number;
}

/** Pixi-side getter: returns the in-progress death animations with
 * their normalized progress. Prunes entries whose start time hasn't
 * been reached yet (returns them with t=0) so they paint at full alpha
 * during the stagger window. Expired entries are removed. */
export function getActiveDeaths(now: number = performance.now()): ActiveDeath[] {
  const out: ActiveDeath[] = [];
  for (let i = deaths.length - 1; i >= 0; i--) {
    const d = deaths[i];
    const elapsed = now - d.startedAt;
    if (elapsed >= d.duration) {
      deaths.splice(i, 1);
      continue;
    }
    const t = elapsed <= 0 ? 0 : elapsed / d.duration;
    out.push({ factionIdx: d.factionIdx, q: d.q, r: d.r, t });
  }
  return out;
}

/** Drop all in-flight death animations. Used by the passover curtain
 * so the incoming player doesn't see leftover fades from the previous
 * player's combat. Mirrors clearAllUnitTweens / clearCombatEffects. */
export function clearUnitKilledAnims(): void {
  deaths.length = 0;
  lastEventAt = 0;
  activeStagger = 0;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function ensureLoop(): void {
  if (rafId !== null) return;
  const tick = (): void => {
    const now = performance.now();
    let active = false;
    for (const d of deaths) {
      if (now - d.startedAt < d.duration) {
        active = true;
        break;
      }
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
