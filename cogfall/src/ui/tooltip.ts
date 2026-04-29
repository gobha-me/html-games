// Hover tooltip — shows terrain stats, plus city/unit details if present.

import { pixelToHex } from '../core/hex';
import { DOM_IDS } from '../core/dom';
import { G, getCityAt, getTile, getUnitAt } from '../core/state';
import { TERRAIN_TYPES } from '../data/terrain';
import { getResource } from '../data/resources';
import { UNIT_TYPES } from '../data/units';
import { previewCombat } from '../systems/combat';

const TOOLTIP_OFFSET = 18;
const TOOLTIP_MAX_WIDTH = 280;
const TOOLTIP_MAX_HEIGHT = 160;

export function handleHover(e: MouseEvent): void {
  const wx = (e.clientX - G.cameraX) / G.zoom;
  const wy = (e.clientY - G.cameraY) / G.zoom;
  const { q, r } = pixelToHex(wx, wy);
  const tile = getTile(q, r);
  const tip = document.getElementById(DOM_IDS.TOOLTIP);
  if (!tip) return;
  if (
    !tile ||
    !tile.visibility[G.playerFactionIdx] ||
    tile.visibility[G.playerFactionIdx] === 'unseen'
  ) {
    tip.style.display = 'none';
    return;
  }
  const tt = TERRAIN_TYPES[tile.terrain];
  const unit = getUnitAt(q, r);
  const city = getCityAt(q, r);
  let html = `<h4>${tt.name}</h4>`;
  if (tile.visibility[G.playerFactionIdx] !== 'visible') {
    html += `<div class="stat" style="font-style:italic">(remembered)</div>`;
  }
  html += `<div class="stat">Food: <strong>${tt.food}</strong> · Prod: <strong>${tt.prod}</strong> · Gold: <strong>${tt.gold}</strong></div>`;
  if (tt.defBonus > 0) {
    html += `<div class="stat">Defense: +${Math.round(tt.defBonus * 100)}%</div>`;
  }
  const res = getResource(tile.resource);
  if (res) {
    const parts: string[] = [];
    if (res.food) parts.push(`+${res.food}F`);
    if (res.prod) parts.push(`+${res.prod}P`);
    if (res.gold) parts.push(`+${res.gold}G`);
    html += `<div class="stat">Resource: <strong>${res.glyph} ${res.name}</strong> (${parts.join(' ')})</div>`;
  }
  if (tile.improvement && tile.improvement !== 'looted') {
    html += `<div class="stat">Improvement: <strong>${tile.improvement}</strong></div>`;
  }
  if (city) {
    const fac = G.factions[city.factionIdx];
    html += `<hr style="border-color:var(--brass-d);margin:6px 0">`;
    html += `<h4 style="color:${fac.color}">${city.name}</h4>`;
    html += `<div class="stat">${fac.name}${city.isCapital ? ' ★' : ''}</div>`;
    html += `<div class="stat">Pop: <strong>${city.population}</strong> · HP: <strong>${city.hp}/${city.maxHp}</strong></div>`;
  }
  if (unit) {
    const fac = G.factions[unit.factionIdx];
    const tpl = UNIT_TYPES[unit.typeId];
    html += `<hr style="border-color:var(--brass-d);margin:6px 0">`;
    html += `<h4 style="color:${fac.color}">${tpl.name}</h4>`;
    html += `<div class="stat">${fac.name}</div>`;
    html += `<div class="stat">HP: <strong>${unit.hp}/${unit.maxHp}</strong> · Atk: <strong>${tpl.atk}</strong> · Def: <strong>${tpl.def}</strong></div>`;
    html += `<div class="stat">MP: <strong>${unit.mp}/${unit.maxMp}</strong></div>`;
  }

  const sel = G.selected;
  if (sel?.type === 'unit' && sel.ref.factionIdx === G.playerFactionIdx) {
    const targeted = G.attackTargets.find((t) => t.q === q && t.r === r);
    if (targeted) {
      const preview = previewCombat(sel.ref, targeted);
      if (preview) {
        html += `<hr style="border-color:var(--brass-d);margin:6px 0">`;
        html += `<div class="stat" style="color:var(--brass-l)"><strong>If you attack:</strong></div>`;
        if (preview.kind === 'unit') {
          html += `<div class="stat">You deal: <strong>${preview.atkMin}–${preview.atkMax}</strong></div>`;
          html += `<div class="stat">You take: <strong>${preview.defMin}–${preview.defMax}</strong></div>`;
        } else {
          html += `<div class="stat">City damage: <strong>${preview.dmgMin}</strong></div>`;
        }
      }
    }
  }
  tip.innerHTML = html;
  tip.style.display = 'block';
  tip.style.left =
    Math.min(window.innerWidth - TOOLTIP_MAX_WIDTH, e.clientX + TOOLTIP_OFFSET) + 'px';
  tip.style.top =
    Math.min(window.innerHeight - TOOLTIP_MAX_HEIGHT, e.clientY + TOOLTIP_OFFSET) + 'px';
}
