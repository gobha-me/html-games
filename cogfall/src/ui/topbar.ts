// Top bar + selection panel orchestration. updateUI() is the main UI entry
// point — called from the turn loop's redraw hook, from input handlers, and
// from anywhere state changes that the player should see reflected.

import { DOM_IDS } from '../core/dom';
import { G } from '../core/state';
import { cityYields } from '../systems/city';
import { getCulturalShare } from '../systems/culture';
import { updateSelectionPanel } from './selectionPanel';

export function updateUI(): void {
  const player = G.factions[G.playerFactionIdx];
  const emblem = document.getElementById(DOM_IDS.CUR_FACTION_EMBLEM);
  if (emblem) {
    emblem.textContent = player.glyph;
    emblem.style.borderColor = player.color;
    emblem.style.color = player.color;
  }
  const name = document.getElementById(DOM_IDS.CUR_FACTION_NAME);
  if (name) {
    name.textContent = player.name;
    name.style.color = player.color;
  }

  const cur = G.factions[G.currentFactionIdx];
  const turn = document.getElementById(DOM_IDS.CUR_TURN);
  if (turn) {
    turn.textContent = `Turn ${G.turn}${
      cur.idx === G.playerFactionIdx ? ' — your move' : ' — ' + cur.name + ' moves'
    }`;
  }

  const gold = document.getElementById(DOM_IDS.R_GOLD);
  if (gold) gold.textContent = String(Math.floor(player.resources.gold));
  const aether = document.getElementById(DOM_IDS.R_AETHER);
  if (aether) aether.textContent = String(Math.floor(player.resources.aether));

  let goldD = 0;
  let aetherD = 0;
  let sciD = 0;
  let cultureD = 0;
  for (const c of G.cities.filter((c) => c.factionIdx === G.playerFactionIdx)) {
    const y = cityYields(c);
    goldD += y.gold;
    aetherD += y.aether;
    sciD += y.sci;
    cultureD += y.culture;
  }
  const goldDel = document.getElementById(DOM_IDS.R_GOLD_D);
  if (goldDel) {
    goldDel.textContent = (goldD >= 0 ? '+' : '') + goldD;
    goldDel.className = 'delta' + (goldD < 0 ? ' neg' : '');
  }
  const aetherDel = document.getElementById(DOM_IDS.R_AETHER_D);
  if (aetherDel) aetherDel.textContent = (aetherD >= 0 ? '+' : '') + aetherD;
  const sciDel = document.getElementById(DOM_IDS.R_SCI_D);
  if (sciDel) sciDel.textContent = '+' + sciD;
  const cultureDel = document.getElementById(DOM_IDS.R_CULTURE_D);
  if (cultureDel) cultureDel.textContent = '+' + cultureD;
  const cultureShare = document.getElementById(DOM_IDS.R_CULTURE_SHARE);
  if (cultureShare) {
    const share = getCulturalShare(G.playerFactionIdx);
    cultureShare.textContent = `${Math.round(share * 100)}%`;
  }

  updateSelectionPanel();

  const isPlayerTurn = cur.idx === G.playerFactionIdx;
  const myUnitsWithMP = G.units.filter(
    (u) => u.factionIdx === G.playerFactionIdx && u.mp > 0 && !u.fortified
  ).length;
  const status = document.getElementById(DOM_IDS.STATUS_TEXT);
  const endTurnBtn = document.getElementById(DOM_IDS.END_TURN_BTN) as HTMLButtonElement | null;
  if (isPlayerTurn) {
    if (status) {
      status.textContent =
        myUnitsWithMP > 0
          ? `${myUnitsWithMP} unit${myUnitsWithMP > 1 ? 's' : ''} await${myUnitsWithMP > 1 ? '' : 's'} orders.`
          : 'All forces have moved.';
    }
    if (endTurnBtn) endTurnBtn.disabled = false;
  } else {
    if (status) status.textContent = `${cur.name} is plotting...`;
    if (endTurnBtn) endTurnBtn.disabled = true;
  }
}
