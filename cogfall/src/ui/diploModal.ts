// Diplomacy modal — list other factions, show status + grudge mood +
// power, with declare-war / offer-peace buttons. The peace acceptance
// formula matches the prototype's: a deterministic score plus a 30%
// random-accept chance, modified by personality aggression.

import { log } from '../core/log';
import { DOM_IDS } from '../core/dom';
import { G } from '../core/state';
import type { FactionIdx } from '../core/types';
import { PERSONALITIES } from '../data/personalities';
import { aiFactionMilitaryStrength } from '../ai/strategy';
import { updateUI } from './topbar';

const RANDOM_PEACE_ACCEPT_CHANCE = 0.3;
const PLAYER_DECLARE_WAR_GRUDGE = 30;

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
    if (status === 'peace')
      html += `<button class="btn small danger" onclick="declareWar(${f.idx})">Declare War</button>`;
    else if (status === 'war')
      html += `<button class="btn small" onclick="offerPeace(${f.idx})">Offer Peace</button>`;
    html += `</div></div>`;
  }
  if (!html) html = '<p style="color:var(--parchment-d);font-style:italic">No other banners stand.</p>';
  const content = document.getElementById(DOM_IDS.DIPLO_CONTENT);
  if (content) content.innerHTML = html;
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
  if (PERSONALITIES[other.personality].agg > 0.7) acceptScore -= 20;
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

const w = window as Window &
  typeof globalThis & { declareWar: typeof declareWar; offerPeace: typeof offerPeace };
w.declareWar = declareWar;
w.offerPeace = offerPeace;
