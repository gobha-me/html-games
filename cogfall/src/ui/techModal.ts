// Tech tree modal — 4-column branch grid with status-coded nodes.
// window.pickResearch handles inline onclick from clickable nodes.

import { DOM_IDS } from '../core/dom';
import { G } from '../core/state';
import { TECHS, TECH_BRANCHES, type TechBranch, type TechId } from '../data/techs';
import { UNIT_TYPES, type UnitTypeId } from '../data/units';
import { cityYields } from '../systems/city';
import { updateUI } from './topbar';

const BRANCH_ORDER: readonly TechBranch[] = ['science', 'industry', 'economy', 'expansion'];

export function renderTechTree(): void {
  const player = G.factions[G.playerFactionIdx];
  let status = '';
  if (player.currentResearch) {
    const t = TECHS[player.currentResearch];
    const sciPerTurn = G.cities
      .filter((c) => c.factionIdx === G.playerFactionIdx)
      .reduce((s, c) => s + cityYields(c).sci, 0);
    const remaining = t.cost - (player.researchProgress || 0);
    const turns = sciPerTurn > 0 ? Math.ceil(remaining / sciPerTurn) : '∞';
    status = `Researching <strong>${t.name}</strong>: ${player.researchProgress || 0}/${t.cost} (${turns} turn${turns !== 1 ? 's' : ''} at +${sciPerTurn}/turn)`;
  } else {
    status = 'Choose what to rediscover.';
  }
  const statusEl = document.getElementById(DOM_IDS.RESEARCH_STATUS);
  if (statusEl) statusEl.innerHTML = status;

  let html = '<div class="tech-tree-grid">';
  for (const branch of BRANCH_ORDER) {
    html += `<div class="tech-column"><h3 style="color:${TECH_BRANCHES[branch].color}">${TECH_BRANCHES[branch].name}</h3>`;
    const techs = Object.entries(TECHS).filter(([, t]) => t.branch === branch);
    techs.sort((a, b) => a[1].cost - b[1].cost);
    for (const [id, t] of techs) {
      const has = player.techs.has(id as TechId);
      const can = t.prereqs.every((p) => player.techs.has(p as TechId));
      const isCur = player.currentResearch === id;
      let cls = 'tech-node ';
      if (has) cls += 'researched';
      else if (isCur) cls += 'researching';
      else if (can) cls += 'available';
      else cls += 'locked';
      html += `<div class="${cls}" ${can && !has && !isCur ? `onclick="pickResearch('${id}')"` : ''}>`;
      html += `<div class="tech-name">${t.name}${'isVictory' in t && t.isVictory ? ' ✦' : ''}</div>`;
      html += `<div class="tech-cost">${t.cost} sci${has ? ' · researched' : isCur ? ` · ${player.researchProgress || 0}/${t.cost}` : ''}</div>`;
      if ('unlocks' in t && t.unlocks) {
        html += `<div class="tech-unlock">Unlocks: ${t.unlocks.map((u) => UNIT_TYPES[u as UnitTypeId]?.name ?? u).join(', ')}</div>`;
      }
      if (t.prereqs.length > 0 && !can) {
        html += `<div class="tech-cost">Needs: ${t.prereqs.map((p) => TECHS[p as TechId].name).join(', ')}</div>`;
      }
      html += `<div class="tech-flavor">${t.flavor}</div>`;
      html += `</div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  const container = document.getElementById(DOM_IDS.TECH_TREE_CONTAINER);
  if (container) container.innerHTML = html;
}

function pickResearch(id: TechId): void {
  const player = G.factions[G.playerFactionIdx];
  if (player.currentResearch === id) return;
  if (player.currentResearch && player.currentResearch !== id) player.researchProgress = 0;
  player.currentResearch = id;
  renderTechTree();
  updateUI();
}

(window as Window & typeof globalThis & { pickResearch: typeof pickResearch }).pickResearch =
  pickResearch;
