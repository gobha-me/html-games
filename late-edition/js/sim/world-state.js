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
// Milestone 0.6 adds: cash + ink + heat running balances on World. At
// DEADLINE_FIRE each printed Story's cash_yield / heat_yield / ink_cost is set
// from js/sim/resources.js (Design Doc §06 + §19 first-pass numbers, medium-
// band per overview line 44); EditionSummary aggregates them; this.resources
// accumulates; ackDebrief applies the §19 baseline heat decay. HudState
// projects the running balances + derived leads/stories counts in snapshot().
// Milestone 0.7.0 adds: Evening Star rival (ICD-02 v0.2) hosted on the World,
// emits RAID_BUREAU intents on a 20 s tick; World reconciles intents by
// spawning Goon units at GOON_SPAWN_TILE walking toward a Bureau-adjacent tile.
// Goons damage the Bureau press at 1 dmg/s on contact; Press HP at 0 emits a
// CYCLE_GAME_OVER (ICD-06 v0.3) and freezes the sim. A Fixer unit spawns at
// FIXER_SPAWN_TILE; on contact with a Goon, the Goon dies (1-hit kill, Design
// Doc §17); two goons adjacent → fixer dies (Design Doc §rivals "two goons
// beat one fixer"). Rival event digests (raid_attempted / raid_succeeded /
// raid_wiped) accrue per-edition and flush to EditionSummary at DEADLINE_FIRE.
// Milestone 0.7.1 adds: Editor unit (stationary at EDITOR_SPAWN_TILE west of
// Bureau, speed 0, dispatch-rejected). At DEADLINE_FIRE the plating step
// substitutes the editor's UnitId for AUTO_PLATE_SENTINEL on Story.plated_by
// per ICD-05 v0.4 §Notes (sentinel stays as the defensive fallback only).
// Ink plate-time hard gate: a verified→plated transition that would leave
// World.resources.ink negative is rejected — the Story stays 'verified' at
// the Darkroom and waits for the next edition (ICD-05 v0.4 §Notes).

import { pathfind } from './pathfinder.js';
import { CycleClock } from './cycle-clock.js';
import {
  STARTING_INK,
  HEAT_DECAY_PER_EDITION,
  cashYieldFor,
  inkCostFor,
  heatYieldFor,
} from './resources.js';
import { EveningStar, PAST_INTENTS_PROJECTION_CAP } from './evening-star.js';

export const TILE = 6;
export const GRID_W = 10;
export const GRID_H = 10;
// Per-kind walk speeds in world-units / second. Lands at 0.7 (ICD-03 v0.2
// §Notes "per-kind costs land at 0.7"). Design Doc §17 unit stats table:
// reporter 3.5, photog 2.5 (held at 3.5 by carryover from 0.4 — re-tune at
// Tier-1 balance pass), goon 2.5, fixer 3.0.
export const UNIT_SPEED = {
  reporter: 3.5,
  photog:   3.5,
  goon:     2.5,
  fixer:    3.0,
  editor:   0,   // 0.7.1: stationary at Bureau — dispatch is rejected, this is belt-and-braces.
};
export const REPORTER_SPEED = UNIT_SPEED.reporter; // legacy export — kept stable for tests/unit-step.test.mjs
export const PRESS_HP = 90;        // overview §Single fail-state
export const GOON_DAMAGE_PER_SECOND = 1; // Design Doc §17 — "damages press at 1 dmg/s on contact"
export const LEAD_SPAWN_TILE = { x: 2, y: 2 }; // 0.3 "single district" pickup point
export const BUREAU_TILE = { x: 5, y: 5 };
export const DARKROOM_TILE = { x: 7, y: 7 }; // 0.4: symmetric from Bureau (Manhattan 4)
export const FIXER_SPAWN_TILE = { x: 6, y: 5 }; // 0.7: Bureau-adjacent (east of Bureau)
export const GOON_SPAWN_TILE = { x: 0, y: 0 }; // 0.7: NW grid edge (placeholder until district edges land)
export const EDITOR_SPAWN_TILE = { x: 4, y: 5 }; // 0.7.1: Bureau-adjacent (west of Bureau) — Editor is stationary

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

    // Running resource balances (ICD-01 v0.5 §HudState · Design Doc §06).
    // Ink/cash/heat accumulate across editions; the derived leads/stories counts
    // live in snapshot(). 0.6 medium-band — values from js/sim/resources.js.
    this.resources = { ink: STARTING_INK, cash: 0, heat: 0 };

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
      makeUnit(mkId('u'), 'reporter', reporterStart),
      makeUnit(mkId('u'), 'photog',   photogStart),
      // 0.7.0: Fixer spawns east of Bureau. HP 3, walk 3.0 u/s (Design Doc §17).
      // One static fixer at 0.7 — hire cost is fuzzy until the economy buys it.
      makeUnit(mkId('u'), 'fixer',    { ...FIXER_SPAWN_TILE }, { hp: 3, hp_max: 3 }),
      // 0.7.1: Editor stationary at Bureau-west (Design Doc §17 "Stationed at the
      // Bureau"). Speed 0 + dispatch reject keeps it pinned to EDITOR_SPAWN_TILE.
      // Its load-bearing role is plating: at DEADLINE_FIRE _fireDebrief substitutes
      // its UnitId for AUTO_PLATE_SENTINEL on Story.plated_by (ICD-05 v0.4 §Notes).
      makeUnit(mkId('u'), 'editor',   { ...EDITOR_SPAWN_TILE }),
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

    // 0.7.0: Evening Star rival (ICD-02 v0.2). Deterministic seed → replay-safe.
    // Seed is constructor-overridable so tests can pin behavior. Production uses
    // the default seed at 0.7; player-driven seeds land at PRE-0.8 / save schema.
    const bureauId = this.buildings.find((b) => b.kind === 'bureau').id;
    this.rivals = [
      new EveningStar({ seed: opts.rivalSeed ?? 0xC0FFEE, bureauId }),
    ];

    // 0.7.0: rolling list of edition deltas the rival projection can read.
    // Cap at 10 entries per ICD-02 §RivalView edition_history.
    this.editionHistory = [];
    // 0.7.0: per-edition rival event digest accumulator. Flushed into
    // EditionSummary.rival_events at DEADLINE_FIRE, cleared at CYCLE_BEGIN.
    this._pendingRivalEvents = [];

    // 0.7.0: fail-state flag. World.tick() short-circuits when set (matches the
    // debrief pause pattern). Set when bureau.hp ≤ 0.
    this.gameOver = false;

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
    // 0.7.1: Editor is stationary at the Bureau (Design Doc §17). Reject before
    // pathfinding so a stray right-click while the editor is somehow selected
    // is a silent no-op.
    if (unit.kind === 'editor') return false;
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
    // 0.7.0 fail-state: when bureau.hp ≤ 0 the run has ended (CYCLE_GAME_OVER
    // already emitted). Subsequent ticks are inert — same shape as debriefOpen.
    if (this.gameOver) return;

    this.sim_time_ms += dt * 1000;
    for (const u of this.units) {
      if (u.state === 'idle' || u.path.length === 0) continue;
      const arrived = stepAlongPath(u, dt);
      if (arrived) this._handleArrival(u);
    }

    // 0.7.0 combat tick. Goon damage on the Press happens first (before fixer
    // intercept) so a fixer arriving the same tick as the killing blow doesn't
    // retroactively un-end the run. Order is: goon damage → fixer kill →
    // fail-state check → rival tick → intent reconcile.
    this._goonDamageTick(dt);
    this._fixerInterceptTick();
    this._pruneDeadUnits();
    if (!this.gameOver && this._bureau().hp <= 0) this._enterGameOver();
    if (this.gameOver) return;

    // 0.7.0 rival tick. Each rival advances on its own cadence; intents
    // accrue and reconcile at end-of-tick (ICD-02 §Per-tick contract).
    const dtMs = dt * 1000;
    for (const rival of this.rivals) {
      const view = this._buildRivalView(rival);
      const intents = rival.advance(view, dtMs);
      for (const intent of intents) this._reconcileIntent(rival, intent);
    }

    const events = this.cycle.advance(dt * 1000);
    for (const ev of events) {
      this._emitCycle(ev);
      if (ev.kind === 'DEADLINE_FIRE') this._fireDebrief();
    }
  }

  _bureau() {
    return this.buildings.find((b) => b.kind === 'bureau');
  }

  // ICD-02 §RivalView projection (v0.2). Read-only snapshot the world hands
  // each rival on tick. Filters honor §Visibility filter (0.7 = all-shared).
  _buildRivalView(rival) {
    const heat = this.resources.heat;
    const heatNoise = rival.rng ? (rival.rng.next() * 40 - 20) : 0;
    return {
      cycle: {
        edition: this.cycle.edition,
        remaining_ms: this.cycle.remainingMs,
      },
      player: {
        heat_noisy: heat + heatNoise,
        visible_leads: this.stories
          .filter((s) => s.state === 'lead' && !s.picked_up_by && !s.held_by_building)
          .map((s) => ({ id: s.id, district: s.district, tier: s.tier, flavor: s.flavor })),
        visible_reporters: this.units
          .filter((u) => u.kind === 'reporter')
          .map((u) => ({ id: u.id, district: 'd-default' })),
      },
      own: {
        state:        rival.state,
        posture:      rival.posture,
        past_intents: rival.pastIntents.slice(-PAST_INTENTS_PROJECTION_CAP),
      },
      edition_history: this.editionHistory.slice(-10),
    };
  }

  // Apply a rival Intent to the world. The 0.7.0 vocabulary in scope:
  //   RAID_BUREAU — spawn `goons` Goon units at GOON_SPAWN_TILE pathing to
  //                 the Bureau-adjacent tile; record a raid_attempted digest.
  //   PASS        — no-op (rival's quiet tick).
  // Other intent kinds are caller-triggered (ICD-02 v0.2 §Caller-triggered)
  // and arrive as their first callers ship.
  _reconcileIntent(rival, intent) {
    if (intent.kind === 'PASS') return;
    if (intent.kind === 'RAID_BUREAU') {
      const target = { x: this._bureau().tile.x - 1, y: this._bureau().tile.y };
      for (let i = 0; i < intent.goons; i++) {
        const goon = makeUnit(mkId('u'), 'goon', { ...GOON_SPAWN_TILE }, { hp: 1, hp_max: 1 });
        this.units.push(goon);
        const res = pathfind({ from: goon.tile, to: target, unitKind: 'goon' }, this.grid);
        if (res.found && res.cells.length >= 2) {
          goon.path = res.cells;
          goon.pathIdx = 0;
          goon.state = 'walking';
        }
      }
      this._pendingRivalEvents.push({
        rival: rival.id,
        kind:  'raid_attempted',
        text:  `${rival.id.replace('_', ' ').toUpperCase()} SENDS ${intent.goons} GOON${intent.goons === 1 ? '' : 'S'}`,
      });
      return;
    }
    // Other intent kinds are caller-triggered (BRIBE / RUSH / etc.) — when
    // their bodies land at Tier-1 they'll add reconciler branches here.
  }

  // Damage tick: each living goon at Manhattan distance 1 from the Bureau
  // deals GOON_DAMAGE_PER_SECOND × dt. Damage accumulates per-tick; the
  // fail-state check at end-of-tick converts ≤ 0 HP into CYCLE_GAME_OVER.
  _goonDamageTick(dt) {
    const bureau = this._bureau();
    let total = 0;
    for (const u of this.units) {
      if (u.kind !== 'goon') continue;
      if ((u.hp ?? 0) <= 0) continue;
      const d = Math.abs(u.tile.x - bureau.tile.x) + Math.abs(u.tile.y - bureau.tile.y);
      if (d !== 1) continue;
      total += GOON_DAMAGE_PER_SECOND * dt;
    }
    if (total > 0) bureau.hp = Math.max(0, bureau.hp - total);
  }

  // Fixer intercept: per-tick, each fixer counts adjacent live goons
  // (Manhattan ≤ 1, including same tile). One adjacent goon → that goon dies.
  // Two-or-more adjacent → one goon dies AND the fixer dies (Design Doc
  // §rivals "two goons beat one fixer"). Goon deaths are sim-internal kills;
  // unit removal happens in _pruneDeadUnits.
  _fixerInterceptTick() {
    for (const fixer of this.units) {
      if (fixer.kind !== 'fixer') continue;
      if ((fixer.hp ?? 0) <= 0) continue;
      const adjGoons = this.units.filter((u) =>
        u.kind === 'goon' &&
        (u.hp ?? 0) > 0 &&
        Math.abs(u.tile.x - fixer.tile.x) + Math.abs(u.tile.y - fixer.tile.y) <= 1,
      );
      if (adjGoons.length === 0) continue;
      adjGoons[0].hp = 0; // 1-hit kill
      if (adjGoons.length >= 2) fixer.hp = 0;
    }
  }

  _pruneDeadUnits() {
    if (this.units.some((u) => u.kind !== 'reporter' && u.kind !== 'photog' && (u.hp ?? 1) <= 0)) {
      this.units = this.units.filter((u) =>
        u.kind === 'reporter' || u.kind === 'photog' || (u.hp ?? 1) > 0,
      );
      // Deselect any selection that was on a removed unit.
      const stillSelected = this.units.some((u) => u.selected);
      if (!stillSelected) {
        for (const u of this.units) u.selected = false;
      }
    }
  }

  _enterGameOver() {
    this.gameOver = true;
    this._emitCycle({
      kind: 'CYCLE_GAME_OVER',
      edition: this.cycle.edition,
      reason: 'press_destroyed',
    });
  }

  // Triggered exactly once per edition on DEADLINE_FIRE. Walks each verified
  // story sitting at the Darkroom through verified → plated → printed in the
  // same frame. 0.7.1: the plating step substitutes the Editor's UnitId for
  // AUTO_PLATE_SENTINEL (ICD-05 v0.4 §Notes — the sentinel constant remains
  // exported as the defensive fallback for a no-Editor world) and applies the
  // ink hard gate: verified→plated is rejected if it would leave
  // World.resources.ink negative. Stories that fail the gate stay 'verified'
  // at the Darkroom and retry next edition. Builds the EditionSummary, emits
  // EDITION_DEBRIEF_BEGIN, and flips debriefOpen so subsequent ticks pause the
  // sim until ackDebrief() resolves the panel.
  _fireDebrief() {
    const darkroom = this.buildings.find((b) => b.kind === 'darkroom');
    const editor   = this.units.find((u) => u.kind === 'editor');
    const platedBy = editor ? editor.id : AUTO_PLATE_SENTINEL;
    const verifiedStories = darkroom
      ? this.stories.filter((s) => s.state === 'verified' && s.held_by_building === darkroom.id)
      : [];

    // 0.7.1 ink hard gate (ICD-05 v0.4 §Notes). Walk the verified queue in order
    // and admit only stories whose ink cost fits the projected budget. Skipped
    // stories stay 'verified' at the Darkroom — untouched — and try again next
    // edition (where ink may have been restocked).
    const printing = [];
    let projectedInk = this.resources.ink;
    for (const story of verifiedStories) {
      const cost = inkCostFor(story);
      if (projectedInk - cost < 0) continue;
      projectedInk -= cost;
      printing.push(story);
    }

    for (const story of printing) {
      // verified → plated → printed in one tick. Yields land at the plated step
      // and freeze there per ICD-05 §Notes.
      story.state = 'plated';
      story.plated_by = platedBy;
      story.cash_yield = cashYieldFor(story);
      story.heat_yield = heatYieldFor(story);
      story.ink_cost = inkCostFor(story);
      story.state = 'printed';
      story.printed_in = this.cycle.edition;
    }

    const summary = this._buildEditionSummary(printing);
    // Apply the edition deltas to the running balances. With the 0.7.1 gate in
    // place, summary.ink_consumed is exactly the admitted set's total — so
    // resources.ink stays ≥ 0 after this subtraction.
    this.resources.cash += summary.cash_earned;
    this.resources.ink  -= summary.ink_consumed;
    this.resources.heat += summary.heat_applied;
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
    // Edition-boundary heat decay (Design Doc §19 baseline). Clamped at zero.
    // The "−12 if no controversial stories" and "0 decay if heat>80" nuances
    // are medium-band balance refinements scheduled for 0.7+.
    this.resources.heat = Math.max(0, this.resources.heat - HEAT_DECAY_PER_EDITION);

    // 0.7.0: rivals tick their edition-boundary state (ICD-02 §Notes
    // "rival manages it from … EDITION_DEBRIEF_END callbacks").
    for (const rival of this.rivals) rival.onEditionEnd();

    this._emitCycle({ kind: 'EDITION_DEBRIEF_END' });
    const begin = this.cycle.start(this.cycle.edition + 1);
    this._emitCycle(begin);
  }

  _buildEditionSummary(printed) {
    const rivalEvents = this._pendingRivalEvents.slice();
    this._pendingRivalEvents = [];
    // 0.7.0: append this edition's deltas to the history ring (cap 10 entries
    // per ICD-02 §RivalView edition_history). The summary captures the
    // public-facing deltas; raids_attempted comes from the rival events
    // we just flushed.
    const raidsAttempted = rivalEvents.filter((e) => e.kind === 'raid_attempted').length;
    const raidsSucceeded = rivalEvents.filter((e) => e.kind === 'raid_succeeded').length;
    const cashEarned = printed.reduce((sum, s) => sum + (s.cash_yield ?? 0), 0);
    this.editionHistory.push({
      edition: this.cycle.edition,
      player_cash_delta: cashEarned,
      raids_attempted:   raidsAttempted,
      raids_succeeded:   raidsSucceeded,
    });
    while (this.editionHistory.length > 10) this.editionHistory.shift();

    return {
      edition: this.cycle.edition,
      stories_printed: printed.map(storyDigest),
      cash_earned:  cashEarned,
      ink_consumed: printed.reduce((sum, s) => sum + (s.ink_cost  ?? 0), 0),
      heat_applied: printed.reduce((sum, s) => sum + (s.heat_yield ?? 0), 0),
      rival_events: rivalEvents,
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
    // Goon and Fixer have no on-arrival pickup logic — combat resolves in the
    // per-tick fixer-intercept + goon-damage routines, not at arrival. The
    // unit just flips to idle and the next tick's combat tick takes over.
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
    const leads = this.stories
      .filter((s) => s.state === 'lead' && !s.picked_up_by && !s.held_by_building)
      .map((s) => leadView(s, this.sim_time_ms));
    const storyCount = this.stories.filter(
      (s) => s.state === 'verified' || s.state === 'plated',
    ).length;
    return {
      cameraTarget: { x: 0, y: 0, z: 0 },
      buildings: this.buildings.map(buildingView),
      units: this.units.map(unitView),
      leads,
      rain: { intensity: 1 },
      fog: { near: 22, far: 60, color: 0xc8c4bc },
      hud: {
        edition: this.cycle.edition,
        deadline_ms: this.cycle.remainingMs,
        // ICD-01 v0.5 §HudState. leads/stories are derived from the live state
        // (same lead filter as frame.leads; stories = verified+plated count).
        // ink/cash/heat read from the running balances accumulated at print.
        resources: {
          leads: leads.length,
          stories: storyCount,
          ink: this.resources.ink,
          cash: this.resources.cash,
          heat: this.resources.heat,
        },
      },
      effects: this.effects.splice(0),
    };
  }
}

function bakeGrid() {
  const walkable = Array.from({ length: GRID_H }, () => Array(GRID_W).fill(true));
  return { width: GRID_W, height: GRID_H, walkable };
}

// Shared unit constructor. hp/hp_max are sim-internal (not on UnitView) and
// only meaningful for kinds that can take damage (goon, fixer at 0.7.0).
function makeUnit(id, kind, tile, extras = {}) {
  return {
    id,
    tile: { ...tile },
    pos: tileToWorld(tile),
    facing: 0,
    kind,
    state: 'idle',
    selected: false,
    carrying: null,
    carryingStoryId: null,
    path: [],
    pathIdx: 0,
    ...extras,
  };
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
  const speed = UNIT_SPEED[u.kind] ?? UNIT_SPEED.reporter;
  let remaining = speed * dt;
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
