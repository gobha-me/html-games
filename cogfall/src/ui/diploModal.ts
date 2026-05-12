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
  applyTrade,
  applyTribute,
  evaluateTrade,
  evaluateTribute,
  suggestedAetherPrice,
  suggestedTechPrice,
  suggestedTribute,
  TRADE_REFUSAL_GRUDGE,
  TRIBUTE_DEFIANCE_GRUDGE,
  type TradeOffer,
  type TradeRefusal,
  type TributeDemand,
  type TributeRefusal,
} from '../systems/diplomacy';
import { updateUI } from './topbar';

const RANDOM_PEACE_ACCEPT_CHANCE = 0.3;
const PLAYER_DECLARE_WAR_GRUDGE = 30;
const AETHER_TRADE_LOT = 20;

type ActionPanel =
  | null
  | { kind: 'trade'; factionIdx: FactionIdx }
  | { kind: 'tribute'; factionIdx: FactionIdx };

let activePanel: ActionPanel = null;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderDiploScreen(): void {
  const player = G.factions[G.playerFactionIdx];
  let html = '';
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

function declareWar(idx: FactionIdx): void {
  const player = G.factions[G.playerFactionIdx];
  player.diplo[idx] = 'war';
  G.factions[idx].diplo[player.idx] = 'war';
  const mem = G.aiMemory[idx];
  if (mem) {
    mem.grudges[player.idx] = (mem.grudges[player.idx] || 0) + PLAYER_DECLARE_WAR_GRUDGE;
  }
  log(`You declared war on ${G.factions[idx].name}!`, 'warning');
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

const w = window as Window &
  typeof globalThis & {
    declareWar: typeof declareWar;
    offerPeace: typeof offerPeace;
    openTradePanel: typeof openTradePanel;
    openTributePanel: typeof openTributePanel;
    closeActionPanel: typeof closeActionPanel;
    proposeTechTrade: typeof proposeTechTrade;
    proposeAetherTrade: typeof proposeAetherTrade;
    submitTributeDemand: typeof submitTributeDemand;
  };
w.declareWar = declareWar;
w.offerPeace = offerPeace;
w.openTradePanel = openTradePanel;
w.openTributePanel = openTributePanel;
w.closeActionPanel = closeActionPanel;
w.proposeTechTrade = proposeTechTrade;
w.proposeAetherTrade = proposeAetherTrade;
w.submitTributeDemand = submitTributeDemand;
