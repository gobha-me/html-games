// Random number generation.
//
// Phase 1 strategy: defaultRng wraps Math.random so production behavior is
// byte-identical to the prototype. createSeededRng() provides a deterministic
// alternative used by tests. The full Phase 2b work is to thread an `rng`
// parameter through every system that randomizes (combat, mapgen, AI tech
// pick, ruin loot, etc.) and surface a seed in the setup UI.
//
// Algorithm: mulberry32 — fast, decent statistical quality, public domain.

export type Rng = () => number;

export const defaultRng: Rng = () => Math.random();

export function createSeededRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
