// AI diplomacy. Each turn:
//   - Convert 'unmet' → 'peace' on first sighting (a faction's city visible
//     to the other side).
//   - Score each known relationship and probabilistically transition
//     peace ↔ war based on grudges, military ratio, personality aggression,
//     and a cooldown after the last declaration.
//   - Consider proposing a gold-for-tech trade or demanding tribute, after
//     the peace/war pass so any war declared this turn rules out a trade.
//   - Decay grudges by 1 per turn.
//
// aiTelegraph() emits a flavor-text warning to the player when the AI is
// massing military units near them. Phase 2b: war/peace triggers, telegraph
// trigger, and telegraph line pick all draw from the seeded game rng so a
// recorded action stream replays identically. Phase 3 S9a: AI-initiated
// trade and tribute draws also go through the seeded rng for the same
// reason.

import { hexDistance } from '../core/hex';
import { log } from '../core/log';
import { G, getCityAt } from '../core/state';
import { getGameRng } from '../core/rng';
import type { Faction, TechId } from '../core/types';
import { UNIT_TYPES } from '../data/units';
import { TECHS } from '../data/techs';
import { AI_THINKING_LINES } from '../data/personalities';
import { getDiplomacyVoice } from '../data/diplomacyVoice';
import { aiFactionMilitaryStrength, effectiveAgg } from './strategy';
import { resolveBehavior } from './behavior';
import {
  alliancesBetween,
  alliancesInvolving,
  applyAlliance,
  applyTrade,
  applyTradeAgreement,
  applyTribute,
  breakAlliancesOnPeace,
  breakTradeAgreementsOnWar,
  evaluateAlliance,
  evaluateTrade,
  evaluateTradeAgreement,
  evaluateTribute,
  suggestedAgreementGold,
  suggestedTechPrice,
  suggestedTribute,
  TRIBUTE_DEFIANCE_GRUDGE,
  type AllianceOffer,
  type TradeAgreementOffer,
  type TradeOffer,
  type TributeDemand,
} from '../systems/diplomacy';

const WAR_DECLARATION_COOLDOWN_TURNS = 8;
const WAR_DECLARATION_COOLDOWN_PENALTY = 50;
const WAR_THRESHOLD = 60;
const WAR_TRIGGER_CHANCE = 0.25;
const PEACE_THRESHOLD = 35;
const PEACE_TRIGGER_CHANCE = 0.2;
const PEACE_GRUDGE_FORGIVENESS = 50;
const TELEGRAPH_NEARBY_RADIUS = 5;
const TELEGRAPH_REQUIRED_NEARBY = 2;
const TELEGRAPH_CHANCE = 0.4;
const TELEGRAPH_MIN_ATK = 4;

// S9a — AI-initiated trade + tribute considerations. Kept rare so the
// event log doesn't get spammed; the agg scalar weights tribute attempts
// so Iron Legion demands more often than Verdant Pact.
const AI_TRADE_CONSIDER_CHANCE = 0.05;
const AI_TRIBUTE_CONSIDER_CHANCE = 0.06;
const AI_TRIBUTE_MIN_RATIO = 1.5;
const AI_MIN_GOLD_TO_OFFER = 300;
const AI_TARGET_MIN_GOLD_FOR_TRIBUTE = 100;

// S9b — alliance + persistent-trade considerations. Same low-frequency
// pattern; alliance has a grudge floor so the AI only proposes when it
// actually has a "common enemy worth fighting" rather than chatting up
// every peer.
const AI_ALLIANCE_CONSIDER_CHANCE = 0.04;
const AI_ALLIANCE_MIN_GRUDGE = 60;
const AI_AGREEMENT_CONSIDER_CHANCE = 0.04;
const AI_AGREEMENT_MIN_AETHER = 10;
const AI_AGREEMENT_AMOUNT_PER_TURN = 5;
const AI_AGREEMENT_DURATION = 5;
/** Bias added to the war score when `other` is the named enemy of an
 *  alliance `faction` is party to — alliances pull both parties toward
 *  joint aggression on the named foe. */
const ALLIANCE_WAR_BIAS = 30;

export function aiDiplomacy(faction: Faction): void {
  const mem = G.aiMemory[faction.idx];
  if (!mem || !G.map) return;
  const myStr = aiFactionMilitaryStrength(faction.idx);

  for (const other of G.factions) {
    if (!other.alive || other.idx === faction.idx) continue;
    const cur = faction.diplo[other.idx] || 'unmet';
    if (cur === 'unmet') {
      const sawMe = [...G.map.tiles.values()].some((t) => {
        if (!t.cityId) return false;
        const c = getCityAt(t.q, t.r);
        return c?.factionIdx === faction.idx && t.visibility[other.idx] === 'visible';
      });
      if (sawMe) {
        faction.diplo[other.idx] = 'peace';
        other.diplo[faction.idx] = 'peace';
        log(
          `${faction.name} has met ${other.name}.`,
          'diplo',
          faction.idx === G.playerFactionIdx || other.idx === G.playerFactionIdx
        );
      }
      continue;
    }
    const grudge = mem.grudges[other.idx] || 0;
    const otherStr = aiFactionMilitaryStrength(other.idx);
    const ratio = myStr / Math.max(1, otherStr);
    const agg = effectiveAgg(faction, other.idx);
    if (cur === 'peace') {
      // S9b: skip allies entirely — joint pact stays intact even if grudge
      // would otherwise trip the threshold. Bias war score *up* when other
      // is the named enemy of any alliance faction is party to.
      if (alliancesBetween(G.treaties, faction.idx, other.idx).length > 0) continue;
      const allianceBias = alliancesInvolving(G.treaties, faction.idx).some(
        (t) => t.kind === 'alliance' && t.enemy === other.idx
      )
        ? ALLIANCE_WAR_BIAS
        : 0;
      let warScore = grudge * 0.5 + agg * 30 + (ratio - 1) * 50 + allianceBias;
      if (G.turn - mem.lastDeclareWarTurn < WAR_DECLARATION_COOLDOWN_TURNS) {
        warScore -= WAR_DECLARATION_COOLDOWN_PENALTY;
      }
      if (warScore > WAR_THRESHOLD && getGameRng()() < WAR_TRIGGER_CHANCE) {
        faction.diplo[other.idx] = 'war';
        other.diplo[faction.idx] = 'war';
        mem.lastDeclareWarTurn = G.turn;
        // S9b: war between trade partners breaks the agreement immediately.
        const brokenAgreements = breakTradeAgreementsOnWar(G, faction.idx, other.idx);
        for (const t of brokenAgreements) {
          if (t.kind !== 'trade_agreement') continue;
          const partnerIdx = t.provider === faction.idx ? t.consumer : t.provider;
          const partner = G.factions[partnerIdx];
          if (partner) {
            log(
              getDiplomacyVoice(faction.id).tradeAgreementBroken(partner.name, 'war'),
              'diplo',
              partnerIdx === G.playerFactionIdx || faction.idx === G.playerFactionIdx
            );
          }
        }
        log(`${faction.name} declares war on ${other.name}!`, 'warning', true);
      }
    } else if (cur === 'war') {
      const peaceScore = (1 - ratio) * 40 + (1 - agg) * 20 - grudge * 0.3;
      if (peaceScore > PEACE_THRESHOLD && getGameRng()() < PEACE_TRIGGER_CHANCE) {
        faction.diplo[other.idx] = 'peace';
        other.diplo[faction.idx] = 'peace';
        mem.grudges[other.idx] = Math.max(
          0,
          (mem.grudges[other.idx] || 0) - PEACE_GRUDGE_FORGIVENESS
        );
        // S9b: any alliance whose named enemy was `other` breaks when
        // faction sues for peace with that enemy. Mirror on the other
        // side as well — both parties' alliance entries flush. The
        // speaker is the side this alliance entry belonged to.
        const brokenA = breakAlliancesOnPeace(G, faction.idx, other.idx).map(
          (t) => ({ t, breakerIdx: faction.idx })
        );
        const brokenB = breakAlliancesOnPeace(G, other.idx, faction.idx).map(
          (t) => ({ t, breakerIdx: other.idx })
        );
        for (const { t, breakerIdx } of [...brokenA, ...brokenB]) {
          if (t.kind !== 'alliance') continue;
          const partnerIdx = t.partyA === breakerIdx ? t.partyB : t.partyA;
          const partner = G.factions[partnerIdx];
          const breaker = G.factions[breakerIdx];
          if (partner && breaker) {
            log(
              getDiplomacyVoice(breaker.id).allianceBroken(partner.name, other.name),
              'diplo',
              partnerIdx === G.playerFactionIdx ||
                faction.idx === G.playerFactionIdx ||
                other.idx === G.playerFactionIdx
            );
          }
        }
        log(`${faction.name} sues for peace with ${other.name}.`, 'diplo', true);
      }
    }
  }
  // S9a — after war/peace updates settle, consider one-shot trades and
  // tribute demands. Iterated separately so a freshly-declared war this
  // turn rules out the proposal cleanly (the eval refuses 'hostile').
  // S9b — alliance and persistent-trade considerations slot in next to
  // the one-shots; the eval enforces the at-peace-and-at-war-with-enemy
  // pre-conditions so a freshly-rotated stance is respected.
  for (const other of G.factions) {
    if (!other.alive || other.idx === faction.idx) continue;
    aiConsiderTrade(faction, other);
    aiConsiderTribute(faction, other);
    aiConsiderAlliance(faction, other);
    aiConsiderTradeAgreement(faction, other);
  }

  for (const k of Object.keys(mem.grudges)) {
    const idx = Number(k);
    mem.grudges[idx] = Math.max(0, (mem.grudges[idx] || 0) - 1);
  }
}

function aiConsiderTrade(faction: Faction, other: Faction): void {
  if (faction.diplo[other.idx] !== 'peace') return;
  if (faction.resources.gold < AI_MIN_GOLD_TO_OFFER) return;
  const rng = getGameRng();
  if (rng() >= AI_TRADE_CONSIDER_CHANCE) return;

  const candidates: TechId[] = [];
  for (const t of other.techs) {
    if (faction.techs.has(t)) continue;
    candidates.push(t);
  }
  if (candidates.length === 0) return;
  const techId = candidates[Math.floor(rng() * candidates.length)];
  const ask = suggestedTechPrice(techId);
  if (faction.resources.gold < ask) return;

  const proposerStrength = aiFactionMilitaryStrength(faction.idx);
  const targetStrength = aiFactionMilitaryStrength(other.idx);
  const offer: TradeOffer = {
    kind: 'gold_for_tech',
    proposer: faction.idx,
    target: other.idx,
    goldOffered: ask,
    techId,
  };
  const decision = evaluateTrade(
    offer,
    faction,
    other,
    proposerStrength,
    targetStrength,
    G.aiMemory[other.idx],
    rng
  );
  const visible =
    faction.idx === G.playerFactionIdx || other.idx === G.playerFactionIdx;
  if (decision.accept) {
    applyTrade(offer, faction, other);
    log(getDiplomacyVoice(faction.id).weBought(other.name, TECHS[techId].name, ask), 'diplo', visible);
  }
  // Silent on refusal — refused offers happen often enough at the 5%
  // chance + threshold-band rng that logging each would drown the
  // other diplomacy events. Tribute refusals, which are louder events,
  // do log.
}

function aiConsiderTribute(faction: Faction, other: Faction): void {
  if (faction.diplo[other.idx] !== 'peace') return;
  if (other.resources.gold < AI_TARGET_MIN_GOLD_FOR_TRIBUTE) return;
  const proposerStrength = aiFactionMilitaryStrength(faction.idx);
  const targetStrength = aiFactionMilitaryStrength(other.idx);
  if (proposerStrength / Math.max(1, targetStrength) < AI_TRIBUTE_MIN_RATIO) return;

  const beh = resolveBehavior(faction);
  const rng = getGameRng();
  // Aggression scales the consider chance — Iron Legion (agg 0.85) hits
  // ~10% per turn per credible target; Verdant Pact (agg 0.15) ~2%.
  if (rng() >= AI_TRIBUTE_CONSIDER_CHANCE * beh.agg * 2) return;

  const demanded = suggestedTribute(other);
  const demand: TributeDemand = {
    demander: faction.idx,
    target: other.idx,
    goldDemanded: demanded,
  };
  const decision = evaluateTribute(
    demand,
    faction,
    other,
    proposerStrength,
    targetStrength,
    G.aiMemory[other.idx],
    rng
  );
  const visible =
    faction.idx === G.playerFactionIdx || other.idx === G.playerFactionIdx;
  if (decision.accept) {
    applyTribute(demand, faction, other);
    log(getDiplomacyVoice(faction.id).weReceivedTribute(other.name, demanded), 'diplo', visible);
  } else {
    const memDem = G.aiMemory[faction.idx];
    if (memDem) {
      memDem.grudges[other.idx] = (memDem.grudges[other.idx] ?? 0) + TRIBUTE_DEFIANCE_GRUDGE;
    }
    log(getDiplomacyVoice(faction.id).ourTributeRefused(other.name), 'diplo', visible);
  }
}

function aiConsiderAlliance(faction: Faction, other: Faction): void {
  if (faction.diplo[other.idx] !== 'peace') return;
  const mem = G.aiMemory[faction.idx];
  if (!mem) return;

  // Pick the highest-grudge enemy that faction is at war with — the
  // "common enemy" candidate — BEFORE drawing rng. Burning rng when no
  // eligible enemy exists would shift the seeded cursor relative to S9a
  // tests (mirrors aiConsiderTrade's cheap-guards-first ordering).
  let enemyIdx: number | null = null;
  let topGrudge = -1;
  for (const k of Object.keys(mem.grudges)) {
    const idx = Number(k);
    if (idx === other.idx) continue;
    if (faction.diplo[idx] !== 'war') continue;
    const g = mem.grudges[idx] ?? 0;
    if (g >= AI_ALLIANCE_MIN_GRUDGE && g > topGrudge) {
      topGrudge = g;
      enemyIdx = idx;
    }
  }
  if (enemyIdx === null) return;
  const enemy = G.factions[enemyIdx];
  if (!enemy || !enemy.alive) return;

  const rng = getGameRng();
  if (rng() >= AI_ALLIANCE_CONSIDER_CHANCE) return;

  const offer: AllianceOffer = {
    proposer: faction.idx,
    target: other.idx,
    enemy: enemy.idx,
  };
  const proposerStr = aiFactionMilitaryStrength(faction.idx);
  const targetStr = aiFactionMilitaryStrength(other.idx);
  const enemyStr = aiFactionMilitaryStrength(enemy.idx);
  const decision = evaluateAlliance(
    offer,
    faction,
    other,
    proposerStr + targetStr,
    enemyStr,
    G.aiMemory[other.idx],
    G.treaties,
    rng
  );
  const visible =
    faction.idx === G.playerFactionIdx ||
    other.idx === G.playerFactionIdx ||
    enemy.idx === G.playerFactionIdx;
  if (decision.accept) {
    applyAlliance(offer, faction, other, enemy, G, G.turn);
    log(
      getDiplomacyVoice(faction.id).proposeAlliance(other.name, enemy.name),
      'diplo',
      visible
    );
  } else {
    // Refusal silent (low-frequency event, log fills fast); the AI bears
    // the small social cost via the existing aiMemory pathway when
    // grudges drift.
  }
}

function aiConsiderTradeAgreement(faction: Faction, other: Faction): void {
  if (faction.diplo[other.idx] !== 'peace') return;
  if (other.resources.aether < AI_AGREEMENT_MIN_AETHER) return;
  if (faction.resources.gold < AI_MIN_GOLD_TO_OFFER) return;
  const rng = getGameRng();
  if (rng() >= AI_AGREEMENT_CONSIDER_CHANCE) return;

  // Faction is buying aether from other (faction = consumer, other = provider).
  const amount = AI_AGREEMENT_AMOUNT_PER_TURN;
  const gold = suggestedAgreementGold(amount);
  if (faction.resources.gold < gold) return;
  const offer: TradeAgreementOffer = {
    proposer: faction.idx,
    target: other.idx,
    provider: other.idx,
    consumer: faction.idx,
    resource: 'aether',
    amountPerTurn: amount,
    goldPerTurn: gold,
    duration: AI_AGREEMENT_DURATION,
  };
  const decision = evaluateTradeAgreement(
    offer,
    faction,
    other,
    G.aiMemory[other.idx],
    G.treaties,
    rng
  );
  const visible =
    faction.idx === G.playerFactionIdx || other.idx === G.playerFactionIdx;
  if (decision.accept) {
    applyTradeAgreement(offer, G, G.turn);
    log(
      getDiplomacyVoice(faction.id).proposeTradeAgreement(
        other.name,
        amount,
        gold,
        AI_AGREEMENT_DURATION
      ),
      'diplo',
      visible
    );
  }
  // Silent refusal — same reasoning as aiConsiderTrade.
}

export function aiTelegraph(faction: Faction): void {
  if (faction.idx === G.playerFactionIdx) return;
  const player = G.factions[G.playerFactionIdx];
  if (!player.alive) return;
  if (faction.diplo[G.playerFactionIdx] !== 'war') return;

  const playerSighted: { q: number; r: number }[] = G.units
    .filter((u) => u.factionIdx === G.playerFactionIdx)
    .map((u) => ({ q: u.q, r: u.r }));
  for (const c of G.cities) {
    if (c.factionIdx === G.playerFactionIdx) playerSighted.push({ q: c.q, r: c.r });
  }
  const aiMil = G.units.filter(
    (u) => u.factionIdx === faction.idx && UNIT_TYPES[u.typeId].atk >= TELEGRAPH_MIN_ATK
  );
  let nearbyCount = 0;
  for (const m of aiMil) {
    for (const ps of playerSighted) {
      if (hexDistance(m, ps) <= TELEGRAPH_NEARBY_RADIUS) {
        nearbyCount++;
        break;
      }
    }
  }
  const rng = getGameRng();
  if (nearbyCount >= TELEGRAPH_REQUIRED_NEARBY && rng() < TELEGRAPH_CHANCE) {
    const lines = AI_THINKING_LINES[faction.personality];
    const line = lines[Math.floor(rng() * lines.length)];
    log(
      `${faction.name} ${line.replace('...', '')} — ${nearbyCount} hostile companies near your borders.`,
      'warning',
      true
    );
  }
}
