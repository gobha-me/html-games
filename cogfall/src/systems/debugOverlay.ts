// Debug / designer overlay state (Phase 2L).
//
// A backtick (`/~) hotkey cycles a per-tile overlay through display
// modes that surface internal engine state for tuning. Default OFF
// (gated by setup-modal "🔍 Debug overlay" checkbox); even when on,
// the cycle starts at 'off' so the overlay is opt-in twice.
//
// Mode persisted in localStorage so a designer toggling between
// modes across reloads doesn't have to reset every time. Enable
// flag persisted at a separate key so the master gate can stay off
// while the chosen mode survives.
//
// Module-local state (matches the audio.ts / minimap.ts pattern):
// the render layer and the input layer both read getMode() — no
// prop-drilling, no context. setMode() validates and writes through
// to localStorage so reloads are coherent.

import { G } from '../core/state';
import { hexKey } from '../core/hex';
import type { FactionIdx, Tile } from '../core/types';
import { makeNoise, tileNoiseCoords } from './noise';

export type OverlayMode = 'off' | 'elevation' | 'ai' | 'visibility' | 'culture';

export const MODE_ORDER: readonly OverlayMode[] = [
  'off',
  'elevation',
  'ai',
  'visibility',
  'culture',
] as const;

const MODE_KEY = 'cogfall:debug:overlay:mode';
const ENABLED_KEY = 'cogfall:debug:overlay:enabled';

function isOverlayMode(s: string | null): s is OverlayMode {
  return s != null && (MODE_ORDER as readonly string[]).includes(s);
}

function readMode(): OverlayMode {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    return isOverlayMode(raw) ? raw : 'off';
  } catch {
    return 'off';
  }
}

let currentMode: OverlayMode = readMode();

export function getMode(): OverlayMode {
  return currentMode;
}

export function setMode(mode: OverlayMode): void {
  currentMode = mode;
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // localStorage write blocked (private mode / quota) — keep
    // in-memory state, ignore persist failure.
  }
}

export function cycleMode(current: OverlayMode = currentMode): OverlayMode {
  const i = MODE_ORDER.indexOf(current);
  const next = MODE_ORDER[(i + 1) % MODE_ORDER.length];
  return next;
}

export function isOverlayEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setOverlayEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
  // Idempotence: turning the master gate off resets the active mode
  // so re-enabling later starts at 'off' instead of resuming
  // wherever the cycle left off.
  if (!enabled) setMode('off');
}

// --- Per-mode data extractors ----------------------------------------------

/**
 * Recompute the mapgen elevation field from the persisted seed. Returns
 * null if G.mapSeed is undefined (pre-2L save) — caller renders a
 * fallback label in that case. Pure / deterministic; no rng draws.
 */
export function getElevationField(): Map<string, number> | null {
  if (G.mapSeed == null || !G.map) return null;
  const noise = makeNoise(G.mapSeed);
  const out = new Map<string, number>();
  for (const tile of G.map.tiles.values()) {
    const { px, py } = tileNoiseCoords(tile.q, tile.r);
    out.set(hexKey(tile.q, tile.r), noise(px, py));
  }
  return out;
}

/**
 * Faction indices that currently see (visible or seen) the given tile.
 * Reads tile.visibility — already on the struct since Phase 1.
 */
export function getVisibilityFactionsFor(tile: Tile): FactionIdx[] {
  const out: FactionIdx[] = [];
  for (const key of Object.keys(tile.visibility)) {
    const idx = Number(key) as FactionIdx;
    const v = tile.visibility[idx];
    if (v === 'visible' || v === 'seen') out.push(idx);
  }
  return out;
}
