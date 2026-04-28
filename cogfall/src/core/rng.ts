// Random number generation.
//
// Two layers:
//
//   1. createSeededRng / createSeededRngWithState — pure factories. Tests use
//      these directly to pin determinism for a single system (combat, mapgen).
//
//   2. Game RNG singleton — initGameRng / getGameRng / getGameRngState /
//      setGameRngState. The simulation's *one* source of randomness once a
//      game has started. Save/load captures the cursor via getGameRngState
//      and restores it via setGameRngState so a mid-game save resumes the
//      same sequence.
//
// Cosmetic call sites (turn-flavor lines, AI spinner jitter, diplo modal
// simulation, city-name flavor in city.ts) intentionally stay on Math.random.
// They have no replay-determinism impact, and converting them would violate
// the "preserve prototype byte-feel" carry-forward documented in state.ts.
// If you "helpfully" convert them you will break replay parity via a
// side-channel — don't.
//
// Algorithm: mulberry32 — fast, decent statistical quality, public domain,
// 32-bit single-word state (the whole resume cursor fits in one number).

export type Rng = () => number;

export interface SeededRng {
  rng: Rng;
  getState: () => number;
  setState: (s: number) => void;
}

export const defaultRng: Rng = () => Math.random();

export function createSeededRngWithState(seed: number): SeededRng {
  let s = seed >>> 0;
  const rng: Rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    rng,
    getState: () => s,
    setState: (newS: number) => {
      s = newS >>> 0;
    },
  };
}

export function createSeededRng(seed: number): Rng {
  return createSeededRngWithState(seed).rng;
}

// --- Game RNG singleton ----------------------------------------------------
//
// Lifecycle: initGameRng(seed) on new-game (setupGame) and on load
// (loadGameState followed by setGameRngState(savedCursor)). All gameplay
// randomness inside systems/* and ai/* should resolve via getGameRng() at
// the call site (not captured at module top — the singleton is replaced on
// new-game/load).

let gameRngHandle: SeededRng | null = null;
let warnedUninit = false;

export function initGameRng(seed: number): void {
  gameRngHandle = createSeededRngWithState(seed);
  warnedUninit = false;
}

export function getGameRng(): Rng {
  if (!gameRngHandle) {
    if (!warnedUninit) {
      console.warn(
        '[cogfall] getGameRng() called before initGameRng(); falling back to Math.random. This breaks replay determinism — fix the wiring.'
      );
      warnedUninit = true;
    }
    return defaultRng;
  }
  return gameRngHandle.rng;
}

export function getGameRngState(): number {
  return gameRngHandle ? gameRngHandle.getState() : 0;
}

export function setGameRngState(s: number): void {
  if (!gameRngHandle) {
    gameRngHandle = createSeededRngWithState(0);
  }
  gameRngHandle.setState(s);
}

// Fisher-Yates in place. Mutates `arr` and returns it (matches the prototype).
// Accepts an optional rng for testability; defaults to Math.random.
export function shuffle<T>(arr: T[], rng: Rng = defaultRng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
