export const STORAGE_KEY_RUN = 'lateEdition.run';

const STORAGE_KEY_BEST = 'lateEdition.bestCirculation.v2';

// Only nonnegative finite numbers (or their stored strings) are valid scores.
export function sanitizeBestScore(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return 0;
  if (typeof value === 'string' && value.trim() === '') return 0;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 ? score : 0;
}

// Resolve storage lazily: even obtaining browser storage can throw when blocked.
export function createStorageAdapter(getStorage = () => null) {
  return {
    readRun() {
      try {
        return { ok: true, json: getStorage()?.getItem(STORAGE_KEY_RUN) ?? null };
      } catch {
        return { ok: false, reason: 'The morgue file cannot be read. Storage is unavailable.' };
      }
    },
    writeRun(json) {
      try {
        const storage = getStorage();
        if (!storage) throw new Error('Storage unavailable');
        storage.setItem(STORAGE_KEY_RUN, json);
        return { ok: true };
      } catch {
        return { ok: false, reason: 'The run could not be saved. Storage is full or unavailable.' };
      }
    },
    clearRun() {
      try {
        const storage = getStorage();
        if (!storage) throw new Error('Storage unavailable');
        storage.removeItem(STORAGE_KEY_RUN);
        return { ok: true };
      } catch {
        return { ok: false, reason: 'The old morgue file could not be removed. Storage is unavailable.' };
      }
    },
    readBest() {
      try {
        return sanitizeBestScore(getStorage()?.getItem(STORAGE_KEY_BEST));
      } catch {
        // Blocked/disabled persistence must not prevent starting a night shift.
        return 0;
      }
    },
    writeBest(score) {
      try {
        getStorage()?.setItem(STORAGE_KEY_BEST, String(sanitizeBestScore(score)));
      } catch {
        // Quota/security failures leave the current run's best score in memory.
      }
    },
  };
}

export function createAudioAdapter(audio) {
  return Object.fromEntries([
    'dispatch', 'typewriter', 'wireBell', 'bribe', 'phoneRing', 'pressRun', 'shutter',
  ].map((cue) => [cue, (...args) => audio?.[cue]?.(...args)]));
}

export function resolveSeed(value, fallback) {
  if (typeof value === 'string' && /^[+-]?\d+$/.test(value.trim())
    && Number.isSafeInteger(Number(value))) return Number(value);
  return fallback;
}
