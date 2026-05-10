// Per-faction AI behavior overlays (Phase 3 S5).
//
// Each faction here gets a hook-bearing `AIBehavior` plugged into
// `Faction.behavior` at game start (setup.ts) and on save load
// (save.ts:applySerializedStateToG). The default-faction byte-equal
// contract (decision-log item 11 in core/state.ts) holds: factions
// absent from this table — currently `cogwright` — return undefined
// from `getFactionBehavior` and play exactly as the personality
// template alone dictates.
//
// pickBuild SAFETY: the call site (cityAI.ts:21) returns the override
// UNCONDITIONALLY. Hook bodies MUST self-guard `city.buildings.has(id)`
// AND any `requires` tech — `processCity` doesn't re-check, so an
// already-built or prereq-missing return wastes a turn of city
// production. The `buildIfMissing` helper centralizes both checks for
// building picks; unit picks gate on `requires` directly via
// `faction.techs.has(...)`.
//
// pickTech is gentler: techAI.ts:14 filters with
// `avail.some(t => t.id === override)`, so returning a tech whose
// prereqs aren't satisfied (or that's already researched) silently
// falls through to default scoring. Each preference list below puts
// prereqs before their children, so the hook returns the next legal
// step in the chain — no skipping.
//
// Hook bodies are pure: they walk small constant-length preference
// lists or read `faction.techs` / `city.buildings` Sets. None consume
// `rng`, so replays stay deterministic across the override.

import type { AIBehavior } from '../ai/behavior';
import { G } from '../core/state';
import type { BuildQueue, City, Faction, TechId, UnitTypeId } from '../core/types';
import { BUILDING_TYPES, type BuildingId } from './buildings';
import type { FactionId } from './factions';

function nextMissingTech(faction: Faction, ids: readonly TechId[]): TechId | null {
  for (const id of ids) {
    if (!faction.techs.has(id)) return id;
  }
  return null;
}

function nextMissingBuilding(
  faction: Faction,
  city: City,
  ids: readonly BuildingId[]
): BuildQueue | null {
  for (const id of ids) {
    if (city.buildings.has(id)) continue;
    const def = BUILDING_TYPES[id];
    if ('requires' in def && def.requires && !faction.techs.has(def.requires)) continue;
    return { kind: 'building', id };
  }
  return null;
}

const IRON_TECH_PRIORITY: readonly TechId[] = [
  'metallurgy',
  'gunpowder',
  'steamcraft',
  'steam_armor',
];

const AETHERIC_TECH_PRIORITY: readonly TechId[] = [
  'rediscovery',
  'aetherics',
  'espionage',
  'aether_war',
  'grand_apparatus',
];
const AETHERIC_BUILD_PRIORITY: readonly BuildingId[] = ['library', 'spire', 'academy'];

const VERDANT_TECH_PRIORITY: readonly TechId[] = ['cartography', 'lithography', 'salons'];
const VERDANT_BUILD_PRIORITY: readonly BuildingId[] = ['walls', 'opera_house'];

const COIN_TECH_PRIORITY: readonly TechId[] = ['currency', 'banking', 'cartography'];
const COIN_BUILD_PRIORITY: readonly BuildingId[] = ['bank', 'foundry'];

export const FACTION_BEHAVIORS: Partial<Record<FactionId, AIBehavior>> = {
  // Iron Legion — rushes infantry; telegraphs war earlier via agg overlay
  // flowing through effectiveAgg → aiDiplomacy.
  iron: {
    agg: 0.9,
    pickTech: (faction) => nextMissingTech(faction, IRON_TECH_PRIORITY),
    pickBuild: (faction, city) => {
      const atWar = G.factions.some(
        (_, i) => i !== faction.idx && faction.diplo[i] === 'war'
      );
      const garrison = G.units.some(
        (u) =>
          u.factionIdx === faction.idx &&
          u.q === city.q &&
          u.r === city.r &&
          (u.typeId === 'COGMAN' ||
            u.typeId === 'MUSKETEER' ||
            u.typeId === 'STEAMTANK' ||
            u.typeId === 'AETHERMECH')
      );
      if (!atWar && garrison) return null;
      const bestMil: UnitTypeId = faction.techs.has('gunpowder') ? 'MUSKETEER' : 'COGMAN';
      return { kind: 'unit', id: bestMil };
    },
  },

  // Aetheric Order — science beeline + science-building spam.
  aetheric: {
    sci: 0.95,
    pickTech: (faction) => nextMissingTech(faction, AETHERIC_TECH_PRIORITY),
    pickBuild: (faction, city) => nextMissingBuilding(faction, city, AETHERIC_BUILD_PRIORITY),
  },

  // Verdant Pact — turtles up; builds walls before anything else, then
  // opera house once Salons is researched.
  verdant: {
    agg: 0.1,
    pickTech: (faction) => nextMissingTech(faction, VERDANT_TECH_PRIORITY),
    pickBuild: (faction, city) => nextMissingBuilding(faction, city, VERDANT_BUILD_PRIORITY),
  },

  // Coalition of Coin — war-averse via agg overlay; econ buildings first.
  coin: {
    agg: 0.3,
    pickTech: (faction) => nextMissingTech(faction, COIN_TECH_PRIORITY),
    pickBuild: (faction, city) => nextMissingBuilding(faction, city, COIN_BUILD_PRIORITY),
  },
};

export function getFactionBehavior(id: FactionId): AIBehavior | undefined {
  return FACTION_BEHAVIORS[id];
}
