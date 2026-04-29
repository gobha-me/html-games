import { describe, expect, it } from 'vitest';
import { hash2, fakeNoise, makeNoise, tileNoiseCoords } from '../src/systems/noise';

describe('noise', () => {
  describe('makeNoise', () => {
    it('is deterministic for a given seed', () => {
      const n = makeNoise(42);
      const a = n(3.5, 7.25);
      const b = n(3.5, 7.25);
      expect(a).toBe(b);
    });

    it('produces different values for different seeds', () => {
      const a = makeNoise(1);
      const b = makeNoise(2);
      let diffs = 0;
      for (let i = 0; i < 50; i++) {
        if (a(i * 0.7, i * 1.3) !== b(i * 0.7, i * 1.3)) diffs++;
      }
      expect(diffs).toBeGreaterThan(40);
    });

    it('keeps output in [0, 1] across a sample grid', () => {
      const n = makeNoise(7);
      for (let r = 0; r < 12; r++) {
        for (let q = 0; q < 12; q++) {
          const { px, py } = tileNoiseCoords(q, r);
          const v = n(px, py);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('hash2 / fakeNoise primitives', () => {
    it('hash2 returns a value in [0, 1]', () => {
      for (let i = 0; i < 50; i++) {
        const h = hash2(i, i * 13);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(1);
      }
    });

    it('fakeNoise smoothly interpolates between hash2 corners', () => {
      // At integer coords, fakeNoise == hash2.
      expect(fakeNoise(3, 5)).toBeCloseTo(hash2(3, 5), 12);
    });
  });
});
