import { describe, expect, it } from 'vitest';
import {
  applyTrade,
  applyTribute,
  evaluateTrade,
  evaluateTribute,
  suggestedAetherPrice,
  suggestedTechPrice,
  suggestedTribute,
  TRADE_ACCEPT_THRESHOLD,
  TRADE_AETHER_BASE_VALUE,
  TRADE_FUZZ_BAND,
  TRADE_TECH_BASE_VALUE,
  TRIBUTE_FUZZ_BAND,
  TRIBUTE_MIN_STRENGTH_RATIO,
  TRIBUTE_PAY_THRESHOLD,
  type TradeOffer,
  type TributeDemand,
} from '../src/systems/diplomacy';
import { asFactionIdx } from '../src/core/types';
import type { AIMemory, Faction, PersonalityId } from '../src/core/types';

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
