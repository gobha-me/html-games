// Late Edition — simulation state.
// Owns the authoritative grid, buildings, units, and stories. Produces a
// WorldFrame per snapshot() — the only thing the renderer sees (ICD-01 §Notes).
//
// Constants locked in milestone 0.2 plan:
//   tile = 6 world-units · 10x10 playable grid · world range [-30, +30] on x/z.
//   Bureau anchors at tile (5, 5); Reporter spawns at tile (5, 4).
// Milestone 0.3 adds: one 'lead'-state Story spawned at tile (2, 2); pickup
// on arrival; drop-at-bureau holds the Story via Story.held_by_building
// (ICD-05 v0.2). The Story id is stable across pickup/drop — ICD-05 Purpose.

import { pathfind } from './pathfinder.js';

export const TILE = 6;
export const GRID_W = 10;
export const GRID_H = 10;
export const REPORTER_SPEED = 3.5; // world-units / second (overview §Reporter unit core)
export const PRESS_HP = 90;        // overview §Single fail-state
export const LEAD_SPAWN_TILE = { x: 2, y: 2 }; // 0.3 "single district" pickup point

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
    this.sim_time_ms = 0;

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
      carryingStoryId: null,
      path: [],
      pathIdx: 0,
    }];

    // Milestone 0.3: spawn one Story in 'lead' state at the district tile.
    // ICD-05 §Shape — district / flavor / tier / truthful / spawned_at_ms.
    this.stories = [{
      id: mkId('s'),
      state: 'lead',
      district: 'd-default',
      flavor: 'vice',
      tier: 'whisper',
      truthful: true,
      spawned_at_ms: 0,
      tile: { ...LEAD_SPAWN_TILE },
      picked_up_by: null,
      held_by_building: null,
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
    this.sim_time_ms += dt * 1000;
    for (const u of this.units) {
      if (u.state === 'idle' || u.path.length === 0) continue;
      const arrived = stepAlongPath(u, dt);
      if (arrived) this._handleArrival(u);
    }
  }

  // Pickup / drop bookkeeping on path completion. Pickup is auto: any reporter
  // landing on a free 'lead'-state Story claims it (no Intent kind added to
  // ICD-02 — 0.3 keeps the dispatch surface unchanged). Drop is auto when a
  // carrying reporter arrives adjacent to a Bureau — the Story stays in
  // 'lead' state but resides on the building via held_by_building (ICD-05 v0.2).
  _handleArrival(u) {
    if (u.kind === 'reporter' && u.carrying === null) {
      const lead = this.stories.find((s) =>
        s.state === 'lead' &&
        !s.picked_up_by &&
        !s.held_by_building &&
        s.tile.x === u.tile.x &&
        s.tile.y === u.tile.y,
      );
      if (lead) {
        lead.picked_up_by = u.id;
        u.carrying = 'lead';
        u.carryingStoryId = lead.id;
      }
    }
    if (u.carrying === 'lead') {
      const bureau = this.buildings.find((b) =>
        b.kind === 'bureau' &&
        Math.abs(b.tile.x - u.tile.x) + Math.abs(b.tile.y - u.tile.y) === 1,
      );
      if (bureau) {
        const story = this.stories.find((s) => s.id === u.carryingStoryId);
        if (story) {
          story.held_by_building = bureau.id;
          story.picked_up_by = null;
        }
        u.carrying = null;
        u.carryingStoryId = null;
      }
    }
    // At-rest is 'idle' regardless of carry — 'walking' and 'carrying' are
    // motion states (ICD-01 §UnitView: "walking with a lead is visually
    // distinct from walking empty-handed"). The folder mesh keys off the
    // independent `carrying` field, not `state`.
    u.state = 'idle';
  }

  snapshot() {
    return {
      cameraTarget: { x: 0, y: 0, z: 0 },
      buildings: this.buildings.map(buildingView),
      units: this.units.map(unitView),
      leads: this.stories
        .filter((s) => s.state === 'lead' && !s.picked_up_by && !s.held_by_building)
        .map((s) => leadView(s, this.sim_time_ms)),
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

function leadView(s, simTime) {
  return {
    id: s.id,
    pos: tileToWorld(s.tile),
    tier: s.tier,
    flavor: s.flavor,
    age_ms: simTime - s.spawned_at_ms,
  };
}

// Returns true when the unit arrived (path drained this step). World decides
// what to do with arrival (pickup, drop, state flip) — see _handleArrival.
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
    return true;
  }
  return false;
}
