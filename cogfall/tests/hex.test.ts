import { describe, expect, it } from 'vitest';
import {
  HEX_DIRS,
  HEX_SIZE,
  hexDistance,
  hexKey,
  hexNeighbors,
  hexToPixel,
  pixelToHex,
  roundHex,
} from '../src/core/hex';

describe('hex math', () => {
  describe('hexNeighbors', () => {
    it('returns 6 neighbors at axial distance 1', () => {
      const ns = hexNeighbors(3, 4);
      expect(ns).toHaveLength(6);
      for (const n of ns) {
        expect(hexDistance({ q: 3, r: 4 }, n)).toBe(1);
      }
    });

    it('matches HEX_DIRS at origin', () => {
      const ns = hexNeighbors(0, 0);
      expect(ns).toEqual(HEX_DIRS.map((d) => ({ q: d.q, r: d.r })));
    });
  });

  describe('hexDistance', () => {
    it('is zero for same hex', () => {
      expect(hexDistance({ q: 5, r: -2 }, { q: 5, r: -2 })).toBe(0);
    });

    it('is symmetric', () => {
      const a = { q: 2, r: -3 };
      const b = { q: -1, r: 4 };
      expect(hexDistance(a, b)).toBe(hexDistance(b, a));
    });

    it('returns 1 for direct neighbors', () => {
      for (const d of HEX_DIRS) {
        expect(hexDistance({ q: 0, r: 0 }, d)).toBe(1);
      }
    });
  });

  describe('hexToPixel + pixelToHex round-trip', () => {
    it('returns the original axial coordinates for hex centers', () => {
      const samples = [
        { q: 0, r: 0 },
        { q: 5, r: -3 },
        { q: -7, r: 2 },
        { q: 12, r: 11 },
      ];
      for (const s of samples) {
        const px = hexToPixel(s.q, s.r);
        expect(roundHex(px.x / HEX_SIZE / 2, px.y / HEX_SIZE / 2)).toBeDefined();
        expect(pixelToHex(px.x, px.y)).toEqual(s);
      }
    });
  });

  describe('hexKey', () => {
    it('produces a stable string-form for axial coords', () => {
      expect(hexKey(3, -4)).toBe('3,-4');
      expect(hexKey(0, 0)).toBe('0,0');
    });

    it('is unique per coord pair within reasonable bounds', () => {
      const seen = new Set<string>();
      for (let q = -10; q <= 10; q++) {
        for (let r = -10; r <= 10; r++) {
          const k = hexKey(q, r);
          expect(seen.has(k)).toBe(false);
          seen.add(k);
        }
      }
      expect(seen.size).toBe(21 * 21);
    });
  });
});
