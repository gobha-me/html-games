// One-shot diplomacy mechanics (Phase 3 S9a).
//
// Three new player↔faction interactions, none of them persistent:
//
//   1. Trade — gold for a tech the seller has and the buyer lacks.
//   2. Trade — gold for a one-shot aether transfer.
//   3. Tribute — gold demanded under military threat.
//
// Every accepted interaction resolves immediately: resources move,
// techs propagate, the event log records the moment, the
// `aiMemory.grudges` ledger absorbs any social fallout. No new field
// lands on Faction or GameState — the only durable record is the
// grudge bump on refusal, which uses the existing serialized map.
//
// Design split:
//   - `evaluateTrade` / `evaluateTribute` are pure: they take Faction
//     refs + scalars + an rng and return a structured Decision. No G
//     access, no DOM, no log() calls. Tests cover them in isolation.
//   - `applyTrade` / `applyTribute` mutate the two factions for the
//     accepted path. Callers (AI in `aiDiplomacy`, UI in
//     `diploModal`) decide whether to apply and which log line to
//     emit.
//
// Replay parity: AI rolls via `getGameRng()` (passed in at the
// evaluate call). Player-initiated paths pass `Math.random` per
// decision-log item 2 — don't "helpfully" thread the seeded rng
// through them.

import type { AIMemory, Faction, FactionIdx, TechId } from '../core/types';
import { TECHS } from '../data/techs';
import { resolveBehavior } from '../ai/behavior';

export type TradeKind = 'gold_for_tech' | 'gold_for_resource';

export type TradeResource = 'aether';

export interface TradeOffer {
  kind: TradeKind;
  proposer: FactionIdx;
  target: FactionIdx;
  goldOffered: number;
  /** Required when kind === 'gold_for_tech'. */
  techId?: TechId;
  /** Required when kind === 'gold_for_resource'. */
  resource?: TradeResource;
  resourceAmount?: number;
}

export type TradeRefusal =
  | 'invalid'
  | 'unaffordable'
  | 'unavailable'
  | 'too_low'
  | 'hostile';

export interface TradeDecision {
  accept: boolean;
  refusal: TradeRefusal | null;
  /** Surfaced for tests + UI hint copy ("they want more gold"). */
  score: number;
}

export interface TributeDemand {
  demander: FactionIdx;
  target: FactionIdx;
  goldDemanded: number;
}

export type TributeRefusal =
  | 'invalid'
  | 'cannot_pay'
  | 'insufficient_threat'
  | 'defiant';

export interface TributeDecision {
  accept: boolean;
  refusal: TributeRefusal | null;
  score: number;
}

// --- Tunable thresholds (exported for test transparency) ----------------

/** Gold-per-research-point reservation price for a tech trade. A tech
 *  with cost 100 has a base ask of 300 gold; the target's behavior +
 *  grudge profile then biases up or down from there. */
export const TRADE_TECH_BASE_VALUE = 3;
/** Gold per aether unit in a one-shot transfer. */
export const TRADE_AETHER_BASE_VALUE = 5;
/** Score above which the target accepts; below `threshold - fuzz` the
 *  target always refuses; between them a single rng draw decides. */
export const TRADE_ACCEPT_THRESHOLD = 50;
export const TRADE_FUZZ_BAND = 10;

/** Minimum military ratio (demander : target) below which a tribute
 *  demand is shrugged off as not credible. */
export const TRIBUTE_MIN_STRENGTH_RATIO = 1.3;
export const TRIBUTE_PAY_THRESHOLD = 0;
export const TRIBUTE_FUZZ_BAND = 15;

/** Grudge bumps applied to the proposer/demander when the recipient
 *  refuses. The slighted side's `aiMemory.grudges[other]` ticks up. */
export const TRADE_REFUSAL_GRUDGE = 5;
export const TRIBUTE_DEFIANCE_GRUDGE = 20;

// --- Trade ---------------------------------------------------------------

export function evaluateTrade(
  offer: TradeOffer,
  proposer: Faction,
  target: Faction,
  proposerStrength: number,
  targetStrength: number,
  targetMemory: AIMemory | null | undefined,
  rng: () => number
): TradeDecision {
  if (offer.proposer !== proposer.idx || offer.target !== target.idx) {
    return { accept: false, refusal: 'invalid', score: 0 };
  }
  if (offer.goldOffered <= 0) {
    return { accept: false, refusal: 'invalid', score: 0 };
  }
  if (proposer.resources.gold < offer.goldOffered) {
    return { accept: false, refusal: 'unaffordable', score: 0 };
  }

  const status = target.diplo[proposer.idx] ?? 'unmet';
  if (status === 'war' || status === 'unmet') {
    return { accept: false, refusal: 'hostile', score: 0 };
  }

  let baseValue: number;
  if (offer.kind === 'gold_for_tech') {
    if (!offer.techId) return { accept: false, refusal: 'invalid', score: 0 };
    if (!target.techs.has(offer.techId) || proposer.techs.has(offer.techId)) {
      return { accept: false, refusal: 'unavailable', score: 0 };
    }
    baseValue = TECHS[offer.techId].cost * TRADE_TECH_BASE_VALUE;
  } else {
    if (!offer.resource || !offer.resourceAmount || offer.resourceAmount <= 0) {
      return { accept: false, refusal: 'invalid', score: 0 };
    }
    if (target.resources[offer.resource] < offer.resourceAmount) {
      return { accept: false, refusal: 'unavailable', score: 0 };
    }
    baseValue = offer.resourceAmount * TRADE_AETHER_BASE_VALUE;
  }

  const grudge = targetMemory?.grudges[proposer.idx] ?? 0;
  const beh = resolveBehavior(target);
  const ratio = offer.goldOffered / Math.max(1, baseValue);
  const priceScore = (ratio - 1) * 100 + beh.econ * 30 - beh.agg * 25;
  const grudgeScore = -grudge * 0.4;
  const strengthScore = proposerStrength > targetStrength ? 10 : 0;
  const score = priceScore + grudgeScore + strengthScore;

  if (score < TRADE_ACCEPT_THRESHOLD - TRADE_FUZZ_BAND) {
    return { accept: false, refusal: 'too_low', score };
  }
  if (score > TRADE_ACCEPT_THRESHOLD + TRADE_FUZZ_BAND) {
    return { accept: true, refusal: null, score };
  }
  // Inside the fuzz band — single rng draw, biased by how far past
  // threshold we are. At threshold exactly: 50/50. At +fuzz: 100%
  // accept. At -fuzz: 100% refuse.
  const margin = (score - TRADE_ACCEPT_THRESHOLD) / TRADE_FUZZ_BAND;
  const acceptChance = 0.5 + margin * 0.5;
  if (rng() < acceptChance) {
    return { accept: true, refusal: null, score };
  }
  return { accept: false, refusal: 'too_low', score };
}

/** Apply an accepted trade by mutating both factions. Caller is
 *  responsible for the accept decision (either via `evaluateTrade`
 *  for AI, or the player's own click for human-initiated). */
export function applyTrade(offer: TradeOffer, proposer: Faction, target: Faction): void {
  proposer.resources.gold -= offer.goldOffered;
  target.resources.gold += offer.goldOffered;
  if (offer.kind === 'gold_for_tech' && offer.techId) {
    proposer.techs.add(offer.techId);
  } else if (offer.kind === 'gold_for_resource' && offer.resource && offer.resourceAmount) {
    target.resources[offer.resource] -= offer.resourceAmount;
    proposer.resources[offer.resource] += offer.resourceAmount;
  }
}

/** Suggested default gold ask for a tech trade — the seller's
 *  reservation price plus a 25% margin so the default offer sits in
 *  the lower edge of the fuzz band. UI uses this to pre-fill the
 *  input. */
export function suggestedTechPrice(techId: TechId): number {
  return Math.round(TECHS[techId].cost * TRADE_TECH_BASE_VALUE * 1.25);
}

/** Suggested gold ask for an aether trade — `amount` aether at the
 *  base rate, +25% margin. */
export function suggestedAetherPrice(amount: number): number {
  return Math.round(amount * TRADE_AETHER_BASE_VALUE * 1.25);
}

// --- Tribute -------------------------------------------------------------

export function evaluateTribute(
  demand: TributeDemand,
  demander: Faction,
  target: Faction,
  demanderStrength: number,
  targetStrength: number,
  targetMemory: AIMemory | null | undefined,
  rng: () => number
): TributeDecision {
  if (demand.demander !== demander.idx || demand.target !== target.idx) {
    return { accept: false, refusal: 'invalid', score: 0 };
  }
  if (demand.goldDemanded <= 0) {
    return { accept: false, refusal: 'invalid', score: 0 };
  }
  const strengthRatio = demanderStrength / Math.max(1, targetStrength);
  if (strengthRatio < TRIBUTE_MIN_STRENGTH_RATIO) {
    return { accept: false, refusal: 'insufficient_threat', score: 0 };
  }
  if (target.resources.gold < demand.goldDemanded) {
    return { accept: false, refusal: 'cannot_pay', score: 0 };
  }

  const fractionDemanded = demand.goldDemanded / Math.max(1, target.resources.gold);
  const beh = resolveBehavior(target);
  const grudge = targetMemory?.grudges[demander.idx] ?? 0;

  // Higher score = more willing to pay. Threat capped at 3× because a 10×
  // overwhelming force doesn't make "give us 90% of your treasury or die"
  // any more reasonable than 3× does — historically tribute is moderate
  // repeated payments, not bankruptcy under duress. Cost weight (200) is
  // intentionally heavy: a target paying its last coin to a demander has
  // nothing left to defend with, so the formula tilts toward defiance
  // when the ask is most of the treasury even under heavy threat.
  const cappedRatio = Math.min(strengthRatio, 3.0);
  const threatScore = (cappedRatio - 1) * 60;
  const costScore = -fractionDemanded * 200;
  const defianceScore = -beh.agg * 30 - beh.defenseFocus * 15;
  const grudgeScore = -grudge * 0.4;
  const score = threatScore + costScore + defianceScore + grudgeScore;

  if (score < TRIBUTE_PAY_THRESHOLD - TRIBUTE_FUZZ_BAND) {
    return { accept: false, refusal: 'defiant', score };
  }
  if (score > TRIBUTE_PAY_THRESHOLD + TRIBUTE_FUZZ_BAND) {
    return { accept: true, refusal: null, score };
  }
  const margin = (score - TRIBUTE_PAY_THRESHOLD) / TRIBUTE_FUZZ_BAND;
  const acceptChance = 0.5 + margin * 0.5;
  if (rng() < acceptChance) {
    return { accept: true, refusal: null, score };
  }
  return { accept: false, refusal: 'defiant', score };
}

export function applyTribute(
  demand: TributeDemand,
  demander: Faction,
  target: Faction
): void {
  target.resources.gold -= demand.goldDemanded;
  demander.resources.gold += demand.goldDemanded;
}

/** Suggested default tribute demand — 10% of target's treasury,
 *  capped at 25% of the demander's military-edge wealth. UI uses this
 *  to pre-fill the demand amount. */
export function suggestedTribute(target: Faction): number {
  return Math.max(50, Math.round(target.resources.gold * 0.1));
}
