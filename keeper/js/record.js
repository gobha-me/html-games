// Last morning only. Full in-progress state has a separate versioned save key.
export const RECORD_KEY = 'keeper.record.v1';
export function parseRecord(raw) {
  try {
    const value = JSON.parse(raw);
    if (![1, 2, 3].includes(value?.version) || !Number.isSafeInteger(value.seed) || value.seed < 0 || value.seed > 0xffffffff) return null;
    if (![value.safe, value.wrecked].every((count) => Number.isSafeInteger(count) && count >= 0)
      || !Number.isSafeInteger(value.safe + value.wrecked)) return null;
    if (value.version === 1 && value.safe + value.wrecked !== 1) return null;
    if (value.version === 3) {
      if (!Number.isInteger(value.night) || value.night < 1 || value.night > 5
        || ![value.unseen, value.logged, value.cumulativeWrecks].every((count) => Number.isSafeInteger(count) && count >= 0)
        || (value.lost !== undefined && (!Number.isSafeInteger(value.lost) || value.lost < 0))
        || value.cumulativeWrecks < value.wrecked || value.relieved !== (value.cumulativeWrecks >= 3)) return null;
      return { version: 3, seed: value.seed, night: value.night, safe: value.safe, wrecked: value.wrecked,
        unseen: value.unseen, lost: value.lost ?? 0, logged: value.logged,
        cumulativeWrecks: value.cumulativeWrecks, relieved: value.relieved };
    }
    return { version: value.version, seed: value.seed, safe: value.safe, wrecked: value.wrecked };
  } catch {
    return null;
  }
}
