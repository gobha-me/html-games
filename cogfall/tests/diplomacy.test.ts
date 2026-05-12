import { describe, expect, it } from 'vitest';
import {
  ALLIANCE_ACCEPT_THRESHOLD,
  ALLIANCE_FORMATION_GRUDGE,
  ALLIANCE_FUZZ_BAND,
  alliancesBetween,
  alliancesInvolving,
  applyAlliance,
  applyTrade,
  applyTradeAgreement,
  applyTribute,
  breakAlliancesOnPeace,
  breakTradeAgreementsOnWar,
  cancelTreaty,
  dissolveTreatiesOnDeath,
  evaluateAlliance,
  evaluateTrade,
  evaluateTradeAgreement,
  evaluateTribute,
  suggestedAetherPrice,
  suggestedAgreementGold,
  suggestedTechPrice,
  suggestedTribute,
  tickTreaties,
  TRADE_ACCEPT_THRESHOLD,
  TRADE_AETHER_BASE_VALUE,
  TRADE_AGREEMENT_ACCEPT_THRESHOLD,
  TRADE_AGREEMENT_FUZZ_BAND,
  TRADE_AGREEMENT_MAX_DURATION,
  TRADE_FUZZ_BAND,
  TRADE_TECH_BASE_VALUE,
  TRIBUTE_FUZZ_BAND,
  TRIBUTE_MIN_STRENGTH_RATIO,
  TRIBUTE_PAY_THRESHOLD,
  type AllianceOffer,
  type TradeAgreementOffer,
  type TradeOffer,
  type TributeDemand,
} from '../src/systems/diplomacy';
import { asFactionIdx } from '../src/core/types';
import type {
  AIMemory,
  Faction,
  FactionIdx,
  PersonalityId,
  Treaty,
} from '../src/core/types';

function makeFaction(
  idx: number,
  personality: PersonalityId,
  overrides: Partial<Faction> = {}
): Faction {
  return {
    idx: asFactionIdx(idx),
    id: 'cogwright',
    name: `F${idx}`,
    color: '#fff',
    glyph: 'X',
    personality,
    desc: '',
    isAI: true,
    alive: true,
    resources: { gold: 1000, aether: 100 },
    science: 0,
    researchProgress: 0,
    techs: new Set(),
    currentResearch: null,
    score: 0,
    diplo: { [1 - idx]: 'peace' },
    ...overrides,
  };
}

function memory(grudges: Record<number, number> = {}): AIMemory {
  return {
    grudges,
    strategicPhase: 'expand',
    targetEnemy: null,
    targetCityId: null,
    lastDeclareWarTurn: -999,
  };
}

const constRng = (v: number) => () => v;

describe('evaluateTrade — gold for tech', () => {
  it('refuses if buyer cannot afford', () => {
    const buyer = makeFaction(0, 'industrial', { resources: { gold: 10, aether: 0 } });
    const seller = makeFaction(1, 'industrial', { techs: new Set(['metallurgy']) });
    const offer: TradeOffer = {
      kind: 'gold_for_tech',
      proposer: buyer.idx,
      target: seller.idx,
      goldOffered: 200,
      techId: 'metallurgy',
    };
    const r = evaluateTrade(offer, buyer, seller, 10, 10, memory(), constRng(0.5));
    expect(r.accept).toBe(false);
    expect(r.refusal).toBe('unaffordable');
  });

  it('refuses if seller does not own the tech', () => {
    const buyer = makeFaction(0, 'industrial');
    const seller = makeFaction(1, 'industrial');
    const offer: TradeOffer = {
      kind: 'gold_for_tech',
      proposer: buyer.idx,
      target: seller.idx,
      goldOffered: 200,
      techId: 'metallurgy',
    };
    const r = evaluateTrade(offer, buyer, seller, 10, 10, memory(), constRng(0.5));
    expect(r.refusal).toBe('unavailable');
  });

  it('refuses if buyer already owns the tech', () => {
    const buyer = makeFaction(0, 'industrial', { techs: new Set(['metallurgy']) });
    const seller = makeFaction(1, 'industrial', { techs: new Set(['metallurgy']) });
    const offer: TradeOffer = {
      kind: 'gold_for_tech',
      proposer: buyer.idx,
      target: seller.idx,
      goldOffered: 200,
      techId: 'metallurgy',
    };
    const r = evaluateTrade(offer, buyer, seller, 10, 10, memory(), constRng(0.5));
    expect(r.refusal).toBe('unavailable');
  });

  it('refuses with hostile when at war', () => {
    const buyer = makeFaction(0, 'industrial');
    const seller = makeFaction(1, 'industrial', {
      techs: new Set(['metallurgy']),
      diplo: { 0: 'war' },
    });
    const offer: TradeOffer = {
      kind: 'gold_for_tech',
      proposer: buyer.idx,
      target: seller.idx,
      goldOffered: 1000,
      techId: 'metallurgy',
    };
    const r = evaluateTrade(offer, buyer, seller, 10, 10, memory(), constRng(0.5));
    expect(r.refusal).toBe('hostile');
  });

  it('refuses with hostile when unmet', () => {
    const buyer = makeFaction(0, 'industrial');
    const seller = makeFaction(1, 'industrial', {
      techs: new Set(['metallurgy']),
      diplo: {},
    });
    const offer: TradeOffer = {
      kind: 'gold_for_tech',
      proposer: buyer.idx,
      target: seller.idx,
      goldOffered: 1000,
      techId: 'metallurgy',
    };
    const r = evaluateTrade(offer, buyer, seller, 10, 10, memory(), constRng(0.5));
    expect(r.refusal).toBe('hostile');
  });

  it('accepts a generous offer (>> base value)', () => {
    const buyer = makeFaction(0, 'industrial');
    const seller = makeFaction(1, 'economic', { techs: new Set(['metallurgy']) });
    // Metallurgy cost = 50; base value = 50 * 3 = 150. Offer 600 = ratio 4 → score huge.
    const offer: TradeOffer = {
      kind: 'gold_for_tech',
      proposer: buyer.idx,
      target: seller.idx,
      goldOffered: 600,
      techId: 'metallurgy',
    };
    const r = evaluateTrade(offer, buyer, seller, 10, 10, memory(), constRng(0.99));
    expect(r.accept).toBe(true);
    expect(r.score).toBeGreaterThan(TRADE_ACCEPT_THRESHOLD + TRADE_FUZZ_BAND);
  });

  it('refuses a stingy offer (< base value)', () => {
    const buyer = makeFaction(0, 'industrial');
    const seller = makeFaction(1, 'militaristic', { techs: new Set(['metallurgy']) });
    // 50 gold << base 150. Militaristic agg high → further negative.
    const offer: TradeOffer = {
      kind: 'gold_for_tech',
      proposer: buyer.idx,
      target: seller.idx,
      goldOffered: 50,
      techId: 'metallurgy',
    };
    const r = evaluateTrade(offer, buyer, seller, 10, 10, memory(), constRng(0.01));
    expect(r.accept).toBe(false);
    expect(r.refusal).toBe('too_low');
  });

  it('economic sellers accept lower ratios than militaristic ones at the same offer', () => {
    const buyer = makeFaction(0, 'industrial');
    // grand_apparatus cost 360 → base value 1080. Offer 1000 (ratio ~0.93).
    const econ = makeFaction(1, 'economic', { techs: new Set(['grand_apparatus']) });
    const mil = makeFaction(1, 'militaristic', { techs: new Set(['grand_apparatus']) });
    const offer = {
      kind: 'gold_for_tech' as const,
      proposer: buyer.idx,
      target: econ.idx,
      goldOffered: 1000,
      techId: 'grand_apparatus' as const,
    };
    const econR = evaluateTrade(offer, buyer, econ, 10, 10, memory(), constRng(0.5));
    const milR = evaluateTrade(offer, buyer, mil, 10, 10, memory(), constRng(0.5));
    expect(econR.score).toBeGreaterThan(milR.score);
  });

  it('high grudge penalises score', () => {
    const buyer = makeFaction(0, 'industrial');
    const seller = makeFaction(1, 'economic', { techs: new Set(['metallurgy']) });
    const offer: TradeOffer = {
      kind: 'gold_for_tech',
      proposer: buyer.idx,
      target: seller.idx,
      goldOffered: 300,
      techId: 'metallurgy',
    };
    const noGrudge = evaluateTrade(offer, buyer, seller, 10, 10, memory(), constRng(0.5));
    const heavyGrudge = evaluateTrade(
      offer,
      buyer,
      seller,
      10,
      10,
      memory({ 0: 200 }),
      constRng(0.5)
    );
    expect(heavyGrudge.score).toBeLessThan(noGrudge.score);
  });

  it('rng draw inside the fuzz band can flip the outcome', () => {
    const buyer = makeFaction(0, 'industrial');
    const seller = makeFaction(1, 'industrial', { techs: new Set(['metallurgy']) });
    // Tune into the fuzz band [40, 60]:
    //   metallurgy cost 50 → baseValue 150
    //   200 gold → ratio 1.333 → priceScore 33.3 + econ(0.7)*30 - agg(0.3)*25
    //     = 33.3 + 21 - 7.5 = 46.8
    //   equal strengths → no strengthScore bias; no grudge
    //   score ≈ 46.8 (squarely in fuzz band)
    const offer: TradeOffer = {
      kind: 'gold_for_tech',
      proposer: buyer.idx,
      target: seller.idx,
      goldOffered: 200,
      techId: 'metallurgy',
    };
    const lowRoll = evaluateTrade(offer, buyer, seller, 10, 10, memory(), constRng(0.01));
    const highRoll = evaluateTrade(offer, buyer, seller, 10, 10, memory(), constRng(0.99));
    // Same inputs differ only by rng — flipping the rng must change at least
    // one decision in the fuzz band.
    expect(lowRoll.score).toBe(highRoll.score);
    expect(lowRoll.accept).not.toBe(highRoll.accept);
  });
});

describe('evaluateTrade — gold for aether', () => {
  it('refuses if seller lacks the aether', () => {
    const buyer = makeFaction(0, 'industrial');
    const seller = makeFaction(1, 'industrial', { resources: { gold: 100, aether: 5 } });
    const offer: TradeOffer = {
      kind: 'gold_for_resource',
      proposer: buyer.idx,
      target: seller.idx,
      goldOffered: 200,
      resource: 'aether',
      resourceAmount: 20,
    };
    const r = evaluateTrade(offer, buyer, seller, 10, 10, memory(), constRng(0.5));
    expect(r.refusal).toBe('unavailable');
  });

  it('accepts a healthy aether trade', () => {
    const buyer = makeFaction(0, 'industrial');
    const seller = makeFaction(1, 'economic', { resources: { gold: 100, aether: 50 } });
    // 20 aether → base 100 gold. Offer 200 → ratio 2 → score well above threshold.
    const offer: TradeOffer = {
      kind: 'gold_for_resource',
      proposer: buyer.idx,
      target: seller.idx,
      goldOffered: 200,
      resource: 'aether',
      resourceAmount: 20,
    };
    const r = evaluateTrade(offer, buyer, seller, 10, 10, memory(), constRng(0.5));
    expect(r.accept).toBe(true);
  });

  it('refuses invalid shapes', () => {
    const buyer = makeFaction(0, 'industrial');
    const seller = makeFaction(1, 'industrial', { resources: { gold: 100, aether: 50 } });
    const offer: TradeOffer = {
      kind: 'gold_for_resource',
      proposer: buyer.idx,
      target: seller.idx,
      goldOffered: 200,
      // missing resource / resourceAmount
    };
    const r = evaluateTrade(offer, buyer, seller, 10, 10, memory(), constRng(0.5));
    expect(r.refusal).toBe('invalid');
  });
});

describe('applyTrade', () => {
  it('moves gold and the tech', () => {
    const buyer = makeFaction(0, 'industrial', { resources: { gold: 500, aether: 0 } });
    const seller = makeFaction(1, 'industrial', {
      techs: new Set(['metallurgy']),
      resources: { gold: 100, aether: 0 },
    });
    const offer: TradeOffer = {
      kind: 'gold_for_tech',
      proposer: buyer.idx,
      target: seller.idx,
      goldOffered: 200,
      techId: 'metallurgy',
    };
    applyTrade(offer, buyer, seller);
    expect(buyer.resources.gold).toBe(300);
    expect(seller.resources.gold).toBe(300);
    expect(buyer.techs.has('metallurgy')).toBe(true);
    expect(seller.techs.has('metallurgy')).toBe(true); // seller still has it
  });

  it('moves gold and the aether stack', () => {
    const buyer = makeFaction(0, 'industrial', { resources: { gold: 500, aether: 0 } });
    const seller = makeFaction(1, 'industrial', { resources: { gold: 100, aether: 30 } });
    const offer: TradeOffer = {
      kind: 'gold_for_resource',
      proposer: buyer.idx,
      target: seller.idx,
      goldOffered: 100,
      resource: 'aether',
      resourceAmount: 20,
    };
    applyTrade(offer, buyer, seller);
    expect(buyer.resources.gold).toBe(400);
    expect(seller.resources.gold).toBe(200);
    expect(buyer.resources.aether).toBe(20);
    expect(seller.resources.aether).toBe(10);
  });
});

describe('evaluateTribute', () => {
  it('refuses if demander is not credibly stronger', () => {
    const dem = makeFaction(0, 'militaristic');
    const tgt = makeFaction(1, 'defensive');
    const demand: TributeDemand = {
      demander: dem.idx,
      target: tgt.idx,
      goldDemanded: 100,
    };
    const r = evaluateTribute(demand, dem, tgt, 10, 10, memory(), constRng(0.5));
    expect(r.refusal).toBe('insufficient_threat');
    expect(r.accept).toBe(false);
  });

  it('refuses if target cannot pay', () => {
    const dem = makeFaction(0, 'militaristic');
    const tgt = makeFaction(1, 'defensive', { resources: { gold: 10, aether: 0 } });
    const demand: TributeDemand = {
      demander: dem.idx,
      target: tgt.idx,
      goldDemanded: 200,
    };
    const r = evaluateTribute(demand, dem, tgt, 100, 30, memory(), constRng(0.5));
    expect(r.refusal).toBe('cannot_pay');
  });

  it('pays when threat is large and the ask is small', () => {
    const dem = makeFaction(0, 'militaristic');
    const tgt = makeFaction(1, 'economic', { resources: { gold: 5000, aether: 0 } });
    const demand: TributeDemand = {
      demander: dem.idx,
      target: tgt.idx,
      goldDemanded: 100,
    };
    const r = evaluateTribute(demand, dem, tgt, 200, 30, memory(), constRng(0.5));
    expect(r.accept).toBe(true);
    expect(r.refusal).toBeNull();
  });

  it('defies when the ask is most of the treasury even under heavy threat', () => {
    const dem = makeFaction(0, 'militaristic');
    const tgt = makeFaction(1, 'defensive', { resources: { gold: 200, aether: 0 } });
    const demand: TributeDemand = {
      demander: dem.idx,
      target: tgt.idx,
      goldDemanded: 180,
    };
    const r = evaluateTribute(demand, dem, tgt, 300, 30, memory(), constRng(0.5));
    expect(r.accept).toBe(false);
    expect(r.refusal).toBe('defiant');
  });
});

describe('applyTribute', () => {
  it('transfers gold from target to demander', () => {
    const dem = makeFaction(0, 'militaristic', { resources: { gold: 0, aether: 0 } });
    const tgt = makeFaction(1, 'economic', { resources: { gold: 500, aether: 0 } });
    applyTribute(
      { demander: dem.idx, target: tgt.idx, goldDemanded: 150 },
      dem,
      tgt
    );
    expect(dem.resources.gold).toBe(150);
    expect(tgt.resources.gold).toBe(350);
  });
});

describe('suggestion helpers', () => {
  it('suggestedTechPrice scales with research cost', () => {
    expect(suggestedTechPrice('metallurgy')).toBeGreaterThan(
      suggestedTechPrice('rediscovery')
    );
    // Reservation price = cost * 3 * 1.25 = cost * 3.75
    expect(suggestedTechPrice('metallurgy')).toBe(Math.round(50 * TRADE_TECH_BASE_VALUE * 1.25));
  });

  it('suggestedAetherPrice is linear in amount', () => {
    // Use amounts that round cleanly (8 → 50; 16 → 100) to sidestep
    // the .5-rounding asymmetry between Math.round(62.5)=63 and
    // Math.round(125)=125.
    expect(suggestedAetherPrice(8)).toBe(Math.round(8 * TRADE_AETHER_BASE_VALUE * 1.25));
    expect(suggestedAetherPrice(16)).toBe(suggestedAetherPrice(8) * 2);
  });

  it('suggestedTribute floors at 50 gold', () => {
    const tgt = makeFaction(1, 'economic', { resources: { gold: 100, aether: 0 } });
    expect(suggestedTribute(tgt)).toBe(50);
  });

  it('suggestedTribute scales with treasury', () => {
    const tgt = makeFaction(1, 'economic', { resources: { gold: 5000, aether: 0 } });
    expect(suggestedTribute(tgt)).toBe(500);
  });
});

// --- S9b: persistent treaties -------------------------------------------

function makeTreatyState(
  treaties: Treaty[] = [],
  factions: Faction[] = [],
  aiMemory: Record<number, AIMemory> = {}
) {
  return {
    treaties,
    nextTreatyId: 1,
    factions,
    aiMemory: aiMemory as Partial<Record<number, AIMemory>>,
  };
}

describe('evaluateAlliance', () => {
  it('refuses self-alliance / enemy is a party as invalid', () => {
    const a = makeFaction(0, 'industrial');
    const b = makeFaction(1, 'industrial', { diplo: { 0: 'peace', 2: 'war' } });
    // proposer === target
    const r1 = evaluateAlliance(
      { proposer: a.idx, target: a.idx, enemy: asFactionIdx(2) },
      a,
      a,
      100,
      100,
      memory(),
      [],
      constRng(0.5)
    );
    expect(r1.refusal).toBe('invalid');
    // enemy is target
    const r2 = evaluateAlliance(
      { proposer: a.idx, target: b.idx, enemy: b.idx },
      a,
      b,
      100,
      100,
      memory(),
      [],
      constRng(0.5)
    );
    expect(r2.refusal).toBe('invalid');
  });

  it('refuses with hostile when proposer is not at peace with target', () => {
    const a = makeFaction(0, 'industrial', { diplo: { 1: 'war', 2: 'war' } });
    const b = makeFaction(1, 'industrial', { diplo: { 0: 'war', 2: 'war' } });
    const r = evaluateAlliance(
      { proposer: a.idx, target: b.idx, enemy: asFactionIdx(2) },
      a,
      b,
      100,
      100,
      memory({ 2: 200 }),
      [],
      constRng(0.5)
    );
    expect(r.refusal).toBe('hostile');
  });

  it('refuses with unenemy when proposer is not at war with named enemy', () => {
    const a = makeFaction(0, 'industrial', { diplo: { 1: 'peace', 2: 'peace' } });
    const b = makeFaction(1, 'industrial', { diplo: { 0: 'peace', 2: 'war' } });
    const r = evaluateAlliance(
      { proposer: a.idx, target: b.idx, enemy: asFactionIdx(2) },
      a,
      b,
      100,
      100,
      memory({ 2: 200 }),
      [],
      constRng(0.5)
    );
    expect(r.refusal).toBe('unenemy');
  });

  it('refuses with redundant when same alliance already exists', () => {
    const a = makeFaction(0, 'industrial', { diplo: { 1: 'peace', 2: 'war' } });
    const b = makeFaction(1, 'industrial', { diplo: { 0: 'peace', 2: 'war' } });
    const existing: Treaty = {
      kind: 'alliance',
      id: 1,
      partyA: a.idx,
      partyB: b.idx,
      enemy: asFactionIdx(2),
      startTurn: 5,
    };
    const r = evaluateAlliance(
      { proposer: a.idx, target: b.idx, enemy: asFactionIdx(2) },
      a,
      b,
      100,
      100,
      memory({ 2: 200 }),
      [existing],
      constRng(0.5)
    );
    expect(r.refusal).toBe('redundant');
  });

  it('refuses with disinterested when target has no grudge and is at peace with enemy', () => {
    const a = makeFaction(0, 'industrial', { diplo: { 1: 'peace', 2: 'war' } });
    const b = makeFaction(1, 'economic', { diplo: { 0: 'peace', 2: 'peace' } });
    const r = evaluateAlliance(
      { proposer: a.idx, target: b.idx, enemy: asFactionIdx(2) },
      a,
      b,
      100,
      100,
      memory(),
      [],
      constRng(0.5)
    );
    expect(r.accept).toBe(false);
    expect(r.refusal).toBe('disinterested');
  });

  it('accepts when target shares grudge and is already at war with the enemy', () => {
    const a = makeFaction(0, 'industrial', { diplo: { 1: 'peace', 2: 'war' } });
    const b = makeFaction(1, 'militaristic', { diplo: { 0: 'peace', 2: 'war' } });
    const r = evaluateAlliance(
      { proposer: a.idx, target: b.idx, enemy: asFactionIdx(2) },
      a,
      b,
      100,
      150,
      memory({ 2: 200 }),
      [],
      constRng(0.5)
    );
    expect(r.accept).toBe(true);
    expect(r.score).toBeGreaterThan(ALLIANCE_ACCEPT_THRESHOLD + ALLIANCE_FUZZ_BAND);
  });

  it('rng draw inside fuzz band flips the outcome', () => {
    // Tune the inputs into the fuzz band [35, 65] (threshold 50 ± 15).
    // Scientific personality: agg 0.2, econ 0.4; grudge 100; at peace
    // with enemy → stanceScore -20; modest strength relief.
    //   grudge 100 * 0.6 = 60
    //   behScore = 0.2 * 35 - 0.4 * 20 = 7 - 8 = -1
    //   stance peace → -20
    //   strengthRelief: 120/100 = 1.2 → (1.2-0.8)*40 = 16
    //   total ≈ 55 (inside fuzz band)
    const a = makeFaction(0, 'industrial', { diplo: { 1: 'peace', 2: 'war' } });
    const b = makeFaction(1, 'scientific', { diplo: { 0: 'peace', 2: 'peace' } });
    const offer = {
      proposer: a.idx,
      target: b.idx,
      enemy: asFactionIdx(2),
    };
    const lowRoll = evaluateAlliance(offer, a, b, 100, 120, memory({ 2: 100 }), [], constRng(0.01));
    const highRoll = evaluateAlliance(offer, a, b, 100, 120, memory({ 2: 100 }), [], constRng(0.99));
    expect(lowRoll.score).toBe(highRoll.score);
    expect(lowRoll.accept).not.toBe(highRoll.accept);
  });
});

describe('applyAlliance', () => {
  it('flips both parties to war with the named enemy and pushes the treaty', () => {
    const a = makeFaction(0, 'industrial', { diplo: { 1: 'peace', 2: 'peace' } });
    const b = makeFaction(1, 'industrial', { diplo: { 0: 'peace', 2: 'peace' } });
    const e = makeFaction(2, 'industrial', { diplo: { 0: 'peace', 1: 'peace' } });
    const state = makeTreatyState([], [a, b, e], { 2: memory() });
    const offer: AllianceOffer = { proposer: a.idx, target: b.idx, enemy: e.idx };
    const t = applyAlliance(offer, a, b, e, state, 7);

    expect(a.diplo[e.idx]).toBe('war');
    expect(b.diplo[e.idx]).toBe('war');
    expect(e.diplo[a.idx]).toBe('war');
    expect(e.diplo[b.idx]).toBe('war');
    expect(state.treaties).toHaveLength(1);
    expect(state.treaties[0]).toBe(t);
    expect(t.kind).toBe('alliance');
    if (t.kind === 'alliance') {
      expect(t.partyA).toBe(a.idx);
      expect(t.partyB).toBe(b.idx);
      expect(t.enemy).toBe(e.idx);
      expect(t.startTurn).toBe(7);
      expect(t.id).toBe(1);
    }
    expect(state.nextTreatyId).toBe(2);
  });

  it("bumps the enemy's grudge ledger against each ally", () => {
    const a = makeFaction(0, 'industrial', { diplo: { 1: 'peace', 2: 'war' } });
    const b = makeFaction(1, 'industrial', { diplo: { 0: 'peace', 2: 'war' } });
    const e = makeFaction(2, 'industrial', { diplo: { 0: 'war', 1: 'war' } });
    const state = makeTreatyState([], [a, b, e], { 2: memory({ 0: 50 }) });
    applyAlliance({ proposer: a.idx, target: b.idx, enemy: e.idx }, a, b, e, state, 7);
    expect(state.aiMemory[2]?.grudges[0]).toBe(50 + ALLIANCE_FORMATION_GRUDGE);
    expect(state.aiMemory[2]?.grudges[1]).toBe(ALLIANCE_FORMATION_GRUDGE);
  });

  it('does not re-trigger a war declaration when already at war', () => {
    const a = makeFaction(0, 'industrial', { diplo: { 1: 'peace', 2: 'war' } });
    const b = makeFaction(1, 'industrial', { diplo: { 0: 'peace', 2: 'war' } });
    const e = makeFaction(2, 'industrial', { diplo: { 0: 'war', 1: 'war' } });
    const state = makeTreatyState([], [a, b, e], { 2: memory() });
    applyAlliance({ proposer: a.idx, target: b.idx, enemy: e.idx }, a, b, e, state, 7);
    // Diplo stays at 'war' (no change, no extra log expected at this layer)
    expect(a.diplo[e.idx]).toBe('war');
    expect(b.diplo[e.idx]).toBe('war');
  });
});

describe('alliancesBetween / alliancesInvolving', () => {
  const a = asFactionIdx(0);
  const b = asFactionIdx(1);
  const c = asFactionIdx(2);
  const allianceAB: Treaty = {
    kind: 'alliance', id: 1, partyA: a, partyB: b, enemy: c, startTurn: 1,
  };
  const allianceBA: Treaty = {
    kind: 'alliance', id: 2, partyA: b, partyB: a, enemy: c, startTurn: 1,
  };
  const allianceBC: Treaty = {
    kind: 'alliance', id: 3, partyA: b, partyB: c, enemy: a, startTurn: 1,
  };
  const agreement: Treaty = {
    kind: 'trade_agreement', id: 4, provider: a, consumer: b, resource: 'aether',
    amountPerTurn: 5, goldPerTurn: 30, startTurn: 1, turnsRemaining: 5,
  };

  it('alliancesBetween matches both orderings', () => {
    const res = alliancesBetween([allianceAB, allianceBA, allianceBC, agreement], a, b);
    expect(res).toEqual([allianceAB, allianceBA]);
  });

  it('alliancesInvolving picks every alliance touching the faction', () => {
    const res = alliancesInvolving([allianceAB, allianceBC, agreement], b);
    expect(res).toEqual([allianceAB, allianceBC]);
  });
});

describe('breakAlliancesOnPeace', () => {
  it('removes alliances whose named enemy matches and faction is a party', () => {
    const a = asFactionIdx(0);
    const b = asFactionIdx(1);
    const c = asFactionIdx(2);
    const t1: Treaty = {
      kind: 'alliance', id: 1, partyA: a, partyB: b, enemy: c, startTurn: 1,
    };
    const t2: Treaty = {
      kind: 'alliance', id: 2, partyA: a, partyB: c, enemy: b, startTurn: 1,
    };
    const t3: Treaty = {
      kind: 'trade_agreement', id: 3, provider: a, consumer: c, resource: 'aether',
      amountPerTurn: 5, goldPerTurn: 30, startTurn: 1, turnsRemaining: 5,
    };
    const state = { treaties: [t1, t2, t3] };
    const broken = breakAlliancesOnPeace(state, a, c);
    expect(broken).toEqual([t1]);
    expect(state.treaties).toEqual([t2, t3]);
  });

  it('leaves trade agreements alone', () => {
    const a = asFactionIdx(0);
    const b = asFactionIdx(1);
    const t: Treaty = {
      kind: 'trade_agreement', id: 1, provider: a, consumer: b, resource: 'aether',
      amountPerTurn: 5, goldPerTurn: 30, startTurn: 1, turnsRemaining: 5,
    };
    const state = { treaties: [t] };
    const broken = breakAlliancesOnPeace(state, a, b);
    expect(broken).toEqual([]);
    expect(state.treaties).toEqual([t]);
  });
});

describe('dissolveTreatiesOnDeath', () => {
  it('removes every treaty involving the dead faction in any role', () => {
    const a = asFactionIdx(0);
    const b = asFactionIdx(1);
    const c = asFactionIdx(2);
    const d = asFactionIdx(3);
    const alliance_abc: Treaty = {
      kind: 'alliance', id: 1, partyA: a, partyB: b, enemy: c, startTurn: 1,
    };
    const agreement_ab: Treaty = {
      kind: 'trade_agreement', id: 2, provider: a, consumer: b, resource: 'aether',
      amountPerTurn: 5, goldPerTurn: 30, startTurn: 1, turnsRemaining: 5,
    };
    const agreement_cd: Treaty = {
      kind: 'trade_agreement', id: 3, provider: c, consumer: d, resource: 'aether',
      amountPerTurn: 5, goldPerTurn: 30, startTurn: 1, turnsRemaining: 5,
    };
    const state = { treaties: [alliance_abc, agreement_ab, agreement_cd] };
    const removed = dissolveTreatiesOnDeath(state, a);
    expect(removed).toEqual([alliance_abc, agreement_ab]);
    expect(state.treaties).toEqual([agreement_cd]);
  });

  it('removes alliances where the dead faction was the named enemy', () => {
    const a = asFactionIdx(0);
    const b = asFactionIdx(1);
    const c = asFactionIdx(2);
    const alliance: Treaty = {
      kind: 'alliance', id: 1, partyA: a, partyB: b, enemy: c, startTurn: 1,
    };
    const state = { treaties: [alliance] };
    const removed = dissolveTreatiesOnDeath(state, c);
    expect(removed).toEqual([alliance]);
    expect(state.treaties).toEqual([]);
  });
});

describe('evaluateTradeAgreement', () => {
  function buildOffer(
    proposer: FactionIdx,
    target: FactionIdx,
    provider: FactionIdx,
    consumer: FactionIdx,
    overrides: Partial<TradeAgreementOffer> = {}
  ): TradeAgreementOffer {
    return {
      proposer,
      target,
      provider,
      consumer,
      resource: 'aether',
      amountPerTurn: 5,
      goldPerTurn: 35,
      duration: 5,
      ...overrides,
    };
  }

  it('refuses zero / negative amounts as invalid', () => {
    const a = makeFaction(0, 'industrial');
    const b = makeFaction(1, 'industrial', { resources: { gold: 1000, aether: 50 } });
    const offer = buildOffer(a.idx, b.idx, b.idx, a.idx, { amountPerTurn: 0 });
    const r = evaluateTradeAgreement(offer, a, b, memory(), [], constRng(0.5));
    expect(r.refusal).toBe('invalid');
  });

  it('refuses if proposer/target party mapping is wrong', () => {
    const a = makeFaction(0, 'industrial');
    const b = makeFaction(1, 'industrial', { resources: { gold: 1000, aether: 50 } });
    // provider must be proposer or target — using a third faction is invalid
    const offer = buildOffer(a.idx, b.idx, asFactionIdx(7), b.idx);
    const r = evaluateTradeAgreement(offer, a, b, memory(), [], constRng(0.5));
    expect(r.refusal).toBe('invalid');
  });

  it('refuses with hostile when at war', () => {
    const a = makeFaction(0, 'industrial', { diplo: { 1: 'war' } });
    const b = makeFaction(1, 'industrial', {
      resources: { gold: 1000, aether: 50 },
      diplo: { 0: 'war' },
    });
    const offer = buildOffer(a.idx, b.idx, b.idx, a.idx);
    const r = evaluateTradeAgreement(offer, a, b, memory(), [], constRng(0.5));
    expect(r.refusal).toBe('hostile');
  });

  it('refuses unavailable if provider lacks the aether', () => {
    const a = makeFaction(0, 'industrial');
    const b = makeFaction(1, 'industrial', { resources: { gold: 1000, aether: 2 } });
    const offer = buildOffer(a.idx, b.idx, b.idx, a.idx);
    const r = evaluateTradeAgreement(offer, a, b, memory(), [], constRng(0.5));
    expect(r.refusal).toBe('unavailable');
  });

  it('refuses unaffordable if consumer lacks the gold', () => {
    const a = makeFaction(0, 'industrial', { resources: { gold: 10, aether: 0 } });
    const b = makeFaction(1, 'industrial', { resources: { gold: 1000, aether: 50 } });
    const offer = buildOffer(a.idx, b.idx, b.idx, a.idx);
    const r = evaluateTradeAgreement(offer, a, b, memory(), [], constRng(0.5));
    expect(r.refusal).toBe('unaffordable');
  });

  it('refuses redundant when an identical agreement already exists', () => {
    const a = makeFaction(0, 'industrial');
    const b = makeFaction(1, 'industrial', { resources: { gold: 1000, aether: 50 } });
    const existing: Treaty = {
      kind: 'trade_agreement', id: 1, provider: b.idx, consumer: a.idx,
      resource: 'aether', amountPerTurn: 5, goldPerTurn: 30, startTurn: 1,
      turnsRemaining: 5,
    };
    const offer = buildOffer(a.idx, b.idx, b.idx, a.idx);
    const r = evaluateTradeAgreement(offer, a, b, memory(), [existing], constRng(0.5));
    expect(r.refusal).toBe('redundant');
  });

  it('refuses too_low when the rate is stingy', () => {
    const a = makeFaction(0, 'industrial');
    const b = makeFaction(1, 'militaristic', { resources: { gold: 1000, aether: 50 } });
    // 5 aether * 5 = 25 base; offering only 10 gold/turn → ratio 0.4, score deeply negative
    const offer = buildOffer(a.idx, b.idx, b.idx, a.idx, { goldPerTurn: 10 });
    const r = evaluateTradeAgreement(offer, a, b, memory(), [], constRng(0.01));
    expect(r.refusal).toBe('too_low');
  });

  it('accepts a healthy rate from an economic seller', () => {
    const a = makeFaction(0, 'industrial');
    const b = makeFaction(1, 'economic', { resources: { gold: 1000, aether: 50 } });
    // 5 aether * 5 = 25 base; offering 50 → ratio 2 → score well above threshold
    const offer = buildOffer(a.idx, b.idx, b.idx, a.idx, { goldPerTurn: 50, duration: 5 });
    const r = evaluateTradeAgreement(offer, a, b, memory(), [], constRng(0.5));
    expect(r.accept).toBe(true);
  });
});

describe('applyTradeAgreement', () => {
  it('pushes a treaty without transferring resources', () => {
    const a = makeFaction(0, 'industrial', { resources: { gold: 500, aether: 0 } });
    const b = makeFaction(1, 'industrial', { resources: { gold: 100, aether: 50 } });
    const state = makeTreatyState([], [a, b]);
    const offer: TradeAgreementOffer = {
      proposer: a.idx, target: b.idx, provider: b.idx, consumer: a.idx,
      resource: 'aether', amountPerTurn: 5, goldPerTurn: 30, duration: 5,
    };
    const t = applyTradeAgreement(offer, state, 3);
    // Resources untouched until first tick
    expect(a.resources.gold).toBe(500);
    expect(b.resources.gold).toBe(100);
    expect(a.resources.aether).toBe(0);
    expect(b.resources.aether).toBe(50);
    expect(state.treaties).toEqual([t]);
    expect(t.kind).toBe('trade_agreement');
    if (t.kind === 'trade_agreement') {
      expect(t.turnsRemaining).toBe(5);
    }
  });

  it('caps stored turnsRemaining at TRADE_AGREEMENT_MAX_DURATION', () => {
    const a = makeFaction(0, 'industrial');
    const b = makeFaction(1, 'industrial');
    const state = makeTreatyState();
    const offer: TradeAgreementOffer = {
      proposer: a.idx, target: b.idx, provider: b.idx, consumer: a.idx,
      resource: 'aether', amountPerTurn: 5, goldPerTurn: 30, duration: 100,
    };
    const t = applyTradeAgreement(offer, state, 1);
    if (t.kind === 'trade_agreement') {
      expect(t.turnsRemaining).toBe(TRADE_AGREEMENT_MAX_DURATION);
    }
  });
});

describe('tickTreaties', () => {
  function makeRunningAgreement(
    provider: FactionIdx,
    consumer: FactionIdx,
    overrides: Partial<Extract<Treaty, { kind: 'trade_agreement' }>> = {}
  ): Treaty {
    return {
      kind: 'trade_agreement',
      id: 1,
      provider,
      consumer,
      resource: 'aether',
      amountPerTurn: 5,
      goldPerTurn: 30,
      startTurn: 1,
      turnsRemaining: 3,
      ...overrides,
    };
  }

  it('transfers per-turn from provider to consumer and decrements turnsRemaining', () => {
    const a = makeFaction(0, 'industrial', { resources: { gold: 100, aether: 0 } });
    const b = makeFaction(1, 'industrial', { resources: { gold: 50, aether: 30 } });
    const treaty = makeRunningAgreement(b.idx, a.idx);
    const state = makeTreatyState([treaty], [a, b]);
    const events = tickTreaties(state, b); // provider's turn

    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('transferred');
    expect(b.resources.aether).toBe(25);
    expect(a.resources.aether).toBe(5);
    expect(a.resources.gold).toBe(70);
    expect(b.resources.gold).toBe(80);
    expect(state.treaties[0].kind).toBe('trade_agreement');
    if (state.treaties[0].kind === 'trade_agreement') {
      expect(state.treaties[0].turnsRemaining).toBe(2);
    }
  });

  it('is a no-op when faction is not the provider (consumer tick)', () => {
    const a = makeFaction(0, 'industrial', { resources: { gold: 100, aether: 0 } });
    const b = makeFaction(1, 'industrial', { resources: { gold: 50, aether: 30 } });
    const treaty = makeRunningAgreement(b.idx, a.idx);
    const state = makeTreatyState([treaty], [a, b]);
    const events = tickTreaties(state, a); // consumer's turn — no-op

    expect(events).toEqual([]);
    expect(a.resources.gold).toBe(100);
    expect(b.resources.aether).toBe(30);
  });

  it('breaks with failed_to_deliver when provider runs out of aether', () => {
    const a = makeFaction(0, 'industrial', { resources: { gold: 100, aether: 0 } });
    const b = makeFaction(1, 'industrial', { resources: { gold: 50, aether: 2 } });
    const treaty = makeRunningAgreement(b.idx, a.idx);
    const state = makeTreatyState([treaty], [a, b]);
    const events = tickTreaties(state, b);

    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('broken');
    expect(events[0].reason).toBe('failed_to_deliver');
    expect(state.treaties).toEqual([]);
    // Resources stay put
    expect(b.resources.aether).toBe(2);
    expect(a.resources.gold).toBe(100);
  });

  it('breaks with failed_to_pay when consumer runs out of gold', () => {
    const a = makeFaction(0, 'industrial', { resources: { gold: 10, aether: 0 } });
    const b = makeFaction(1, 'industrial', { resources: { gold: 50, aether: 30 } });
    const treaty = makeRunningAgreement(b.idx, a.idx);
    const state = makeTreatyState([treaty], [a, b]);
    const events = tickTreaties(state, b);

    expect(events[0].reason).toBe('failed_to_pay');
    expect(state.treaties).toEqual([]);
    expect(b.resources.aether).toBe(30);
    expect(a.resources.gold).toBe(10);
  });

  it('breaks with partner_lost when the consumer is dead', () => {
    const a = makeFaction(0, 'industrial', {
      alive: false,
      resources: { gold: 100, aether: 0 },
    });
    const b = makeFaction(1, 'industrial', { resources: { gold: 50, aether: 30 } });
    const treaty = makeRunningAgreement(b.idx, a.idx);
    const state = makeTreatyState([treaty], [a, b]);
    const events = tickTreaties(state, b);

    expect(events[0].reason).toBe('partner_lost');
    expect(state.treaties).toEqual([]);
  });

  it('breaks with completed when turnsRemaining hits 0', () => {
    const a = makeFaction(0, 'industrial', { resources: { gold: 100, aether: 0 } });
    const b = makeFaction(1, 'industrial', { resources: { gold: 50, aether: 30 } });
    const treaty = makeRunningAgreement(b.idx, a.idx, { turnsRemaining: 1 });
    const state = makeTreatyState([treaty], [a, b]);
    const events = tickTreaties(state, b);

    expect(events[0].kind).toBe('broken');
    expect(events[0].reason).toBe('completed');
    // Final transfer happens even on the completing tick
    expect(b.resources.aether).toBe(25);
    expect(a.resources.aether).toBe(5);
    expect(state.treaties).toEqual([]);
  });

  it('leaves alliances untouched', () => {
    const a = makeFaction(0, 'industrial');
    const b = makeFaction(1, 'industrial');
    const c = makeFaction(2, 'industrial');
    const alliance: Treaty = {
      kind: 'alliance', id: 1, partyA: a.idx, partyB: b.idx, enemy: c.idx, startTurn: 1,
    };
    const state = makeTreatyState([alliance], [a, b, c]);
    const events = tickTreaties(state, a);
    expect(events).toEqual([]);
    expect(state.treaties).toEqual([alliance]);
  });
});

describe('breakTradeAgreementsOnWar', () => {
  it('removes only trade agreements between the two specified parties', () => {
    const a = asFactionIdx(0);
    const b = asFactionIdx(1);
    const c = asFactionIdx(2);
    const ab: Treaty = {
      kind: 'trade_agreement', id: 1, provider: a, consumer: b, resource: 'aether',
      amountPerTurn: 5, goldPerTurn: 30, startTurn: 1, turnsRemaining: 5,
    };
    const ba: Treaty = {
      kind: 'trade_agreement', id: 2, provider: b, consumer: a, resource: 'aether',
      amountPerTurn: 5, goldPerTurn: 30, startTurn: 1, turnsRemaining: 5,
    };
    const ac: Treaty = {
      kind: 'trade_agreement', id: 3, provider: a, consumer: c, resource: 'aether',
      amountPerTurn: 5, goldPerTurn: 30, startTurn: 1, turnsRemaining: 5,
    };
    const alliance: Treaty = {
      kind: 'alliance', id: 4, partyA: a, partyB: b, enemy: c, startTurn: 1,
    };
    const state = { treaties: [ab, ba, ac, alliance] };
    const broken = breakTradeAgreementsOnWar(state, a, b);
    expect(broken).toEqual([ab, ba]);
    expect(state.treaties).toEqual([ac, alliance]); // alliance NOT broken by war
  });
});

describe('cancelTreaty', () => {
  it('removes a treaty by id and returns it', () => {
    const t: Treaty = {
      kind: 'alliance', id: 7, partyA: asFactionIdx(0), partyB: asFactionIdx(1),
      enemy: asFactionIdx(2), startTurn: 1,
    };
    const state = { treaties: [t] };
    const removed = cancelTreaty(state, 7);
    expect(removed).toBe(t);
    expect(state.treaties).toEqual([]);
  });

  it('returns null when the id is unknown', () => {
    const t: Treaty = {
      kind: 'alliance', id: 7, partyA: asFactionIdx(0), partyB: asFactionIdx(1),
      enemy: asFactionIdx(2), startTurn: 1,
    };
    const state = { treaties: [t] };
    expect(cancelTreaty(state, 99)).toBeNull();
    expect(state.treaties).toEqual([t]);
  });
});

describe('suggestedAgreementGold', () => {
  it('matches the one-shot aether pricing per unit', () => {
    // Use amounts that round cleanly (8 → 50, 16 → 100) to sidestep the
    // .5-rounding asymmetry (mirrors the suggestedAetherPrice test
    // pattern).
    expect(suggestedAgreementGold(8)).toBe(Math.round(8 * TRADE_AETHER_BASE_VALUE * 1.25));
    expect(suggestedAgreementGold(16)).toBe(suggestedAgreementGold(8) * 2);
  });
});

describe('alliance threshold sanity', () => {
  it('threshold is positive and the fuzz band is non-zero', () => {
    expect(ALLIANCE_ACCEPT_THRESHOLD).toBeGreaterThan(0);
    expect(ALLIANCE_FUZZ_BAND).toBeGreaterThan(0);
    expect(TRADE_AGREEMENT_ACCEPT_THRESHOLD).toBeGreaterThan(0);
    expect(TRADE_AGREEMENT_FUZZ_BAND).toBeGreaterThan(0);
  });
});

describe('threshold sanity (regression guards)', () => {
  it('TRADE_ACCEPT_THRESHOLD is positive and within reach of the score formula', () => {
    expect(TRADE_ACCEPT_THRESHOLD).toBeGreaterThan(0);
    expect(TRADE_FUZZ_BAND).toBeGreaterThan(0);
  });

  it('TRIBUTE_MIN_STRENGTH_RATIO is > 1 (no tribute from peers)', () => {
    expect(TRIBUTE_MIN_STRENGTH_RATIO).toBeGreaterThan(1);
    expect(TRIBUTE_FUZZ_BAND).toBeGreaterThan(0);
    expect(TRIBUTE_PAY_THRESHOLD).toBeGreaterThanOrEqual(0);
  });
});
