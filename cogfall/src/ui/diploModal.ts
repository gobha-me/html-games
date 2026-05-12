// Diplomacy modal — list other factions, show status + grudge mood +
// power, with declare-war / offer-peace buttons. The peace acceptance
// formula matches the prototype's: a deterministic score plus a 30%
// random-accept chance, modified by personality aggression.
//
// Phase 3 S9a — player-initiated trades and tribute demands wire
// through this same screen. Clicking "Offer Trade…" or "Demand
// Tribute…" expands an inline sub-panel inside the faction row;
// submitting routes through systems/diplomacy's evaluate/apply
// functions and re-renders. Player rolls use Math.random per
// decision-log item 2 (replay-parity side channel — don't thread
// the seeded rng through these paths).

import { log } from '../core/log';
import { DOM_IDS } from '../core/dom';
import { G } from '../core/state';
import type { FactionId, FactionIdx, TechId } from '../core/types';
import { TECHS } from '../data/techs';
import { getDiplomacyVoice } from '../data/diplomacyVoice';
import { resolveBehavior } from '../ai/behavior';
import { aiFactionMilitaryStrength } from '../ai/strategy';
import {
  applyAlliance,
  applyTrade,
  applyTradeAgreement,
  applyTribute,
  breakAlliancesOnPeace,
  breakTradeAgreementsOnWar,
  cancelTreaty,
  evaluateAlliance,
  evaluateTrade,
  evaluateTradeAgreement,
  evaluateTribute,
  suggestedAetherPrice,
  suggestedAgreementGold,
  suggestedTechPrice,
  suggestedTribute,
  TRADE_AGREEMENT_MAX_DURATION,
  TRADE_REFUSAL_GRUDGE,
  TRIBUTE_DEFIANCE_GRUDGE,
  type AllianceOffer,
  type TradeAgreementOffer,
  type TradeOffer,
  type TradeRefusal,
  type TributeDemand,
  type TributeRefusal,
} from '../systems/diplomacy';
import { updateUI } from './topbar';

const RANDOM_PEACE_ACCEPT_CHANCE = 0.3;
const PLAYER_DECLARE_WAR_GRUDGE = 30;
const AETHER_TRADE_LOT = 20;
const DEFAULT_AGREEMENT_AMOUNT = 5;
const DEFAULT_AGREEMENT_DURATION = 5;
/** Grudge bump when the player cancels a treaty unilaterally — small,
 *  because cancellation is a known social cost but not as offensive as
 *  a tribute refusal. */
const PLAYER_CANCEL_GRUDGE = 8;

type ActionPanel =
  | null
  | { kind: 'trade'; factionIdx: FactionIdx }
  | { kind: 'tribute'; factionIdx: FactionIdx }
  | { kind: 'alliance'; factionIdx: FactionIdx }
  | { kind: 'tradeAgreement'; factionIdx: FactionIdx };

let activePanel: ActionPanel = null;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderDiploScreen(): void {
  const player = G.factions[G.playerFactionIdx];
  let html = renderActivePacts(player.idx);
  for (const f of G.factions) {
    if (f.idx === player.idx || !f.alive) continue;
    const status = player.diplo[f.idx] || 'unmet';
    const grudge = G.aiMemory[f.idx]?.grudges[player.idx] || 0;
    const myStr = Math.round(aiFactionMilitaryStrength(player.idx));
    const theirStr = Math.round(aiFactionMilitaryStrength(f.idx));
    let mood = '';
    if (status === 'unmet') mood = 'Not yet met.';
    else if (grudge > 50) mood = `<span style="color:var(--danger)">Holds a deep grudge.</span>`;
    else if (grudge > 20) mood = `<span style="color:var(--rust)">Wary, suspicious.</span>`;
    else mood = `<span style="color:var(--parchment-d)">Calm — for now.</span>`;
    html += `<div class="diplo-row">`;
    html += `<div class="swatch" style="background:${f.color}33;border-color:${f.color}">${f.glyph}</div>`;
    html += `<div class="info"><div class="name" style="color:${f.color}">${f.name}</div>`;
    html += `<div class="status status-${status}">${status.toUpperCase()}</div>`;
    html += `<div style="font-size:11px;color:var(--parchment-d);margin-top:2px">${mood} · Power: ${theirStr} (yours: ${myStr})</div>`;
    html += `</div>`;
    html += `<div class="actions">`;
    if (status === 'peace') {
      html += `<button class="btn small" onclick="openTradePanel(${f.idx})">Offer Trade…</button>`;
      if (f.resources.aether >= DEFAULT_AGREEMENT_AMOUNT * 2) {
        html += `<button class="btn small" onclick="openAgreementPanel(${f.idx})">Propose Agreement…</button>`;
      }
      // Alliance proposal available when the player has at least one
      // known faction at war — that's the credible common-enemy list.
      if (listAllianceCandidates(player.idx, f.idx).length > 0) {
        html += `<button class="btn small" onclick="openAlliancePanel(${f.idx})">Propose Alliance…</button>`;
      }
      if (myStr > theirStr) {
        html += `<button class="btn small" onclick="openTributePanel(${f.idx})">Demand Tribute…</button>`;
      }
      html += `<button class="btn small danger" onclick="declareWar(${f.idx})">Declare War</button>`;
    } else if (status === 'war') {
      html += `<button class="btn small" onclick="offerPeace(${f.idx})">Offer Peace</button>`;
    }
    html += `</div></div>`;

    if (activePanel && activePanel.factionIdx === f.idx) {
      html += renderActionPanel(f.idx);
    }
  }
  if (!html)
    html = '<p style="color:var(--parchment-d);font-style:italic">No other banners stand.</p>';
  const content = document.getElementById(DOM_IDS.DIPLO_CONTENT);
  if (content) content.innerHTML = html;
}

/** Candidate "common enemies" for an alliance proposal: every faction the
 *  player is at war with, excluding the target. Used both to gate the
 *  Propose Alliance button and to populate the sub-panel dropdown. */
function listAllianceCandidates(
  playerIdx: FactionIdx,
  targetIdx: FactionIdx
): FactionIdx[] {
  const player = G.factions[playerIdx];
  const out: FactionIdx[] = [];
  for (const f of G.factions) {
    if (!f.alive) continue;
    if (f.idx === playerIdx || f.idx === targetIdx) continue;
    if (player.diplo[f.idx] === 'war') out.push(f.idx);
  }
  return out;
}

function renderActivePacts(playerIdx: FactionIdx): string {
  const mine = G.treaties.filter((t) => {
    if (t.kind === 'alliance') return t.partyA === playerIdx || t.partyB === playerIdx;
    return t.provider === playerIdx || t.consumer === playerIdx;
  });
  if (mine.length === 0) return '';
  let html = `<div style="margin:0 0 14px 0;padding:8px 10px;border:1px dashed var(--parchment-d);border-radius:4px">`;
  html += `<div style="font-size:12px;color:var(--parchment-d);margin-bottom:6px">Active Pacts</div>`;
  for (const t of mine) {
    if (t.kind === 'alliance') {
      const partnerIdx = t.partyA === playerIdx ? t.partyB : t.partyA;
      const partner = G.factions[partnerIdx];
      const enemy = G.factions[t.enemy];
      if (!partner || !enemy) continue;
      html += `<div style="display:flex;align-items:center;justify-content:space-between;margin:4px 0">`;
      html += `<span><strong>Alliance</strong> with <span style="color:${partner.color}">${escapeHtml(
        partner.name
      )}</span> against <span style="color:${enemy.color}">${escapeHtml(enemy.name)}</span></span>`;
      html += `<button class="btn small danger" onclick="cancelMyTreaty(${t.id})">Break</button>`;
      html += `</div>`;
    } else {
      const partnerIdx = t.provider === playerIdx ? t.consumer : t.provider;
      const partner = G.factions[partnerIdx];
      if (!partner) continue;
      const role = t.provider === playerIdx ? 'shipping' : 'receiving';
      html += `<div style="display:flex;align-items:center;justify-content:space-between;margin:4px 0">`;
      html += `<span><strong>Trade Agreement</strong> ${role} ${t.amountPerTurn} aether / ${t.goldPerTurn} gold per turn with <span style="color:${partner.color}">${escapeHtml(
        partner.name
      )}</span> · ${t.turnsRemaining} turn(s) left</span>`;
      html += `<button class="btn small danger" onclick="cancelMyTreaty(${t.id})">Break</button>`;
      html += `</div>`;
    }
  }
  html += `</div>`;
  return html;
}

function renderActionPanel(idx: FactionIdx): string {
  if (!activePanel) return '';
  const target = G.factions[idx];
  if (activePanel.kind === 'trade') {
    const tradableTechs: TechId[] = [];
    for (const t of target.techs) {
      if (G.factions[G.playerFactionIdx].techs.has(t)) continue;
      tradableTechs.push(t);
    }
    let inner = `<div class="diplo-action-panel" style="margin:6px 0 14px 56px;padding:10px;border:1px dashed var(--parchment-d);border-radius:4px">`;
    inner += `<div style="font-size:12px;color:var(--parchment-d);margin-bottom:8px">Treat with <strong style="color:${target.color}">${escapeHtml(
      target.name
    )}</strong> — bring coin, leave with what they hold.</div>`;
    if (tradableTechs.length === 0 && target.resources.aether < AETHER_TRADE_LOT) {
      inner += `<div style="font-style:italic;color:var(--parchment-d)">Their stores hold nothing you lack.</div>`;
    } else {
      for (const techId of tradableTechs) {
        const price = suggestedTechPrice(techId);
        const t = TECHS[techId];
        const canAfford = G.factions[G.playerFactionIdx].resources.gold >= price;
        inner += `<div style="display:flex;align-items:center;justify-content:space-between;margin:4px 0">`;
        inner += `<span><strong>${escapeHtml(t.name)}</strong> <span style="color:var(--parchment-d);font-size:11px">(${t.branch})</span></span>`;
        inner += `<button class="btn small${canAfford ? '' : ' disabled'}" ${
          canAfford ? `onclick="proposeTechTrade(${idx}, '${techId}', ${price})"` : 'disabled'
        }>Buy for ${price}g</button>`;
        inner += `</div>`;
      }
      if (target.resources.aether >= AETHER_TRADE_LOT) {
        const aetherPrice = suggestedAetherPrice(AETHER_TRADE_LOT);
        const canAfford = G.factions[G.playerFactionIdx].resources.gold >= aetherPrice;
        inner += `<div style="display:flex;align-items:center;justify-content:space-between;margin:4px 0">`;
        inner += `<span><strong>${AETHER_TRADE_LOT} ✦ aether</strong> <span style="color:var(--parchment-d);font-size:11px">(they hold ${target.resources.aether})</span></span>`;
        inner += `<button class="btn small${canAfford ? '' : ' disabled'}" ${
          canAfford
            ? `onclick="proposeAetherTrade(${idx}, ${AETHER_TRADE_LOT}, ${aetherPrice})"`
            : 'disabled'
        }>Buy for ${aetherPrice}g</button>`;
        inner += `</div>`;
      }
    }
    inner += `<div style="text-align:right;margin-top:8px"><button class="btn small" onclick="closeActionPanel()">Done</button></div>`;
    inner += `</div>`;
    return inner;
  }
  if (activePanel.kind === 'alliance') {
    return renderAlliancePanel(idx);
  }
  if (activePanel.kind === 'tradeAgreement') {
    return renderAgreementPanel(idx);
  }
  // Tribute panel
  const suggested = suggestedTribute(target);
  const canPay = target.resources.gold >= suggested;
  let inner = `<div class="diplo-action-panel" style="margin:6px 0 14px 56px;padding:10px;border:1px dashed var(--parchment-d);border-radius:4px">`;
  inner += `<div style="font-size:12px;color:var(--parchment-d);margin-bottom:8px">Stand under their gates and ask what their coin is worth. Suggested demand: <strong>${suggested}g</strong>.</div>`;
  inner += `<div style="display:flex;align-items:center;gap:8px">`;
  inner += `<input type="number" id="tribute-amount" value="${suggested}" min="1" step="1" style="width:120px">`;
  inner += `<button class="btn small${canPay ? '' : ' disabled'}" onclick="submitTributeDemand(${idx})">Demand</button>`;
  inner += `<button class="btn small" onclick="closeActionPanel()">Cancel</button>`;
  inner += `</div>`;
  if (!canPay) {
    inner += `<div style="font-size:11px;color:var(--rust);margin-top:6px">Their treasury holds only ${target.resources.gold}g — they cannot pay the suggested amount.</div>`;
  }
  inner += `</div>`;
  return inner;
}

function renderAlliancePanel(idx: FactionIdx): string {
  const target = G.factions[idx];
  const candidates = listAllianceCandidates(G.playerFactionIdx, idx);
  let inner = `<div class="diplo-action-panel" style="margin:6px 0 14px 56px;padding:10px;border:1px dashed var(--parchment-d);border-radius:4px">`;
  inner += `<div style="font-size:12px;color:var(--parchment-d);margin-bottom:8px">Propose a joint pact with <strong style="color:${target.color}">${escapeHtml(
    target.name
  )}</strong> against a common foe — your wars become theirs.</div>`;
  if (candidates.length === 0) {
    inner += `<div style="font-style:italic;color:var(--parchment-d)">You stand at peace with all your neighbours; there is no enemy to name.</div>`;
  } else {
    inner += `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">`;
    inner += `<label style="font-size:12px;color:var(--parchment-d)">Against:</label>`;
    inner += `<select id="alliance-enemy" style="min-width:160px">`;
    for (const e of candidates) {
      const enemy = G.factions[e];
      inner += `<option value="${e}">${escapeHtml(enemy.name)}</option>`;
    }
    inner += `</select>`;
    inner += `<button class="btn small" onclick="submitAllianceProposal(${idx})">Propose</button>`;
    inner += `<button class="btn small" onclick="closeActionPanel()">Cancel</button>`;
    inner += `</div>`;
    inner += `<div style="font-size:11px;color:var(--parchment-d);margin-top:6px">Accepting means immediate joint war with the named foe.</div>`;
  }
  inner += `</div>`;
  return inner;
}

function renderAgreementPanel(idx: FactionIdx): string {
  const target = G.factions[idx];
  const defaultAmount = DEFAULT_AGREEMENT_AMOUNT;
  const defaultGold = suggestedAgreementGold(defaultAmount);
  const haveAether = target.resources.aether;
  const maxDuration = TRADE_AGREEMENT_MAX_DURATION;
  let inner = `<div class="diplo-action-panel" style="margin:6px 0 14px 56px;padding:10px;border:1px dashed var(--parchment-d);border-radius:4px">`;
  inner += `<div style="font-size:12px;color:var(--parchment-d);margin-bottom:8px">Strike a standing arrangement with <strong style="color:${target.color}">${escapeHtml(
    target.name
  )}</strong>: aether shipped, coin paid, season after season.</div>`;
  inner += `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px">`;
  inner += `<label>Aether/turn: <input type="number" id="agreement-amount" value="${defaultAmount}" min="1" max="${haveAether}" step="1" style="width:70px"></label>`;
  inner += `<label>Gold/turn: <input type="number" id="agreement-gold" value="${defaultGold}" min="1" step="1" style="width:90px"></label>`;
  inner += `<label>Turns: <input type="number" id="agreement-turns" value="${DEFAULT_AGREEMENT_DURATION}" min="1" max="${maxDuration}" step="1" style="width:70px"></label>`;
  inner += `<button class="btn small" onclick="submitAgreementProposal(${idx})">Propose</button>`;
  inner += `<button class="btn small" onclick="closeActionPanel()">Cancel</button>`;
  inner += `</div>`;
  inner += `<div style="font-size:11px;color:var(--parchment-d);margin-top:6px">They hold ${haveAether} ✦. Default ${defaultGold}g/turn is one-and-a-quarter market rate.</div>`;
  inner += `</div>`;
  return inner;
}

function declareWar(idx: FactionIdx): void {
  const player = G.factions[G.playerFactionIdx];
  const target = G.factions[idx];
  player.diplo[idx] = 'war';
  target.diplo[player.idx] = 'war';
  const mem = G.aiMemory[idx];
  if (mem) {
    mem.grudges[player.idx] = (mem.grudges[player.idx] || 0) + PLAYER_DECLARE_WAR_GRUDGE;
  }
  // S9b: war with a trade partner breaks the agreement immediately.
  // Target speaks the break line — they reacted to your declaration.
  const broken = breakTradeAgreementsOnWar(G, player.idx, idx);
  for (const t of broken) {
    if (t.kind !== 'trade_agreement') continue;
    log(
      getDiplomacyVoice(target.id).tradeAgreementBroken(player.name, 'war'),
      'diplo'
    );
  }
  log(`You declared war on ${target.name}!`, 'warning');
  activePanel = null;
  renderDiploScreen();
  updateUI();
}

function offerPeace(idx: FactionIdx): void {
  const player = G.factions[G.playerFactionIdx];
  const other = G.factions[idx];
  const grudge = G.aiMemory[idx]?.grudges[player.idx] || 0;
  const myStr = aiFactionMilitaryStrength(player.idx);
  const theirStr = aiFactionMilitaryStrength(idx);
  const ratio = theirStr / Math.max(1, myStr);
  let acceptScore = 20 - grudge * 0.3 + (ratio < 0.7 ? 40 : 0) + (ratio > 1.3 ? -20 : 0);
  if (resolveBehavior(other).agg > 0.7) acceptScore -= 20;
  if (acceptScore > 0 || Math.random() < RANDOM_PEACE_ACCEPT_CHANCE) {
    player.diplo[idx] = 'peace';
    other.diplo[player.idx] = 'peace';
    // S9b: alliances whose named enemy was `other` break when peace is
    // struck with that enemy. Check from both sides — either party in
    // the alliance might have routed peace through this same `other`.
    // The partner speaks the break line (they watched the player drop
    // their part of the pact).
    const brokenA = breakAlliancesOnPeace(G, player.idx, idx);
    const brokenB = breakAlliancesOnPeace(G, idx, player.idx);
    for (const t of [...brokenA, ...brokenB]) {
      if (t.kind !== 'alliance') continue;
      const partnerIdx = t.partyA === player.idx ? t.partyB : t.partyA;
      const partner = G.factions[partnerIdx];
      if (partner) {
        log(
          getDiplomacyVoice(partner.id).allianceBroken(player.name, other.name),
          'diplo'
        );
      }
    }
    log(`${other.name} accepted your offer of peace.`, 'diplo');
  } else {
    log(`${other.name} rejected your offer of peace. The war drags on.`, 'warning');
  }
  renderDiploScreen();
  updateUI();
}

function openTradePanel(idx: FactionIdx): void {
  activePanel = { kind: 'trade', factionIdx: idx };
  renderDiploScreen();
}

function openTributePanel(idx: FactionIdx): void {
  activePanel = { kind: 'tribute', factionIdx: idx };
  renderDiploScreen();
}

function openAlliancePanel(idx: FactionIdx): void {
  activePanel = { kind: 'alliance', factionIdx: idx };
  renderDiploScreen();
}

function openAgreementPanel(idx: FactionIdx): void {
  activePanel = { kind: 'tradeAgreement', factionIdx: idx };
  renderDiploScreen();
}

function closeActionPanel(): void {
  activePanel = null;
  renderDiploScreen();
}

function tradeRefusalLine(refusal: TradeRefusal | null, target: { id: FactionId; name: string }): string {
  const v = getDiplomacyVoice(target.id);
  switch (refusal) {
    case 'too_low':
      return v.refuseTradeTooLow();
    case 'hostile':
      return v.refuseTradeHostile();
    case 'unavailable':
      return `${target.name} has nothing to trade you.`;
    case 'unaffordable':
      return `You cannot afford that offer.`;
    case 'invalid':
      return `The offer was malformed.`;
    default:
      return `${target.name} refused the trade.`;
  }
}

function tributeRefusalLine(refusal: TributeRefusal | null, target: { id: FactionId; name: string }): string {
  const v = getDiplomacyVoice(target.id);
  switch (refusal) {
    case 'defiant':
      return v.refuseTributeDefiant();
    case 'insufficient_threat':
      return v.refuseTributeUnafraid();
    case 'cannot_pay':
      return `${target.name}'s treasury is too thin to meet your demand.`;
    case 'invalid':
      return `The demand was malformed.`;
    default:
      return `${target.name} refused tribute.`;
  }
}

function proposeTechTrade(idx: FactionIdx, techId: TechId, goldOffered: number): void {
  const player = G.factions[G.playerFactionIdx];
  const target = G.factions[idx];
  const offer: TradeOffer = {
    kind: 'gold_for_tech',
    proposer: player.idx,
    target: target.idx,
    goldOffered,
    techId,
  };
  const decision = evaluateTrade(
    offer,
    player,
    target,
    aiFactionMilitaryStrength(player.idx),
    aiFactionMilitaryStrength(target.idx),
    G.aiMemory[target.idx],
    Math.random
  );
  if (decision.accept) {
    applyTrade(offer, player, target);
    log(getDiplomacyVoice(target.id).sellTech(TECHS[techId].name, goldOffered), 'diplo');
  } else {
    bumpRefusalGrudge(idx);
    log(tradeRefusalLine(decision.refusal, target), 'warning');
  }
  renderDiploScreen();
  updateUI();
}

function proposeAetherTrade(idx: FactionIdx, amount: number, goldOffered: number): void {
  const player = G.factions[G.playerFactionIdx];
  const target = G.factions[idx];
  const offer: TradeOffer = {
    kind: 'gold_for_resource',
    proposer: player.idx,
    target: target.idx,
    goldOffered,
    resource: 'aether',
    resourceAmount: amount,
  };
  const decision = evaluateTrade(
    offer,
    player,
    target,
    aiFactionMilitaryStrength(player.idx),
    aiFactionMilitaryStrength(target.idx),
    G.aiMemory[target.idx],
    Math.random
  );
  if (decision.accept) {
    applyTrade(offer, player, target);
    log(getDiplomacyVoice(target.id).sellAether(amount, goldOffered), 'diplo');
  } else {
    bumpRefusalGrudge(idx);
    log(tradeRefusalLine(decision.refusal, target), 'warning');
  }
  renderDiploScreen();
  updateUI();
}

function submitTributeDemand(idx: FactionIdx): void {
  const input = document.getElementById('tribute-amount') as HTMLInputElement | null;
  const amount = input ? Math.floor(Number(input.value) || 0) : 0;
  if (amount <= 0) return;
  const player = G.factions[G.playerFactionIdx];
  const target = G.factions[idx];
  const demand: TributeDemand = {
    demander: player.idx,
    target: target.idx,
    goldDemanded: amount,
  };
  const decision = evaluateTribute(
    demand,
    player,
    target,
    aiFactionMilitaryStrength(player.idx),
    aiFactionMilitaryStrength(target.idx),
    G.aiMemory[target.idx],
    Math.random
  );
  if (decision.accept) {
    applyTribute(demand, player, target);
    log(getDiplomacyVoice(target.id).payTribute(amount), 'diplo');
  } else {
    bumpDefianceGrudge(idx);
    log(tributeRefusalLine(decision.refusal, target), 'warning');
  }
  activePanel = null;
  renderDiploScreen();
  updateUI();
}

function bumpRefusalGrudge(idx: FactionIdx): void {
  // Player's offer refused — the player's own grudge against the target
  // doesn't accumulate (no player aiMemory), but the target's grudge
  // against the player edges up (refusal is a small social slight).
  const mem = G.aiMemory[idx];
  if (mem) {
    mem.grudges[G.playerFactionIdx] =
      (mem.grudges[G.playerFactionIdx] ?? 0) + TRADE_REFUSAL_GRUDGE;
  }
}

function bumpDefianceGrudge(idx: FactionIdx): void {
  // Player's tribute demand refused — the target now resents the
  // attempt (heavier than trade refusal). Players have no
  // grudge-ledger of their own; this loud event lives in the log.
  const mem = G.aiMemory[idx];
  if (mem) {
    mem.grudges[G.playerFactionIdx] =
      (mem.grudges[G.playerFactionIdx] ?? 0) + TRIBUTE_DEFIANCE_GRUDGE;
  }
}

function submitAllianceProposal(idx: FactionIdx): void {
  const select = document.getElementById('alliance-enemy') as HTMLSelectElement | null;
  if (!select) return;
  const enemyIdxNum = Number(select.value);
  if (!Number.isFinite(enemyIdxNum)) return;
  const player = G.factions[G.playerFactionIdx];
  const target = G.factions[idx];
  const enemy = G.factions[enemyIdxNum];
  if (!enemy || !enemy.alive) return;

  const offer: AllianceOffer = {
    proposer: player.idx,
    target: target.idx,
    enemy: enemy.idx,
  };
  const playerStr = aiFactionMilitaryStrength(player.idx);
  const targetStr = aiFactionMilitaryStrength(target.idx);
  const enemyStr = aiFactionMilitaryStrength(enemy.idx);
  const decision = evaluateAlliance(
    offer,
    player,
    target,
    playerStr + targetStr,
    enemyStr,
    G.aiMemory[target.idx],
    G.treaties,
    Math.random
  );
  if (decision.accept) {
    applyAlliance(offer, player, target, enemy, G, G.turn);
    log(getDiplomacyVoice(target.id).acceptAlliance(player.name, enemy.name), 'diplo');
  } else {
    bumpRefusalGrudge(idx);
    log(getDiplomacyVoice(target.id).refuseAlliance(player.name, enemy.name), 'warning');
  }
  activePanel = null;
  renderDiploScreen();
  updateUI();
}

function submitAgreementProposal(idx: FactionIdx): void {
  const amountEl = document.getElementById('agreement-amount') as HTMLInputElement | null;
  const goldEl = document.getElementById('agreement-gold') as HTMLInputElement | null;
  const turnsEl = document.getElementById('agreement-turns') as HTMLInputElement | null;
  const amount = amountEl ? Math.floor(Number(amountEl.value) || 0) : 0;
  const gold = goldEl ? Math.floor(Number(goldEl.value) || 0) : 0;
  const turns = turnsEl ? Math.floor(Number(turnsEl.value) || 0) : 0;
  if (amount <= 0 || gold <= 0 || turns <= 0) return;
  const player = G.factions[G.playerFactionIdx];
  const target = G.factions[idx];
  // Player is the consumer (buying aether from target). The reverse direction
  // ("player ships aether for gold") isn't surfaced in S9b — UI starts the
  // shape simple; the eval/apply functions support it for future use.
  const offer: TradeAgreementOffer = {
    proposer: player.idx,
    target: target.idx,
    provider: target.idx,
    consumer: player.idx,
    resource: 'aether',
    amountPerTurn: amount,
    goldPerTurn: gold,
    duration: turns,
  };
  const decision = evaluateTradeAgreement(
    offer,
    player,
    target,
    G.aiMemory[target.idx],
    G.treaties,
    Math.random
  );
  if (decision.accept) {
    applyTradeAgreement(offer, G, G.turn);
    log(
      getDiplomacyVoice(target.id).acceptTradeAgreement(player.name, amount, gold, turns),
      'diplo'
    );
  } else {
    bumpRefusalGrudge(idx);
    log(getDiplomacyVoice(target.id).refuseTradeAgreement(player.name), 'warning');
  }
  activePanel = null;
  renderDiploScreen();
  updateUI();
}

function cancelMyTreaty(treatyId: number): void {
  const player = G.factions[G.playerFactionIdx];
  // Look up the treaty BEFORE removing it so we can name the partner in
  // voice + bump the right grudge ledger.
  const treaty = G.treaties.find((t) => t.id === treatyId);
  if (!treaty) return;
  let partnerIdx: FactionIdx | null = null;
  let enemyName = '';
  if (treaty.kind === 'alliance') {
    partnerIdx = treaty.partyA === player.idx ? treaty.partyB : treaty.partyA;
    const enemy = G.factions[treaty.enemy];
    enemyName = enemy?.name ?? 'the foe';
  } else {
    partnerIdx = treaty.provider === player.idx ? treaty.consumer : treaty.provider;
  }
  if (partnerIdx === null) return;
  const partner = G.factions[partnerIdx];
  if (!partner) return;
  cancelTreaty(G, treatyId);
  // Partner reacts to the cancellation; small grudge bump models the
  // social cost (smaller than tribute defiance, larger than nothing).
  const mem = G.aiMemory[partnerIdx];
  if (mem) {
    mem.grudges[player.idx] = (mem.grudges[player.idx] ?? 0) + PLAYER_CANCEL_GRUDGE;
  }
  if (treaty.kind === 'alliance') {
    log(getDiplomacyVoice(partner.id).allianceBroken(player.name, enemyName), 'diplo');
  } else {
    log(
      getDiplomacyVoice(partner.id).tradeAgreementBroken(player.name, 'cancelled'),
      'diplo'
    );
  }
  renderDiploScreen();
  updateUI();
}

const w = window as Window &
  typeof globalThis & {
    declareWar: typeof declareWar;
    offerPeace: typeof offerPeace;
    openTradePanel: typeof openTradePanel;
    openTributePanel: typeof openTributePanel;
    openAlliancePanel: typeof openAlliancePanel;
    openAgreementPanel: typeof openAgreementPanel;
    closeActionPanel: typeof closeActionPanel;
    proposeTechTrade: typeof proposeTechTrade;
    proposeAetherTrade: typeof proposeAetherTrade;
    submitTributeDemand: typeof submitTributeDemand;
    submitAllianceProposal: typeof submitAllianceProposal;
    submitAgreementProposal: typeof submitAgreementProposal;
    cancelMyTreaty: typeof cancelMyTreaty;
  };
w.declareWar = declareWar;
w.offerPeace = offerPeace;
w.openTradePanel = openTradePanel;
w.openTributePanel = openTributePanel;
w.openAlliancePanel = openAlliancePanel;
w.openAgreementPanel = openAgreementPanel;
w.closeActionPanel = closeActionPanel;
w.proposeTechTrade = proposeTechTrade;
w.proposeAetherTrade = proposeAetherTrade;
w.submitTributeDemand = submitTributeDemand;
w.submitAllianceProposal = submitAllianceProposal;
w.submitAgreementProposal = submitAgreementProposal;
w.cancelMyTreaty = cancelMyTreaty;
