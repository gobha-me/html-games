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

import type { AIMemory, Faction, FactionIdx, TechId, Treaty } from '../core/types';
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

// --- Persistent treaties (Phase 3 S9b) -----------------------------------
//
// Two treaty kinds share one discriminated union (`Treaty` in core/types.ts):
//
//   1. Alliance — mutual pact against a named enemy. Apply *also* declares
//      joint war on the enemy (matches roadmap "mutual war" phrasing).
//      Breaks when either party makes peace with the named enemy
//      (`breakAlliancesOnPeace`).
//   2. Trade agreement — per-turn aether-for-gold exchange over N turns.
//      Ticks at the start of the provider's turn (`tickTreaties`). Breaks
//      on resource starvation, on war between the parties
//      (`breakTreatiesOnWar`), or naturally when `turnsRemaining` hits 0.
//
// Eval/apply split mirrors S9a (item 15): `evaluateX` is pure and returns a
// decision; `applyX` mutates inputs and pushes the treaty. All AI rolls go
// through the seeded rng (diploAI.ts passes `getGameRng()`); player-
// initiated rolls stay on `Math.random` (item-2 precedent).

// --- Alliance ------------------------------------------------------------

export interface AllianceOffer {
  proposer: FactionIdx;
  target: FactionIdx;
  enemy: FactionIdx;
}

export type AllianceRefusal =
  | 'invalid'
  | 'hostile'
  | 'unenemy'
  | 'redundant'
  | 'disinterested';

export interface AllianceDecision {
  accept: boolean;
  refusal: AllianceRefusal | null;
  score: number;
}

export const ALLIANCE_ACCEPT_THRESHOLD = 50;
export const ALLIANCE_FUZZ_BAND = 15;
/** Grudge bump applied to the named enemy against each new ally, so the
 *  enemy's next aiDiplomacy pass weighs retaliation appropriately. */
export const ALLIANCE_FORMATION_GRUDGE = 25;

export function evaluateAlliance(
  offer: AllianceOffer,
  proposer: Faction,
  target: Faction,
  combinedStrength: number,
  enemyStrength: number,
  targetMemory: AIMemory | null | undefined,
  treaties: readonly Treaty[],
  rng: () => number
): AllianceDecision {
  if (
    offer.proposer === offer.target ||
    offer.proposer === offer.enemy ||
    offer.target === offer.enemy
  ) {
    return { accept: false, refusal: 'invalid', score: 0 };
  }
  if (offer.proposer !== proposer.idx || offer.target !== target.idx) {
    return { accept: false, refusal: 'invalid', score: 0 };
  }
  const proposerVsTarget = proposer.diplo[offer.target] ?? 'unmet';
  if (proposerVsTarget !== 'peace') {
    return { accept: false, refusal: 'hostile', score: 0 };
  }
  const proposerVsEnemy = proposer.diplo[offer.enemy] ?? 'unmet';
  if (proposerVsEnemy !== 'war') {
    return { accept: false, refusal: 'unenemy', score: 0 };
  }
  const alreadyAllied = treaties.some(
    (t) =>
      t.kind === 'alliance' &&
      ((t.partyA === offer.proposer && t.partyB === offer.target) ||
        (t.partyA === offer.target && t.partyB === offer.proposer)) &&
      t.enemy === offer.enemy
  );
  if (alreadyAllied) {
    return { accept: false, refusal: 'redundant', score: 0 };
  }

  const grudge = targetMemory?.grudges[offer.enemy] ?? 0;
  const beh = resolveBehavior(target);
  const targetVsEnemy = target.diplo[offer.enemy] ?? 'unmet';
  // Target already at war with enemy → much more interested in joining
  // forces; target at peace with enemy → reluctant to start a war on
  // someone else's behalf.
  const stanceScore = targetVsEnemy === 'war' ? 30 : -20;
  // Enemy outpowers the combined alliance → target appreciates the help.
  const reliefRatio = enemyStrength / Math.max(1, combinedStrength);
  const strengthRelief = reliefRatio > 0.8 ? (reliefRatio - 0.8) * 40 : 0;
  const grudgeScore = grudge * 0.6;
  const behScore = beh.agg * 35 - beh.econ * 20;
  const score = grudgeScore + behScore + stanceScore + strengthRelief;

  if (score < ALLIANCE_ACCEPT_THRESHOLD - ALLIANCE_FUZZ_BAND) {
    return { accept: false, refusal: 'disinterested', score };
  }
  if (score > ALLIANCE_ACCEPT_THRESHOLD + ALLIANCE_FUZZ_BAND) {
    return { accept: true, refusal: null, score };
  }
  const margin = (score - ALLIANCE_ACCEPT_THRESHOLD) / ALLIANCE_FUZZ_BAND;
  const acceptChance = 0.5 + margin * 0.5;
  if (rng() < acceptChance) {
    return { accept: true, refusal: null, score };
  }
  return { accept: false, refusal: 'disinterested', score };
}

export interface TreatyStateSlice {
  treaties: Treaty[];
  nextTreatyId: number;
  aiMemory: Partial<Record<number, AIMemory>>;
}

/** Apply an accepted alliance: flip both parties to war with the named
 *  enemy if either was still at peace, bump the enemy's grudge against
 *  each ally, push the treaty. Returns the treaty so the caller can log
 *  voice. Caller decides whether to apply (via `evaluateAlliance` for
 *  AI, or the player's click for human-initiated). */
export function applyAlliance(
  offer: AllianceOffer,
  proposer: Faction,
  target: Faction,
  enemy: Faction,
  state: TreatyStateSlice,
  startTurn: number
): Treaty {
  if (proposer.diplo[enemy.idx] !== 'war') {
    proposer.diplo[enemy.idx] = 'war';
    enemy.diplo[proposer.idx] = 'war';
  }
  if (target.diplo[enemy.idx] !== 'war') {
    target.diplo[enemy.idx] = 'war';
    enemy.diplo[target.idx] = 'war';
  }
  const enemyMem = state.aiMemory[enemy.idx];
  if (enemyMem) {
    enemyMem.grudges[proposer.idx] =
      (enemyMem.grudges[proposer.idx] ?? 0) + ALLIANCE_FORMATION_GRUDGE;
    enemyMem.grudges[target.idx] =
      (enemyMem.grudges[target.idx] ?? 0) + ALLIANCE_FORMATION_GRUDGE;
  }
  const treaty: Treaty = {
    kind: 'alliance',
    id: state.nextTreatyId++,
    partyA: offer.proposer,
    partyB: offer.target,
    enemy: offer.enemy,
    startTurn,
  };
  state.treaties.push(treaty);
  return treaty;
}

/** Return every active alliance where `factionIdx` is a party and
 *  `partner.idx` (the other party) matches. Used by the UI to short-
 *  circuit "are we already allied" checks. */
export function alliancesBetween(
  treaties: readonly Treaty[],
  a: FactionIdx,
  b: FactionIdx
): Treaty[] {
  return treaties.filter(
    (t) =>
      t.kind === 'alliance' &&
      ((t.partyA === a && t.partyB === b) || (t.partyA === b && t.partyB === a))
  );
}

/** Return every active alliance involving `factionIdx`. */
export function alliancesInvolving(
  treaties: readonly Treaty[],
  factionIdx: FactionIdx
): Treaty[] {
  return treaties.filter(
    (t) => t.kind === 'alliance' && (t.partyA === factionIdx || t.partyB === factionIdx)
  );
}

/** Splice out any alliance where `factionIdx` is a party and the named
 *  enemy equals `otherIdx`. Returns the removed treaties so the caller
 *  can log per-faction break voice. Called by every site that flips
 *  `diplo[x] = 'peace'` (decision-log item 16). */
export function breakAlliancesOnPeace(
  state: { treaties: Treaty[] },
  factionIdx: FactionIdx,
  otherIdx: FactionIdx
): Treaty[] {
  const broken: Treaty[] = [];
  state.treaties = state.treaties.filter((t) => {
    if (t.kind !== 'alliance') return true;
    const isParty = t.partyA === factionIdx || t.partyB === factionIdx;
    if (isParty && t.enemy === otherIdx) {
      broken.push(t);
      return false;
    }
    return true;
  });
  return broken;
}

/** Splice out every treaty involving the dead faction (any role:
 *  partyA/partyB/enemy for alliances, provider/consumer for trade
 *  agreements). Called from faction-elimination sites in combat.ts /
 *  city.ts. Returns the removed list for voice logging. */
export function dissolveTreatiesOnDeath(
  state: { treaties: Treaty[] },
  deadIdx: FactionIdx
): Treaty[] {
  const dissolved: Treaty[] = [];
  state.treaties = state.treaties.filter((t) => {
    const touches =
      t.kind === 'alliance'
        ? t.partyA === deadIdx || t.partyB === deadIdx || t.enemy === deadIdx
        : t.provider === deadIdx || t.consumer === deadIdx;
    if (touches) dissolved.push(t);
    return !touches;
  });
  return dissolved;
}

// --- Trade agreement -----------------------------------------------------

export interface TradeAgreementOffer {
  proposer: FactionIdx;
  target: FactionIdx;
  /** Must equal proposer or target. Ships `amountPerTurn` of `resource`. */
  provider: FactionIdx;
  /** The other party; pays `goldPerTurn`. */
  consumer: FactionIdx;
  resource: 'aether';
  amountPerTurn: number;
  goldPerTurn: number;
  /** Total ticks the agreement runs for. Decremented once per provider
   *  turn by `tickTreaties`. */
  duration: number;
}

export type TradeAgreementRefusal =
  | 'invalid'
  | 'hostile'
  | 'unavailable'
  | 'unaffordable'
  | 'redundant'
  | 'too_low';

export interface TradeAgreementDecision {
  accept: boolean;
  refusal: TradeAgreementRefusal | null;
  score: number;
}

export const TRADE_AGREEMENT_ACCEPT_THRESHOLD = 40;
export const TRADE_AGREEMENT_FUZZ_BAND = 12;
/** Duration cap surfaced to UI defaults and AI proposals; longer agreements
 *  are technically valid but the score model damps the bonus past this. */
export const TRADE_AGREEMENT_MAX_DURATION = 20;

export function evaluateTradeAgreement(
  offer: TradeAgreementOffer,
  proposer: Faction,
  target: Faction,
  targetMemory: AIMemory | null | undefined,
  treaties: readonly Treaty[],
  rng: () => number
): TradeAgreementDecision {
  if (
    offer.proposer === offer.target ||
    offer.amountPerTurn <= 0 ||
    offer.goldPerTurn <= 0 ||
    offer.duration <= 0
  ) {
    return { accept: false, refusal: 'invalid', score: 0 };
  }
  if (offer.proposer !== proposer.idx || offer.target !== target.idx) {
    return { accept: false, refusal: 'invalid', score: 0 };
  }
  const validParties =
    (offer.provider === offer.proposer && offer.consumer === offer.target) ||
    (offer.provider === offer.target && offer.consumer === offer.proposer);
  if (!validParties) {
    return { accept: false, refusal: 'invalid', score: 0 };
  }

  const proposerVsTarget = proposer.diplo[offer.target] ?? 'unmet';
  if (proposerVsTarget !== 'peace') {
    return { accept: false, refusal: 'hostile', score: 0 };
  }

  // First-tick feasibility: provider must currently hold the aether,
  // consumer must currently hold the gold. We check the actual factions
  // (matched against offer.provider/consumer) so eval is symmetric.
  const providerFaction = offer.provider === proposer.idx ? proposer : target;
  const consumerFaction = offer.consumer === proposer.idx ? proposer : target;
  if (providerFaction.resources.aether < offer.amountPerTurn) {
    return { accept: false, refusal: 'unavailable', score: 0 };
  }
  if (consumerFaction.resources.gold < offer.goldPerTurn) {
    return { accept: false, refusal: 'unaffordable', score: 0 };
  }

  // Redundancy: same parties + same resource direction already running.
  const alreadyRunning = treaties.some(
    (t) =>
      t.kind === 'trade_agreement' &&
      t.provider === offer.provider &&
      t.consumer === offer.consumer &&
      t.resource === offer.resource
  );
  if (alreadyRunning) {
    return { accept: false, refusal: 'redundant', score: 0 };
  }

  const baseValue = offer.amountPerTurn * TRADE_AETHER_BASE_VALUE;
  const ratio = offer.goldPerTurn / Math.max(1, baseValue);
  const grudge = targetMemory?.grudges[offer.proposer] ?? 0;
  const beh = resolveBehavior(target);
  const priceScore = (ratio - 1) * 100 + beh.econ * 30 - beh.agg * 20;
  const grudgeScore = -grudge * 0.4;
  // Longer agreements give targets predictable income / outflow — modest
  // positive bias, damped past TRADE_AGREEMENT_MAX_DURATION.
  const duration = Math.min(offer.duration, TRADE_AGREEMENT_MAX_DURATION);
  const durationBonus = duration * 1.5;
  const score = priceScore + grudgeScore + durationBonus;

  if (score < TRADE_AGREEMENT_ACCEPT_THRESHOLD - TRADE_AGREEMENT_FUZZ_BAND) {
    return { accept: false, refusal: 'too_low', score };
  }
  if (score > TRADE_AGREEMENT_ACCEPT_THRESHOLD + TRADE_AGREEMENT_FUZZ_BAND) {
    return { accept: true, refusal: null, score };
  }
  const margin = (score - TRADE_AGREEMENT_ACCEPT_THRESHOLD) / TRADE_AGREEMENT_FUZZ_BAND;
  const acceptChance = 0.5 + margin * 0.5;
  if (rng() < acceptChance) {
    return { accept: true, refusal: null, score };
  }
  return { accept: false, refusal: 'too_low', score };
}

/** Push the agreement onto state.treaties. First payout happens on the
 *  next `tickTreaties(state, provider)` call — no immediate transfer. */
export function applyTradeAgreement(
  offer: TradeAgreementOffer,
  state: { treaties: Treaty[]; nextTreatyId: number },
  startTurn: number
): Treaty {
  const treaty: Treaty = {
    kind: 'trade_agreement',
    id: state.nextTreatyId++,
    provider: offer.provider,
    consumer: offer.consumer,
    resource: offer.resource,
    amountPerTurn: offer.amountPerTurn,
    goldPerTurn: offer.goldPerTurn,
    startTurn,
    turnsRemaining: Math.min(offer.duration, TRADE_AGREEMENT_MAX_DURATION),
  };
  state.treaties.push(treaty);
  return treaty;
}

/** Suggested default per-turn gold for an aether agreement — same
 *  reservation price as one-shot trades, applied per turn. UI uses this
 *  to pre-fill the gold/turn input. */
export function suggestedAgreementGold(amountPerTurn: number): number {
  return Math.round(amountPerTurn * TRADE_AETHER_BASE_VALUE * 1.25);
}

// --- Per-turn tick + war/death breakage ----------------------------------

export type TreatyBreakReason =
  | 'completed'
  | 'failed_to_deliver'
  | 'failed_to_pay'
  | 'war'
  | 'cancelled'
  | 'partner_lost';

export interface TreatyTickEvent {
  treaty: Treaty;
  kind: 'transferred' | 'broken';
  reason?: TreatyBreakReason;
}

/** Process one game-turn's worth of trade-agreement payouts for treaties
 *  where `faction` is the provider. Provider-side gating keeps each
 *  agreement firing exactly once per game-turn even though both parties
 *  take faction-turns. Returns events the caller can map to voice lines.
 *
 *  This is the **only** site that mutates faction resources for trade
 *  agreements or decrements `turnsRemaining` (decision-log item 16). */
export function tickTreaties(
  state: { treaties: Treaty[]; factions: Faction[] },
  faction: Faction
): TreatyTickEvent[] {
  const events: TreatyTickEvent[] = [];
  const keep: Treaty[] = [];
  for (const t of state.treaties) {
    if (t.kind !== 'trade_agreement' || t.provider !== faction.idx) {
      keep.push(t);
      continue;
    }
    const consumerFaction = state.factions[t.consumer];
    if (!consumerFaction || !consumerFaction.alive) {
      events.push({ treaty: t, kind: 'broken', reason: 'partner_lost' });
      continue;
    }
    if (faction.resources.aether < t.amountPerTurn) {
      events.push({ treaty: t, kind: 'broken', reason: 'failed_to_deliver' });
      continue;
    }
    if (consumerFaction.resources.gold < t.goldPerTurn) {
      events.push({ treaty: t, kind: 'broken', reason: 'failed_to_pay' });
      continue;
    }
    faction.resources.aether -= t.amountPerTurn;
    consumerFaction.resources.aether += t.amountPerTurn;
    consumerFaction.resources.gold -= t.goldPerTurn;
    faction.resources.gold += t.goldPerTurn;
    const next: Treaty = { ...t, turnsRemaining: t.turnsRemaining - 1 };
    if (next.turnsRemaining <= 0) {
      events.push({ treaty: next, kind: 'broken', reason: 'completed' });
      continue;
    }
    events.push({ treaty: next, kind: 'transferred' });
    keep.push(next);
  }
  state.treaties = keep;
  return events;
}

/** Splice out trade agreements between two parties (either direction).
 *  Called by sites that declare war (diploAI war-trigger, combat.ts
 *  attack-spawned war, player declare-war button). Alliances are NOT
 *  touched here — alliance-vs-alliance war is a deliberate joint act
 *  that doesn't break the underlying pact. */
export function breakTradeAgreementsOnWar(
  state: { treaties: Treaty[] },
  factionIdx: FactionIdx,
  otherIdx: FactionIdx
): Treaty[] {
  const broken: Treaty[] = [];
  state.treaties = state.treaties.filter((t) => {
    if (t.kind !== 'trade_agreement') return true;
    const between =
      (t.provider === factionIdx && t.consumer === otherIdx) ||
      (t.provider === otherIdx && t.consumer === factionIdx);
    if (between) {
      broken.push(t);
      return false;
    }
    return true;
  });
  return broken;
}

/** Remove a treaty by id. Returns the removed treaty (or null if not
 *  found). Used by the player-side cancel button. Does NOT mutate
 *  resources or diplo — caller decides on grudge / voice. */
export function cancelTreaty(
  state: { treaties: Treaty[] },
  treatyId: number
): Treaty | null {
  const idx = state.treaties.findIndex((t) => t.id === treatyId);
  if (idx < 0) return null;
  const [removed] = state.treaties.splice(idx, 1);
  return removed;
}
