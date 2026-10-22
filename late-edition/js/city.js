import { mulberry32 } from './rng.js';
import { WORLD_W, WORLD_H } from './config.js';

// A separate, fixed cosmetic stream: never accept the simulation's RNG here.
export const CITY_SEED = 1947;
export function generateDistrict(district, seed = CITY_SEED) {
  if (!district || typeof district.id !== 'string' || !district.id.length ||
      !['x', 'y', 'w', 'h'].every((key) => Number.isFinite(district[key])) ||
      district.w < 80 || district.h < 80) throw new RangeError('Invalid cosmetic district');
  if (!Number.isSafeInteger(seed)) throw new RangeError('Invalid cosmetic seed');
  let hash = seed >>> 0;
  for (const char of district.id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const rng = mulberry32(hash);
  return Array.from({ length: 6 }, (_, index) => {
    const width = district.w / 3 - 16;
    const depth = district.h / 2 - 29;
    const height = 24 + rng.nextInt(0, 43);
    return {
      x: district.x + 8 + (index % 3) * district.w / 3,
      y: district.y + 32 + Math.floor(index / 3) * district.h / 2,
      width, depth, height,
      setback: rng.nextFloat() > 0.5,
      tank: rng.nextFloat() > 0.65,
      escape: rng.nextFloat() > 0.45,
      windows: Array.from({ length: 15 }, () => rng.nextFloat() > 0.69),
    };
  });
}

// A light directly above a footprint has no preferred direction; use the same
// down-street fallback for every render instead of dividing by zero.
export function shadowVector(x, y, length, lamp) {
  const dx = x - lamp.x, dy = y - lamp.y;
  const distance = Math.hypot(dx, dy);
  return distance === 0 ? { x: 0, y: length } :
    { x: dx / distance * length, y: dy / distance * length };
}

export function districtSignPosition(district, width, obstacles) {
  const left = district.x + 8;
  const right = Math.max(left, district.x + district.w - width);
  const candidates = [];
  // Keep signs in their neighbourhood: first slide along its southern curb,
  // then use the northern curb. Include the post in the collision envelope.
  for (const y of [district.y + district.h - 4, district.y + district.h + 30,
    district.y - 20, district.y + 24]) {
    for (let x = left; x <= right; x += 24) candidates.push({ x, y });
    candidates.push({ x: right, y });
  }
  const overlap = ({ x, y }) => obstacles.reduce((sum, b) => sum +
    Math.max(0, Math.min(x + width, b.x + b.w) - Math.max(x, b.x)) *
    Math.max(0, Math.min(y + 25, b.y + b.h) - Math.max(y - 18, b.y)), 0);
  const curb = candidates.find((point) => overlap(point) === 0);
  if (curb) return curb;
  // Several telegrams can cover both curbs. Step into the adjoining street,
  // keeping the complete sign/post on the map, before accepting any overlap.
  for (const margin of [48, 96, 144, 192]) {
    for (const y of [district.y - margin, district.y + district.h + margin]) {
      for (let x = left - margin; x <= right + margin; x += 24) {
        const point = { x, y };
        if (x < 8 || x + width > WORLD_W - 8 || y < 20 || y + 25 > WORLD_H - 8) continue;
        if (overlap(point) === 0) return point;
      }
    }
  }
  // Impossible fixtures may cover the entire map. Keep one stable sign instead
  // of dropping it or changing the underlying district/lead coordinates.
  return candidates.reduce((best, point) => overlap(point) < overlap(best) ? point : best);
}
