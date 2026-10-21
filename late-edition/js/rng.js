// Mulberry32 uses an unsigned 32-bit seed; negative/large integer seeds wrap.
export function mulberry32(seed = 0) {
  if (!Number.isSafeInteger(seed)) throw new RangeError('Seed must be a safe integer');
  let state = seed >>> 0;
  const rng = {
    nextFloat() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    nextInt(min, maxExclusive) {
      if (!Number.isSafeInteger(min) || !Number.isSafeInteger(maxExclusive)
        || maxExclusive <= min || !Number.isSafeInteger(maxExclusive - min)) {
        throw new RangeError('Expected safe integer bounds with min < maxExclusive');
      }
      return min + Math.floor(rng.nextFloat() * (maxExclusive - min));
    },
    pick(array) {
      if (!Array.isArray(array) || array.length === 0) {
        throw new RangeError('Expected a nonempty array');
      }
      return array[rng.nextInt(0, array.length)];
    },
    getState: () => state,
  };
  return rng;
}
