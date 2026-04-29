// Right-side city production panel: build queue progress + scrollable lists
// of available units and buildings. window.setCityBuild handles the inline
// onclick from each list item.

import { DOM_IDS } from '../core/dom';
import { G, getTile } from '../core/state';
import { MAX_BUILD_QUEUE_LEN } from '../core/types';
import type { BuildingId, City, UnitTypeId } from '../core/types';
import { BUILDING_TYPES } from '../data/buildings';
import { UNIT_TYPES, isNaval, isSpy } from '../data/units';
import { TECHS } from '../data/techs';
import { cityYields } from '../systems/city';
import { isCoast } from '../systems/mapgen';
import { updateUI } from './topbar';

export function renderCityDetailsRight(city: City): void {
  const right = document.getElementById(DOM_IDS.RIGHT_PANEL);
  if (!right) return;
  right.style.display = 'block';
  const title = document.getElementById(DOM_IDS.RIGHT_TITLE);
  if (title) title.textContent = city.name + ' — Production';
  const fac = G.factions[city.factionIdx];

  let html = '';
  if (city.buildQueue.length > 0) {
    const item = city.buildQueue[0];
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
    html += `<div style="margin-bottom:6px;padding:8px;background:rgba(78,205,196,0.1);border:1px solid var(--aether);border-radius:4px">Building <strong>${name}</strong>: ${city.productionStored}/${cost} <span style="color:var(--parchment-d)">(${turns} turns)</span></div>`;

    // Pending queue (positions 1..N) — reorder + remove controls.
    if (city.buildQueue.length > 1) {
      html += `<div style="margin-bottom:10px;padding:6px;background:rgba(0,0,0,0.15);border-radius:4px;font-size:12px"><div style="color:var(--parchment-d);margin-bottom:4px">Up next (${city.buildQueue.length - 1}/${MAX_BUILD_QUEUE_LEN - 1}):</div>`;
      for (let i = 1; i < city.buildQueue.length; i++) {
        const q = city.buildQueue[i];
        const qName = q.kind === 'unit' ? UNIT_TYPES[q.id].name : BUILDING_TYPES[q.id].name;
        const qGlyph = q.kind === 'unit' ? UNIT_TYPES[q.id].glyph : BUILDING_TYPES[q.id].glyph;
        const upDisabled = i === 1;
        const downDisabled = i === city.buildQueue.length - 1;
        html += `<div class="queue-item" style="display:flex;align-items:center;gap:4px;padding:3px 4px;border:1px solid rgba(78,205,196,0.3);border-radius:3px;margin-bottom:2px">`;
        html += `<span style="flex:1">${qGlyph} ${qName}</span>`;
        html += `<button onclick="moveCityBuild(${city.id},${i},-1)" style="padding:0 6px;background:rgba(78,205,196,0.15);border:1px solid var(--aether);border-radius:2px;color:var(--parchment);cursor:pointer${upDisabled ? ';opacity:0.3;cursor:default' : ''}" ${upDisabled ? 'disabled' : ''}>↑</button>`;
        html += `<button onclick="moveCityBuild(${city.id},${i},1)" style="padding:0 6px;background:rgba(78,205,196,0.15);border:1px solid var(--aether);border-radius:2px;color:var(--parchment);cursor:pointer${downDisabled ? ';opacity:0.3;cursor:default' : ''}" ${downDisabled ? 'disabled' : ''}>↓</button>`;
        html += `<button onclick="removeCityBuild(${city.id},${i})" style="padding:0 6px;background:rgba(220,80,80,0.2);border:1px solid #c66;border-radius:2px;color:var(--parchment);cursor:pointer">×</button>`;
        html += `</div>`;
      }
      html += `</div>`;
    } else if (city.buildQueue.length === 1) {
      // One item in flight, queue otherwise empty — hint at the cap.
      html += `<div style="margin-bottom:10px;font-size:11px;color:var(--parchment-d)">Queue empty — click below to enqueue (cap ${MAX_BUILD_QUEUE_LEN}).</div>`;
    }
  }

  const cityTile = getTile(city.q, city.r);
  const coastal = !!(cityTile && G.map && isCoast(cityTile, G.map));

  html += `<h4>Units</h4><div class="build-list">`;
  for (const [uid, tpl] of Object.entries(UNIT_TYPES)) {
    if ('requires' in tpl && tpl.requires && !fac.techs.has(tpl.requires)) continue;
    if (isNaval(uid as UnitTypeId) && !coastal) continue;
    const isCur = city.buildQueue.some(
      (q) => q.kind === 'unit' && q.id === (uid as UnitTypeId)
    );
    const navalTag = isNaval(uid as UnitTypeId) ? ' · Naval' : '';
    const spyTag = isSpy(uid as UnitTypeId) ? ' · Spy' : '';
    html += `<div class="build-item ${isCur ? 'current' : ''}" onclick="setCityBuild(${city.id},'unit','${uid}')">`;
    html += `<div class="name">${tpl.glyph} ${tpl.name}</div>`;
    html += `<div class="desc">${tpl.desc}</div>`;
    html += `<div class="meta">Cost: ${tpl.cost} prod · HP ${tpl.hp} Atk ${tpl.atk} Def ${tpl.def} MP ${tpl.mp}${navalTag}${spyTag}</div>`;
    html += `</div>`;
  }

  html += `</div><h4>Buildings</h4><div class="build-list">`;
  for (const [bid, b] of Object.entries(BUILDING_TYPES)) {
    if (city.buildings.has(bid as BuildingId)) continue;
    const locked = 'requires' in b && b.requires && !fac.techs.has(b.requires);
    const isCur = city.buildQueue.some(
      (q) => q.kind === 'building' && q.id === (bid as BuildingId)
    );
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
  if (c.buildQueue.length >= MAX_BUILD_QUEUE_LEN) return;
  const player = G.factions[G.playerFactionIdx];
  if (kind === 'unit') {
    const tpl = UNIT_TYPES[id as UnitTypeId];
    if ('requires' in tpl && tpl.requires && !player.techs.has(tpl.requires)) return;
    if (isNaval(id as UnitTypeId)) {
      const t = getTile(c.q, c.r);
      if (!t || !G.map || !isCoast(t, G.map)) return;
    }
    if (c.buildQueue.some((q) => q.kind === 'unit' && q.id === (id as UnitTypeId))) return;
    c.buildQueue.push({ kind: 'unit', id: id as UnitTypeId });
  } else {
    const tpl = BUILDING_TYPES[id as BuildingId];
    if ('requires' in tpl && tpl.requires && !player.techs.has(tpl.requires)) return;
    if (c.buildQueue.some((q) => q.kind === 'building' && q.id === (id as BuildingId))) return;
    c.buildQueue.push({ kind: 'building', id: id as BuildingId });
  }
  updateUI();
}

function moveCityBuild(cityId: number, idx: number, dir: -1 | 1): void {
  const c = G.cities.find((c) => c.id === cityId);
  if (!c || c.factionIdx !== G.playerFactionIdx) return;
  // queue[0] is the in-flight build — only positions 1..N reorder.
  if (idx < 1 || idx >= c.buildQueue.length) return;
  const target = idx + dir;
  if (target < 1 || target >= c.buildQueue.length) return;
  const tmp = c.buildQueue[idx];
  c.buildQueue[idx] = c.buildQueue[target];
  c.buildQueue[target] = tmp;
  updateUI();
}

function removeCityBuild(cityId: number, idx: number): void {
  const c = G.cities.find((c) => c.id === cityId);
  if (!c || c.factionIdx !== G.playerFactionIdx) return;
  if (idx < 1 || idx >= c.buildQueue.length) return;
  c.buildQueue.splice(idx, 1);
  updateUI();
}

type CityPanelWindow = Window &
  typeof globalThis & {
    setCityBuild: typeof setCityBuild;
    moveCityBuild: typeof moveCityBuild;
    removeCityBuild: typeof removeCityBuild;
  };

(window as CityPanelWindow).setCityBuild = setCityBuild;
(window as CityPanelWindow).moveCityBuild = moveCityBuild;
(window as CityPanelWindow).removeCityBuild = removeCityBuild;
