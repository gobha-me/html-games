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

export type VictoryType = 'domination' | 'ascension' | 'hegemony' | 'cultural';

export type DiploStatus = 'unmet' | 'peace' | 'war';

export type StrategicPhase = 'expand' | 'fortify' | 'contest' | 'ascend';

export type Improvement = 'farm' | 'mine' | 'road' | 'looted';

export type Visibility = 'visible' | 'seen' | 'unseen';

export type Difficulty = 'easy' | 'medium' | 'hard';

// Phase 2m — control mode for the game's seat / handoff model.
//   'single'  — exactly one local human (today's behavior); no curtain.
//   'hotseat' — multiple local humans share a keyboard; curtain modal
//               between human turns.
// Reserved future values: 'pbem' (export save at human turn end), 'plinth'
// (remote multiplayer via the future Plinth network layer). The dispatch
// seam in turn.ts switches on this; new modes plug in alongside hot-seat
// without rewiring the seat list, save schema, or victory rule.
export type ControlMode = 'single' | 'hotseat';

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
  /** 6-bit bitmask of which HEX_DIRS edges have a river segment. Optional —
   * absent on tiles without rivers and on saves written before Phase 2c. */
  riverEdges?: number;
  /** Soft cultural claim — the faction whose accumulated cultural pressure
   * dominates this tile, even if `owner` is null. Never overwrites `owner`
   * (Phase 2g, decision-log item 7). Optional — absent on neutral/unclaimed
   * tiles and on saves written before Phase 2g (v2). */
  claim?: FactionIdx;
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
  // Persistent strategic anchor: city id of the current conquest objective.
  // Picked by pickTargetCity in strategy.ts when targetEnemy refreshes;
  // refreshed only when the target dies/is captured. aiMilitaryAction reads
  // this and adds an assault bias toward it. Optional for save back-compat —
  // v2 saves load with undefined and treat it as null at read sites.
  targetCityId?: number | null;
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

export interface SabotageTarget {
  q: number;
  r: number;
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
  /** Phase 2m — semantics extended: in 'single' this is the only human,
   * in 'hotseat' it tracks the *currently-controlling* local human and is
   * updated by the curtain modal on each handoff. ~30 read sites that say
   * "render this faction's POV" / "is this my turn now?" continue working
   * unchanged because they always meant "the human at the keyboard right now". */
  playerFactionIdx: FactionIdx;
  /** Phase 2m — seat / handoff model. 'single' is byte-identical to pre-2m
   * behavior. 'hotseat' enables the curtain modal between humans. Future
   * 'pbem' / 'plinth' values plug into the same dispatch seam in turn.ts. */
  controlMode: ControlMode;
  /** Phase 2m — every faction index that is human-controlled. Mode-agnostic
   * (hot-seat humans, future Plinth seats, future PBEM seats all share this
   * list). Single-player = [playerFactionIdx]. Faction.isAI is derived and
   * kept consistent: G.factions[i].isAI === !humanFactionIdxs.includes(i). */
  humanFactionIdxs: FactionIdx[];
  /** Phase 2m — runtime-only flag while the curtain modal is up. Suppresses
   * canvas / keyboard input. Never serialized. */
  passoverActive: boolean;
  difficulty: Difficulty;
  goldHegemonyThreshold: number;
  goldHegemonyRequired: number;
  goldHegemonyCounter: Partial<Record<number, number>>;
  /** Phase 2g — cultural hegemony victory. Threshold is a *proportion* of
   * all claimed tiles ([0, 1]); required is the consecutive-turn count to
   * trigger. Counter ticks up while the faction holds ≥ threshold and
   * resets to 0 when it slips. Enabled flag is wired through the setup
   * modal (2g-6); when false, victory check no-ops but the claim system
   * still runs (cosmetic borders remain). */
  culturalHegemonyThreshold: number;
  culturalHegemonyRequired: number;
  culturalHegemonyCounter: Partial<Record<number, number>>;
  culturalHegemonyEnabled: boolean;
  selected: Selection | null;
  /** Phase 2n-1 — hex the cursor is currently over, in axial coords. UI
   * transient (parallel to selected / moveTargets / attackTargets);
   * never serialized. Cleared on canvas leave, dragstart, and while the
   * hot-seat curtain is up so it doesn't bleed into the next player's view. */
  hoveredHex: { q: number; r: number } | null;
  /** Phase 2n-2 — player-facing threat-range overlay toggle (T hotkey).
   * UI transient (same precedent as hoveredHex); never serialized. The
   * threatened-tile set itself is recomputed each render and not stored
   * on G — only the toggle persists in-session. */
  showThreatRange: boolean;
  moveTargets: MoveTarget[];
  attackTargets: AttackTarget[];
  sabotageTargets: SabotageTarget[];
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
  /** Seed used to initialise the game RNG. Stamped on each save for replay. */
  seed: number;
  /** Phase 2L — noise seed used by mapgen to build the elevation field.
   * Derived from the game RNG inside generateMap (rng() * 1000), persisted
   * here so the debug overlay can recompute elevation post-mapgen / post-
   * load without re-running mapgen. Optional for back-compat: pre-2L saves
   * load with mapSeed undefined, and the elevation overlay degrades to a
   * "no mapSeed" label for those. */
  mapSeed?: number;
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
