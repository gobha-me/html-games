import { mulberry32 } from './rng.js';

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
