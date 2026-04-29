// Phase 2g-1 invariants: culture is plumbed into types, yields, and saves
// without changing any pre-existing behavior. The tile-claim system, victory
// check, and AI scoring land in later 2g sub-commits — those tests live
// alongside this file as the system fills in.

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { G } from '../src/core/state';
import {
  loadGameState,
  SAVE_VERSION,
  serializeGameState,
  type SaveData,
} from '../src/core/save';
import { cityYields, createCity } from '../src/systems/city';
import {
  computeCulturalClaim,
  CLAIM_RADIUS,
  getCulturalShare,
  processCulturalHegemony,
  tallyClaimedTiles,
} from '../src/systems/culture';
import { generateMap } from '../src/systems/mapgen';
import { hexDistance, hexKey } from '../src/core/hex';
import { createSeededRng } from '../src/core/rng';
import { FACTIONS } from '../src/data/factions';
import { PERSONALITIES } from '../src/data/personalities';
import { TECHS, TECH_BRANCHES } from '../src/data/techs';
import { BUILDING_TYPES } from '../src/data/buildings';
import { TERRAIN_TYPES } from '../src/data/terrain';
import { getAvailableTechs } from '../src/systems/research';
import { aiPickTech } from '../src/ai/techAI';
import { aiPickBuild } from '../src/ai/cityAI';
import { initAIMemory } from '../src/ai/memory';
import type { Faction, FactionIdx, Tile } from '../src/core/types';

function TERRAIN_TYPES_walkable(t: Tile): boolean {
  return TERRAIN_TYPES[t.terrain].walkable;
}

// Build a small synthetic all-PLAINS map. Avoids the seed-roulette of
// generateMap when a test needs deterministic geometry — every tile is
// walkable, no water/mountains, no resources.
function buildSyntheticPlainsMap(half: number = 8): void {
  G.map = {
    w: half * 2 + 1,
    h: half * 2 + 1,
    tiles: new Map(),
  };
  for (let q = -half; q <= half; q++) {
    for (let r = -half; r <= half; r++) {
      G.map.tiles.set(hexKey(q, r), {
        q,
        r,
        terrain: 'PLAINS',
        resource: null,
        improvement: null,
        owner: null,
        cityId: null,
        unitId: null,
        visibility: {},
      });
    }
  }
}

// Pick a walkable tile that has at least CLAIM_RADIUS-many walkable
// neighbors at distance ≤ CLAIM_RADIUS — gives the claim system an
// honest neighborhood to project into. Map seeds vary, so iterate
// until we find one.
function pickInteriorWalkable(map: NonNullable<typeof G.map>): Tile {
  for (const t of map.tiles.values()) {
    if (!TERRAIN_TYPES_walkable(t)) continue;
    let neighbors = 0;
    for (const other of map.tiles.values()) {
      if (other === t) continue;
      if (!TERRAIN_TYPES_walkable(other)) continue;
      const d = hexDistance({ q: t.q, r: t.r }, { q: other.q, r: other.r });
      if (d > 0 && d <= CLAIM_RADIUS) neighbors++;
      if (neighbors >= 6) return t;
    }
  }
  throw new Error('no interior walkable tile found');
}

function makeFaction(idx: number, isAI: boolean): Faction {
  const tpl = FACTIONS[idx];
  return {
    idx: idx as FactionIdx,
    id: tpl.id,
    name: tpl.name,
    color: tpl.color,
    glyph: tpl.glyph,
    personality: tpl.personality,
    desc: tpl.desc,
    isAI,
    alive: true,
    resources: { gold: 50, aether: 0 },
    science: 0,
    researchProgress: 0,
    techs: new Set(tpl.startTechs),
    currentResearch: null,
    score: 0,
    diplo: {},
  };
}

function buildSmallScenario(): void {
  G.map = generateMap('small', createSeededRng(123));
  G.factions = [makeFaction(0, false)];
  G.units = [];
  G.cities = [];
  G.events = [];
  G.aiMemory = {};
  G.gameOver = false;
  G.turn = 1;
  G.nextUnitId = 1;
  G.nextCityId = 1;
  G.currentFactionIdx = 0 as FactionIdx;
  G.playerFactionIdx = 0 as FactionIdx;
  G.difficulty = 'medium';
  G.cameraX = 0;
  G.cameraY = 0;
  G.zoom = 1;
  G.goldHegemonyCounter = {};
  G.goldHegemonyThreshold = 5000;
  G.goldHegemonyRequired = 3;
  G.culturalHegemonyCounter = {};
  G.culturalHegemonyThreshold = 0.4;
  G.culturalHegemonyRequired = 5;
  G.culturalHegemonyEnabled = true;
}

function clearGameState(): void {
  G.map = null;
  G.factions = [];
  G.units = [];
  G.cities = [];
  G.events = [];
  G.aiMemory = {};
  G.goldHegemonyCounter = {};
  G.culturalHegemonyCounter = {};
}

describe('Phase 2g-1: culture types and save migration', () => {
  beforeEach(() => clearGameState());
  afterEach(() => clearGameState());

  it('cityYields returns culture: 0 for a city with no culture-yielding buildings', () => {
    buildSmallScenario();
    // Pick a tile in the populated map for a synthetic city. mapgen places
    // tiles around (0, 0); use the first walkable one we find.
    const tile = [...G.map!.tiles.values()].find((t) => t.q === 0 && t.r === 0);
    expect(tile).toBeDefined();
    const c = createCity(0 as FactionIdx, tile!.q, tile!.r, 'Test City');
    const y = cityYields(c);
    expect(y.culture).toBe(0);
    // And every other yield key is still present (no field went missing).
    expect(typeof y.food).toBe('number');
    expect(typeof y.prod).toBe('number');
    expect(typeof y.gold).toBe('number');
    expect(typeof y.sci).toBe('number');
    expect(typeof y.aether).toBe('number');
  });

  it('every personality has a culture dim in [0, 1]', () => {
    for (const [id, p] of Object.entries(PERSONALITIES)) {
      const pp = p as unknown as { culture?: number };
      expect(typeof pp.culture, `${id} culture is a number`).toBe('number');
      expect(pp.culture!).toBeGreaterThanOrEqual(0);
      expect(pp.culture!).toBeLessThanOrEqual(1);
    }
  });

  it('round-trips a v3 save preserving cultural hegemony fields', () => {
    buildSmallScenario();
    G.culturalHegemonyCounter = { 0: 2 };
    G.culturalHegemonyThreshold = 0.42;
    G.culturalHegemonyRequired = 7;
    G.culturalHegemonyEnabled = false;

    const data = serializeGameState();
    expect(data.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBe(4);

    // Round-trip through JSON to simulate localStorage.
    const json = JSON.stringify(data);
    const parsed = JSON.parse(json) as SaveData;

    clearGameState();
    loadGameState(parsed);

    expect(G.culturalHegemonyCounter[0]).toBe(2);
    expect(G.culturalHegemonyThreshold).toBe(0.42);
    expect(G.culturalHegemonyRequired).toBe(7);
    expect(G.culturalHegemonyEnabled).toBe(false);
  });

  it('printing_press building yields +2 culture; opera_house yields +4 culture +1 gold', () => {
    buildSmallScenario();
    const tile = [...G.map!.tiles.values()].find((t) => t.q === 0 && t.r === 0);
    expect(tile).toBeDefined();
    const c = createCity(0 as FactionIdx, tile!.q, tile!.r, 'Test City');

    const baseCulture = cityYields(c).culture;
    const baseGold = cityYields(c).gold;

    c.buildings.add('printing_press');
    const afterPress = cityYields(c);
    expect(afterPress.culture - baseCulture).toBe(2);

    c.buildings.add('opera_house');
    const afterBoth = cityYields(c);
    expect(afterBoth.culture - baseCulture).toBe(2 + 4);
    expect(afterBoth.gold - baseGold).toBe(1);

    // BUILDING_TYPES sanity — yields are correctly declared.
    expect(BUILDING_TYPES.printing_press.requires).toBe('lithography');
    expect(BUILDING_TYPES.opera_house.requires).toBe('salons');
  });

  it('salons tech is gated behind lithography (prereq chain)', () => {
    buildSmallScenario();
    // Without rediscovery: lithography is not available because its prereq
    // is missing.
    const f = G.factions[0];
    f.techs = new Set();
    let avail = getAvailableTechs(f).map((t) => t.id);
    expect(avail).not.toContain('lithography');
    expect(avail).not.toContain('salons');

    // With rediscovery: lithography is available, salons is not.
    f.techs.add('rediscovery');
    avail = getAvailableTechs(f).map((t) => t.id);
    expect(avail).toContain('lithography');
    expect(avail).not.toContain('salons');

    // Once lithography is researched: salons is available.
    f.techs.add('lithography');
    avail = getAvailableTechs(f).map((t) => t.id);
    expect(avail).toContain('salons');

    // Both new techs live on the new culture branch.
    expect(TECHS.lithography.branch).toBe('culture');
    expect(TECHS.salons.branch).toBe('culture');
    expect('culture' in TECH_BRANCHES).toBe(true);
  });

  it('verdant faction gets +1 culture in capitals only', () => {
    buildSmallScenario();
    // Override the (cogwright) faction to verdant so cityYields finds the
    // matching id check at city.ts.
    const v = FACTIONS.find((f) => f.id === 'verdant')!;
    G.factions[0] = {
      ...G.factions[0],
      id: v.id,
      name: v.name,
      color: v.color,
      glyph: v.glyph,
      personality: v.personality,
      desc: v.desc,
    };

    const tile = [...G.map!.tiles.values()].find((t) => t.q === 0 && t.r === 0);
    const cap = createCity(0 as FactionIdx, tile!.q, tile!.r, 'Verdant Cap');
    cap.isCapital = true;

    // Find another walkable tile far enough to host a non-capital city
    // without overlapping the first one's neighborhood.
    const otherTile = [...G.map!.tiles.values()].find(
      (t) => t.q === 5 && t.r === 5 && t.owner == null
    );
    if (!otherTile) {
      // Fallback: pick any walkable tile not already owned.
      // (Test is still meaningful — we just need a non-capital city.)
    }
    const second = createCity(
      0 as FactionIdx,
      otherTile?.q ?? 4,
      otherTile?.r ?? -2,
      'Verdant Outpost'
    );
    second.isCapital = false;

    expect(cityYields(cap).culture).toBe(1);
    expect(cityYields(second).culture).toBe(0);
  });

  it('cultural pressure claims neutral tiles within CLAIM_RADIUS of a culturing city', () => {
    buildSmallScenario();
    // Find an interior walkable tile to plant the city, so radius-3
    // neighborhood contains plenty of unowned land.
    const center = pickInteriorWalkable(G.map!);
    expect(center).toBeDefined();
    const c = createCity(0 as FactionIdx, center!.q, center!.r, 'Press City');
    c.buildings.add('printing_press'); // +2 culture

    computeCulturalClaim();

    // Some neutral walkable tile within radius 3 should be claimed by
    // faction 0. Tiles immediately adjacent are owner-set by createCity,
    // so look at distance 2-3.
    const claimed = [...G.map!.tiles.values()].filter(
      (t) => t.claim === (0 as FactionIdx)
    );
    expect(claimed.length).toBeGreaterThan(0);
    for (const t of claimed) {
      // Soft claim never overlaps ownership.
      expect(t.owner).toBeNull();
      expect(hexDistance({ q: c.q, r: c.r }, { q: t.q, r: t.r })).toBeLessThanOrEqual(
        CLAIM_RADIUS
      );
    }
  });

  it('two cities of equal culture from different factions leave shared midpoint unclaimed', () => {
    buildSyntheticPlainsMap();
    G.factions = [makeFaction(0, false), makeFaction(1, true)];
    G.units = [];
    G.cities = [];
    G.turn = 1;
    G.nextUnitId = 1;
    G.nextCityId = 1;
    G.currentFactionIdx = 0 as FactionIdx;
    G.playerFactionIdx = 0 as FactionIdx;
    G.difficulty = 'medium';

    // Cities 6 apart along the q axis. createCity claims the city tile
    // and the 6 immediate neighbors for the faction; (3, 0) sits two
    // hexes outside both ownership rings → genuine neutral.
    const cA = createCity(0 as FactionIdx, 0, 0, 'A');
    const cB = createCity(1 as FactionIdx, 6, 0, 'B');
    cA.buildings.add('printing_press');
    cB.buildings.add('printing_press');

    computeCulturalClaim();

    const mid = G.map!.tiles.get(hexKey(3, 0));
    expect(mid).toBeDefined();
    expect(mid!.owner).toBeNull();
    // Equal pressure from both factions → no claim.
    expect(mid!.claim).toBeUndefined();

    // And tiles unambiguously closer to one city should be claimed by
    // it. Distance from (1, 0): 1 to A, 5 to B → A wins.
    const nearA = G.map!.tiles.get(hexKey(2, 0));
    expect(nearA).toBeDefined();
    if (nearA && nearA.owner == null) {
      expect(nearA.claim).toBe(0 as FactionIdx);
    }
  });

  it('cultural pressure dies off past CLAIM_RADIUS', () => {
    buildSmallScenario();
    const center = pickInteriorWalkable(G.map!);
    const c = createCity(0 as FactionIdx, center!.q, center!.r, 'Far City');
    c.buildings.add('printing_press');

    computeCulturalClaim();

    // Any tile farther than CLAIM_RADIUS hexes must be unclaimed.
    for (const t of G.map!.tiles.values()) {
      if (hexDistance({ q: c.q, r: c.r }, { q: t.q, r: t.r }) > CLAIM_RADIUS) {
        expect(t.claim).toBeUndefined();
      }
    }
  });

  it('soft-claim never mutates tile.owner', () => {
    buildSmallScenario();
    const center = pickInteriorWalkable(G.map!);
    const c = createCity(0 as FactionIdx, center!.q, center!.r, 'Soft City');
    c.buildings.add('opera_house'); // strong pressure
    // Snapshot every tile's owner before the compute.
    const ownerBefore = new Map<string, FactionIdx | null>();
    for (const t of G.map!.tiles.values()) {
      ownerBefore.set(hexKey(t.q, t.r), t.owner);
    }

    computeCulturalClaim();

    for (const t of G.map!.tiles.values()) {
      expect(t.owner).toBe(ownerBefore.get(hexKey(t.q, t.r)));
    }
  });

  it('owned tiles never receive a claim, even under high pressure', () => {
    buildSmallScenario();
    const center = pickInteriorWalkable(G.map!);
    const c = createCity(0 as FactionIdx, center!.q, center!.r, 'Solid City');
    c.buildings.add('opera_house');

    computeCulturalClaim();

    for (const t of G.map!.tiles.values()) {
      if (t.owner != null) {
        expect(t.claim).toBeUndefined();
      }
    }
  });

  it('claim disappears when the projecting city is removed', () => {
    buildSmallScenario();
    const center = pickInteriorWalkable(G.map!);
    const c = createCity(0 as FactionIdx, center!.q, center!.r, 'Doomed');
    c.buildings.add('opera_house');

    computeCulturalClaim();
    const claimedBefore = [...G.map!.tiles.values()].filter((t) => t.claim != null).length;
    expect(claimedBefore).toBeGreaterThan(0);

    // Remove the city. The claim recompute should clear all of its
    // pressure and leave previously-claimed neutral tiles unclaimed.
    G.cities = G.cities.filter((cc) => cc.id !== c.id);
    computeCulturalClaim();

    const claimedAfter = [...G.map!.tiles.values()].filter((t) => t.claim != null).length;
    expect(claimedAfter).toBe(0);
  });

  it('cultural hegemony counter increments when share crosses threshold', () => {
    buildSyntheticPlainsMap();
    G.factions = [makeFaction(0, false), makeFaction(1, true)];
    G.units = [];
    G.cities = [];
    G.turn = 1;
    G.nextUnitId = 1;
    G.nextCityId = 1;
    G.currentFactionIdx = 0 as FactionIdx;
    G.playerFactionIdx = 0 as FactionIdx;
    G.difficulty = 'medium';
    G.culturalHegemonyEnabled = true;
    // Threshold lowered for this test: 17×17 synthetic plains map = 289
    // walkable tiles. A single radius-3 claim caps near 37 tiles ≈ 13% —
    // we want the counter mechanic, not realistic balance, so 5% lets
    // the test land squarely above threshold without staging four cities.
    G.culturalHegemonyThreshold = 0.05;
    G.culturalHegemonyRequired = 5;
    G.culturalHegemonyCounter = {};

    // Faction 0 dominates: city with strong culture; faction 1 has none.
    const cA = createCity(0 as FactionIdx, 0, 0, 'A');
    cA.buildings.add('opera_house');
    createCity(1 as FactionIdx, 12, 0, 'B'); // far away, no culture buildings

    computeCulturalClaim();
    const share0 = getCulturalShare(0 as FactionIdx);
    expect(share0).toBeGreaterThanOrEqual(G.culturalHegemonyThreshold);

    const result = processCulturalHegemony(G.factions[0]);
    expect(result.victory).toBe(false);
    expect(G.culturalHegemonyCounter[0]).toBe(1);

    // Run again — counter ticks up.
    processCulturalHegemony(G.factions[0]);
    expect(G.culturalHegemonyCounter[0]).toBe(2);
  });

  it('cultural hegemony counter resets when share drops below threshold', () => {
    buildSyntheticPlainsMap();
    G.factions = [makeFaction(0, false), makeFaction(1, true)];
    G.units = [];
    G.cities = [];
    G.turn = 1;
    G.nextUnitId = 1;
    G.nextCityId = 1;
    G.currentFactionIdx = 0 as FactionIdx;
    G.playerFactionIdx = 0 as FactionIdx;
    G.difficulty = 'medium';
    G.culturalHegemonyEnabled = true;
    G.culturalHegemonyThreshold = 0.4;
    G.culturalHegemonyRequired = 5;
    G.culturalHegemonyCounter = { 0: 3 }; // mid-streak

    // No claims at all: share = 0, counter resets.
    const tally = tallyClaimedTiles();
    expect(tally.total).toBe(0);

    const result = processCulturalHegemony(G.factions[0]);
    expect(result.victory).toBe(false);
    expect(G.culturalHegemonyCounter[0]).toBe(0);
  });

  it('cultural hegemony reports victory when counter hits required threshold', () => {
    buildSyntheticPlainsMap();
    G.factions = [makeFaction(0, false), makeFaction(1, true)];
    G.units = [];
    G.cities = [];
    G.turn = 1;
    G.nextUnitId = 1;
    G.nextCityId = 1;
    G.currentFactionIdx = 0 as FactionIdx;
    G.playerFactionIdx = 0 as FactionIdx;
    G.difficulty = 'medium';
    G.culturalHegemonyEnabled = true;
    // Lowered threshold matches the counter-increment test rationale —
    // we're pinning the victory dispatch, not staging a realistic claim.
    G.culturalHegemonyThreshold = 0.05;
    G.culturalHegemonyRequired = 3;
    G.culturalHegemonyCounter = { 0: 2 }; // one shy of required

    const cA = createCity(0 as FactionIdx, 0, 0, 'A');
    cA.buildings.add('opera_house');
    createCity(1 as FactionIdx, 12, 0, 'B');

    computeCulturalClaim();
    const result = processCulturalHegemony(G.factions[0]);
    expect(result.victory).toBe(true);
    expect(G.culturalHegemonyCounter[0]).toBe(3);

    // Disabled flag short-circuits the check entirely (counter resets).
    G.culturalHegemonyEnabled = false;
    G.culturalHegemonyCounter[0] = 2;
    const r2 = processCulturalHegemony(G.factions[0]);
    expect(r2.victory).toBe(false);
    expect(G.culturalHegemonyCounter[0]).toBe(0);
  });

  it('regression: a single capital with culture (Verdant turn-1) does not trivially exceed 40% share', () => {
    // Pre-fix bug: getCulturalShare divided perFaction by *claimed* tiles,
    // so a faction that was the only one generating culture trivially hit
    // 100% share and won the cultural-hegemony victory in 5 turns. Post-
    // fix the denominator is walkable tiles, so a single radius-3 claim
    // around a turn-1 Verdant capital sits well under the 40% threshold.
    buildSyntheticPlainsMap();
    G.factions = [makeFaction(0, false), makeFaction(1, true)];
    G.units = [];
    G.cities = [];
    G.turn = 1;
    G.nextUnitId = 1;
    G.nextCityId = 1;
    G.currentFactionIdx = 0 as FactionIdx;
    G.playerFactionIdx = 0 as FactionIdx;
    G.difficulty = 'medium';
    G.culturalHegemonyEnabled = true;
    G.culturalHegemonyThreshold = 0.4;
    G.culturalHegemonyRequired = 5;
    G.culturalHegemonyCounter = {};

    // Mimics turn-1 Verdant: capital with the +1-culture trait, AI rival
    // with no culture buildings yet. (We approximate the trait via a
    // printing_press for +2; the precise number doesn't matter — what
    // matters is that it's the only culture source on the map.)
    const cap = createCity(0 as FactionIdx, 0, 0, 'Verdant Cap');
    cap.buildings.add('printing_press');
    createCity(1 as FactionIdx, 12, 0, 'Rival Cap');

    computeCulturalClaim();
    const share = getCulturalShare(0 as FactionIdx);
    expect(share).toBeLessThan(G.culturalHegemonyThreshold);

    const result = processCulturalHegemony(G.factions[0]);
    expect(result.victory).toBe(false);
    expect(G.culturalHegemonyCounter[0]).toBe(0);
  });

  it('high-culture personalities pick culture-branch tech more often than low-culture ones', () => {
    // Defensive (culture 0.65) vs militaristic (culture 0.20). The +40
    // p.mil unlocks bonus and various branch +tech bonuses dominate
    // unless we deplete the rest of the tree, so the comparison runs
    // with every non-culture tech (excluding banking, kept as a
    // single competitor) pre-researched. Available to both: lithography,
    // banking. Defensive's culture×30 lifts lithography clear of
    // banking; militaristic's barely does.
    const allNonCulture = (Object.keys(TECHS) as (keyof typeof TECHS)[]).filter(
      (id) => TECHS[id].branch !== 'culture' && id !== 'banking'
    );
    const trials = 50;
    let defCulture = 0;
    let milCulture = 0;
    for (let seed = 1; seed <= trials; seed++) {
      const def: Faction = { ...makeFaction(3, true) }; // verdant -> defensive
      def.techs = new Set(allNonCulture);
      const mil: Faction = { ...makeFaction(2, true) }; // iron -> militaristic
      mil.techs = new Set(allNonCulture);
      const dPick = aiPickTech(def, createSeededRng(seed));
      const mPick = aiPickTech(mil, createSeededRng(seed));
      if (dPick && TECHS[dPick].branch === 'culture') defCulture++;
      if (mPick && TECHS[mPick].branch === 'culture') milCulture++;
    }
    expect(defCulture).toBeGreaterThan(milCulture);
    expect(defCulture).toBeGreaterThan(0);
  });

  it('aiPickBuild biases toward opera_house more in peace than at war for high-culture factions', () => {
    // Synthetic 2-faction scenario. Faction 0 is defensive (high
    // culture, p.culture = 0.65) with salons researched so opera_house
    // sits in the candidate set. The setup intentionally tilts away
    // from the AI's usual military/expansion bias: phase = 'fortify'
    // (no pioneer option), 2 COGMAN garrison (so the bestMil branch
    // skips the !garrison +50 and the under-quota +30), late game
    // (turn 30, no scout). At peace, opera_house should out-score
    // COGMAN; at war, the -40 penalty reverses that.
    buildSyntheticPlainsMap();
    G.factions = [makeFaction(3, true), makeFaction(2, true)]; // verdant + iron
    G.units = [];
    G.cities = [];
    G.events = [];
    G.aiMemory = {};
    G.gameOver = false;
    G.turn = 30;
    G.nextUnitId = 1;
    G.nextCityId = 1;
    G.currentFactionIdx = 0 as FactionIdx;
    G.playerFactionIdx = 0 as FactionIdx;
    G.difficulty = 'medium';
    initAIMemory(0 as FactionIdx);
    initAIMemory(1 as FactionIdx);
    G.aiMemory[0]!.strategicPhase = 'fortify';

    G.factions[0].techs.add('rediscovery');
    G.factions[0].techs.add('lithography');
    G.factions[0].techs.add('salons');
    const cap = createCity(0 as FactionIdx, 0, 0, 'Salon Capital');
    cap.isCapital = true;
    cap.population = 4;
    // Pre-build the always-available cheap-and-flat-score buildings so
    // the only viable building options are culture (workshop and walls
    // would otherwise dominate at 74 / 81 score).
    cap.buildings.add('workshop');
    cap.buildings.add('walls');
    cap.buildings.add('granary');
    cap.buildings.add('library');

    // Garrison: 2 COGMAN at the city. Skips the !garrison +50 and the
    // myMilUnits<myCityCount*2 +30 in bestMil scoring.
    const cog1 = {
      id: G.nextUnitId++,
      typeId: 'COGMAN' as const,
      factionIdx: 0 as FactionIdx,
      q: cap.q,
      r: cap.r,
      hp: 20,
      maxHp: 20,
      mp: 2,
      maxMp: 2,
      fortified: false,
    };
    const cog2 = { ...cog1, id: G.nextUnitId++ };
    G.units = [cog1, cog2];

    const trials = 60;
    let peacePicks = 0;
    let warPicks = 0;
    for (let seed = 1; seed <= trials; seed++) {
      G.factions[0].diplo[1] = 'peace';
      G.factions[1].diplo[0] = 'peace';
      const peace = aiPickBuild(G.factions[0], cap, createSeededRng(seed));
      if (peace?.kind === 'building' && peace.id === 'opera_house') peacePicks++;
      G.factions[0].diplo[1] = 'war';
      G.factions[1].diplo[0] = 'war';
      const war = aiPickBuild(G.factions[0], cap, createSeededRng(seed));
      if (war?.kind === 'building' && war.id === 'opera_house') warPicks++;
    }
    expect(peacePicks).toBeGreaterThan(warPicks);
    expect(peacePicks).toBeGreaterThan(0);
  });

  it('opera_house is gated behind salons; printing_press behind lithography', () => {
    buildSyntheticPlainsMap();
    G.factions = [makeFaction(3, true)];
    G.units = [];
    G.cities = [];
    G.events = [];
    G.aiMemory = {};
    G.gameOver = false;
    G.turn = 30;
    G.nextUnitId = 1;
    G.nextCityId = 1;
    G.currentFactionIdx = 0 as FactionIdx;
    G.playerFactionIdx = 0 as FactionIdx;
    G.difficulty = 'medium';
    initAIMemory(0 as FactionIdx);
    G.aiMemory[0]!.strategicPhase = 'fortify';

    const cap = createCity(0 as FactionIdx, 0, 0, 'Capital');
    cap.isCapital = true;
    cap.population = 4;
    // Pre-build dominators so culture buildings can surface as picks.
    cap.buildings.add('workshop');
    cap.buildings.add('walls');
    cap.buildings.add('granary');
    cap.buildings.add('library');

    // No culture techs: neither building should reach the candidate set.
    let reached = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) {
      const pick = aiPickBuild(G.factions[0], cap, createSeededRng(seed));
      if (pick?.kind === 'building') reached.add(pick.id);
    }
    expect(reached.has('printing_press')).toBe(false);
    expect(reached.has('opera_house')).toBe(false);

    // Lithography only: printing_press is gated open, opera_house still gated.
    G.factions[0].techs.add('rediscovery');
    G.factions[0].techs.add('lithography');
    reached = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) {
      const pick = aiPickBuild(G.factions[0], cap, createSeededRng(seed));
      if (pick?.kind === 'building') reached.add(pick.id);
    }
    expect(reached.has('opera_house')).toBe(false);

    // Salons unlocks opera_house — at least one trial should reach it
    // given the defensive faction's culture bias.
    G.factions[0].techs.add('salons');
    // Add a garrison so the bestMil score calms enough to let
    // opera_house surface.
    G.units = [
      {
        id: G.nextUnitId++,
        typeId: 'COGMAN',
        factionIdx: 0 as FactionIdx,
        q: cap.q,
        r: cap.r,
        hp: 20,
        maxHp: 20,
        mp: 2,
        maxMp: 2,
        fortified: false,
      },
      {
        id: G.nextUnitId++,
        typeId: 'COGMAN',
        factionIdx: 0 as FactionIdx,
        q: cap.q,
        r: cap.r,
        hp: 20,
        maxHp: 20,
        mp: 2,
        maxMp: 2,
        fortified: false,
      },
    ];
    reached = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) {
      const pick = aiPickBuild(G.factions[0], cap, createSeededRng(seed));
      if (pick?.kind === 'building') reached.add(pick.id);
    }
    expect(reached.has('opera_house')).toBe(true);
  });

  it('migrates a v2 save (no cultural fields) to v3 defaults', () => {
    buildSmallScenario();
    const data = serializeGameState();
    // Strip the v3 cultural fields and downgrade the version stamp to
    // simulate a save written before 2g-1 landed.
    data.version = 2;
    delete (data.state as { culturalHegemonyThreshold?: number })
      .culturalHegemonyThreshold;
    delete (data.state as { culturalHegemonyRequired?: number })
      .culturalHegemonyRequired;
    delete (data.state as { culturalHegemonyCounter?: unknown })
      .culturalHegemonyCounter;
    delete (data.state as { culturalHegemonyEnabled?: boolean })
      .culturalHegemonyEnabled;

    const round = JSON.parse(JSON.stringify(data)) as SaveData;
    clearGameState();
    loadGameState(round);

    // Defaults should land cleanly.
    expect(G.culturalHegemonyThreshold).toBe(0.4);
    expect(G.culturalHegemonyRequired).toBe(5);
    expect(G.culturalHegemonyEnabled).toBe(true);
    expect(G.culturalHegemonyCounter).toEqual({});
  });
});

describe('Phase 2L: computeCulturalPressureMap', () => {
  it('returns per-faction pressure sums that fall off with distance', async () => {
    const { computeCulturalPressureMap } = await import('../src/systems/culture');
    buildSyntheticPlainsMap();
    G.factions = [makeFaction(0, false)];
    G.units = [];
    G.cities = [];
    G.turn = 1;
    G.nextUnitId = 1;
    G.nextCityId = 1;
    G.currentFactionIdx = 0 as FactionIdx;
    G.playerFactionIdx = 0 as FactionIdx;
    G.difficulty = 'medium';

    const c = createCity(0 as FactionIdx, 0, 0, 'Press');
    c.buildings.add('printing_press'); // +2 culture

    const pressure = computeCulturalPressureMap();
    // Tile 2 hexes away should have non-zero pressure.
    const arr = pressure.get(hexKey(2, 0));
    expect(arr).toBeDefined();
    expect(arr![0]).toBeGreaterThan(0);
    // Distance-3 tile has lower pressure than distance-2 tile.
    const arrFar = pressure.get(hexKey(3, 0));
    if (arrFar) expect(arrFar[0]).toBeLessThan(arr![0]);
  });

  it('records both factions on a contested tile', async () => {
    const { computeCulturalPressureMap } = await import('../src/systems/culture');
    buildSyntheticPlainsMap();
    G.factions = [makeFaction(0, false), makeFaction(1, true)];
    G.units = [];
    G.cities = [];
    G.turn = 1;
    G.nextUnitId = 1;
    G.nextCityId = 1;
    G.currentFactionIdx = 0 as FactionIdx;
    G.playerFactionIdx = 0 as FactionIdx;
    G.difficulty = 'medium';

    const cA = createCity(0 as FactionIdx, 0, 0, 'A');
    const cB = createCity(1 as FactionIdx, 6, 0, 'B');
    cA.buildings.add('printing_press');
    cB.buildings.add('printing_press');

    const pressure = computeCulturalPressureMap();
    const mid = pressure.get(hexKey(3, 0));
    expect(mid).toBeDefined();
    expect(mid![0]).toBeGreaterThan(0);
    expect(mid![1]).toBeGreaterThan(0);
    expect(mid![0]).toBe(mid![1]); // symmetric
  });
});
