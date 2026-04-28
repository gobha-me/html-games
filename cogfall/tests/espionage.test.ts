import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TECHS } from '../src/data/techs';
import type { TechId } from '../src/data/techs';
import { UNIT_TYPES, isNaval, isSpy } from '../src/data/units';
import type { UnitTypeId } from '../src/data/units';
import { aiPickBuild } from '../src/ai/cityAI';
import { aiSaboteurAction } from '../src/ai/unitAI';
import { createCity } from '../src/systems/city';
import {
  sabotageBuilding,
  sabotageableBuildings,
  stealTech,
  stealableTechs,
} from '../src/systems/espionage';
import { createUnit } from '../src/systems/movement';
import { createSeededRng, initGameRng } from '../src/core/rng';
import { G } from '../src/core/state';
import { hexKey } from '../src/core/hex';
import type { Faction, FactionIdx, GameMap, Tile, TerrainId } from '../src/core/types';
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

function makeTile(q: number, r: number, terrain: TerrainId): Tile {
  return {
    q,
    r,
    terrain,
    resource: null,
    improvement: null,
    owner: null,
    cityId: null,
    unitId: null,
    visibility: {},
  };
}

function buildPlainsMap(size = 7): GameMap {
  const tiles = new Map<`${number},${number}`, Tile>();
  for (let r = 0; r < size; r++) {
    for (let q = 0; q < size; q++) {
      tiles.set(hexKey(q, r), makeTile(q, r, 'PLAINS'));
    }
  }
  return { w: size, h: size, tiles };
}

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

describe('stealTech', () => {
  let prevMap: GameMap | null;

  beforeEach(() => {
    prevMap = G.map;
    G.map = null;
    G.units = [];
    G.cities = [];
    G.factions = [makeFaction(0, 'militaristic'), makeFaction(1, 'scientific')];
    G.nextUnitId = 1;
    G.nextCityId = 1;
    G.turn = 10;
    G.playerFactionIdx = asFactionIdx(0);
    G.currentFactionIdx = asFactionIdx(0);
    G.aiMemory = {};
    G.events = [];
    initGameRng(42);
  });

  afterEach(() => {
    G.map = prevMap;
  });

  it('transfers a stealable tech, removes the saboteur, and logs', () => {
    const thief = G.factions[0];
    const victim = G.factions[1];
    victim.techs.add('aetherics');
    victim.techs.add('rediscovery');
    const sab = createUnit('SABOTEUR', asFactionIdx(0), 1, 1);
    const city = createCity(asFactionIdx(1), 2, 1, 'Loomwerks');
    stealTech(sab, city);
    expect(thief.techs.size).toBeGreaterThan(0);
    const stolen = [...thief.techs][0];
    expect(victim.techs.has(stolen)).toBe(true);
    expect(G.units.find((u) => u.id === sab.id)).toBeUndefined();
    expect(G.events[0]?.type).toBe('tech');
    expect(G.events[0]?.msg).toContain('Loomwerks');
  });

  it('with empty pool: removes saboteur, no tech transferred, warns', () => {
    const thief = G.factions[0];
    thief.techs.add('aetherics');
    G.factions[1].techs.add('aetherics');
    const sab = createUnit('SABOTEUR', asFactionIdx(0), 1, 1);
    const city = createCity(asFactionIdx(1), 2, 1, 'Hollowgate');
    const beforeSize = thief.techs.size;
    stealTech(sab, city);
    expect(thief.techs.size).toBe(beforeSize);
    expect(G.units.find((u) => u.id === sab.id)).toBeUndefined();
    expect(G.events[0]?.type).toBe('warning');
  });

  it('excludes isVictory techs from the stealable pool', () => {
    const victim = G.factions[1];
    victim.techs.add('grand_apparatus' as TechId);
    victim.techs.add('rediscovery');
    const pool = stealableTechs(0, 1);
    expect(pool).toContain('rediscovery');
    expect(pool).not.toContain('grand_apparatus');
  });

  it('replay parity: same seed → same tech stolen', () => {
    const setup = () => {
      G.units = [];
      G.cities = [];
      G.factions = [makeFaction(0, 'militaristic'), makeFaction(1, 'scientific')];
      G.factions[1].techs.add('rediscovery');
      G.factions[1].techs.add('aetherics');
      G.factions[1].techs.add('cartography');
      G.factions[1].techs.add('metallurgy');
      G.nextUnitId = 1;
      G.nextCityId = 1;
      G.events = [];
      initGameRng(2026);
      const sab = createUnit('SABOTEUR', asFactionIdx(0), 1, 1);
      const city = createCity(asFactionIdx(1), 2, 1, 'Same');
      stealTech(sab, city);
      return [...G.factions[0].techs][0];
    };
    const a = setup();
    const b = setup();
    expect(a).toBe(b);
  });
});

describe('aiSaboteurAction', () => {
  let prevMap: GameMap | null;

  beforeEach(() => {
    prevMap = G.map;
    G.map = buildPlainsMap();
    G.units = [];
    G.cities = [];
    G.factions = [makeFaction(0, 'militaristic'), makeFaction(1, 'scientific')];
    G.factions[0].diplo = { 1: 'war' };
    G.factions[1].diplo = { 0: 'war' };
    G.nextUnitId = 1;
    G.nextCityId = 1;
    G.turn = 10;
    G.playerFactionIdx = asFactionIdx(0);
    G.currentFactionIdx = asFactionIdx(0);
    G.aiMemory = {};
    G.events = [];
    initGameRng(99);
  });

  afterEach(() => {
    G.map = prevMap;
  });

  it('steals from a war-enemy city it is adjacent to', () => {
    const thief = G.factions[0];
    const victim = G.factions[1];
    victim.techs.add('rediscovery');
    victim.techs.add('aetherics');
    const sab = createUnit('SABOTEUR', asFactionIdx(0), 2, 2);
    createCity(asFactionIdx(1), 3, 2, 'Adjacent');
    aiSaboteurAction(thief, sab);
    expect(G.units.find((u) => u.id === sab.id)).toBeUndefined();
    expect(thief.techs.size).toBeGreaterThan(0);
  });

  it('does not steal from a non-war neighbor (war is required)', () => {
    G.factions[0].diplo = {};
    G.factions[1].diplo = {};
    const thief = G.factions[0];
    const victim = G.factions[1];
    victim.techs.add('rediscovery');
    const sab = createUnit('SABOTEUR', asFactionIdx(0), 2, 2);
    createCity(asFactionIdx(1), 3, 2, 'Peace');
    aiSaboteurAction(thief, sab);
    expect(G.units.find((u) => u.id === sab.id)).toBeDefined();
    expect(thief.techs.size).toBe(0);
  });

  it('does not steal from a war-enemy city with empty pool', () => {
    const thief = G.factions[0];
    const victim = G.factions[1];
    thief.techs.add('rediscovery');
    thief.techs.add('aetherics');
    victim.techs.add('rediscovery');
    victim.techs.add('aetherics');
    const sab = createUnit('SABOTEUR', asFactionIdx(0), 2, 2);
    createCity(asFactionIdx(1), 3, 2, 'Drained');
    createCity(asFactionIdx(0), 0, 2, 'Home');
    aiSaboteurAction(thief, sab);
    expect(G.units.find((u) => u.id === sab.id)).toBeDefined();
    expect(thief.techs.size).toBe(2);
  });

  it('walks home rather than toward neutral cities when no war declared', () => {
    G.factions[0].diplo = {};
    G.factions[1].diplo = {};
    const thief = G.factions[0];
    const victim = G.factions[1];
    victim.techs.add('rediscovery');
    const sab = createUnit('SABOTEUR', asFactionIdx(0), 3, 3);
    createCity(asFactionIdx(1), 5, 3, 'Neutral');
    createCity(asFactionIdx(0), 1, 3, 'Home');
    aiSaboteurAction(thief, sab);
    expect(sab.q).toBeLessThanOrEqual(3);
  });

  it('replay parity: same seed + same setup → same outcome', () => {
    const setup = () => {
      G.map = buildPlainsMap();
      G.units = [];
      G.cities = [];
      G.factions = [makeFaction(0, 'militaristic'), makeFaction(1, 'scientific')];
      G.factions[0].diplo = { 1: 'war' };
      G.factions[1].diplo = { 0: 'war' };
      G.factions[1].techs.add('rediscovery');
      G.factions[1].techs.add('aetherics');
      G.factions[1].techs.add('cartography');
      G.factions[1].techs.add('metallurgy');
      G.nextUnitId = 1;
      G.nextCityId = 1;
      G.events = [];
      initGameRng(7777);
      const sab = createUnit('SABOTEUR', asFactionIdx(0), 2, 2);
      createCity(asFactionIdx(1), 3, 2, 'Same');
      aiSaboteurAction(G.factions[0], sab);
      return [...G.factions[0].techs].sort();
    };
    const a = setup();
    const b = setup();
    expect(a).toEqual(b);
  });
});

describe('sabotageBuilding (2f-4)', () => {
  let prevMap: GameMap | null;

  beforeEach(() => {
    prevMap = G.map;
    G.map = buildPlainsMap();
    G.units = [];
    G.cities = [];
    G.factions = [makeFaction(0, 'economic'), makeFaction(1, 'scientific')];
    G.factions[0].diplo = { 1: 'war' };
    G.factions[1].diplo = { 0: 'war' };
    G.nextUnitId = 1;
    G.nextCityId = 1;
    G.turn = 10;
    G.playerFactionIdx = asFactionIdx(0);
    G.currentFactionIdx = asFactionIdx(0);
    G.aiMemory = {};
    G.events = [];
    initGameRng(2027);
  });

  afterEach(() => {
    G.map = prevMap;
  });

  it('removes one building, kills the saboteur, logs', () => {
    const sab = createUnit('SABOTEUR', asFactionIdx(0), 2, 2);
    const target = createCity(asFactionIdx(1), 3, 2, 'Workshop City');
    target.buildings.add('workshop');
    target.buildings.add('granary');
    sabotageBuilding(sab, target);
    expect(G.units.find((u) => u.id === sab.id)).toBeUndefined();
    expect(target.buildings.size).toBe(1);
  });

  it('excludes walls and citadel from the sabotage pool', () => {
    const target = createCity(asFactionIdx(1), 3, 2, 'Fortress');
    target.buildings.add('walls');
    target.buildings.add('citadel');
    target.buildings.add('library');
    const pool = sabotageableBuildings(target);
    expect(pool).not.toContain('walls');
    expect(pool).not.toContain('citadel');
    expect(pool).toContain('library');
  });

  it('empty-pool path: kills saboteur, no removal, logs warning', () => {
    const sab = createUnit('SABOTEUR', asFactionIdx(0), 2, 2);
    const target = createCity(asFactionIdx(1), 3, 2, 'Bare');
    // Only excluded buildings present.
    target.buildings.add('walls');
    target.buildings.add('citadel');
    sabotageBuilding(sab, target);
    expect(G.units.find((u) => u.id === sab.id)).toBeUndefined();
    expect(target.buildings.has('walls')).toBe(true);
    expect(target.buildings.has('citadel')).toBe(true);
  });

  it('aiSaboteurAction picks sabotage when steal pool is empty and sab pool non-empty', () => {
    // Thief and victim share all techs → empty steal pool.
    G.factions[0].techs.add('rediscovery');
    G.factions[0].techs.add('aetherics');
    G.factions[1].techs.add('rediscovery');
    G.factions[1].techs.add('aetherics');
    const sab = createUnit('SABOTEUR', asFactionIdx(0), 2, 2);
    const target = createCity(asFactionIdx(1), 3, 2, 'Sab Only');
    target.buildings.add('workshop');
    aiSaboteurAction(G.factions[0], sab);
    expect(G.units.find((u) => u.id === sab.id)).toBeUndefined();
    expect(target.buildings.has('workshop')).toBe(false);
  });

  it('replay parity: same seed → same building sabotaged', () => {
    const setup = () => {
      G.map = buildPlainsMap();
      G.units = [];
      G.cities = [];
      G.factions = [makeFaction(0, 'economic'), makeFaction(1, 'scientific')];
      G.nextUnitId = 1;
      G.nextCityId = 1;
      G.events = [];
      initGameRng(4321);
      const sab = createUnit('SABOTEUR', asFactionIdx(0), 1, 1);
      const target = createCity(asFactionIdx(1), 2, 1, 'Repeat');
      target.buildings.add('workshop');
      target.buildings.add('granary');
      target.buildings.add('library');
      target.buildings.add('foundry');
      sabotageBuilding(sab, target);
      // Find the one we removed by diffing.
      const all = ['workshop', 'granary', 'library', 'foundry'] as const;
      return all.find((b) => !target.buildings.has(b)) ?? 'none';
    };
    const a = setup();
    const b = setup();
    expect(a).toBe(b);
  });
});
