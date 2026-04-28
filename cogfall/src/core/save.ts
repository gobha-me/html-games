// Save / load. JSON-serializes GameState to localStorage with explicit
// handling for Sets (faction.techs, city.buildings) and the tile Map. A
// version field is stamped into every save so future schema changes can
// fail loudly instead of silently corrupting state.
//
// Slot layout: 3 manual slots + 1 autosave. Autosave fires at end of every
// player turn (in systems/turn.ts). Transient state (selection, drag,
// move/attack targets) is intentionally NOT persisted — those reset on load.

import { G } from './state';
import { log } from './log';
import { getGameRngState, initGameRng, setGameRngState } from './rng';
import type {
  AIMemory,
  BuildingId,
  City,
  Difficulty,
  DragStart,
  Faction,
  FactionIdx,
  GameMap,
  LogEntry,
  TechId,
  Tile,
  TileKey,
  Unit,
} from './types';

// v1 → v2: added `seed` + `rngState` to SerializedGameState (Phase 2b).
// v1 saves are loaded with an auto-assigned Date.now() seed and a fresh
// rng cursor — they remain playable but their future RNG sequence is
// fresh, not reproducible. A console warning + an in-game log entry
// surface the migration so the player understands why a "replay this
// game from the same point" wouldn't be byte-identical.
//
// v2 → v3: added cultural-hegemony state on GameState and `claim` on Tile
// (Phase 2g). v2 saves load with cultural counter empty, threshold/required
// at engine defaults, and `culturalHegemonyEnabled = true`. Tile.claim is
// optional, so v2 tiles simply have no claim until the next endTurn pass.
export const SAVE_VERSION = 3;
export const MANUAL_SLOTS = 3;
export const AUTOSAVE_KEY = 'cogfall:autosave';
const slotKey = (n: number): string => `cogfall:save:${n}`;

// --- Serialized shapes -----------------------------------------------------

interface SerializedFaction extends Omit<Faction, 'techs'> {
  techs: TechId[];
}

interface SerializedCity extends Omit<City, 'buildings'> {
  buildings: BuildingId[];
}

interface SerializedMap {
  w: number;
  h: number;
  tiles: Array<[TileKey, Tile]>;
}

interface SerializedGameState {
  map: SerializedMap | null;
  factions: SerializedFaction[];
  units: Unit[];
  cities: SerializedCity[];
  turn: number;
  currentFactionIdx: FactionIdx;
  playerFactionIdx: FactionIdx;
  difficulty: Difficulty;
  goldHegemonyThreshold: number;
  goldHegemonyRequired: number;
  goldHegemonyCounter: Partial<Record<number, number>>;
  events: LogEntry[];
  cameraX: number;
  cameraY: number;
  zoom: number;
  nextUnitId: number;
  nextCityId: number;
  gameOver: boolean;
  aiMemory: Partial<Record<number, AIMemory>>;
  /** v2+: seed used to init the game rng. Stamped for replay (Phase 2k). */
  seed: number;
  /** v2+: mulberry32 cursor at save time, restored via setGameRngState. */
  rngState: number;
  /** v3+ (Phase 2g): cultural hegemony tuning + per-faction counters. */
  culturalHegemonyThreshold?: number;
  culturalHegemonyRequired?: number;
  culturalHegemonyCounter?: Partial<Record<number, number>>;
  culturalHegemonyEnabled?: boolean;
}

export interface SaveData {
  version: number;
  timestamp: number;
  turn: number;
  factionName: string;
  factionGlyph: string;
  factionColor: string;
  mapSize: { w: number; h: number };
  state: SerializedGameState;
}

// --- Serialize / deserialize ----------------------------------------------

export function serializeGameState(): SaveData {
  const state: SerializedGameState = {
    map: G.map
      ? {
          w: G.map.w,
          h: G.map.h,
          tiles: [...G.map.tiles.entries()],
        }
      : null,
    factions: G.factions.map((f) => ({ ...f, techs: [...f.techs] })),
    units: G.units.map((u) => ({ ...u })),
    cities: G.cities.map((c) => ({ ...c, buildings: [...c.buildings] })),
    turn: G.turn,
    currentFactionIdx: G.currentFactionIdx,
    playerFactionIdx: G.playerFactionIdx,
    difficulty: G.difficulty,
    goldHegemonyThreshold: G.goldHegemonyThreshold,
    goldHegemonyRequired: G.goldHegemonyRequired,
    goldHegemonyCounter: { ...G.goldHegemonyCounter },
    events: G.events.map((e) => ({ ...e })),
    cameraX: G.cameraX,
    cameraY: G.cameraY,
    zoom: G.zoom,
    nextUnitId: G.nextUnitId,
    nextCityId: G.nextCityId,
    gameOver: G.gameOver,
    aiMemory: { ...G.aiMemory },
    seed: G.seed,
    rngState: getGameRngState(),
    culturalHegemonyThreshold: G.culturalHegemonyThreshold,
    culturalHegemonyRequired: G.culturalHegemonyRequired,
    culturalHegemonyCounter: { ...G.culturalHegemonyCounter },
    culturalHegemonyEnabled: G.culturalHegemonyEnabled,
  };

  const player = G.factions[G.playerFactionIdx];
  return {
    version: SAVE_VERSION,
    timestamp: Date.now(),
    turn: G.turn,
    factionName: player?.name ?? 'Unknown',
    factionGlyph: player?.glyph ?? '?',
    factionColor: player?.color ?? '#888',
    mapSize: G.map ? { w: G.map.w, h: G.map.h } : { w: 0, h: 0 },
    state,
  };
}

export class SaveVersionMismatchError extends Error {
  constructor(public got: number, public want: number) {
    super(`Save version ${got} is incompatible (current: ${want})`);
    this.name = 'SaveVersionMismatchError';
  }
}

const DEFAULT_CULTURAL_HEGEMONY_THRESHOLD = 0.4;
const DEFAULT_CULTURAL_HEGEMONY_REQUIRED = 5;

export function loadGameState(data: SaveData): void {
  if (data.version !== 1 && data.version !== 2 && data.version !== SAVE_VERSION) {
    throw new SaveVersionMismatchError(data.version, SAVE_VERSION);
  }
  const s = data.state;

  G.map = s.map
    ? ({
        w: s.map.w,
        h: s.map.h,
        tiles: new Map<TileKey, Tile>(s.map.tiles),
      } as GameMap)
    : null;
  G.factions = s.factions.map((f) => ({ ...f, techs: new Set<TechId>(f.techs) }));
  G.units = s.units.map((u) => ({ ...u }));
  G.cities = s.cities.map((c) => ({ ...c, buildings: new Set<BuildingId>(c.buildings) }));
  G.turn = s.turn;
  G.currentFactionIdx = s.currentFactionIdx;
  G.playerFactionIdx = s.playerFactionIdx;
  G.difficulty = s.difficulty;
  G.goldHegemonyThreshold = s.goldHegemonyThreshold;
  G.goldHegemonyRequired = s.goldHegemonyRequired;
  G.goldHegemonyCounter = { ...s.goldHegemonyCounter };
  G.culturalHegemonyThreshold =
    s.culturalHegemonyThreshold ?? DEFAULT_CULTURAL_HEGEMONY_THRESHOLD;
  G.culturalHegemonyRequired = s.culturalHegemonyRequired ?? DEFAULT_CULTURAL_HEGEMONY_REQUIRED;
  G.culturalHegemonyCounter = { ...(s.culturalHegemonyCounter ?? {}) };
  G.culturalHegemonyEnabled = s.culturalHegemonyEnabled ?? true;
  G.events = s.events.map((e) => ({ ...e }));
  G.cameraX = s.cameraX;
  G.cameraY = s.cameraY;
  G.zoom = s.zoom;
  G.nextUnitId = s.nextUnitId;
  G.nextCityId = s.nextCityId;
  G.gameOver = s.gameOver;
  G.aiMemory = { ...s.aiMemory };

  // RNG: v2 saves restore the exact mulberry32 cursor; v1 saves get a fresh
  // Date.now() seed since the field didn't exist when they were written.
  if (data.version === 1) {
    const migratedSeed = Date.now() >>> 0;
    G.seed = migratedSeed;
    initGameRng(migratedSeed);
    console.warn(
      `[cogfall] Loaded v1 save (no rng cursor); auto-assigned seed ${migratedSeed}. ` +
        `Future randomness diverges from the original session.`
    );
    log(
      `Save migrated from v1 — assigned new seed ${migratedSeed} for the rest of this session.`,
      'flavor'
    );
  } else {
    G.seed = s.seed;
    initGameRng(s.seed);
    setGameRngState(s.rngState);
  }

  // Reset transients — selection, pathing, drag state are not persisted.
  G.selected = null;
  G.moveTargets = [];
  G.attackTargets = [];
  G.sabotageTargets = [];
  G.isDragging = false;
  G.dragStart = null as DragStart | null;
}

// --- Slot management -------------------------------------------------------

export interface Slot {
  /** localStorage key. */
  key: string;
  /** Display label ("Slot 1", "Autosave"). */
  label: string;
  /** Whether this slot is the autosave (different visual treatment). */
  isAuto: boolean;
  /** Parsed save data, or null if the slot is empty. */
  data: SaveData | null;
}

export function listSlots(): Slot[] {
  const out: Slot[] = [];
  for (let i = 1; i <= MANUAL_SLOTS; i++) {
    const k = slotKey(i);
    out.push({ key: k, label: `Slot ${i}`, isAuto: false, data: readSlot(k) });
  }
  out.push({
    key: AUTOSAVE_KEY,
    label: 'Autosave',
    isAuto: true,
    data: readSlot(AUTOSAVE_KEY),
  });
  return out;
}

export function readSlot(key: string): SaveData | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveData;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSlot(key: string, data: SaveData): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export function deleteSlot(key: string): void {
  localStorage.removeItem(key);
}

/** Quick check used by the setup-modal "Continue" button. */
export function hasAutosave(): boolean {
  return readSlot(AUTOSAVE_KEY) !== null;
}

/**
 * Autosave entry point. Wraps writeSlot in a try/catch because
 * localStorage.setItem can throw on quota / private-mode browsers.
 * Silent failure is acceptable here — the autosave is best-effort.
 */
export function saveAuto(): void {
  try {
    writeSlot(AUTOSAVE_KEY, serializeGameState());
  } catch {
    // Quota exceeded, private mode, etc. Nothing else to do.
  }
}
