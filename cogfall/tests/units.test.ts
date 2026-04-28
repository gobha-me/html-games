import { describe, expect, it } from 'vitest';
import { UNIT_TYPES, isNaval } from '../src/data/units';
import type { UnitTypeId } from '../src/data/units';

describe('isNaval', () => {
  it('returns true for naval units', () => {
    expect(isNaval('STEAMSHIP')).toBe(true);
    expect(isNaval('IRONCLAD')).toBe(true);
    expect(isNaval('AETHER_FRIGATE')).toBe(true);
  });

  it('returns false for land units', () => {
    const land: UnitTypeId[] = [
      'PIONEER',
      'SCOUT',
      'COGMAN',
      'MUSKETEER',
      'STEAMTANK',
      'AETHERMECH',
      'WORKER',
    ];
    for (const id of land) {
      expect(isNaval(id), `${id} should not be naval`).toBe(false);
    }
  });

  it('every UNIT_TYPES entry is classified consistently', () => {
    for (const id of Object.keys(UNIT_TYPES) as UnitTypeId[]) {
      const tpl = UNIT_TYPES[id];
      const tagged = 'domain' in tpl && tpl.domain === 'sea';
      expect(isNaval(id)).toBe(tagged);
    }
  });
});
