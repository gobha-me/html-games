// Right-side city production panel: build queue progress + scrollable lists
// of available units and buildings. window.setCityBuild handles the inline
// onclick from each list item.

import { DOM_IDS } from '../core/dom';
import { G } from '../core/state';
import type { BuildingId, City, UnitTypeId } from '../core/types';
import { BUILDING_TYPES } from '../data/buildings';
import { UNIT_TYPES } from '../data/units';
import { TECHS } from '../data/techs';
import { cityYields } from '../systems/city';
import { updateUI } from './topbar';

export function renderCityDetailsRight(city: City): void {
  const right = document.getElementById(DOM_IDS.RIGHT_PANEL);
  if (!right) return;
  right.style.display = 'block';
  const title = document.getElementById(DOM_IDS.RIGHT_TITLE);
  if (title) title.textContent = city.name + ' — Production';
  const fac = G.factions[city.factionIdx];

  let html = '';
  if (city.buildQueue) {
    const item = city.buildQueue;
    let cost = 0;
    let name = '';
    if (item.kind === 'unit') {
      cost = UNIT_TYPES[item.id].cost;
      name = UNIT_TYPES[item.id].name;
    } else {
      cost = BUILDING_TYPES[item.id].cost;
      name = BUILDING_TYPES[item.id].name;
    }
    const remaining = cost - city.productionStored;
    const turns = Math.max(0, Math.ceil(remaining / Math.max(1, cityYields(city).prod)));
    html += `<div style="margin-bottom:10px;padding:8px;background:rgba(78,205,196,0.1);border:1px solid var(--aether);border-radius:4px">Building <strong>${name}</strong>: ${city.productionStored}/${cost} <span style="color:var(--parchment-d)">(${turns} turns)</span></div>`;
  }

  html += `<h4>Units</h4><div class="build-list">`;
  for (const [uid, tpl] of Object.entries(UNIT_TYPES)) {
    if ('requires' in tpl && tpl.requires && !fac.techs.has(tpl.requires)) continue;
    const isCur =
      city.buildQueue &&
      city.buildQueue.kind === 'unit' &&
      city.buildQueue.id === (uid as UnitTypeId);
    html += `<div class="build-item ${isCur ? 'current' : ''}" onclick="setCityBuild(${city.id},'unit','${uid}')">`;
    html += `<div class="name">${tpl.glyph} ${tpl.name}</div>`;
    html += `<div class="desc">${tpl.desc}</div>`;
    html += `<div class="meta">Cost: ${tpl.cost} prod · HP ${tpl.hp} Atk ${tpl.atk} Def ${tpl.def} MP ${tpl.mp}</div>`;
    html += `</div>`;
  }

  html += `</div><h4>Buildings</h4><div class="build-list">`;
  for (const [bid, b] of Object.entries(BUILDING_TYPES)) {
    if (city.buildings.has(bid as BuildingId)) continue;
    const locked = 'requires' in b && b.requires && !fac.techs.has(b.requires);
    const isCur =
      city.buildQueue &&
      city.buildQueue.kind === 'building' &&
      city.buildQueue.id === (bid as BuildingId);
    html += `<div class="build-item ${isCur ? 'current' : ''} ${locked ? 'locked' : ''}" ${
      !locked ? `onclick="setCityBuild(${city.id},'building','${bid}')"` : ''
    }>`;
    html += `<div class="name">${b.glyph} ${b.name}</div>`;
    html += `<div class="desc">${b.desc}</div>`;
    html += `<div class="meta">Cost: ${b.cost} prod${locked && 'requires' in b && b.requires ? ' · Requires ' + TECHS[b.requires].name : ''}</div>`;
    html += `</div>`;
  }

  if (city.buildings.size > 0) {
    html += `</div><h4>Already Built</h4><div style="font-size:11px;color:var(--parchment-d)">`;
    for (const b of city.buildings)
      html += `<div>${BUILDING_TYPES[b].glyph} ${BUILDING_TYPES[b].name}</div>`;
    html += `</div>`;
  } else html += `</div>`;

  const content = document.getElementById(DOM_IDS.RIGHT_CONTENT);
  if (content) content.innerHTML = html;
}

function setCityBuild(cityId: number, kind: 'unit' | 'building', id: string): void {
  const c = G.cities.find((c) => c.id === cityId);
  if (!c || c.factionIdx !== G.playerFactionIdx) return;
  const player = G.factions[G.playerFactionIdx];
  if (kind === 'unit') {
    const tpl = UNIT_TYPES[id as UnitTypeId];
    if ('requires' in tpl && tpl.requires && !player.techs.has(tpl.requires)) return;
    c.buildQueue = { kind: 'unit', id: id as UnitTypeId };
  } else {
    const tpl = BUILDING_TYPES[id as BuildingId];
    if ('requires' in tpl && tpl.requires && !player.techs.has(tpl.requires)) return;
    c.buildQueue = { kind: 'building', id: id as BuildingId };
  }
  updateUI();
}

(window as Window & typeof globalThis & { setCityBuild: typeof setCityBuild }).setCityBuild =
  setCityBuild;
