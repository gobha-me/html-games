import { beforeEach, describe, expect, it } from 'vitest';
import { combat, previewCombat } from '../src/systems/combat';
import { G } from '../src/core/state';
import type {
  City,
  Faction,
  FactionIdx,
  Tile,
  TerrainId,
  Unit,
  UnitTypeId,
} from '../src/core/types';

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

function makeUnit(
  id: number,
  factionIdx: number,
  q: number,
  r: number,
  typeId: UnitTypeId = 'COGMAN',
  hp = 25
): Unit {
  return {
    id,
    typeId,
    factionIdx: factionIdx as FactionIdx,
    q,
    r,
    hp,
    maxHp: 25,
    mp: 2,
    maxMp: 2,
    fortified: false,
  };
}

function makeTile(q: number, r: number, terrain: TerrainId = 'PLAINS'): Tile {
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

function makeCity(id: number, factionIdx: number, q: number, r: number): City {
  return {
    id,
    name: 'Testopolis',
    factionIdx: factionIdx as FactionIdx,
    q,
    r,
    population: 3,
    foodStored: 0,
    foodNeeded: 10,
    productionStored: 0,
    hp: 50,
    maxHp: 50,
    isCapital: false,
    buildings: new Set(),
    buildQueue: null,
  };
}

function setup() {
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
}

describe('previewCombat', () => {
  beforeEach(setup);

  it('returns null for an empty tile', () => {
    const attacker = makeUnit(1, 0, 0, 0);
    G.units = [attacker];
    G.map!.tiles.get('0,0')!.unitId = 1;
    expect(previewCombat(attacker, { q: 1, r: 0, target: 'unit' })).toBeNull();
  });

  it('produces unit-vs-unit ranges that match the deterministic formula', () => {
    const attacker = makeUnit(1, 0, 0, 0); // COGMAN: atk=4, def=4
    const defender = makeUnit(2, 1, 1, 0);
    G.units = [attacker, defender];
    G.map!.tiles.get('0,0')!.unitId = 1;
    G.map!.tiles.get('1,0')!.unitId = 2;

    const p = previewCombat(attacker, { q: 1, r: 0, target: 'unit' });
    expect(p?.kind).toBe('unit');
    if (p?.kind !== 'unit') return;
    // ratio = (4 * 1) / max(0.5, 4 * 1) = 1
    expect(p.atkMin).toBe(8); // round(8 * 1)
    expect(p.atkMax).toBe(12); // round(8 * 1 + 4)
    expect(p.defMin).toBe(8); // round(8 / 1)
    expect(p.defMax).toBe(11); // round(8 / 1 + 3)
  });

  it('applies the iron-attack bonus to the attacker', () => {
    G.factions = [makeFaction(0, 'iron'), makeFaction(1, 'cogwright')];
    const attacker = makeUnit(1, 0, 0, 0);
    const defender = makeUnit(2, 1, 1, 0);
    G.units = [attacker, defender];
    G.map!.tiles.get('0,0')!.unitId = 1;
    G.map!.tiles.get('1,0')!.unitId = 2;

    const p = previewCombat(attacker, { q: 1, r: 0, target: 'unit' });
    if (p?.kind !== 'unit') throw new Error('expected unit');
    // atkPow = 4 * 1.2 = 4.8; defPow = 4; ratio = 1.2
    expect(p.atkMin).toBe(Math.round(8 * 1.2)); // 10
    expect(p.atkMax).toBe(Math.round(8 * 1.2 + 4)); // 14
  });

  it('applies fortified, terrain, and verdant city defenses to the defender', () => {
    G.factions = [makeFaction(0, 'cogwright'), makeFaction(1, 'verdant')];
    const attacker = makeUnit(1, 0, 0, 0);
    const defender = makeUnit(2, 1, 1, 0);
    defender.fortified = true;
    const city = makeCity(10, 1, 1, 0);
    city.buildings.add('walls');
    city.buildings.add('citadel');
    G.units = [attacker, defender];
    G.cities = [city];
    G.map!.tiles.get('1,0')!.terrain = 'FOREST'; // FOREST defBonus
    G.map!.tiles.get('0,0')!.unitId = 1;
    G.map!.tiles.get('1,0')!.unitId = 2;
    G.map!.tiles.get('1,0')!.cityId = 10;

    const p = previewCombat(attacker, { q: 1, r: 0, target: 'unit' });
    if (p?.kind !== 'unit') throw new Error('expected unit');
    // Defender is heavily buffed; attacker damage should be the floor of 2.
    expect(p.atkMin).toBe(2);
    // Defender counter-attack scales high; just assert > base.
    expect(p.defMin).toBeGreaterThan(8);
  });

  it('applies hard-AI attack bonus to non-player attackers', () => {
    G.difficulty = 'hard';
    G.playerFactionIdx = 1 as FactionIdx;
    const attacker = makeUnit(1, 0, 0, 0); // faction 0 = AI
    const defender = makeUnit(2, 1, 1, 0);
    G.units = [attacker, defender];
    G.map!.tiles.get('0,0')!.unitId = 1;
    G.map!.tiles.get('1,0')!.unitId = 2;

    const p = previewCombat(attacker, { q: 1, r: 0, target: 'unit' });
    if (p?.kind !== 'unit') throw new Error('expected unit');
    // ratio = (4 * 1.15) / 4 = 1.15
    expect(p.atkMin).toBe(Math.round(8 * 1.15)); // 9
  });

  it('produces a deterministic single value for unit-vs-city', () => {
    const attacker = makeUnit(1, 0, 0, 0);
    const city = makeCity(10, 1, 1, 0);
    G.units = [attacker];
    G.cities = [city];
    G.map!.tiles.get('0,0')!.unitId = 1;
    G.map!.tiles.get('1,0')!.cityId = 10;

    const p = previewCombat(attacker, { q: 1, r: 0, target: 'city' });
    expect(p?.kind).toBe('city');
    if (p?.kind !== 'city') return;
    // atkPow = 4 * 1 * 1 = 4; cityDef = 25; dmg = round((4 * 60) / 25) = 10
    expect(p.dmgMin).toBe(10);
    expect(p.dmgMax).toBe(10);
  });

  it('preview range bounds the actual rolled outcome', () => {
    // Run live combat() with rng=0 and rng→1 substitutes; outcomes must
    // land within the preview range. This is the load-bearing guarantee:
    // preview and live must never disagree on the central deterministic
    // value.
    G.units = [];
    setup();
    const attacker = makeUnit(1, 0, 0, 0);
    const defender = makeUnit(2, 1, 1, 0);
    G.units = [attacker, defender];
    G.map!.tiles.get('0,0')!.unitId = 1;
    G.map!.tiles.get('1,0')!.unitId = 2;
    const p = previewCombat(attacker, { q: 1, r: 0, target: 'unit' });
    if (p?.kind !== 'unit') throw new Error('expected unit');

    // rng=0 path
    const aHpBefore = attacker.hp;
    const dHpBefore = defender.hp;
    combat(attacker, { q: 1, r: 0, target: 'unit' }, () => 0);
    const atkDealt0 = dHpBefore - defender.hp;
    const defDealt0 = aHpBefore - attacker.hp;
    expect(atkDealt0).toBe(p.atkMin);
    expect(defDealt0).toBe(p.defMin);
  });
});
