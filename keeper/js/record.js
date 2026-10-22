// This milestone stores the last dawn record, not an in-progress night or log.
export const RECORD_KEY = 'keeper.record.v1';
export function parseRecord(raw) {
  try {
    const value = JSON.parse(raw);
    if (![1, 2].includes(value?.version) || !Number.isSafeInteger(value.seed) || value.seed < 0 || value.seed > 0xffffffff) return null;
    if (![value.safe, value.wrecked].every((count) => Number.isSafeInteger(count) && count >= 0)
      || !Number.isSafeInteger(value.safe + value.wrecked)) return null;
    if (value.version === 1 && value.safe + value.wrecked !== 1) return null;
    return { version: value.version, seed: value.seed, safe: value.safe, wrecked: value.wrecked };
  } catch {
    return null;
  }
}
