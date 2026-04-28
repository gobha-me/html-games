import { describe, expect, it } from 'vitest';
import { TECHS } from '../src/data/techs';
import { UNIT_TYPES, isNaval, isSpy } from '../src/data/units';
import type { UnitTypeId } from '../src/data/units';

describe('espionage tech', () => {
  it('exists with science branch and rediscovery prereq', () => {
    const t = TECHS.espionage;
    expect(t).toBeDefined();
    expect(t.branch).toBe('science');
    expect(t.prereqs).toContain('rediscovery');
  });

  it('unlocks SABOTEUR', () => {
    const t = TECHS.espionage;
    expect('unlocks' in t && t.unlocks).toBeTruthy();
    expect(('unlocks' in t ? t.unlocks : []) as readonly string[]).toContain(
      'SABOTEUR'
    );
  });
});

describe('SABOTEUR unit', () => {
  it('requires espionage and has steal_tech ability', () => {
    const u = UNIT_TYPES.SABOTEUR;
    expect(u).toBeDefined();
    expect('requires' in u && u.requires).toBe('espionage');
    expect('abilities' in u && (u.abilities as readonly string[])).toContain(
      'steal_tech'
    );
  });

  it('has the locked stat block', () => {
    const u = UNIT_TYPES.SABOTEUR;
    expect(u.hp).toBe(12);
    expect(u.atk).toBe(1);
    expect(u.def).toBe(1);
    expect(u.mp).toBe(4);
    expect(u.sight).toBe(2);
    expect(u.cost).toBe(50);
  });

  it('is not naval', () => {
    expect(isNaval('SABOTEUR')).toBe(false);
  });
});

describe('isSpy', () => {
  it('returns true for SABOTEUR', () => {
    expect(isSpy('SABOTEUR')).toBe(true);
  });

  it('returns false for non-spy units', () => {
    const others: UnitTypeId[] = [
      'PIONEER',
      'SCOUT',
      'COGMAN',
      'MUSKETEER',
      'STEAMTANK',
      'AETHERMECH',
      'WORKER',
      'STEAMSHIP',
      'IRONCLAD',
      'AETHER_FRIGATE',
    ];
    for (const id of others) {
      expect(isSpy(id), `${id} should not be a spy`).toBe(false);
    }
  });

  it('every UNIT_TYPES entry is classified consistently with abilities', () => {
    for (const id of Object.keys(UNIT_TYPES) as UnitTypeId[]) {
      const tpl = UNIT_TYPES[id];
      const tagged =
        'abilities' in tpl &&
        (tpl.abilities as readonly string[]).includes('steal_tech');
      expect(isSpy(id)).toBe(tagged);
    }
  });
});
