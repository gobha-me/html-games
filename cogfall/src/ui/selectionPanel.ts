// Left-side selection panel. Routes by selection type and renders unit /
// city / tile details. Player action buttons (Found city / Improve / Fortify)
// remain wired through window.* for compatibility with the inline onclick
// markup; co-located here per the plan's "handlers live with their panel"
// rule. Step 8 of Phase 2 should migrate to data-attribute + listener.

import { hexDistance } from '../core/hex';
import { log } from '../core/log';
import { DOM_IDS } from '../core/dom';
import { G, getCityAt, getTile } from '../core/state';
import type { City, Tile, Unit } from '../core/types';
import { TERRAIN_TYPES } from '../data/terrain';
import { UNIT_TYPES } from '../data/units';
import { createCity, cityYields, pickCityName } from '../systems/city';
import { adjacentSabotageTargets } from '../systems/espionage';
import { killUnit } from '../systems/movement';
import { recomputeVisibility } from '../systems/visibility';
import { renderCityDetailsRight } from './cityPanel';
import { render } from '../render/canvas';
import { updateUI } from './topbar';

const PIONEER_FOUND_MIN_DIST = 4;

export function updateSelectionPanel(): void {
  const sel = G.selected;
  const c = document.getElementById(DOM_IDS.SELECTION_CONTENT);
  const right = document.getElementById(DOM_IDS.RIGHT_PANEL);
  if (!c) return;
  if (!sel) {
    c.innerHTML =
      '<span style="color:var(--parchment-d);font-style:italic">Click a tile to inspect.</span>';
    if (right) right.style.display = 'none';
    return;
  }
  if (sel.type === 'unit') {
    renderUnitPanel(sel.ref);
    if (right) right.style.display = 'none';
  } else if (sel.type === 'city') {
    renderCityPanel(sel.ref);
  } else if (sel.type === 'tile') {
    renderTilePanel(sel.ref);
    if (right) right.style.display = 'none';
  }
}

export function renderUnitPanel(unit: Unit): void {
  const fac = G.factions[unit.factionIdx];
  const tpl = UNIT_TYPES[unit.typeId];
  let html = `<div class="unit-card"><div class="name" style="color:${fac.color}">${tpl.glyph} ${tpl.name}</div>`;
  html += `<div class="stat-row"><span>HP ${unit.hp}/${unit.maxHp}</span><span>Atk ${tpl.atk}</span><span>Def ${tpl.def}</span><span>MP ${unit.mp}/${unit.maxMp}</span></div>`;
  html += `<div class="hp-bar"><div style="width:${(unit.hp / unit.maxHp) * 100}%"></div></div>`;
  html += `<div style="font-size:11px;color:var(--parchment-d);margin-top:4px;font-style:italic">${tpl.desc}</div>`;
  html += `</div>`;
  if (unit.factionIdx === G.playerFactionIdx) {
    if (unit.typeId === 'PIONEER' && unit.mp > 0) {
      const tile = getTile(unit.q, unit.r);
      const tooClose = G.cities.some(
        (c) => tile && hexDistance({ q: c.q, r: c.r }, tile) < PIONEER_FOUND_MIN_DIST
      );
      const cityHere = getCityAt(unit.q, unit.r);
      html += `<button class="action-btn" ${
        tooClose || cityHere ? 'disabled' : ''
      } onclick="playerFoundCity()">⌂ Found city here${tooClose ? ' (too close)' : ''}</button>`;
    }
    if (unit.typeId === 'WORKER' && unit.mp > 0) {
      const t = getTile(unit.q, unit.r);
      const ok =
        t &&
        t.owner === unit.factionIdx &&
        !t.improvement &&
        !t.cityId &&
        (t.terrain === 'PLAINS' || t.terrain === 'HILLS' || t.terrain === 'FOREST');
      let imp = 'farm';
      if (t && t.terrain === 'HILLS') imp = 'mine';
      else if (t && t.terrain === 'FOREST') imp = 'road';
      html += `<button class="action-btn" ${ok ? '' : 'disabled'} onclick="playerImprove()">⚒ Build ${imp}</button>`;
    }
    if (UNIT_TYPES[unit.typeId].atk > 0 && !unit.fortified) {
      html += `<button class="action-btn" onclick="playerFortify()">◫ Fortify (+30% def)</button>`;
    }
    const tpl2 = UNIT_TYPES[unit.typeId];
    if ('abilities' in tpl2 && (tpl2.abilities as readonly string[]).includes('steal_tech') && unit.mp > 0) {
      const targets = adjacentSabotageTargets(unit);
      const armed = G.sabotageTargets.length > 0;
      html += `<button class="action-btn" ${
        targets.length === 0 ? 'disabled' : ''
      } onclick="playerSteal()">${armed ? '✗ Cancel steal' : '🎭 Steal Tech'}${
        targets.length === 0 ? ' (no adjacent rival)' : ''
      }</button>`;
    }
  }
  const sc = document.getElementById(DOM_IDS.SELECTION_CONTENT);
  if (sc) sc.innerHTML = html;
}

export function renderCityPanel(city: City): void {
  const fac = G.factions[city.factionIdx];
  const y = cityYields(city);
  let html = `<div class="unit-card"><div class="name" style="color:${fac.color}">${fac.glyph} ${city.name}${city.isCapital ? ' ★' : ''}</div>`;
  html += `<div class="stat-row"><span>Pop ${city.population}</span><span>HP ${city.hp}/${city.maxHp}</span></div>`;
  html += `<div class="stat-row"><span>Food ${city.foodStored}/${city.foodNeeded} (${y.food >= 0 ? '+' : ''}${y.food})</span></div>`;
  html += `<div class="stat-row"><span>Prod (${y.prod})</span><span>Gold (+${y.gold})</span><span>Sci (+${y.sci})</span><span>Culture (+${y.culture})</span></div>`;
  html += `</div>`;
  const sc = document.getElementById(DOM_IDS.SELECTION_CONTENT);
  if (sc) sc.innerHTML = html;
  if (city.factionIdx === G.playerFactionIdx) renderCityDetailsRight(city);
  else {
    const right = document.getElementById(DOM_IDS.RIGHT_PANEL);
    if (right) right.style.display = 'none';
  }
}

export function renderTilePanel(tile: Tile): void {
  const tt = TERRAIN_TYPES[tile.terrain];
  let html = `<div class="unit-card"><div class="name">${tt.name}</div>`;
  html += `<div class="stat-row"><span>F ${tt.food}</span><span>P ${tt.prod}</span><span>G ${tt.gold}</span></div>`;
  if (tt.defBonus > 0)
    html += `<div class="stat-row"><span>Defense bonus: +${Math.round(tt.defBonus * 100)}%</span></div>`;
  if (tile.owner != null)
    html += `<div class="stat-row"><span>Claimed by ${G.factions[tile.owner].name}</span></div>`;
  html += `</div>`;
  const sc = document.getElementById(DOM_IDS.SELECTION_CONTENT);
  if (sc) sc.innerHTML = html;
}

// --- Player action handlers (window-bound for inline onclick compat) ------

function playerFoundCity(): void {
  const sel = G.selected;
  if (!sel || sel.type !== 'unit') return;
  const u = sel.ref;
  const tile = getTile(u.q, u.r);
  if (!tile) return;
  if (getCityAt(u.q, u.r)) return;
  const tooClose = G.cities.some(
    (c) => hexDistance({ q: c.q, r: c.r }, tile) < PIONEER_FOUND_MIN_DIST
  );
  if (tooClose) return;
  const name = pickCityName();
  const c = createCity(u.factionIdx, u.q, u.r, name);
  if (G.cities.filter((cc) => cc.factionIdx === u.factionIdx).length === 1) c.isCapital = true;
  log(`You founded ${name}.`, 'good');
  killUnit(u);
  G.selected = { type: 'city', ref: c };
  G.moveTargets = [];
  G.attackTargets = [];
  recomputeVisibility();
  render();
  updateUI();
}

function playerImprove(): void {
  const sel = G.selected;
  if (!sel || sel.type !== 'unit') return;
  const u = sel.ref;
  const t = getTile(u.q, u.r);
  if (!t || t.owner !== u.factionIdx || t.improvement || t.cityId) return;
  if (t.terrain === 'PLAINS') t.improvement = 'farm';
  else if (t.terrain === 'HILLS') t.improvement = 'mine';
  else if (t.terrain === 'FOREST') t.improvement = 'road';
  else return;
  log(`Engineer built ${t.improvement}.`, 'good');
  u.mp = 0;
  render();
  updateUI();
}

function playerFortify(): void {
  const sel = G.selected;
  if (!sel || sel.type !== 'unit') return;
  const u = sel.ref;
  u.fortified = true;
  u.mp = 0;
  render();
  updateUI();
}

function playerSteal(): void {
  const sel = G.selected;
  if (!sel || sel.type !== 'unit') return;
  const u = sel.ref;
  if (u.factionIdx !== G.playerFactionIdx || u.mp <= 0) return;
  const tpl = UNIT_TYPES[u.typeId];
  if (!('abilities' in tpl) || !(tpl.abilities as readonly string[]).includes('steal_tech')) return;
  if (G.sabotageTargets.length > 0) {
    G.sabotageTargets = [];
  } else {
    G.sabotageTargets = adjacentSabotageTargets(u);
  }
  render();
  updateUI();
}

// Expose for the inline onclick attributes generated above.
const w = window as Window &
  typeof globalThis & {
    playerFoundCity: typeof playerFoundCity;
    playerImprove: typeof playerImprove;
    playerFortify: typeof playerFortify;
    playerSteal: typeof playerSteal;
  };
w.playerFoundCity = playerFoundCity;
w.playerImprove = playerImprove;
w.playerFortify = playerFortify;
w.playerSteal = playerSteal;
