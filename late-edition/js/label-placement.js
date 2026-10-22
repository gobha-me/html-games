import { WORLD_W, WORLD_H } from './config.js';

export const boxesIntersect = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x &&
  a.y < b.y + b.h && a.y + a.h > b.y;

export const labelLeader = (anchor, box) => ({ from: { x: anchor.x, y: anchor.y }, to: {
  x: Math.max(box.x, Math.min(anchor.x, box.x + box.w)),
  y: Math.max(box.y, Math.min(anchor.y, box.y + box.h)),
} });

const boxValid = (b) => b && ['x', 'y', 'w', 'h'].every((key) => Number.isFinite(b[key])) && b.w > 0 && b.h > 0;
const MAP_BOUNDS = { x: 0, y: 0, w: WORLD_W, h: WORLD_H };

export function clampLabelBox(box, bounds = MAP_BOUNDS) {
  if (!boxValid(box) || !boxValid(bounds)) throw new RangeError('Invalid label geometry');
  // Oversized copy cannot fit by translation alone. The renderer scales its
  // artwork into this bounded box; the gameplay anchor/hit target stays put.
  const w = Math.min(box.w, bounds.w), h = Math.min(box.h, bounds.h);
  return { x: Math.max(bounds.x, Math.min(box.x, bounds.x + bounds.w - w)),
    y: Math.max(bounds.y, Math.min(box.y, bounds.y + bounds.h - h)), w, h };
}

// Pure display geometry. Never move the address or grow its input target.
export function placeLabel(anchor, size, obstacles, bounds = MAP_BOUNDS) {
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y) ||
      !size || !Number.isFinite(size.w) || !Number.isFinite(size.h) || size.w <= 0 || size.h <= 0 ||
      !boxValid(bounds) || !Array.isArray(obstacles) || !obstacles.every(boxValid)) {
    throw new RangeError('Invalid label geometry');
  }
  const { w, h } = size;
  // Leave room for the director's enlarged figures, badges and stun rings.
  const gap = 8, radius = 96;
  const fits = (box) => box.x >= bounds.x && box.y >= bounds.y &&
    box.x + w <= bounds.x + bounds.w && box.y + h <= bounds.y + bounds.h &&
    !obstacles.some((obstacle) => boxesIntersect(box, obstacle));
  // Fixed, deterministic offsets: no obstacle-edge search or per-frame solving.
  const candidates = [
    { x: anchor.x + radius + gap, y: anchor.y - radius - gap - h, w, h },
    { x: anchor.x - radius - gap - w, y: anchor.y - radius - gap - h, w, h },
    { x: anchor.x + radius + gap, y: anchor.y + radius + gap, w, h },
    { x: anchor.x - radius - gap - w, y: anchor.y + radius + gap, w, h },
  ];
  // Keep the last-offset fallback when blocked, but canvas containment takes
  // priority over clearance: a crowded map must never hide the headline.
  const box = clampLabelBox(candidates.find(fits) ?? candidates[3], bounds);
  return { box, leader: labelLeader(anchor, box) };
}
