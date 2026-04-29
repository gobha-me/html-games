// Game setup orchestration. setupGame() is called when the player clicks
// "Begin the Awakening" — it reads the form, generates the map, creates the
// player + AI factions, places starting cities and units, and centers the
// camera on the player capital.

import { hexNeighbors } from '../core/hex';
import { log } from '../core/log';
import { getGameRng, initGameRng, shuffle } from '../core/rng';
import { G, getTile, getUnitAt } from '../core/state';
import type { Difficulty, Faction, FactionIdx } from '../core/types';
import { FACTIONS, type MapSizeId, type FactionDef } from '../data/factions';
import { TERRAIN_TYPES } from '../data/terrain';
import { UNIT_TYPES } from '../data/units';
import { initAIMemory } from '../ai/memory';
import { createCity, pickCityName, resetCityNames } from './city';
import {
  generateMap,
  findFactionStarts,
  type WaterLevel,
  type ResourceDensity,
} from './mapgen';
import { createUnit } from './movement';
import { recomputeVisibility } from './visibility';
import { clearTelemetryLog } from './telemetry';
import { clearReplayLog, recordReplaySnapshot } from './replay';
import { DOM_IDS } from '../core/dom';
import { centerOnHex, resizeCanvas } from '../render/pixi';
import { closeModal } from '../ui/modals';
import { updateUI } from '../ui/topbar';
import { render } from '../render/pixi';
import { getHumanFactionIndices, getSetupControlMode, getSetupSeed } from '../ui/setupModal';

const STARTING_GOLD = 50;
const COIN_BONUS_GOLD = 50;
const HARD_AI_GOLD_BONUS = 100;
const HARD_AI_SCIENCE_BONUS = 20;
const HEGEMONY_GOLD_QUICK = 3000;
const HEGEMONY_GOLD_STANDARD = 5000;
const HEGEMONY_GOLD_LONG = 8000;
const MAX_OPPONENTS = 4;

export function createFaction(template: FactionDef, isAI: boolean, idx: number): Faction {
  const f: Faction = {
    idx: idx as FactionIdx,
    id: template.id,
    name: template.name,
    color: template.color,
    glyph: template.glyph,
    personality: template.personality,
    desc: template.desc,
    isAI,
    alive: true,
    resources: { gold: STARTING_GOLD, aether: 0 },
    science: 0,
    researchProgress: 0,
    techs: new Set(template.startTechs || []),
    currentResearch: null,
    score: 0,
    diplo: {},
    startBonus: 'startBonus' in template ? template.startBonus : undefined,
    traits: template.traits,
  };
  if (template.id === 'coin') f.resources.gold += COIN_BONUS_GOLD;
  return f;
}

export function setupGame(): void {
  const mapSizeEl = document.getElementById(DOM_IDS.MAP_SIZE) as HTMLSelectElement;
  const opponentCountEl = document.getElementById(DOM_IDS.OPPONENT_COUNT) as HTMLInputElement;
  const difficultyEl = document.getElementById(DOM_IDS.DIFFICULTY) as HTMLSelectElement;
  const speedEl = document.getElementById(DOM_IDS.GAME_SPEED) as HTMLSelectElement;
  const waterEl = document.getElementById(DOM_IDS.WATER_LEVEL) as HTMLSelectElement | null;
  const densityEl = document.getElementById(
    DOM_IDS.RESOURCE_DENSITY,
  ) as HTMLSelectElement | null;

  const mapSize = mapSizeEl.value as MapSizeId;
  const waterLevel = (waterEl?.value ?? 'coasts') as WaterLevel;
  const resourceDensity = (densityEl?.value ?? 'standard') as ResourceDensity;
  const opponentCount = Math.max(
    1,
    Math.min(MAX_OPPONENTS, parseInt(opponentCountEl.value, 10) || 3)
  );
  G.difficulty = difficultyEl.value as Difficulty;
  const speed = speedEl.value;
  G.goldHegemonyThreshold =
    speed === 'quick'
      ? HEGEMONY_GOLD_QUICK
      : speed === 'long'
        ? HEGEMONY_GOLD_LONG
        : HEGEMONY_GOLD_STANDARD;

  // Reset module-scope state from any previous game.
  resetCityNames();
  clearTelemetryLog();
  clearReplayLog();
  G.factions = [];
  G.units = [];
  G.cities = [];
  G.events = [];
  G.goldHegemonyCounter = {};
  G.culturalHegemonyCounter = {};
  // Setup-modal toggle for the cultural-hegemony win condition. Default
  // on if the checkbox is missing (defensive — the input ships in 2g-6).
  const culturalEl = document.getElementById(DOM_IDS.CULTURAL_VICTORY) as HTMLInputElement | null;
  G.culturalHegemonyEnabled = culturalEl ? culturalEl.checked : true;
  G.aiMemory = {};
  G.gameOver = false;
  G.turn = 1;
  G.nextUnitId = 1;
  G.nextCityId = 1;
  G.selected = null;
  G.moveTargets = [];
  G.attackTargets = [];

  // RNG: stamp the seed and initialise the game rng *before* mapgen so the
  // world is fully reproducible from this seed alone.
  G.seed = getSetupSeed();
  initGameRng(G.seed);

  G.map = generateMap(mapSize, getGameRng(), { waterLevel, resourceDensity });

  // Build factions. Phase 2m: hot-seat picks N humans from the FACTIONS
  // pool; AI fills the remainder. Single-player path is byte-identical to
  // pre-2m (1 human + opponentCount AIs from the shuffled pool).
  const controlMode = getSetupControlMode();
  const humanPoolIdxs = getHumanFactionIndices();
  const aiPool = FACTIONS.filter((_, i) => !humanPoolIdxs.includes(i)).slice() as unknown as FactionDef[];
  shuffle(aiPool, getGameRng());

  // In hot-seat every remaining FACTION plays ("AI picks what's left").
  // In single-player the user-set opponent count caps AI seats as today.
  const aiCount = controlMode === 'hotseat' ? aiPool.length : opponentCount;

  // Push humans in pool-index ascending order (deterministic; matches
  // setupModal's "lowest-human-index becomes the first seat" rule), then
  // AIs from the shuffled remaining pool.
  humanPoolIdxs.forEach((poolIdx, gameIdx) => {
    const def = FACTIONS[poolIdx] as unknown as FactionDef;
    G.factions.push(createFaction(def, false, gameIdx));
  });
  for (let i = 0; i < aiCount; i++) {
    G.factions.push(createFaction(aiPool[i], true, humanPoolIdxs.length + i));
  }
  G.controlMode = controlMode;
  G.humanFactionIdxs = humanPoolIdxs.map((_, gameIdx) => gameIdx as FactionIdx);
  G.playerFactionIdx = 0 as FactionIdx;
  G.currentFactionIdx = 0 as FactionIdx;
  G.passoverActive = false;

  // Initial diplo: all unmet.
  for (const f of G.factions) {
    for (const f2 of G.factions) if (f !== f2) f.diplo[f2.idx] = 'unmet';
  }

  // AI memory.
  for (const f of G.factions) if (f.isAI) initAIMemory(f.idx);

  // Faction starts: capital + initial units.
  const starts = findFactionStarts(G.factions.length);
  for (let i = 0; i < G.factions.length; i++) {
    const f = G.factions[i];
    const s = starts[i];
    const c = createCity(f.idx, s.q, s.r, pickCityName());
    c.isCapital = true;

    const cogSpot = hexNeighbors(s.q, s.r).find((n) => {
      const t = getTile(n.q, n.r);
      return t && TERRAIN_TYPES[t.terrain].walkable && !getUnitAt(n.q, n.r);
    });
    if (cogSpot) createUnit('COGMAN', f.idx, cogSpot.q, cogSpot.r);

    const tpl = FACTIONS.find((ff) => ff.id === f.id);
    if (tpl && 'startBonus' in tpl) {
      if (tpl.startBonus === 'extra_warrior') {
        const spot = hexNeighbors(s.q, s.r).find((n) => {
          const t = getTile(n.q, n.r);
          return t && TERRAIN_TYPES[t.terrain].walkable && !getUnitAt(n.q, n.r);
        });
        if (spot) createUnit('COGMAN', f.idx, spot.q, spot.r);
      }
      if (tpl.startBonus === 'extra_pioneer') {
        const spot = hexNeighbors(s.q, s.r).find((n) => {
          const t = getTile(n.q, n.r);
          return t && TERRAIN_TYPES[t.terrain].walkable && !getUnitAt(n.q, n.r);
        });
        if (spot) createUnit('PIONEER', f.idx, spot.q, spot.r);
      }
    }

    const spot2 = hexNeighbors(s.q, s.r).find((n) => {
      const t = getTile(n.q, n.r);
      return t && TERRAIN_TYPES[t.terrain].walkable && !getUnitAt(n.q, n.r);
    });
    if (spot2) createUnit('PIONEER', f.idx, spot2.q, spot2.r);
    const spot3 = hexNeighbors(s.q, s.r).find((n) => {
      const t = getTile(n.q, n.r);
      return t && TERRAIN_TYPES[t.terrain].walkable && !getUnitAt(n.q, n.r);
    });
    if (spot3) createUnit('SCOUT', f.idx, spot3.q, spot3.r);
  }

  // Difficulty bonus for AI.
  if (G.difficulty === 'hard') {
    for (const f of G.factions) {
      if (f.isAI) {
        f.resources.gold += HARD_AI_GOLD_BONUS;
        f.science += HARD_AI_SCIENCE_BONUS;
      }
    }
  }

  recomputeVisibility();

  for (const u of G.units.filter((u) => u.factionIdx === G.playerFactionIdx)) {
    u.mp = UNIT_TYPES[u.typeId].mp;
  }

  // Phase 2k: turn-1 baseline snapshot. The endTurn hook records every
  // subsequent game-turn boundary, but turn 1 needs an explicit capture
  // so the replay viewer can scrub all the way back to the opening state.
  // Done before resizeCanvas / render below so a transient Pixi-not-ready
  // throw can't swallow the baseline.
  recordReplaySnapshot();

  const myCap = G.cities.find((c) => c.factionIdx === G.playerFactionIdx);
  if (myCap) centerOnHex(myCap.q, myCap.r);

  closeModal(DOM_IDS.SETUP_MODAL);
  resizeCanvas();
  log(`The Awakening begins. ${G.factions[0].name} stirs from the ash.`, 'flavor');
  log(
    `Your goal: dominate, ascend, or amass ${G.goldHegemonyThreshold} gold for ${G.goldHegemonyRequired} turns.`,
    'flavor'
  );

  updateUI();
  render();
}
