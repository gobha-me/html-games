import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyMod,
  clearMod,
  getActiveMod,
  modHash,
  ModValidationError,
} from '../src/core/mod';
import { G } from '../src/core/state';
import { UNIT_TYPES } from '../src/data/units';
import { BUILDING_TYPES } from '../src/data/buildings';
import { TECHS } from '../src/data/techs';
import { TERRAIN_TYPES } from '../src/data/terrain';
import { PERSONALITIES, AI_THINKING_LINES } from '../src/data/personalities';
import { CITY_NAMES, FACTIONS, MAP_SIZES } from '../src/data/factions';

function baseMod(): Record<string, unknown> {
  return { name: 'test-mod', version: '1.0' };
}

describe('mod / applyMod (object tables)', () => {
  beforeEach(() => {
    clearMod();
    G.map = null;
  });

  afterEach(() => {
    clearMod();
  });

  it('partial-merges per id without touching unrelated fields', () => {
    const cogmanHpBefore = (UNIT_TYPES as Record<string, { hp: number }>).COGMAN.hp;
    const pioneerCostBefore = (UNIT_TYPES as Record<string, { cost: number }>).PIONEER.cost;

    applyMod({
      ...baseMod(),
      units: { COGMAN: { atk: 99 } },
    });

    const cogman = (UNIT_TYPES as Record<string, { hp: number; atk: number }>).COGMAN;
    expect(cogman.atk).toBe(99);
    expect(cogman.hp).toBe(cogmanHpBefore);
    expect((UNIT_TYPES as Record<string, { cost: number }>).PIONEER.cost).toBe(pioneerCostBefore);
  });

  it('adds a new id when the mod introduces one', () => {
    expect('LASER_KNIGHT' in UNIT_TYPES).toBe(false);
    applyMod({
      ...baseMod(),
      units: {
        LASER_KNIGHT: {
          name: 'Laser Knight',
          hp: 50,
          atk: 12,
          def: 8,
          mp: 3,
          sight: 2,
          cost: 100,
          glyph: '⚡',
          desc: 'Pewpew.',
        },
      },
    });
    expect('LASER_KNIGHT' in UNIT_TYPES).toBe(true);
    expect((UNIT_TYPES as Record<string, { atk: number }>).LASER_KNIGHT.atk).toBe(12);
  });

  it('removes an id when the value is null', () => {
    expect('SABOTEUR' in UNIT_TYPES).toBe(true);
    applyMod({ ...baseMod(), units: { SABOTEUR: null } });
    expect('SABOTEUR' in UNIT_TYPES).toBe(false);
  });

  it('clearMod restores the original tables byte-for-byte', () => {
    const beforeUnits = JSON.stringify(UNIT_TYPES);
    const beforeBuildings = JSON.stringify(BUILDING_TYPES);
    const beforeTechs = JSON.stringify(TECHS);
    const beforeTerrain = JSON.stringify(TERRAIN_TYPES);
    const beforePersonalities = JSON.stringify(PERSONALITIES);
    const beforeMapSizes = JSON.stringify(MAP_SIZES);
    const beforeLines = JSON.stringify(AI_THINKING_LINES);

    applyMod({
      ...baseMod(),
      units: { COGMAN: { atk: 99 }, EXTRA: { name: 'X', hp: 1, atk: 1, def: 1, mp: 1, sight: 1, cost: 1, glyph: '?', desc: '' } },
      buildings: { workshop: { cost: 999 } },
      techs: { rediscovery: null },
      terrain: { PLAINS: { food: 99 } },
      personalities: { industrial: { mil: 0.99 } },
      mapSizes: { tiny: { w: 5, h: 5 } },
      aiThinkingLines: { industrial: ['stomps...'] },
    });

    clearMod();

    expect(JSON.stringify(UNIT_TYPES)).toBe(beforeUnits);
    expect(JSON.stringify(BUILDING_TYPES)).toBe(beforeBuildings);
    expect(JSON.stringify(TECHS)).toBe(beforeTechs);
    expect(JSON.stringify(TERRAIN_TYPES)).toBe(beforeTerrain);
    expect(JSON.stringify(PERSONALITIES)).toBe(beforePersonalities);
    expect(JSON.stringify(MAP_SIZES)).toBe(beforeMapSizes);
    expect(JSON.stringify(AI_THINKING_LINES)).toBe(beforeLines);
    expect(getActiveMod()).toBeNull();
  });

  it('reapplying replaces the previous mod (mod B does not stack on mod A)', () => {
    applyMod({ ...baseMod(), units: { COGMAN: { atk: 99 } } });
    applyMod({ ...baseMod(), name: 'mod-b', units: { COGMAN: { def: 88 } } });
    const cogman = (UNIT_TYPES as Record<string, { atk: number; def: number }>).COGMAN;
    // atk goes back to baseline (99 was mod A's mutation) and def is mod B's.
    expect(cogman.atk).not.toBe(99);
    expect(cogman.def).toBe(88);
  });

  it('throws when mod root is not an object', () => {
    expect(() => applyMod('not an object')).toThrow(ModValidationError);
    expect(() => applyMod(null)).toThrow(ModValidationError);
    expect(() => applyMod([])).toThrow(ModValidationError);
  });

  it('throws when name or version is missing', () => {
    expect(() => applyMod({ version: '1.0' })).toThrow(/name/);
    expect(() => applyMod({ name: 'x' })).toThrow(/version/);
  });

  it('throws when a section is not an object', () => {
    expect(() =>
      applyMod({ ...baseMod(), units: 'oops' as unknown as Record<string, never> })
    ).toThrow(/units/);
  });

  it('throws when an aiThinkingLines entry is not a string array', () => {
    expect(() =>
      applyMod({
        ...baseMod(),
        aiThinkingLines: { industrial: [42 as unknown as string] },
      })
    ).toThrow(/aiThinkingLines/);
  });

  it('rejects mid-game application when G.map is not null', () => {
    G.map = { w: 1, h: 1, tiles: new Map() };
    expect(() => applyMod(baseMod())).toThrow(/in progress/);
    G.map = null;
  });

  it('rejects removing a hardcoded starter unit', () => {
    expect(() => applyMod({ ...baseMod(), units: { COGMAN: null } })).toThrow(/starter unit/);
    // Failure must be transactional: COGMAN is still present.
    expect('COGMAN' in UNIT_TYPES).toBe(true);
  });

  it('modHash is stable across key reordering', () => {
    const a = { name: 'm', version: '1', units: { COGMAN: { atk: 9, def: 8 } } };
    const b = { name: 'm', version: '1', units: { COGMAN: { def: 8, atk: 9 } } };
    expect(modHash(a)).toBe(modHash(b));
  });

  it('modHash differs for materially different mods', () => {
    const a = { name: 'm', version: '1', units: { COGMAN: { atk: 9 } } };
    const b = { name: 'm', version: '1', units: { COGMAN: { atk: 10 } } };
    expect(modHash(a)).not.toBe(modHash(b));
  });
});

describe('mod / applyMod (array tables)', () => {
  beforeEach(() => {
    clearMod();
    G.map = null;
  });

  afterEach(() => {
    clearMod();
  });

  it('replaces FACTIONS in place, preserving the array reference', () => {
    const arrayRefBefore = FACTIONS;
    const lengthBefore = FACTIONS.length;

    applyMod({
      ...baseMod(),
      factions: [
        {
          id: 'rust',
          name: 'The Rust Coven',
          color: '#aa3030',
          personality: 'militaristic',
          startTechs: [],
          desc: 'Iron eats iron.',
          traits: 'Bonus warband',
          glyph: '☢',
        },
        {
          id: 'glass',
          name: 'Glass Conclave',
          color: '#7090d0',
          personality: 'scientific',
          startTechs: ['rediscovery'],
          desc: 'Scholars under crystal domes.',
          traits: 'Starts with Rediscovery',
          glyph: '◇',
        },
      ],
    });

    expect(FACTIONS).toBe(arrayRefBefore);
    expect(FACTIONS.length).toBe(2);
    expect(FACTIONS.length).not.toBe(lengthBefore);
    expect(FACTIONS[0].id).toBe('rust');
    expect(FACTIONS[1].id).toBe('glass');
  });

  it('replaces CITY_NAMES in place', () => {
    const arrayRefBefore = CITY_NAMES;
    applyMod({
      ...baseMod(),
      cityNames: ['Alpha', 'Beta'],
    });
    expect(CITY_NAMES).toBe(arrayRefBefore);
    expect(CITY_NAMES.length).toBe(2);
    expect(CITY_NAMES[0]).toBe('Alpha');
  });

  it('clearMod restores FACTIONS and CITY_NAMES to defaults', () => {
    const factionsBefore = JSON.stringify(FACTIONS);
    const cityNamesBefore = JSON.stringify(CITY_NAMES);

    applyMod({
      ...baseMod(),
      factions: [
        {
          id: 'solo',
          name: 'Solo',
          color: '#fff',
          personality: 'industrial',
          startTechs: [],
          desc: '',
          traits: '',
          glyph: 'X',
        },
      ],
      cityNames: ['Lone'],
    });
    clearMod();

    expect(JSON.stringify(FACTIONS)).toBe(factionsBefore);
    expect(JSON.stringify(CITY_NAMES)).toBe(cityNamesBefore);
  });

  it('rejects an empty factions array', () => {
    expect(() => applyMod({ ...baseMod(), factions: [] })).toThrow(/factions/);
  });

  it('rejects a faction missing the id field', () => {
    expect(() =>
      applyMod({
        ...baseMod(),
        factions: [{ name: 'oops', personality: 'industrial' } as Record<string, unknown>],
      })
    ).toThrow(/id/);
  });

  it('rejects a non-string entry in cityNames', () => {
    expect(() =>
      applyMod({
        ...baseMod(),
        cityNames: ['ok', 99 as unknown as string],
      })
    ).toThrow(/cityNames/);
  });
});
