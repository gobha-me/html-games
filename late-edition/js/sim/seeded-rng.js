// Late Edition — seeded PRNG.
// Mulberry32. 32-bit internal state, deterministic per seed, replay-safe.
// Used by rivals (ICD-02 §Determinism) so the same world state + same seed
// produces the same decisions — load-bearing for telemetry, bug repro, and
// the save-schema work at PRE-0.8.

export class SeededRng {
  constructor(seed = 1) {
    this.state = (seed | 0) || 1;
  }

  // Returns [0, 1).
  next() {
    let t = (this.state = (this.state + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // True with probability p ∈ [0, 1].
  chance(p) {
    return this.next() < p;
  }

  // Integer in [lo, hi) (half-open, like Python's randrange).
  range(lo, hi) {
    return lo + Math.floor(this.next() * (hi - lo));
  }
}
