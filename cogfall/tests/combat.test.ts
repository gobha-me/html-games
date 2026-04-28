import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { combat } from '../src/systems/combat';
import { createSeededRng } from '../src/core/rng';
import { G } from '../src/core/state';
import type { Faction, FactionIdx, Tile, Unit } from '../src/core/types';

function makeFaction(idx: number, id: 'cogwright' | 'iron' | 'verdant'): Faction {
  return {
    idx: idx as FactionIdx,
    id,
    name: `F${idx}`,
    color: '#fff',
    glyph: 'X',
    personality: id === 'iron' ? 'militaristic' : id === 'verdant' ? 'defensive' : 'industrial',
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

function makeUnit(id: number, factionIdx: number, q: number, r: number): Unit {
  return {
    id,
    typeId: 'COGMAN',
    factionIdx: factionIdx as FactionIdx,
    q,
    r,
    hp: 25,
    maxHp: 25,
    mp: 2,
    maxMp: 2,
    fortified: false,
  };
}

function makeTile(q: number, r: number): Tile {
  return {
    q,
    r,
    terrain: 'PLAINS',
    resource: null,
    improvement: null,
    owner: null,
    cityId: null,
    unitId: null,
    visibility: {},
  };
}

describe('combat', () => {
  beforeEach(() => {
    G.factions = [makeFaction(0, 'cogwright'), makeFaction(1, 'cogwright')];
    G.units = [];
    G.cities = [];
    G.playerFactionIdx = 0 as FactionIdx;
    G.currentFactionIdx = 0 as FactionIdx;
    G.difficulty = 'medium';
    G.aiMemory = {};
    G.events = [];
    G.gameOver = false;
    G.turn = 1;

    const tiles = new Map<`${number},${number}`, Tile>();
    for (let q = -2; q <= 2; q++) {
      for (let r = -2; r <= 2; r++) {
        tiles.set(`${q},${r}`, makeTile(q, r));
      }
    }
    G.map = { w: 5, h: 5, tiles };
  });

  afterEach(() => {
    G.map = null;
  });

  it('produces deterministic damage given a seeded rng and identical inputs', () => {
    const setup = () => {
      const attacker = makeUnit(1, 0, 0, 0);
      const defender = makeUnit(2, 1, 1, 0);
      G.units = [attacker, defender];
      G.map!.tiles.get('0,0')!.unitId = 1;
      G.map!.tiles.get('1,0')!.unitId = 2;
      return { attacker, defender };
    };

    const a1 = setup();
    combat(a1.attacker, { q: 1, r: 0, target: 'unit' }, createSeededRng(7));
    const after1 = { aHp: a1.attacker.hp, dHp: a1.defender.hp };

    G.units = [];
    const a2 = setup();
    combat(a2.attacker, { q: 1, r: 0, target: 'unit' }, createSeededRng(7));
    const after2 = { aHp: a2.attacker.hp, dHp: a2.defender.hp };

    expect(after1).toEqual(after2);
  });

  it('auto-declares war between attacker and defender if they were at peace', () => {
    const attacker = makeUnit(1, 0, 0, 0);
    const defender = makeUnit(2, 1, 1, 0);
    G.units = [attacker, defender];
    G.map!.tiles.get('0,0')!.unitId = 1;
    G.map!.tiles.get('1,0')!.unitId = 2;
    G.factions[0].diplo[1] = 'peace';
    G.factions[1].diplo[0] = 'peace';

    combat(attacker, { q: 1, r: 0, target: 'unit' }, createSeededRng(1));

    expect(G.factions[0].diplo[1]).toBe('war');
    expect(G.factions[1].diplo[0]).toBe('war');
  });

  it('drains attacker MP to zero after combat', () => {
    const attacker = makeUnit(1, 0, 0, 0);
    const defender = makeUnit(2, 1, 1, 0);
    G.units = [attacker, defender];
    G.map!.tiles.get('0,0')!.unitId = 1;
    G.map!.tiles.get('1,0')!.unitId = 2;

    expect(attacker.mp).toBe(2);
    combat(attacker, { q: 1, r: 0, target: 'unit' }, createSeededRng(1));
    expect(attacker.mp).toBe(0);
  });

  it('iron-faction attackers do more damage than cogwright (IRON_ATK_BONUS)', () => {
    // Run two parallel scenarios with the same seed; only the attacker
    // faction differs. Iron should land higher damage on the defender.
    const seed = 42;
    const runScenario = (attackerFactionId: 'cogwright' | 'iron') => {
      G.factions = [makeFaction(0, attackerFactionId), makeFaction(1, 'cogwright')];
      const attacker = makeUnit(1, 0, 0, 0);
      const defender = makeUnit(2, 1, 1, 0);
      G.units = [attacker, defender];
      G.map!.tiles.get('0,0')!.unitId = 1;
      G.map!.tiles.get('1,0')!.unitId = 2;
      combat(attacker, { q: 1, r: 0, target: 'unit' }, createSeededRng(seed));
      return { attacker, defender };
    };

    const cogResult = runScenario('cogwright');
    const cogDmg = cogResult.defender.maxHp - cogResult.defender.hp;

    G.units = [];
    const ironResult = runScenario('iron');
    const ironDmg = ironResult.defender.maxHp - ironResult.defender.hp;

    expect(ironDmg).toBeGreaterThan(cogDmg);
  });
});
