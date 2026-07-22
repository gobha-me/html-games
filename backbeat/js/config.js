/**
 * BACKBEAT — timing configuration and judgement windows.
 * All times in milliseconds. Windows scale down with difficulty.
 */

export const DIFFICULTY = {
  easy:   { perfect: 90,  good: 160, noteSpeed: 0.55, scoreMul: 1.0 },
  normal: { perfect: 60,  good: 120, noteSpeed: 0.75, scoreMul: 1.5 },
  hard:   { perfect: 40,  good: 90,  noteSpeed: 1.0,  scoreMul: 2.0 }
};

export const JUDGE = { PERFECT: 'perfect', GOOD: 'good', MISS: 'miss' };

export const SCORE = { perfect: 300, good: 100, miss: 0 };

// Lanes map to keys D F J K
export const LANES = 4;
export const LANE_KEYS = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
export const LANE_LABELS = ['D', 'F', 'J', 'K'];
export const LANE_COLORS = ['#00d4ff', '#ff2ec4', '#ffd21f', '#10b981'];

// How far ahead (ms) a note is visible before its hit time (spawn lead).
export const NOTE_LEAD_BASE = 2000; // at noteSpeed 1.0; divided by speed

export function judgeOffset(absOffsetMs, difficulty) {
  const w = DIFFICULTY[difficulty];
  if (absOffsetMs <= w.perfect) return JUDGE.PERFECT;
  if (absOffsetMs <= w.good) return JUDGE.GOOD;
  return null; // outside window — not yet a miss, just not hittable
}
