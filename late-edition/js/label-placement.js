import { WORLD_W, WORLD_H } from './config.js';

export const boxesIntersect = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x &&
  a.y < b.y + b.h && a.y + a.h > b.y;

// Pure display geometry. Never move the address or grow its input target.
export function placeLabel(anchor, size, obstacles, bounds = { x: 0, y: 0, w: WORLD_W, h: WORLD_H }) {
  const boxValid = (b) => b && ['x', 'y', 'w', 'h'].every((key) => Number.isFinite(b[key])) && b.w > 0 && b.h > 0;
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y) ||
      !size || !Number.isFinite(size.w) || !Number.isFinite(size.h) || size.w <= 0 || size.h <= 0 ||
      !boxValid(bounds) || !Array.isArray(obstacles) || !obstacles.every(boxValid)) {
    throw new RangeError('Invalid label geometry');
  }
  const { w, h } = size;
  const gap = 8, radius = 34;
  const fits = (box) => box.x >= bounds.x && box.y >= bounds.y &&
    box.x + w <= bounds.x + bounds.w && box.y + h <= bounds.y + bounds.h &&
    !obstacles.some((obstacle) => boxesIntersect(box, obstacle));
  const candidates = [
    { x: anchor.x - w / 2, y: anchor.y - radius - gap - h, w, h },
    { x: anchor.x + radius + gap, y: anchor.y - h / 2, w, h },
    { x: anchor.x - radius - gap - w, y: anchor.y - h / 2, w, h },
    { x: anchor.x - w / 2, y: anchor.y + radius + gap, w, h },
  ];
  const nearby = candidates.find(fits);
  if (nearby) return { box: nearby, leader: null };

  // A crowded address can block all four neighbours. Probe obstacle edges in
  // distance order; this bounded pass runs only after the cheap offsets fail.
  const xs = [bounds.x, bounds.x + bounds.w - w];
  const ys = [bounds.y, bounds.y + bounds.h - h];
  for (const b of obstacles) {
    xs.push(b.x - gap - w, b.x + b.w + gap);
    ys.push(b.y - gap - h, b.y + b.h + gap);
  }
  xs.push(anchor.x - w / 2);
  ys.push(anchor.y - h / 2);
  const offsets = xs.flatMap((x) => ys.map((y) => ({ x, y, w, h })));
  offsets.sort((a, b) => Math.hypot(a.x + w / 2 - anchor.x, a.y + h / 2 - anchor.y) -
    Math.hypot(b.x + w / 2 - anchor.x, b.y + h / 2 - anchor.y));
  // If the entire viewport is occupied, geometry cannot fit on-screen. Keep
  // the label clear outside the occupied envelope rather than covering a unit.
  const box = offsets.find(fits) ?? {
    x: Math.max(bounds.x + bounds.w, ...obstacles.map((b) => b.x + b.w)) + gap,
    y: anchor.y - h / 2, w, h,
  };
  return { box, leader: { from: { ...anchor }, to: {
    x: Math.max(box.x, Math.min(anchor.x, box.x + w)),
    y: Math.max(box.y, Math.min(anchor.y, box.y + h)),
  } } };
}
