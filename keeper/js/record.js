// This milestone stores the last dawn record, not an in-progress night or log.
export const RECORD_KEY = 'keeper.record.v1';
export function parseRecord(raw) {
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Number.isSafeInteger(value.seed) || value.seed < 0 || value.seed > 0xffffffff) return null;
    if (![0, 1].includes(value.safe) || ![0, 1].includes(value.wrecked) || value.safe + value.wrecked !== 1) return null;
    return { version: 1, seed: value.seed, safe: value.safe, wrecked: value.wrecked };
  } catch {
    return null;
  }
}
