// Turn loop, AI turn scheduling, victory triggers, and final scoring.
//
// Touches the DOM for the AI-thinking spinner, game-over banner, and
// scorecard. updateUI() and render() aren't extracted yet (steps 7-8), so
// turn.ts publishes a `requestRedraw` hook that legacy.ts (and later main.ts)
// fills in. The hook stays an exported setter — no global window.* leakage.

import { G } from '../core/state';
import type { Faction, FactionIdx, VictoryType } from '../core/types';
import { getVictoryProfile } from '../data/factions';
import { AI_THINKING_LINES } from '../data/personalities';
import { UNIT_TYPES } from '../data/units';
import { aiPlayTurn } from '../ai/strategy';
import { processCity } from './city';
import { computeCulturalClaim, processCulturalHegemony } from './culture';
import { processResearch } from './research';
import { recomputeVisibility } from './visibility';
import { playSfx } from './audio';
import { recordTelemetry } from './telemetry';
import { recordReplaySnapshot } from './replay';
import { emit } from '../render/animations';
import { DOM_IDS } from '../core/dom';
import { totalLogCount } from '../core/log';
import { saveAuto } from '../core/save';
import { openPassover } from '../ui/passoverModal';
import { showAiActionBanner } from '../ui/aiActionBanner';

const AI_THINK_BASE_MS = 450;
const AI_THINK_JITTER_MS = 300;
const AI_TURN_END_DELAY_MS = 300;

const SCORE_PER_CITY_BASE = 10;
const SCORE_PER_POP = 4;
const SCORE_PER_UNIT = 3;
const SCORE_PER_TECH = 8;
const SCORE_GOLD_WEIGHT = 0.05;
// Phase 2n-3: dropped from 0.5 → 0.1. Aether output per turn lands in the
// same order of magnitude as gold output for an aether-rich faction (3-8
// vs 5-15), so a 10× score multiplier was overpaying. 2× preserves the
// "aether is scarcer" thumb on the scale without pinning the leaderboard
// to a single resource. Speculative — revisit after a playthrough.
const SCORE_AETHER_WEIGHT = 0.1;

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

  // S7: faction-local override beats G.goldHegemonyThreshold even when mods
  // have rewritten the global. Coin sits at 4500; the others fall through.
  const goldThreshold =
    getVictoryProfile(cur.idx)?.goldHegemonyThreshold ?? G.goldHegemonyThreshold;
  if (cur.resources.gold >= goldThreshold) {
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

  // Phase 2k: snapshot at the start of each new game-turn. Triggers when
  // the rotation just wrapped back to faction 0 — once per G.turn. Sits
  // after recomputeVisibility so the snapshot's per-faction visibility
  // reflects the new turn's view, before any victory short-circuit so
  // the final turn is still captured for replay.
  if (G.currentFactionIdx === 0) recordReplaySnapshot();

  // Phase 2m: multi-human aware victory/defeat. Single-player collapses to
  // pre-2m behavior because humanFactionIdxs has exactly 1 entry. Hot-seat
  // rule: domination requires exactly one alive faction AND it's a human
  // (last human standing — humans must outlast each other AND any AI),
  // defeat requires every human dead.
  const humansAlive = G.humanFactionIdxs.filter((i) => G.factions[i].alive);
  const aliveTotal = G.factions.filter((f) => f.alive).length;
  if (humansAlive.length === 1 && aliveTotal === 1) {
    triggerVictory(humansAlive[0], 'domination');
    return;
  }
  if (humansAlive.length === 0) {
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

  // Phase 3 S1 — bus emit. Fires once the rotation is committed and just
  // before the handoff. Victory / defeat short-circuits above don't reach
  // here; that's the documented contract on the AnimEvent definition.
  emit({ type: 'turnEnd', factionIdx: cur.idx, turn: G.turn });

  dispatchHandoff(next);
}

// Phase 2m — called by main.ts / saveModal.ts after loadGameState restores
// G. In hot-seat, if the saved currentFactionIdx is a human different from
// the saved playerFactionIdx (i.e. autosave was taken right before a
// pending handoff to a *different* human), open the curtain so the right
// player gets the keyboard. In single-player or same-human resume cases,
// just redraw — keeps "Continue Last Game" instant for the common path.
export function resumeAfterLoad(): void {
  const cur = G.factions[G.currentFactionIdx];
  if (G.controlMode === 'hotseat' && !cur.isAI && cur.idx !== G.playerFactionIdx) {
    void openPassover(cur).then(() => {
      G.playerFactionIdx = cur.idx;
      recomputeVisibility();
      requestRedraw();
    });
    return;
  }
  requestRedraw();
}

// Phase 2m — handoff dispatch seam. Three paths:
//   - next is AI:                                             runAITurn
//   - next is human, single-player or same-human wraparound:  requestRedraw
//   - next is human, hot-seat AND a different human:          curtain → advance
// PBEM and Plinth modes plug in here as additional branches; the rest of
// the engine doesn't care which mode is active.
function dispatchHandoff(next: Faction): void {
  if (next.isAI) {
    runAITurn(next);
    return;
  }
  if (G.controlMode === 'hotseat' && next.idx !== G.playerFactionIdx) {
    void openPassover(next).then(() => {
      G.playerFactionIdx = next.idx;
      // Per-faction visibility was recomputed already; rebuild the player
      // edge-distance fog cache for the *new* viewer so fog renders for
      // their POV as soon as the curtain drops.
      recomputeVisibility();
      requestRedraw();
    });
    return;
  }
  requestRedraw();
}

export function runAITurn(faction: Faction): void {
  const lines = AI_THINKING_LINES[faction.personality];
  const line = lines[Math.floor(Math.random() * lines.length)];
  showAIThinking(`${faction.name} ${line}`);
  setTimeout(
    () => {
      const t0 = performance.now();
      // Phase 2n-2: snapshot the log counter so the AI action banner can
      // recover the events emitted by *just this AI* — even if the 100-
      // entry cap popped older ones during the turn.
      const logBefore = totalLogCount();
      aiPlayTurn(faction);
      const t1 = performance.now();
      recordTelemetry({
        kind: 'aiTurn',
        turn: G.turn,
        faction: faction.idx,
        durationMs: t1 - t0,
      });
      const newCount = totalLogCount() - logBefore;
      if (newCount > 0) {
        showAiActionBanner(faction, G.events.slice(0, Math.min(newCount, G.events.length)));
      }
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
  emit({ type: 'victoryReached', factionIdx, victoryType: type });
  const fac = G.factions[factionIdx];
  // Phase 2m: a human win is "any human won" so the shared screen banners
  // VICTORY for the table and DEFEAT only when the AI takes the game from
  // every human at once. Single-player collapses to the pre-2m semantics
  // because humanFactionIdxs has one entry equal to playerFactionIdx.
  const isPlayer = G.humanFactionIdxs.includes(factionIdx);
  if (isPlayer) playSfx('victory');
  const m = VICTORY_MESSAGES[type];
  // S7: faction-flavored title + flavor copy. Each faction declares the
  // overrides it cares about (e.g. Verdant → cultural, Coin → hegemony);
  // anything unset falls through to VICTORY_MESSAGES so the default reads
  // identically to pre-S7 (Cogwright is the byte-equal control).
  const profile = getVictoryProfile(factionIdx);
  const title = profile?.titles?.[type] ?? m.title;
  const flavorTemplate = profile?.flavorTemplates?.[type] ?? m.flavorTemplate;
  const flavor = flavorTemplate.replace('{name}', fac.name);
  const banner = isPlayer
    ? `<div class="victory-banner win"><h2 style="color:#99ee99">VICTORY: ${title}</h2><p style="margin-top:10px;font-style:italic">${flavor}</p></div>`
    : `<div class="victory-banner lose"><h2 style="color:var(--danger)">DEFEAT</h2><p style="margin-top:10px">${fac.name} has achieved ${title}.</p><p style="margin-top:6px;font-style:italic">${flavor}</p></div>`;
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
