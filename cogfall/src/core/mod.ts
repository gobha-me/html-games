// Mod system. Lets a user override the seven data tables in cogfall/src/data/
// at game-setup time via a single JSON object. The merge model:
//
//   - Object-shape tables (units, buildings, techs, etc.): per-id deep merge.
//     New ids add; existing ids partial-override their fields. A `null` value
//     removes the id.
//   - Array-shape tables (factions, cityNames): full replace. Wired in 2i-3.
//
// Loading rules:
//   - applyMod must be called while no game is in progress (G.map === null).
//     Mid-game application would invalidate Pixi sprite caches and game-state
//     references that were minted from the data tables at game start.
//   - applyMod is transactional: the validator runs before any mutation.
//     If the post-merge starter-unit check fails, all mutations roll back.
//   - applyMod replaces. Calling it twice with two different mods is fine —
//     the tables reset to the original snapshot each time before merging.
//   - clearMod resets the tables to their built-in defaults.
//
// AI scoring contract: aiPickBuild / aiPickTech filter on `requires`, so
// options pointing at nonexistent prereq techs go silently unavailable
// rather than crashing. A mod that cranks values 10× will skew AI behavior
// proportionally — that's modder-balance territory, not engine territory.

import { G } from './state';
import { TERRAIN_TYPES } from '../data/terrain';
import { UNIT_TYPES } from '../data/units';
import { BUILDING_TYPES } from '../data/buildings';
import { TECHS, TECH_BRANCHES } from '../data/techs';
import { RESOURCES } from '../data/resources';
import { PERSONALITIES, AI_THINKING_LINES } from '../data/personalities';
import { MAP_SIZES } from '../data/factions';

export interface ModDef {
  name: string;
  version: string;
  terrain?: Record<string, Record<string, unknown> | null>;
  units?: Record<string, Record<string, unknown> | null>;
  buildings?: Record<string, Record<string, unknown> | null>;
  techs?: Record<string, Record<string, unknown> | null>;
  techBranches?: Record<string, Record<string, unknown> | null>;
  resources?: Record<string, Record<string, unknown> | null>;
  personalities?: Record<string, Record<string, unknown> | null>;
  mapSizes?: Record<string, Record<string, unknown> | null>;
  aiThinkingLines?: Record<string, string[]>;
}

export class ModValidationError extends Error {
  constructor(public path: string, message: string) {
    super(`[mod ${path}] ${message}`);
    this.name = 'ModValidationError';
  }
}

// systems/setup.ts spawns these literal ids when starting a new game; if a
// mod removes any of them, the game crashes at first turn. applyMod throws
// up front instead.
const STARTER_UNIT_IDS = ['COGMAN', 'PIONEER', 'SCOUT'] as const;

interface Snapshot {
  terrain: Record<string, Record<string, unknown>>;
  units: Record<string, Record<string, unknown>>;
  buildings: Record<string, Record<string, unknown>>;
  techs: Record<string, Record<string, unknown>>;
  techBranches: Record<string, Record<string, unknown>>;
  resources: Record<string, Record<string, unknown>>;
  personalities: Record<string, Record<string, unknown>>;
  mapSizes: Record<string, Record<string, unknown>>;
  aiThinkingLines: Record<string, string[]>;
}

let snapshot: Snapshot | null = null;
let activeMod: { name: string; version: string; hash: string } | null = null;

const OBJECT_TABLES = {
  terrain: TERRAIN_TYPES,
  units: UNIT_TYPES,
  buildings: BUILDING_TYPES,
  techs: TECHS,
  techBranches: TECH_BRANCHES,
  resources: RESOURCES,
  personalities: PERSONALITIES,
  mapSizes: MAP_SIZES,
} as const;

type ObjectTableKey = keyof typeof OBJECT_TABLES;

function takeSnapshot(): Snapshot {
  return {
    terrain: structuredClone(TERRAIN_TYPES) as Snapshot['terrain'],
    units: structuredClone(UNIT_TYPES) as Snapshot['units'],
    buildings: structuredClone(BUILDING_TYPES) as Snapshot['buildings'],
    techs: structuredClone(TECHS) as Snapshot['techs'],
    techBranches: structuredClone(TECH_BRANCHES) as Snapshot['techBranches'],
    resources: structuredClone(RESOURCES) as Snapshot['resources'],
    personalities: structuredClone(PERSONALITIES) as Snapshot['personalities'],
    mapSizes: structuredClone(MAP_SIZES) as Snapshot['mapSizes'],
    aiThinkingLines: structuredClone(AI_THINKING_LINES) as unknown as Snapshot['aiThinkingLines'],
  };
}

function restoreSnapshot(snap: Snapshot): void {
  for (const key of Object.keys(OBJECT_TABLES) as ObjectTableKey[]) {
    const live = OBJECT_TABLES[key] as Record<string, unknown>;
    const baseline = snap[key];
    for (const k of Object.keys(live)) delete live[k];
    for (const [k, v] of Object.entries(baseline)) {
      live[k] = structuredClone(v);
    }
  }
  const lines = AI_THINKING_LINES as unknown as Record<string, string[]>;
  for (const k of Object.keys(lines)) delete lines[k];
  for (const [k, v] of Object.entries(snap.aiThinkingLines)) {
    lines[k] = [...v];
  }
}

function mergeOrRemove(
  target: Record<string, unknown>,
  mod: Record<string, Record<string, unknown> | null>,
  path: string
): void {
  for (const [id, value] of Object.entries(mod)) {
    if (value === null) {
      delete target[id];
    } else if (id in target) {
      Object.assign(target[id] as object, value);
    } else {
      target[id] = structuredClone(value);
    }
    void path;
  }
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function validateMod(mod: unknown): asserts mod is ModDef {
  if (!isPlainObject(mod)) {
    throw new ModValidationError('$', 'mod root must be an object');
  }
  if (typeof mod.name !== 'string' || mod.name.length === 0) {
    throw new ModValidationError('$.name', 'must be a non-empty string');
  }
  if (typeof mod.version !== 'string' || mod.version.length === 0) {
    throw new ModValidationError('$.version', 'must be a non-empty string');
  }

  const objectSections = [
    'terrain',
    'units',
    'buildings',
    'techs',
    'techBranches',
    'resources',
    'personalities',
    'mapSizes',
  ] as const;
  for (const section of objectSections) {
    const v = (mod as Record<string, unknown>)[section];
    if (v === undefined) continue;
    if (!isPlainObject(v)) {
      throw new ModValidationError(`$.${section}`, 'must be an object');
    }
    for (const [id, entry] of Object.entries(v)) {
      if (entry !== null && !isPlainObject(entry)) {
        throw new ModValidationError(`$.${section}.${id}`, 'must be an object or null');
      }
    }
  }

  const lines = (mod as Record<string, unknown>).aiThinkingLines;
  if (lines !== undefined) {
    if (!isPlainObject(lines)) {
      throw new ModValidationError('$.aiThinkingLines', 'must be an object');
    }
    for (const [id, val] of Object.entries(lines)) {
      if (!Array.isArray(val) || !val.every((s): s is string => typeof s === 'string')) {
        throw new ModValidationError(`$.aiThinkingLines.${id}`, 'must be an array of strings');
      }
    }
  }
}

// FNV-1a 32-bit over a canonical JSON serialization (keys sorted). Stable
// across re-orderings, used in 2i-5 to bind a save to its mod.
function canonicalJSON(x: unknown): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x);
  if (Array.isArray(x)) return '[' + x.map(canonicalJSON).join(',') + ']';
  const obj = x as Record<string, unknown>;
  return (
    '{' +
    Object.keys(obj)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + canonicalJSON(obj[k]))
      .join(',') +
    '}'
  );
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function modHash(mod: ModDef): string {
  return fnv1a(canonicalJSON(mod));
}

export function applyMod(mod: unknown): ModDef {
  if (G.map !== null) {
    throw new ModValidationError('$', 'cannot apply mod while a game is in progress');
  }
  validateMod(mod);

  if (snapshot === null) {
    snapshot = takeSnapshot();
  } else {
    restoreSnapshot(snapshot);
  }

  if (mod.terrain) mergeOrRemove(TERRAIN_TYPES as unknown as Record<string, unknown>, mod.terrain, '$.terrain');
  if (mod.units) mergeOrRemove(UNIT_TYPES as unknown as Record<string, unknown>, mod.units, '$.units');
  if (mod.buildings) mergeOrRemove(BUILDING_TYPES as unknown as Record<string, unknown>, mod.buildings, '$.buildings');
  if (mod.techs) mergeOrRemove(TECHS as unknown as Record<string, unknown>, mod.techs, '$.techs');
  if (mod.techBranches) mergeOrRemove(TECH_BRANCHES as unknown as Record<string, unknown>, mod.techBranches, '$.techBranches');
  if (mod.resources) mergeOrRemove(RESOURCES as unknown as Record<string, unknown>, mod.resources, '$.resources');
  if (mod.personalities) mergeOrRemove(PERSONALITIES as unknown as Record<string, unknown>, mod.personalities, '$.personalities');
  if (mod.mapSizes) mergeOrRemove(MAP_SIZES as unknown as Record<string, unknown>, mod.mapSizes, '$.mapSizes');

  if (mod.aiThinkingLines) {
    const target = AI_THINKING_LINES as unknown as Record<string, string[]>;
    for (const [id, lines] of Object.entries(mod.aiThinkingLines)) {
      target[id] = [...lines];
    }
  }

  for (const id of STARTER_UNIT_IDS) {
    if (!(id in UNIT_TYPES)) {
      restoreSnapshot(snapshot);
      throw new ModValidationError(
        `$.units.${id}`,
        `cannot remove starter unit ${id} — systems/setup.ts spawns it literally`
      );
    }
  }

  activeMod = { name: mod.name, version: mod.version, hash: modHash(mod) };
  return mod;
}

export function clearMod(): void {
  if (snapshot === null) return;
  restoreSnapshot(snapshot);
  snapshot = null;
  activeMod = null;
}

export function getActiveMod(): { name: string; version: string; hash: string } | null {
  return activeMod;
}
