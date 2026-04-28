// Turn loop, AI turn scheduling, victory triggers, and final scoring.
//
// Touches the DOM for the AI-thinking spinner, game-over banner, and
// scorecard. updateUI() and render() aren't extracted yet (steps 7-8), so
// turn.ts publishes a `requestRedraw` hook that legacy.ts (and later main.ts)
// fills in. The hook stays an exported setter — no global window.* leakage.

import { G } from '../core/state';
import type { Faction, FactionIdx, VictoryType } from '../core/types';
import { AI_THINKING_LINES } from '../data/personalities';
import { UNIT_TYPES } from '../data/units';
import { aiPlayTurn } from '../ai/strategy';
import { processCity } from './city';
import { computeCulturalClaim, processCulturalHegemony } from './culture';
import { processResearch } from './research';
import { recomputeVisibility } from './visibility';
import { playSfx } from './audio';
import { DOM_IDS } from '../core/dom';
import { saveAuto } from '../core/save';

const AI_THINK_BASE_MS = 450;
const AI_THINK_JITTER_MS = 300;
const AI_TURN_END_DELAY_MS = 300;

const SCORE_PER_CITY_BASE = 10;
const SCORE_PER_POP = 4;
const SCORE_PER_UNIT = 3;
const SCORE_PER_TECH = 8;
const SCORE_GOLD_WEIGHT = 0.05;
const SCORE_AETHER_WEIGHT = 0.5;

// --- Render hook -----------------------------------------------------------

let requestRedraw: () => void = () => {};
export function setRequestRedraw(fn: () => void): void {
  requestRedraw = fn;
}

// --- AI thinking spinner ---------------------------------------------------

function showAIThinking(text: string): void {
  const t = document.getElementById(DOM_IDS.AI_THINKING_TEXT);
  const p = document.getElementById(DOM_IDS.AI_THINKING);
  if (t) t.textContent = text;
  if (p) p.style.display = 'flex';
}

function hideAIThinking(): void {
  const p = document.getElementById(DOM_IDS.AI_THINKING);
  if (p) p.style.display = 'none';
}

// --- Turn loop -------------------------------------------------------------

export function endTurn(): void {
  if (G.gameOver) return;
  const cur = G.factions[G.currentFactionIdx];

  // SFX only when the player ends their own turn — the AI's many endTurns
  // would chatter through the rest of the round.
  if (!cur.isAI && cur.idx === G.playerFactionIdx) playSfx('endTurn');

  for (const c of G.cities.filter((c) => c.factionIdx === cur.idx)) processCity(c);

  const research = processResearch(cur);
  if (research.ascensionTriggered) {
    triggerVictory(cur.idx, 'ascension');
    return;
  }

  if (cur.resources.gold >= G.goldHegemonyThreshold) {
    G.goldHegemonyCounter[cur.idx] = (G.goldHegemonyCounter[cur.idx] || 0) + 1;
    if ((G.goldHegemonyCounter[cur.idx] || 0) >= G.goldHegemonyRequired) {
      triggerVictory(cur.idx, 'hegemony');
      return;
    }
  } else {
    G.goldHegemonyCounter[cur.idx] = 0;
  }

  // Cultural pressure recompute (Phase 2g). Pure + deterministic; runs
  // after the gold-hegemony check so a gold win short-circuits the
  // cheaper code path.
  computeCulturalClaim();

  // Cultural hegemony victory (Phase 2g-4). Mirrors gold-hegemony's
  // counter pattern: hold ≥ threshold share of all claimed tiles for
  // `required` consecutive end-turns. processCulturalHegemony lives in
  // systems/culture.ts so the share + counter logic is unit-testable
  // without scaffolding the full endTurn DOM/AI/visibility surface.
  if (processCulturalHegemony(cur).victory) {
    triggerVictory(cur.idx, 'cultural');
    return;
  }

  cur.score = computeFactionScore(cur);

  G.currentFactionIdx = ((G.currentFactionIdx + 1) % G.factions.length) as FactionIdx;
  let safety = 10;
  while (!G.factions[G.currentFactionIdx].alive && safety-- > 0) {
    G.currentFactionIdx = ((G.currentFactionIdx + 1) % G.factions.length) as FactionIdx;
  }
  if (G.currentFactionIdx === 0) G.turn++;

  const next = G.factions[G.currentFactionIdx];
  for (const u of G.units.filter((u) => u.factionIdx === next.idx)) {
    u.mp = UNIT_TYPES[u.typeId].mp;
  }
  recomputeVisibility();

  const aliveOpps = G.factions.filter((f) => f.alive && f.idx !== G.playerFactionIdx);
  if (aliveOpps.length === 0 && G.factions[G.playerFactionIdx].alive) {
    triggerVictory(G.playerFactionIdx, 'domination');
    return;
  }
  if (!G.factions[G.playerFactionIdx].alive) {
    triggerDefeat();
    return;
  }

  G.selected = null;
  G.moveTargets = [];
  G.attackTargets = [];

  // Autosave at the moment the player regains control — covers the common
  // "browser tab closed mid-AI-turn" case and gives the player a clean
  // state to roll back to.
  if (!next.isAI) saveAuto();

  if (next.isAI) runAITurn(next);
  else requestRedraw();
}

export function runAITurn(faction: Faction): void {
  const lines = AI_THINKING_LINES[faction.personality];
  const line = lines[Math.floor(Math.random() * lines.length)];
  showAIThinking(`${faction.name} ${line}`);
  setTimeout(
    () => {
      aiPlayTurn(faction);
      hideAIThinking();
      requestRedraw();
      setTimeout(endTurn, AI_TURN_END_DELAY_MS);
    },
    AI_THINK_BASE_MS + Math.random() * AI_THINK_JITTER_MS
  );
}

// --- Scoring ---------------------------------------------------------------

export function computeFactionScore(faction: Faction): number {
  let s = 0;
  s += G.cities
    .filter((c) => c.factionIdx === faction.idx)
    .reduce((acc, c) => acc + SCORE_PER_CITY_BASE + c.population * SCORE_PER_POP, 0);
  s += G.units.filter((u) => u.factionIdx === faction.idx).length * SCORE_PER_UNIT;
  s += faction.techs.size * SCORE_PER_TECH;
  s += faction.resources.gold * SCORE_GOLD_WEIGHT;
  s += faction.resources.aether * SCORE_AETHER_WEIGHT;
  return Math.round(s);
}

// --- Victory / defeat ------------------------------------------------------

const VICTORY_MESSAGES: Record<VictoryType, { title: string; flavorTemplate: string }> = {
  domination: {
    title: 'Domination',
    flavorTemplate: '{name} has crushed all rivals beneath the weight of their banners.',
  },
  ascension: {
    title: 'Ascension',
    flavorTemplate:
      '{name} has restored the Grand Apparatus. The Old World awakens — under their hand.',
  },
  hegemony: {
    title: 'Economic Hegemony',
    flavorTemplate: '{name} has bought the world. The other banners bend, or starve.',
  },
  cultural: {
    title: 'Cultural Hegemony',
    flavorTemplate:
      '{name} has set the loom of every conversation. The world hums their song without thinking.',
  },
};

export function triggerVictory(factionIdx: FactionIdx, type: VictoryType): void {
  G.gameOver = true;
  const fac = G.factions[factionIdx];
  const isPlayer = factionIdx === G.playerFactionIdx;
  if (isPlayer) playSfx('victory');
  const m = VICTORY_MESSAGES[type];
  const flavor = m.flavorTemplate.replace('{name}', fac.name);
  const banner = isPlayer
    ? `<div class="victory-banner win"><h2 style="color:#99ee99">VICTORY: ${m.title}</h2><p style="margin-top:10px;font-style:italic">${flavor}</p></div>`
    : `<div class="victory-banner lose"><h2 style="color:var(--danger)">DEFEAT</h2><p style="margin-top:10px">${fac.name} has achieved ${m.title}.</p><p style="margin-top:6px;font-style:italic">${flavor}</p></div>`;
  const content = document.getElementById(DOM_IDS.GAME_OVER_CONTENT);
  if (content) content.innerHTML = banner + scorecard();
  document.getElementById(DOM_IDS.GAME_OVER_MODAL)?.classList.add('show');
}

export function triggerDefeat(): void {
  G.gameOver = true;
  const banner = `<div class="victory-banner lose"><h2 style="color:var(--danger)">DEFEAT</h2><p style="margin-top:10px;font-style:italic">Your banner has fallen. The Cogfall claims another.</p></div>`;
  const content = document.getElementById(DOM_IDS.GAME_OVER_CONTENT);
  if (content) content.innerHTML = banner + scorecard();
  document.getElementById(DOM_IDS.GAME_OVER_MODAL)?.classList.add('show');
}

export function scorecard(): string {
  // Prototype sorts on freshly-computed scores (not the cached f.score),
  // so eliminated factions still get a fair tally.
  const sorted = G.factions.slice().sort((a, b) => computeFactionScore(b) - computeFactionScore(a));
  let html = '<h3 style="color:var(--brass);margin-bottom:8px">Final Tally</h3>';
  for (const f of sorted) {
    const status = f.alive ? '' : ' <span style="color:var(--danger)">(eliminated)</span>';
    html += `<div class="row"><span><span style="color:${f.color}">${f.glyph}</span> ${f.name}${status}</span><span>${computeFactionScore(f)}</span></div>`;
  }
  return html;
}
