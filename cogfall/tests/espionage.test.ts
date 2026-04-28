import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TECHS } from '../src/data/techs';
import { UNIT_TYPES, isNaval, isSpy } from '../src/data/units';
import type { UnitTypeId } from '../src/data/units';
import { aiPickBuild } from '../src/ai/cityAI';
import { createCity } from '../src/systems/city';
import { createSeededRng } from '../src/core/rng';
import { G } from '../src/core/state';
import type { Faction, FactionIdx, GameMap } from '../src/core/types';
import { asFactionIdx } from '../src/core/types';

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

function makeFaction(idx: number, personality: Faction['personality'] = 'militaristic'): Faction {
  return {
    idx: idx as FactionIdx,
    id: 'cogwright',
    name: `F${idx}`,
    color: '#fff',
    glyph: 'X',
    personality,
    desc: '',
    isAI: idx > 0,
    alive: true,
    resources: { gold: 0, aether: 0 },
    science: 0,
    researchProgress: 0,
    techs: new Set(),
    currentResearch: null,
    score: 0,
    diplo: {},
  };
}

describe('saboteur production gating', () => {
  let prevMap: GameMap | null;

  beforeEach(() => {
    prevMap = G.map;
    G.map = null;
    G.units = [];
    G.cities = [];
    G.factions = [makeFaction(0, 'militaristic')];
    G.nextUnitId = 1;
    G.nextCityId = 1;
    G.turn = 5;
    G.playerFactionIdx = asFactionIdx(0);
    G.currentFactionIdx = asFactionIdx(0);
    G.aiMemory = {};
    G.events = [];
  });

  afterEach(() => {
    G.map = prevMap;
  });

  it('aiPickBuild never offers SABOTEUR when faction lacks espionage', () => {
    const fac = G.factions[0];
    const city = createCity(asFactionIdx(0), 0, 0, 'NoSpy');
    const rng = createSeededRng(11);
    for (let i = 0; i < 100; i++) {
      const pick = aiPickBuild(fac, city, rng);
      if (pick && pick.kind === 'unit') {
        expect(pick.id).not.toBe('SABOTEUR');
      }
    }
  });

  it('aiPickBuild can offer SABOTEUR when faction has espionage and other options are saturated', () => {
    G.factions = [makeFaction(0, 'militaristic'), makeFaction(1, 'militaristic')];
    G.factions[0].diplo = { 1: 'war' };
    G.factions[1].diplo = { 0: 'war' };
    const fac = G.factions[0];
    fac.techs.add('espionage');
    G.turn = 30;
    const city = createCity(asFactionIdx(0), 0, 0, 'SpyHQ');
    city.population = 5;
    city.buildings.add('workshop');
    city.buildings.add('granary');
    city.buildings.add('walls');
    G.units.push(
      {
        id: 1,
        typeId: 'COGMAN',
        factionIdx: asFactionIdx(0),
        q: 0,
        r: 0,
        hp: 25,
        maxHp: 25,
        mp: 2,
        maxMp: 2,
        fortified: false,
      },
      {
        id: 2,
        typeId: 'COGMAN',
        factionIdx: asFactionIdx(0),
        q: 1,
        r: 0,
        hp: 25,
        maxHp: 25,
        mp: 2,
        maxMp: 2,
        fortified: false,
      }
    );
    const rng = createSeededRng(11);
    let sawSaboteur = false;
    for (let i = 0; i < 300; i++) {
      const pick = aiPickBuild(fac, city, rng);
      if (pick && pick.kind === 'unit' && pick.id === 'SABOTEUR') {
        sawSaboteur = true;
        break;
      }
    }
    expect(sawSaboteur).toBe(true);
  });

  it('aiPickBuild stops offering SABOTEUR once one is already in flight', () => {
    const fac = G.factions[0];
    fac.techs.add('espionage');
    G.units.push({
      id: 99,
      typeId: 'SABOTEUR',
      factionIdx: asFactionIdx(0),
      q: 0,
      r: 0,
      hp: 12,
      maxHp: 12,
      mp: 4,
      maxMp: 4,
      fortified: false,
    });
    const city = createCity(asFactionIdx(0), 0, 0, 'OneSpyOnly');
    const rng = createSeededRng(11);
    for (let i = 0; i < 100; i++) {
      const pick = aiPickBuild(fac, city, rng);
      if (pick && pick.kind === 'unit') {
        expect(pick.id).not.toBe('SABOTEUR');
      }
    }
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
