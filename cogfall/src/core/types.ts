// Shared types for the game engine. Built up to support the typed modules
// extracted in later Phase 1 commits; legacy.ts itself runs under @ts-nocheck
// and doesn't yet observe these.

import type { TileKey } from './hex';
import type { TerrainId } from '../data/terrain';
import type { UnitTypeId } from '../data/units';
import type { BuildingId } from '../data/buildings';
import type { TechId, TechBranch } from '../data/techs';
import type { PersonalityId } from '../data/personalities';
import type { FactionId } from '../data/factions';

// Brand FactionIdx so a number meant to be a faction index can't be silently
// confused with a unit/city id or any other count. Cheap to thread because
// the prototype already passes raw `factionIdx` everywhere.
export type FactionIdx = number & { readonly __brand: 'FactionIdx' };
export const asFactionIdx = (n: number): FactionIdx => n as FactionIdx;

export type LogEntryType = 'combat' | 'tech' | 'diplo' | 'warning' | 'good' | 'flavor' | '';

export interface LogEntry {
  msg: string;
  type: LogEntryType;
  turn: number;
}

export type VictoryType = 'domination' | 'ascension' | 'hegemony';

export type DiploStatus = 'unmet' | 'peace' | 'war';

export type StrategicPhase = 'expand' | 'fortify' | 'contest' | 'ascend';

export type Improvement = 'farm' | 'mine' | 'road' | 'looted';

export type Visibility = 'visible' | 'seen' | 'unseen';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type BuildQueue = { kind: 'unit'; id: UnitTypeId } | { kind: 'building'; id: BuildingId };

export interface Tile {
  q: number;
  r: number;
  terrain: TerrainId;
  resource: string | null;
  improvement: Improvement | null;
  owner: FactionIdx | null;
  cityId: number | null;
  unitId: number | null;
  visibility: Partial<Record<number, Visibility>>;
}

export interface GameMap {
  w: number;
  h: number;
  tiles: Map<TileKey, Tile>;
}

export interface Unit {
  id: number;
  typeId: UnitTypeId;
  factionIdx: FactionIdx;
  q: number;
  r: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  fortified: boolean;
}

export interface City {
  id: number;
  factionIdx: FactionIdx;
  q: number;
  r: number;
  name: string;
  population: number;
  foodStored: number;
  foodNeeded: number;
  productionStored: number;
  buildings: Set<BuildingId>;
  buildQueue: BuildQueue | null;
  isCapital: boolean;
  hp: number;
  maxHp: number;
}

export interface Faction {
  idx: FactionIdx;
  id: FactionId;
  name: string;
  color: string;
  glyph: string;
  personality: PersonalityId;
  desc: string;
  isAI: boolean;
  alive: boolean;
  resources: { gold: number; aether: number };
  science: number;
  researchProgress: number;
  techs: Set<TechId>;
  currentResearch: TechId | null;
  score: number;
  diplo: Partial<Record<number, DiploStatus>>;
  startTechs?: readonly string[];
  startBonus?: string;
  traits?: string;
}

export interface AIMemory {
  grudges: Partial<Record<number, number>>;
  strategicPhase: StrategicPhase;
  targetEnemy: FactionIdx | null;
  lastDeclareWarTurn: number;
}

// Discriminated union — exhaustive switches with assertNever() catch missed
// kinds at compile time when new selection types are added.
export type Selection =
  | { type: 'unit'; ref: Unit }
  | { type: 'city'; ref: City }
  | { type: 'tile'; ref: Tile };

export interface MoveTarget {
  q: number;
  r: number;
  cost: number;
}

export interface AttackTarget {
  q: number;
  r: number;
  target: 'unit' | 'city';
}

export interface DragStart {
  x: number;
  y: number;
  cameraX: number;
  cameraY: number;
}

export interface GameState {
  map: GameMap | null;
  factions: Faction[];
  units: Unit[];
  cities: City[];
  turn: number;
  currentFactionIdx: FactionIdx;
  playerFactionIdx: FactionIdx;
  difficulty: Difficulty;
  goldHegemonyThreshold: number;
  goldHegemonyRequired: number;
  goldHegemonyCounter: Partial<Record<number, number>>;
  selected: Selection | null;
  moveTargets: MoveTarget[];
  attackTargets: AttackTarget[];
  events: LogEntry[];
  cameraX: number;
  cameraY: number;
  zoom: number;
  isDragging: boolean;
  dragStart: DragStart | null;
  nextUnitId: number;
  nextCityId: number;
  gameOver: boolean;
  aiMemory: Partial<Record<number, AIMemory>>;
}

// Helper for exhaustive switch checks.
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(x)}`);
}

// Re-exports for downstream convenience.
export type {
  TileKey,
  TerrainId,
  UnitTypeId,
  BuildingId,
  TechId,
  TechBranch,
  PersonalityId,
  FactionId,
};
