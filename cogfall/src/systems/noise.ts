// Value-noise primitives lifted verbatim from mapgen.ts so the debug
// overlay (Phase 2L) can re-derive the elevation field at any time
// from a persisted seed without re-running generateMap.
//
// Behavior must stay byte-identical with the inlined version that lived
// at mapgen.ts:94-126 in Phase 2c — the per-octave amplitude/frequency
// schedule and the seed-offset constants (`seed`, `seed * 1.3`) are
// load-bearing for replay parity. Don't "improve" them here.

export function hash2(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

export function fakeNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

/** Return a 4-octave fBm noise function bound to `seed`. */
export function makeNoise(seed: number): (x: number, y: number) => number {
  return function noise(x: number, y: number): number {
    let n = 0;
    let amp = 1;
    let freq = 0.15;
    let sum = 0;
    for (let o = 0; o < 4; o++) {
      n += amp * fakeNoise(x * freq + seed, y * freq + seed * 1.3);
      sum += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return n / sum;
  };
}

/** Same px/py mapping mapgen uses to project (q, r) into noise space.
 * Exposed so the debug-overlay elevation mode lines up with mapgen's
 * threshold tiers without callers re-implementing the projection. */
export function tileNoiseCoords(q: number, r: number): { px: number; py: number } {
  return { px: q + r * 0.5, py: r };
}
