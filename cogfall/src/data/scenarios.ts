// Phase 3 S3 — Scenario system scaffold.
//
// A ScenarioDef is a hand-authored game setup: which factions play, where
// they start, and (optionally) how mapgen / victory conditions deviate from
// the defaults. The registry ships *empty* in S3 — Session 8 authors the
// first three named scenarios on top of this scaffold. Until then, the
// setup-screen dropdown only offers "Random map" and the scenario branch in
// systems/setup.ts is dead code on every code path.
//
// startBuildings and victoryOverrides are intentionally typed but not
// consumed in S3 — keeping the type stable across S7/S8 avoids re-shaping
// later. See decision-log item 12 in core/state.ts.

import { hexKey } from '../core/hex';
import type { FactionIdx, GameMap, Tile } from '../core/types';
import { TERRAIN_TYPES } from '../data/terrain';
import type { TechId } from '../data/techs';
import type { MapSizeId } from '../data/factions';
import type { ResourceDensity, WaterLevel } from '../systems/mapgen';

export interface ScenarioFactionStart {
  /** Index into the FACTIONS table (data/factions.ts). */
  idx: FactionIdx;
  /** Axial coords of the faction's capital tile. Must be on a walkable
   * tile of the generated/overridden map; resolveScenarioStarts throws
   * otherwise. */
  startQ: number;
  startR: number;
  /** Appended to the faction's default startTechs at game start. Optional. */
  startTechs?: readonly TechId[];
  /** Type-only in S3 — S8 wires consumption when its scenario content
   * needs pre-placed buildings at the capital. */
  startBuildings?: readonly string[];
}

export interface ScenarioMapGenOverrides {
  mapSize?: MapSizeId;
  waterLevel?: WaterLevel;
  resourceDensity?: ResourceDensity;
}

export interface ScenarioDef {
  id: string;
  name: string;
  description: string;
  factions: readonly ScenarioFactionStart[];
  mapGenOverrides?: ScenarioMapGenOverrides;
  /** Type-only placeholder in S3 — S7 (faction-flavored victory paths)
   * designs the concrete shape when it lands. */
  victoryOverrides?: Record<string, unknown>;
}

export const SCENARIOS: readonly ScenarioDef[] = [];

/** Lookup by id. Returns null for null/undefined input or unknown ids so
 * the setup-flow caller can use a uniform `if (scenario) { ... }` branch. */
export function getScenario(id: string | null | undefined): ScenarioDef | null {
  if (id == null || id === '') return null;
  return SCENARIOS.find((s) => s.id === id) ?? null;
}

/**
 * Resolve a scenario's per-faction (q, r) starts to actual map Tiles, in
 * scenario.factions order. Pure — no G access, no RNG draws. Throws if a
 * coord is off-map or on unwalkable terrain so authoring mistakes surface
 * immediately at setup time instead of at city-placement time.
 */
export function resolveScenarioStarts(scenario: ScenarioDef, map: GameMap): Tile[] {
  return scenario.factions.map((s, i) => {
    const tile = map.tiles.get(hexKey(s.startQ, s.startR));
    if (!tile) {
      throw new Error(
        `Scenario "${scenario.id}" faction[${i}] start (${s.startQ}, ${s.startR}) is off-map.`,
      );
    }
    if (!TERRAIN_TYPES[tile.terrain].walkable) {
      throw new Error(
        `Scenario "${scenario.id}" faction[${i}] start (${s.startQ}, ${s.startR}) is on ${tile.terrain} (unwalkable).`,
      );
    }
    return tile;
  });
}
