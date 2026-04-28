// Setup modal — faction picker. The actual game start (mapgen, faction
// creation, starting units, etc.) happens in systems/setup.ts (step 10);
// this module is just the form/picker UI.

import { DOM_IDS } from '../core/dom';
import { FACTIONS } from '../data/factions';

let setupSelectedFaction = 0;

export function getSelectedFactionIdx(): number {
  return setupSelectedFaction;
}

export function renderFactionList(): void {
  const el = document.getElementById(DOM_IDS.FACTION_LIST);
  if (!el) return;
  el.innerHTML = FACTIONS.map(
    (f, i) =>
      `<div class="faction-card ${i === setupSelectedFaction ? 'selected' : ''}" onclick="setupSelectFaction(${i})"><div class="swatch" style="background:${f.color}33;border-color:${f.color}">${f.glyph}</div><div class="info"><div class="title" style="color:${f.color}">${f.name}</div><div class="desc">${f.desc}</div><div class="traits">${f.traits}</div></div></div>`
  ).join('');
}

function setupSelectFaction(i: number): void {
  setupSelectedFaction = i;
  renderFactionList();
}

(
  window as Window & typeof globalThis & { setupSelectFaction: typeof setupSelectFaction }
).setupSelectFaction = setupSelectFaction;
