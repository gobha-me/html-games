import { describe, expect, it } from 'vitest';

import { HOTKEYS } from '../src/input/hotkeys';

describe('hotkey registry', () => {
  it('every entry has at least one key', () => {
    for (const h of HOTKEYS) {
      expect(h.keys.length).toBeGreaterThan(0);
      expect(h.keys.every((k) => k.length > 0)).toBe(true);
    }
  });

  it('every entry has a non-empty label and description', () => {
    for (const h of HOTKEYS) {
      expect(h.label).not.toEqual('');
      expect(h.description).not.toEqual('');
    }
  });

  it('covers every binding actually wired in handlers.ts', () => {
    // If you add a new binding to input/handlers.ts, add a matching
    // registry entry — this test guards the legend from drifting out
    // of sync with the real bindings.
    const wired = ['Space', 'Enter', 'N', 'F', 'Esc', '?', '`', '~'];
    const seen = new Set(HOTKEYS.flatMap((h) => h.keys));
    for (const key of wired) {
      expect(seen.has(key), `expected legend entry for ${key}`).toBe(true);
    }
  });
});
