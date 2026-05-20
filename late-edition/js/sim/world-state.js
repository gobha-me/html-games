// Late Edition — simulation state.
// Owns the authoritative grid, buildings, and units. Produces a WorldFrame
// per snapshot() — the only thing the renderer sees (ICD-01 §Notes).
//
// Constants locked in milestone 0.2 plan:
//   tile = 6 world-units · 10x10 playable grid · world range [-30, +30] on x/z.
//   Bureau anchors at tile (5, 5); Reporter spawns at tile (5, 4).

import { pathfind } from './pathfinder.js';

export const TILE = 6;
export const GRID_W = 10;
export const GRID_H = 10;
export const REPORTER_SPEED = 3.5; // world-units / second (overview §Reporter unit core)
export const PRESS_HP = 90;        // overview §Single fail-state

export function tileToWorld(cell) {
  return { x: cell.x * TILE - 27, y: 0, z: cell.y * TILE - 27 };
}

export function worldToTile(pos) {
  return {
    x: Math.round((pos.x + 27) / TILE),
    y: Math.round((pos.z + 27) / TILE),
  };
}

let nextId = 1;
const mkId = (prefix) => `${prefix}-${nextId++}`;

export class World {
  constructor() {
    nextId = 1;
    this.grid = bakeGrid();

    this.buildings = [{
      id: mkId('b'),
      tile: { x: 5, y: 5 },
      kind: 'bureau',
      hp: PRESS_HP,
      hp_max: PRESS_HP,
      tier: 1,
    }];

    for (const b of this.buildings) this.grid.walkable[b.tile.y][b.tile.x] = false;

    const reporterStart = { x: 5, y: 4 };
    this.units = [{
      id: mkId('u'),
      tile: { ...reporterStart },
      pos: tileToWorld(reporterStart),
      facing: 0,
      kind: 'reporter',
      state: 'idle',
      selected: false,
      carrying: null,
      path: [],
      pathIdx: 0,
    }];

    this.hud = {
      edition: 1,
      deadline_ms: 0,
      resources: { leads: 0, stories: 0, ink: 0, cash: 0, heat: 0 },
    };

    this.effects = [];
  }

  selectUnit(unitId) {
    for (const u of this.units) u.selected = u.id === unitId;
  }

  deselectAll() {
    for (const u of this.units) u.selected = false;
  }

  unitAtTile(cell) {
    return this.units.find((u) => u.tile.x === cell.x && u.tile.y === cell.y) ?? null;
  }

  dispatch(unitId, target) {
    const unit = this.units.find((u) => u.id === unitId);
    if (!unit) return false;
    const res = pathfind(
      { from: unit.tile, to: target, unitKind: unit.kind },
      this.grid,
    );
    if (!res.found || res.cells.length < 2) return false;
    unit.path = res.cells;
    unit.pathIdx = 0;
    unit.state = unit.carrying ? 'carrying' : 'walking';
    return true;
  }

  tick(dt) {
    for (const u of this.units) {
      if (u.state === 'idle' || u.path.length === 0) continue;
      stepAlongPath(u, dt);
    }
  }

  snapshot() {
    return {
      cameraTarget: { x: 0, y: 0, z: 0 },
      buildings: this.buildings.map(buildingView),
      units: this.units.map(unitView),
      leads: [],
      rain: { intensity: 1 },
      fog: { near: 22, far: 60, color: 0xc8c4bc },
      hud: {
        edition: this.hud.edition,
        deadline_ms: this.hud.deadline_ms,
        resources: { ...this.hud.resources },
      },
      effects: this.effects.splice(0),
    };
  }
}

function bakeGrid() {
  const walkable = Array.from({ length: GRID_H }, () => Array(GRID_W).fill(true));
  return { width: GRID_W, height: GRID_H, walkable };
}

function buildingView(b) {
  return {
    id: b.id,
    pos: tileToWorld(b.tile),
    kind: b.kind,
    hp: b.hp,
    hp_max: b.hp_max,
    tier: b.tier,
  };
}

function unitView(u) {
  return {
    id: u.id,
    pos: { x: u.pos.x, y: u.pos.y, z: u.pos.z },
    facing: u.facing,
    kind: u.kind,
    state: u.state,
    selected: u.selected,
    carrying: u.carrying,
  };
}

function stepAlongPath(u, dt) {
  let remaining = REPORTER_SPEED * dt;
  while (remaining > 0 && u.pathIdx < u.path.length - 1) {
    const next = tileToWorld(u.path[u.pathIdx + 1]);
    const dx = next.x - u.pos.x;
    const dz = next.z - u.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= remaining) {
      u.pos.x = next.x;
      u.pos.z = next.z;
      u.tile = { ...u.path[u.pathIdx + 1] };
      u.pathIdx += 1;
      remaining -= dist;
    } else {
      u.pos.x += (dx / dist) * remaining;
      u.pos.z += (dz / dist) * remaining;
      u.facing = Math.atan2(dx, dz);
      remaining = 0;
    }
  }
  if (u.pathIdx >= u.path.length - 1) {
    u.path = [];
    u.pathIdx = 0;
    u.state = u.carrying ? 'carrying' : 'idle';
  }
}
