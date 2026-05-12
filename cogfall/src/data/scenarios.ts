// Phase 3 S3 — Scenario system scaffold; S8 lands three named scenarios on
// top of it.
//
// A ScenarioDef is a hand-authored game setup: which factions play, where
// they start, and (optionally) how mapgen / victory conditions deviate from
// the defaults. Shipped scenarios pin `seed` so hand-picked start coords
// stay valid across machines and replays — the typedef keeps `seed?` so
// test fixtures can omit it; production scenarios always set it. The
// `prologue` field is required: one or two sentences in the steampunk-
// literary register, surfaced via `log(prologue, 'flavor')` in the scenario
// branch of `systems/setup.ts` before `recordReplaySnapshot` so the turn-1
// snapshot captures it.
//
// `ScenarioFactionStart` carries optional cosmetic overrides
// (`nameOverride`, `colorOverride`, `glyphOverride`) so two entries can
// reference the same FactionDef (`idx`) while rendering distinctly — used
// by "Steamguild Civil War" to seat two Cogwright factions. AI behavior,
// victoryProfile, and default startTechs all still resolve through `idx`,
// so the override is purely visual. When a scenario seats duplicate
// FactionIdx values, the *first* scenario.factions entry matching the
// player's pick becomes the human seat; later matches force AI
// (deterministic tiebreak — see systems/setup.ts scenario branch).
//
// startBuildings and victoryOverrides remain intentionally typed but not
// consumed through S8 — keeping the type stable avoids re-shaping later.
// See decision-log item 12 in core/state.ts.

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
  /** Type-only through S8 — wired when a scenario needs pre-placed
   * improvements at the capital. */
  startBuildings?: readonly string[];
  /** Visual-only overrides applied after `createFaction` in the scenario
   * branch of `systems/setup.ts`. The underlying FactionDef (`idx`) still
   * supplies AI behavior, victoryProfile, and default startTechs — these
   * fields only re-skin name/color/glyph for cases like "Steamguild
   * Civil War" where two seats share an `idx`. */
  nameOverride?: string;
  colorOverride?: string;
  glyphOverride?: string;
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
  /** Opening narration shown at game start via `log(..., 'flavor')`. One
   * or two sentences in the steampunk-literary register. Pushed before
   * `recordReplaySnapshot` so the turn-1 snapshot captures it. */
  prologue: string;
  factions: readonly ScenarioFactionStart[];
  mapGenOverrides?: ScenarioMapGenOverrides;
  /** Pin a fixed RNG seed so hand-picked start coords stay valid across
   * machines and replays. Optional in the type to keep test fixtures
   * minimal; every shipped scenario sets it. When present, overrides the
   * form seed in `systems/setup.ts`. */
  seed?: number;
  /** Type-only placeholder through S8 — S7 routed faction-flavored
   * victory work through `factions.ts:victoryProfile` instead, so the
   * concrete shape stays deferred until a scenario actually needs it. */
  victoryOverrides?: Record<string, unknown>;
}

export const SCENARIOS: readonly ScenarioDef[] = [
  {
    id: 'aether_ascendancy',
    name: 'The Aether Ascendancy',
    description:
      'The Aetheric Order chases the Grand Apparatus while three watchful neighbors map its smoke.',
    prologue:
      'The Order has charted the year the heavens unbalance. One tower must rise; three rivals already mark the rim; and the ground between is ash. Wake the Grand Apparatus, Steward, or watch the lattice tilt forever.',
    seed: 1,
    mapGenOverrides: {
      mapSize: 'medium',
      waterLevel: 'lakes',
      resourceDensity: 'sparse',
    },
    factions: [
      // Aetheric (player-eligible) at the center, with a Currency tempo
      // push to keep the rush from starving on sparse resources.
      { idx: 1 as FactionIdx, startQ: 8, startR: 8, startTechs: ['currency'] },
      // Iron Legion on the NW rim.
      { idx: 2 as FactionIdx, startQ: 1, startR: 2 },
      // Coalition of Coin on the NE rim.
      { idx: 4 as FactionIdx, startQ: 20, startR: 2 },
      // Verdant Pact on the southern frontier.
      { idx: 3 as FactionIdx, startQ: 4, startR: 14 },
    ],
  },
  {
    id: 'steamguild_civil_war',
    name: 'Steamguild Civil War',
    description:
      'The Cogwright Guild fractured. One charter, two forges, one continent that will not hold them both.',
    prologue:
      'Two guildmasters, one charter. The Cogwright Guild has split along a fault no one in living memory remembers laying. The elder line holds the eastern forge; the Sundered Cogwright marches from the west. Beneath the ash the great machine still ticks, indifferent to either banner.',
    seed: 1,
    mapGenOverrides: {
      mapSize: 'small',
      waterLevel: 'none',
      resourceDensity: 'standard',
    },
    factions: [
      // Cogwright A — defaults, holds the western forge. Player picks
      // "Cogwright" at setup; the first matching entry becomes the human
      // seat (deterministic tiebreak in systems/setup.ts scenario branch).
      { idx: 0 as FactionIdx, startQ: 0, startR: 4, startTechs: ['gunpowder'] },
      // Cogwright B — the Sundered Cogwright, re-skinned with darker
      // brass and a different glyph. Same FactionDef under the hood, so
      // AI behavior, victoryProfile, and base startTechs all resolve
      // identically; only name/color/glyph re-skin.
      {
        idx: 0 as FactionIdx,
        startQ: 12,
        startR: 4,
        startTechs: ['gunpowder'],
        nameOverride: 'The Sundered Cogwright',
        colorOverride: '#8b5a0a',
        glyphOverride: '⚙',
      },
    ],
  },
  {
    id: 'coastal_conquest',
    name: 'Coastal Conquest',
    description:
      'Iron drums, mercantile flags, and two banners across the salt. Whoever masters the keels masters the coast.',
    prologue:
      'Two banners face the salt — the Iron Legion drumming from the west, the Coalition of Coin flying its flags east. Across the deep water the Aetheric Order and the Verdant Pact have already begun to chart the channel. The land will not be enough, Steward. Build a keel before they build two.',
    seed: 4,
    mapGenOverrides: {
      mapSize: 'medium',
      waterLevel: 'continents',
      resourceDensity: 'standard',
    },
    factions: [
      // Iron Legion (player-eligible) on the western coast.
      { idx: 2 as FactionIdx, startQ: 3, startR: 6 },
      // Coalition of Coin (player-eligible) on the eastern coast.
      { idx: 4 as FactionIdx, startQ: 23, startR: 5 },
      // Aetheric Order on the southern strip.
      { idx: 1 as FactionIdx, startQ: 14, startR: 13 },
      // Verdant Pact on the northern strip.
      { idx: 3 as FactionIdx, startQ: 6, startR: 2 },
    ],
  },
];

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
