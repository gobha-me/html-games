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
// Milestone 0.4 adds: Darkroom building at (7, 7); Photog unit spawning at
// (5, 6); photog ferries a held lead Bureau → Darkroom and drops it with
// state transition 'lead' → 'verified' (ICD-05 v0.2 row 3). The Story id
// remains stable across the verify transition (ICD-05 Purpose still holds).

import { pathfind } from './pathfinder.js';
import { CycleClock } from './cycle-clock.js';

export const TILE = 6;
export const GRID_W = 10;
export const GRID_H = 10;
export const REPORTER_SPEED = 3.5; // world-units / second; shared by all units at 0.4 (ICD-03 per-kind costs land at 0.7)
export const PRESS_HP = 90;        // overview §Single fail-state
export const LEAD_SPAWN_TILE = { x: 2, y: 2 }; // 0.3 "single district" pickup point
export const BUREAU_TILE = { x: 5, y: 5 };
export const DARKROOM_TILE = { x: 7, y: 7 }; // 0.4: symmetric from Bureau (Manhattan 4)

// At 0.5 the print pipeline closes with no Editor unit yet — the verified →
// plated → printed transitions auto-fire same-frame at DEADLINE_FIRE. The
// sentinel below stands in for the real EditorId field on Story.plated_by
// until the Editor lands (0.6/0.7). Keeping a non-null marker (vs null) lets
// future code and tests assert "this story passed through the plating step",
// and the eventual Editor unit just substitutes its UnitId in the same slot.
export const AUTO_PLATE_SENTINEL = 'auto-plate';

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
  constructor(opts = {}) {
    nextId = 1;
    this.grid = bakeGrid();
    this.sim_time_ms = 0;
    this.cycle = new CycleClock(opts.cycle ?? {});
    this.cycle.start(1); // first edition open; subscribers attach post-construction
    this.cycleSubscribers = [];
    this.debriefOpen = false;

    this.buildings = [
      {
        id: mkId('b'),
        tile: { ...BUREAU_TILE },
        kind: 'bureau',
        hp: PRESS_HP,
        hp_max: PRESS_HP,
        tier: 1,
      },
      {
        // 0.4: Darkroom. HP/tier match Bureau placeholder shape — actual
        // balance values are medium-band (overview line 47) and arrive at
        // 0.7+ once a damage source exists. The shape stability matters now.
        id: mkId('b'),
        tile: { ...DARKROOM_TILE },
        kind: 'darkroom',
        hp: PRESS_HP,
        hp_max: PRESS_HP,
        tier: 1,
      },
    ];

    for (const b of this.buildings) this.grid.walkable[b.tile.y][b.tile.x] = false;

    const reporterStart = { x: 5, y: 4 };
    const photogStart = { x: 5, y: 6 }; // 0.4: mirror of reporter, south of Bureau
    this.units = [
      {
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
      },
      {
        id: mkId('u'),
        tile: { ...photogStart },
        pos: tileToWorld(photogStart),
        facing: 0,
        kind: 'photog',
        state: 'idle',
        selected: false,
        carrying: null,
        carryingStoryId: null,
        path: [],
        pathIdx: 0,
      },
    ];

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

    this.effects = [];
  }

  subscribeCycle(fn) {
    this.cycleSubscribers.push(fn);
    return () => {
      const i = this.cycleSubscribers.indexOf(fn);
      if (i >= 0) this.cycleSubscribers.splice(i, 1);
    };
  }

  _emitCycle(ev) {
    for (const fn of this.cycleSubscribers.slice()) fn(ev);
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
    // Full sim pause while the debrief panel is open (ICD-06 v0.2
    // §Pause-during-debrief, milestone-0.5 reading): cycle clock stops and
    // unit motion stops. The renderer keeps painting the last snapshot; only
    // ackDebrief() lets the world resume.
    if (this.debriefOpen) return;

    this.sim_time_ms += dt * 1000;
    for (const u of this.units) {
      if (u.state === 'idle' || u.path.length === 0) continue;
      const arrived = stepAlongPath(u, dt);
      if (arrived) this._handleArrival(u);
    }

    const events = this.cycle.advance(dt * 1000);
    for (const ev of events) {
      this._emitCycle(ev);
      if (ev.kind === 'DEADLINE_FIRE') this._fireDebrief();
    }
  }

  // Triggered exactly once per edition on DEADLINE_FIRE. Walks each verified
  // story sitting at the Darkroom through verified → plated → printed in the
  // same frame (no Editor unit yet — see AUTO_PLATE_SENTINEL above), builds
  // the EditionSummary, emits EDITION_DEBRIEF_BEGIN, and flips debriefOpen
  // so subsequent ticks pause the sim until ackDebrief() resolves the panel.
  _fireDebrief() {
    const darkroom = this.buildings.find((b) => b.kind === 'darkroom');
    const printing = darkroom
      ? this.stories.filter((s) => s.state === 'verified' && s.held_by_building === darkroom.id)
      : [];

    for (const story of printing) {
      // verified → plated → printed in one tick. cash_yield / heat_yield are
      // zero at 0.5 — resource numbers are medium-band per overview line 47
      // and land at milestone 0.6. ICD-05 §Notes ("computed at plated and
      // frozen there") still holds: the values just happen to be zero.
      story.state = 'plated';
      story.plated_by = AUTO_PLATE_SENTINEL;
      story.cash_yield = 0;
      story.heat_yield = 0;
      story.state = 'printed';
      story.printed_in = this.cycle.edition;
    }

    const summary = this._buildEditionSummary(printing);
    this.debriefOpen = true;
    this._emitCycle({ kind: 'EDITION_DEBRIEF_BEGIN', edition: this.cycle.edition, summary });
  }

  // Player-driven exit from the debrief panel. Closes the current edition,
  // starts the next one, dispatches the resulting CYCLE_BEGIN to subscribers.
  // No-op when no debrief is open — the panel always calls this through a
  // user click, so a stale double-click is harmless.
  ackDebrief() {
    if (!this.debriefOpen) return;
    this.debriefOpen = false;
    this._emitCycle({ kind: 'EDITION_DEBRIEF_END' });
    const begin = this.cycle.start(this.cycle.edition + 1);
    this._emitCycle(begin);
  }

  _buildEditionSummary(printed) {
    return {
      edition: this.cycle.edition,
      stories_printed: printed.map(storyDigest),
      cash_earned: 0,    // 0.5: resource numbers land at 0.6 (overview line 47)
      ink_consumed: 0,
      heat_applied: 0,
      rival_events: [],  // 0.5: rivals land at 0.7 (ICD-02 first caller)
    };
  }

  // Pickup / drop bookkeeping on path completion. Each unit kind has its own
  // arrival contract:
  //   reporter — picks up a 'lead'-state Story on its tile (0.3); drops at a
  //     Bureau-adjacent tile, leaving the Story in 'lead' state on the building
  //     via held_by_building (ICD-05 v0.2 row 2).
  //   photog   — picks up a Bureau-held 'lead'-state Story (0.4); drops at a
  //     Darkroom-adjacent tile, flipping the Story to 'verified' (ICD-05 v0.2
  //     row 3). Story.id remains stable across the transition (ICD-05 Purpose).
  // ICD-02 (intent kinds) is untouched — pickup/drop are sim-internal
  // consequences of arrival, not new dispatch verbs.
  _handleArrival(u) {
    if (u.kind === 'reporter') this._handleReporterArrival(u);
    else if (u.kind === 'photog') this._handlePhotogArrival(u);
    // At-rest is 'idle' regardless of carry — 'walking' and 'carrying' are
    // motion states (ICD-01 §UnitView: "walking with a lead is visually
    // distinct from walking empty-handed"). The folder mesh keys off the
    // independent `carrying` field, not `state`.
    u.state = 'idle';
  }

  _handleReporterArrival(u) {
    if (u.carrying === null) {
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
      return;
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
  }

  _handlePhotogArrival(u) {
    if (u.carrying === null) {
      const bureau = this.buildings.find((b) =>
        b.kind === 'bureau' &&
        Math.abs(b.tile.x - u.tile.x) + Math.abs(b.tile.y - u.tile.y) === 1,
      );
      if (!bureau) return;
      const lead = this.stories.find((s) =>
        s.state === 'lead' && s.held_by_building === bureau.id,
      );
      if (lead) {
        lead.picked_up_by = u.id;
        lead.held_by_building = null;
        u.carrying = 'lead';
        u.carryingStoryId = lead.id;
      }
      return;
    }
    if (u.carrying === 'lead') {
      const darkroom = this.buildings.find((b) =>
        b.kind === 'darkroom' &&
        Math.abs(b.tile.x - u.tile.x) + Math.abs(b.tile.y - u.tile.y) === 1,
      );
      if (darkroom) {
        const story = this.stories.find((s) => s.id === u.carryingStoryId);
        if (story) {
          // ICD-05 v0.2 row 3: lead → verified. verified_by + held_by_building
          // set; picked_up_by cleared. State flips on drop.
          story.state = 'verified';
          story.verified_by = u.id;
          story.held_by_building = darkroom.id;
          story.picked_up_by = null;
        }
        u.carrying = null;
        u.carryingStoryId = null;
      }
    }
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
        edition: this.cycle.edition,
        deadline_ms: this.cycle.remainingMs,
        // Resource values stay zero at 0.5 — they light up at milestone 0.6
        // (overview §"Five resources"). Names + shape locked by ICD-01 v0.5.
        resources: { leads: 0, stories: 0, ink: 0, cash: 0, heat: 0 },
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

// ICD-06 v0.2 StoryDigest projection. Headline is synthesized from flavor +
// tier at 0.5 — a real headline-generation pass lands later when the story
// engine (Design Doc §17) lights up. The text is for player feedback in the
// debrief panel; the load-bearing data is id / flavor / tier / cash.
function storyDigest(s) {
  return {
    id: s.id,
    headline: `${s.flavor.toUpperCase()} ${s.tier.toUpperCase()} HITS WIRE`,
    flavor: s.flavor,
    tier: s.tier,
    cash: s.cash_yield ?? 0,
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
