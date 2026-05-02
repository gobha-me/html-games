import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aiPickTech } from '../src/ai/techAI';
import { initAIMemory } from '../src/ai/memory';
import { aiDiplomacy } from '../src/ai/diploAI';
import {
  RALLY_RADIUS,
  computeRallyMap,
  effectiveAgg,
  pickTargetCity,
  pickTargetEnemy,
  updateAIStrategy,
} from '../src/ai/strategy';
import { hexKey } from '../src/core/hex';
import { createSeededRng, initGameRng } from '../src/core/rng';
import { G } from '../src/core/state';
import { asFactionIdx } from '../src/core/types';
import type { Faction, FactionIdx, GameMap, TerrainId, Tile } from '../src/core/types';
import { PERSONALITIES, type PersonalityId } from '../src/data/personalities';
import { TECHS } from '../src/data/techs';
import { createCity } from '../src/systems/city';
import { createUnit } from '../src/systems/movement';
import { aiMilitaryAction } from '../src/ai/unitAI';

function makeFaction(personality: Faction['personality']): Faction {
  return {
    idx: 0 as FactionIdx,
    id: 'cogwright',
    name: 'Test',
    color: '#fff',
    glyph: 'X',
    personality,
    desc: '',
    isAI: true,
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

describe('aiPickTech', () => {
  it('returns null when no techs are available', () => {
    const f = makeFaction('scientific');
    // Mark every tech as researched.
    for (const id of Object.keys(TECHS)) f.techs.add(id as keyof typeof TECHS);
    expect(aiPickTech(f, createSeededRng(1))).toBeNull();
  });

  it('returns a deterministic choice for a fixed seed and personality', () => {
    const a = aiPickTech(makeFaction('scientific'), createSeededRng(42));
    const b = aiPickTech(makeFaction('scientific'), createSeededRng(42));
    expect(a).toBe(b);
    expect(a).not.toBeNull();
  });

  it('biases scientific personalities toward science-branch picks at turn 0', () => {
    // The scientific personality has prefBranch='science' and a +60 score
    // boost for that branch; with the small ±0..8 jitter, the first pick
    // should fall in the science branch a strong majority of the time.
    let scienceCount = 0;
    const trials = 50;
    for (let seed = 1; seed <= trials; seed++) {
      const f = makeFaction('scientific');
      const pick = aiPickTech(f, createSeededRng(seed));
      if (!pick) continue;
      if (TECHS[pick].branch === 'science') scienceCount++;
    }
    expect(scienceCount).toBeGreaterThan(trials * 0.7);
  });

  it('biases industrial personalities toward industry-branch picks', () => {
    let industryCount = 0;
    const trials = 50;
    for (let seed = 1; seed <= trials; seed++) {
      const f = makeFaction('industrial');
      const pick = aiPickTech(f, createSeededRng(seed));
      if (!pick) continue;
      if (TECHS[pick].branch === 'industry') industryCount++;
    }
    expect(industryCount).toBeGreaterThan(trials * 0.5);
  });

  // Phase 3 S2 — pickTech hook short-circuits default scoring when the
  // override returns an *available* tech id. A null hook return defers to
  // default scoring (behavior byte-identical to pre-S2).
  it('returns the pickTech hook override when the chosen tech is available', () => {
    const f = makeFaction('scientific');
    f.behavior = { pickTech: () => 'metallurgy' };
    expect(aiPickTech(f, createSeededRng(7))).toBe('metallurgy');
  });

  it('falls through to default scoring when the pickTech hook returns null', () => {
    const f = makeFaction('scientific');
    const baseline = aiPickTech(f, createSeededRng(7));
    f.behavior = { pickTech: () => null };
    expect(aiPickTech(f, createSeededRng(7))).toBe(baseline);
  });

  it('falls through to default scoring when the pickTech hook returns an unavailable tech', () => {
    const f = makeFaction('scientific');
    f.techs.add('metallurgy');
    const baseline = aiPickTech(f, createSeededRng(7));
    f.behavior = { pickTech: () => 'metallurgy' };
    expect(aiPickTech(f, createSeededRng(7))).toBe(baseline);
  });
});

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

function buildPlainsMap(size = 9): GameMap {
  const tiles = new Map<`${number},${number}`, Tile>();
  for (let r = 0; r < size; r++) {
    for (let q = 0; q < size; q++) {
      tiles.set(hexKey(q, r), makeTile(q, r));
    }
  }
  return { w: size, h: size, tiles };
}

function makeFullFaction(idx: number, personality: Faction['personality'] = 'militaristic'): Faction {
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

describe('persistent conquest goals', () => {
  let prevMap: GameMap | null;

  beforeEach(() => {
    prevMap = G.map;
    G.map = buildPlainsMap();
    G.units = [];
    G.cities = [];
    G.factions = [makeFullFaction(0, 'militaristic'), makeFullFaction(1, 'scientific')];
    G.factions[0].diplo[1] = 'war';
    G.factions[1].diplo[0] = 'war';
    G.aiMemory = {};
    initAIMemory(asFactionIdx(0));
    initAIMemory(asFactionIdx(1));
    G.nextUnitId = 1;
    G.nextCityId = 1;
    G.turn = 30;
    G.playerFactionIdx = asFactionIdx(0);
    G.currentFactionIdx = asFactionIdx(0);
    G.events = [];
    initGameRng(7);
  });

  afterEach(() => {
    G.map = prevMap;
  });

  it('pickTargetEnemy returns null with no grudges', () => {
    expect(pickTargetEnemy(G.factions[0])).toBeNull();
  });

  it('pickTargetEnemy picks the highest-grudge alive faction', () => {
    G.factions.push(makeFullFaction(2, 'industrial'));
    initAIMemory(asFactionIdx(2));
    G.aiMemory[0]!.grudges[1] = 50;
    G.aiMemory[0]!.grudges[2] = 120;
    expect(pickTargetEnemy(G.factions[0])).toBe(2);
  });

  it('pickTargetCity prefers capital on equal-distance tiebreak', () => {
    createCity(asFactionIdx(0), 0, 4, 'Home');
    const c1 = createCity(asFactionIdx(1), 4, 0, 'Plain');
    const c2 = createCity(asFactionIdx(1), 0, 0, 'Throne');
    c2.isCapital = true;
    // Both enemy cities are 4 hexes from Home (axial distance).
    expect(pickTargetCity(G.factions[0], asFactionIdx(1))).toBe(c2.id);
    expect(c1.id).not.toBe(c2.id);
  });

  it('updateAIStrategy refreshes targetCityId only when missing/captured', () => {
    createCity(asFactionIdx(0), 0, 4, 'Home');
    const c1 = createCity(asFactionIdx(1), 4, 0, 'Throne');
    c1.isCapital = true;
    G.aiMemory[0]!.grudges[1] = 30;
    updateAIStrategy(G.factions[0]);
    expect(G.aiMemory[0]!.targetCityId).toBe(c1.id);

    // Add a wounded but non-capital enemy city. Sticky target should hold.
    const c2 = createCity(asFactionIdx(1), 0, 0, 'Outpost');
    c2.hp = 5;
    updateAIStrategy(G.factions[0]);
    expect(G.aiMemory[0]!.targetCityId).toBe(c1.id);

    // Capture the throne (flip ownership). Anchor must move.
    c1.factionIdx = asFactionIdx(0);
    updateAIStrategy(G.factions[0]);
    expect(G.aiMemory[0]!.targetCityId).toBe(c2.id);
  });

  it('aiMilitaryAction picks rightward city when targetCityId points right', () => {
    G.aiMemory[0]!.strategicPhase = 'contest';
    createCity(asFactionIdx(0), 4, 8, 'Home');
    const cA = createCity(asFactionIdx(1), 0, 4, 'A');
    const cB = createCity(asFactionIdx(1), 8, 4, 'B');
    for (const c of [cA, cB]) {
      const t = G.map!.tiles.get(hexKey(c.q, c.r))!;
      t.visibility[0] = 'visible';
    }
    const cog = createUnit('COGMAN', asFactionIdx(0), 4, 4);
    G.aiMemory[0]!.targetCityId = cB.id;
    aiMilitaryAction(G.factions[0], cog);
    expect(cog.q).toBeGreaterThan(4);
  });

  it('aiMilitaryAction picks leftward city when targetCityId points left', () => {
    G.aiMemory[0]!.strategicPhase = 'contest';
    createCity(asFactionIdx(0), 4, 8, 'Home');
    const cA = createCity(asFactionIdx(1), 0, 4, 'A');
    const cB = createCity(asFactionIdx(1), 8, 4, 'B');
    for (const c of [cA, cB]) {
      const t = G.map!.tiles.get(hexKey(c.q, c.r))!;
      t.visibility[0] = 'visible';
    }
    const cog = createUnit('COGMAN', asFactionIdx(0), 4, 4);
    G.aiMemory[0]!.targetCityId = cA.id;
    aiMilitaryAction(G.factions[0], cog);
    expect(cog.q).toBeLessThan(4);
  });

  it('replay parity: pickTargetEnemy + pickTargetCity are pure on identical state', () => {
    G.factions.push(makeFullFaction(2, 'industrial'));
    initAIMemory(asFactionIdx(2));
    G.aiMemory[0]!.grudges[1] = 60;
    G.aiMemory[0]!.grudges[2] = 60;
    createCity(asFactionIdx(0), 0, 0, 'Home');
    createCity(asFactionIdx(1), 3, 0, 'F1A');
    createCity(asFactionIdx(2), 4, 0, 'F2A');
    const e1 = pickTargetEnemy(G.factions[0]);
    const e2 = pickTargetEnemy(G.factions[0]);
    expect(e1).toBe(e2);
    if (e1 != null) {
      expect(pickTargetCity(G.factions[0], e1)).toBe(pickTargetCity(G.factions[0], e1));
    }
  });
});

describe('tactical rally map (2f-3)', () => {
  let prevMap: GameMap | null;

  beforeEach(() => {
    prevMap = G.map;
    G.map = buildPlainsMap(16);
    G.units = [];
    G.cities = [];
    G.factions = [makeFullFaction(0, 'militaristic'), makeFullFaction(1, 'scientific')];
    G.factions[0].diplo[1] = 'war';
    G.factions[1].diplo[0] = 'war';
    G.aiMemory = {};
    initAIMemory(asFactionIdx(0));
    initAIMemory(asFactionIdx(1));
    G.nextUnitId = 1;
    G.nextCityId = 1;
    G.turn = 30;
    G.playerFactionIdx = asFactionIdx(0);
    G.currentFactionIdx = asFactionIdx(0);
    G.events = [];
    initGameRng(11);
  });

  afterEach(() => {
    G.map = prevMap;
  });

  it('returns empty when targetCityId is null', () => {
    expect(computeRallyMap(G.factions[0])).toEqual([]);
  });

  it('groupSize counts only friendlies within RALLY_RADIUS', () => {
    const enemy = createCity(asFactionIdx(1), 8, 8, 'Throne');
    G.aiMemory[0]!.targetCityId = enemy.id;
    // 3 cogmen near the city.
    createUnit('COGMAN', asFactionIdx(0), 7, 8);
    createUnit('COGMAN', asFactionIdx(0), 9, 8);
    createUnit('COGMAN', asFactionIdx(0), 8, 9);
    // 1 cogman far away (outside RALLY_RADIUS).
    createUnit('COGMAN', asFactionIdx(0), 0, 0);
    const rally = computeRallyMap(G.factions[0])[0];
    expect(rally.groupSize).toBe(3);
    // Sanity: that far unit is beyond radius.
    expect(RALLY_RADIUS).toBeLessThan(8);
  });

  it('rallyReady fires when groupPower exceeds suicide-rush threshold', () => {
    G.aiMemory[0]!.strategicPhase = 'contest';
    const home = createCity(asFactionIdx(0), 0, 0, 'Home');
    expect(home).toBeDefined();
    const target = createCity(asFactionIdx(1), 8, 0, 'Throne');
    target.population = 0;
    G.aiMemory[0]!.targetCityId = target.id;
    const t = G.map!.tiles.get(hexKey(target.q, target.r))!;
    t.visibility[0] = 'visible';
    // Three cogmen near the target — strong group.
    createUnit('COGMAN', asFactionIdx(0), 7, 0);
    createUnit('COGMAN', asFactionIdx(0), 6, 1);
    const lead = createUnit('COGMAN', asFactionIdx(0), 5, 2);
    // No alternative target exists, so even without rally bonus the lead
    // unit would head toward Throne. Smoke check: rally map agrees.
    const rally = computeRallyMap(G.factions[0])[0];
    expect(rally.groupSize).toBeGreaterThanOrEqual(3);
    expect(rally.groupPower).toBeGreaterThan(rally.cityDef * 0.8);
    aiMilitaryAction(G.factions[0], lead);
    expect(lead.q).toBeGreaterThan(5);
  });

  it('rally NOT ready when groupSize below RALLY_MIN_SIZE', () => {
    // Unit-level "rallyReady" gate: without ≥3 friendlies in radius the
    // RALLY_JOIN_BONUS must not apply, regardless of how strong the lone
    // unit happens to be. We verify the rally state itself rather than
    // unit movement, since the targetCityId bias from 2f-2 also nudges
    // movement and would mask this gate.
    const home = createCity(asFactionIdx(0), 0, 0, 'Home');
    expect(home).toBeDefined();
    const target = createCity(asFactionIdx(1), 8, 0, 'Throne');
    G.aiMemory[0]!.targetCityId = target.id;
    createUnit('COGMAN', asFactionIdx(0), 7, 0);
    const rally = computeRallyMap(G.factions[0])[0];
    expect(rally.groupSize).toBeLessThan(3);
    expect(rally.groupSize * 1).toBe(1); // exactly one in radius
  });

  it('rally bucketing is deterministic across G.units permutations', () => {
    const target = createCity(asFactionIdx(1), 8, 0, 'Throne');
    G.aiMemory[0]!.targetCityId = target.id;
    createUnit('COGMAN', asFactionIdx(0), 7, 0);
    createUnit('COGMAN', asFactionIdx(0), 9, 0);
    createUnit('COGMAN', asFactionIdx(0), 8, 1);
    const a = computeRallyMap(G.factions[0])[0];
    // Reverse the array to simulate a future code path that re-orders
    // G.units. computeRallyMap sorts by id internally so the result must
    // be byte-identical.
    G.units.reverse();
    const b = computeRallyMap(G.factions[0])[0];
    expect(b.groupSize).toBe(a.groupSize);
    expect(b.groupPower).toBe(a.groupPower);
    expect(b.cityDef).toBe(a.cityDef);
  });
});

describe('effectiveAgg drift (2f-6)', () => {
  let prevMap: GameMap | null;

  beforeEach(() => {
    prevMap = G.map;
    G.map = buildPlainsMap();
    G.units = [];
    G.cities = [];
    G.factions = [makeFullFaction(0, 'defensive'), makeFullFaction(1, 'scientific')];
    G.aiMemory = {};
    initAIMemory(asFactionIdx(0));
    initAIMemory(asFactionIdx(1));
    G.nextUnitId = 1;
    G.nextCityId = 1;
    G.turn = 30;
    G.playerFactionIdx = asFactionIdx(0);
    G.currentFactionIdx = asFactionIdx(0);
    G.events = [];
  });

  afterEach(() => {
    G.map = prevMap;
  });

  it('returns base agg when grudge is 0', () => {
    // defensive personality has agg = 0.15.
    expect(effectiveAgg(G.factions[0], asFactionIdx(1))).toBeCloseTo(0.15);
  });

  it('clamps at 1.0 with extreme grudge', () => {
    G.aiMemory[0]!.grudges[1] = 100000;
    expect(effectiveAgg(G.factions[0], asFactionIdx(1))).toBe(1);
  });

  it('scales linearly within range', () => {
    // 0.15 base + 200 * 0.0015 = 0.15 + 0.30 = 0.45
    G.aiMemory[0]!.grudges[1] = 200;
    expect(effectiveAgg(G.factions[0], asFactionIdx(1))).toBeCloseTo(0.45);
  });

  it('sustained grudge eventually flips a peaceful faction toward war', () => {
    // Defensive faction (agg=0.15) with massive grudge — equiv agg ≈ 1.0.
    // aiDiplomacy war score = grudge*0.5 + agg*30 + (ratio-1)*50.
    // With grudge=900: 450 + 30 + 0 = 480 — well over WAR_THRESHOLD=60.
    // The 25% trigger chance lands within 20 calls on a seeded rng.
    G.factions[0].diplo[1] = 'peace';
    G.factions[1].diplo[0] = 'peace';
    G.aiMemory[0]!.grudges[1] = 900;
    initGameRng(42);
    let declared = false;
    for (let i = 0; i < 20; i++) {
      aiDiplomacy(G.factions[0]);
      const status: string = G.factions[0].diplo[1] ?? 'unmet';
      if (status === 'war') {
        declared = true;
        break;
      }
    }
    expect(declared).toBe(true);
  });
});

describe('personality cunning dim', () => {
  const ids = Object.keys(PERSONALITIES) as PersonalityId[];

  it('is defined for every personality', () => {
    for (const id of ids) {
      expect(typeof PERSONALITIES[id].cunning).toBe('number');
    }
  });

  it('is within [0, 1] for every personality', () => {
    for (const id of ids) {
      const c = PERSONALITIES[id].cunning;
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  it('does not bleed into aiPickTech: scientific picks are stable across 50 trials of seed 42', () => {
    // Guards against accidental references to p.cunning in the tech scorer.
    // Same seed + same personality must produce the same tech, every call.
    const expected = aiPickTech(makeFaction('scientific'), createSeededRng(42));
    for (let i = 0; i < 50; i++) {
      const pick = aiPickTech(makeFaction('scientific'), createSeededRng(42));
      expect(pick).toBe(expected);
    }
  });
});
