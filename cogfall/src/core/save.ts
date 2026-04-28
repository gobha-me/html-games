// Save / load. JSON-serializes GameState to localStorage with explicit
// handling for Sets (faction.techs, city.buildings) and the tile Map. A
// version field is stamped into every save so future schema changes can
// fail loudly instead of silently corrupting state.
//
// Slot layout: 3 manual slots + 1 autosave. Autosave fires at end of every
// player turn (in systems/turn.ts). Transient state (selection, drag,
// move/attack targets) is intentionally NOT persisted — those reset on load.

import { G } from './state';
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

export const SAVE_VERSION = 1;
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

export function loadGameState(data: SaveData): void {
  if (data.version !== SAVE_VERSION) {
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
  G.events = s.events.map((e) => ({ ...e }));
  G.cameraX = s.cameraX;
  G.cameraY = s.cameraY;
  G.zoom = s.zoom;
  G.nextUnitId = s.nextUnitId;
  G.nextCityId = s.nextCityId;
  G.gameOver = s.gameOver;
  G.aiMemory = { ...s.aiMemory };

  // Reset transients — selection, pathing, drag state are not persisted.
  G.selected = null;
  G.moveTargets = [];
  G.attackTargets = [];
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
