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
// raid_attempted lands at 0.7.0; raid_succeeded + raid_wiped land at 0.9.3
// (PR-A audit C-02) on first-damage-tick / last-goon-prune respectively.
// Milestone 0.7.1 adds: Editor unit (stationary at EDITOR_SPAWN_TILE west of
// Bureau, speed 0, dispatch-rejected). At DEADLINE_FIRE the plating step
// substitutes the editor's UnitId for AUTO_PLATE_SENTINEL on Story.plated_by
// per ICD-05 v0.4 §Notes (sentinel stays as the defensive fallback only).
// Ink plate-time hard gate: a verified→plated transition that would leave
// World.resources.ink negative is rejected — the Story stays 'verified' at
// the Darkroom and waits for the next edition (ICD-05 v0.4 §Notes).
// Milestone 0.9.3 (PR-A polish) adds: Press HP repair at edition boundary
// (C-01); raid_id-tagged goons + raid_succeeded / raid_wiped emission in the
// damage / prune loop (C-02 — ICD-02 v0.2.2 §Notes); §19 heat-decay nuances
// (D-04 — quiet edition +12, heat>80 stall); Reporter/Photog/Editor HP fields
// (D-02 — sim-internal, UnitView untouched).

import { pathfind } from './pathfinder.js';
import { CycleClock } from './cycle-clock.js';
import {
  STARTING_INK,
  HEAT_DECAY_PER_EDITION,
  HEAT_DECAY_QUIET_EDITION,
  HEAT_DECAY_STALL_THRESHOLD,
  cashYieldFor,
  inkCostFor,
  heatYieldFor,
} from './resources.js';
import { EveningStar, PAST_INTENTS_PROJECTION_CAP } from './evening-star.js';
import { Herald } from './herald.js';
import { Observer } from './observer.js';
import { SeededRng } from './seeded-rng.js';
import { LeadSpawner } from './lead-spawner.js';
import {
  DISTRICTS,
  DEFAULT_DISTRICT_ID,
  getDistrict,
  resolveDistrictId,
  pickSpawnTile,
  pickWeighted,
  districtForTile,
} from './districts.js';
import { synthesizeHeadline } from './headlines.js';
import {
  ARCS,
  ActiveArc,
  evalTrigger,
  findArc,
  findArcEpisode,
  findArcOutcome,
} from './arcs.js';

// 0.8: id-mint module state. Both fresh-construct (constructor) and the
// snap restore path explicitly call setIdMint — fresh = 1, restore =
// blob.id_mint.next. Mitigates process-wide pollution when tests build
// multiple Worlds in the same Node process.

export const TILE = 6;
export const GRID_W = 10;
export const GRID_H = 10;
// Per-kind walk speeds in world-units / second. Lands at 0.7 (ICD-03 v0.2
// §Notes "per-kind costs land at 0.7"). Design Doc §17 unit stats table:
// reporter 3.5, photog 2.5, goon 2.5, fixer 3.0. Photog re-tuned to spec at
// PR-A (audit D-01) — the 3.5 carryover from 0.4 was a known drift.
export const UNIT_SPEED = {
  reporter: 3.5,
  photog:   2.5,
  goon:     2.5,
  fixer:    3.0,
  editor:   0,   // 0.7.1: stationary at Bureau — dispatch is rejected, this is belt-and-braces.
};
export const REPORTER_SPEED = UNIT_SPEED.reporter; // legacy export — kept stable for tests/unit-step.test.mjs
export const PRESS_HP = 90;        // overview §Single fail-state
export const GOON_DAMAGE_PER_SECOND = 1; // Design Doc §17 — "damages press at 1 dmg/s on contact"
export const LEAD_SPAWN_TILE = { x: 2, y: 2 }; // 0.3 "single district" pickup point (starter lead seed)
export const BUREAU_TILE = { x: 5, y: 5 };
export const DARKROOM_TILE = { x: 7, y: 7 }; // 0.4: symmetric from Bureau (Manhattan 4)
export const FIXER_SPAWN_TILE = { x: 6, y: 5 }; // 0.7: Bureau-adjacent (east of Bureau)
export const GOON_SPAWN_TILE = { x: 0, y: 0 }; // 0.7: NW grid edge (placeholder until district edges land)
export const EDITOR_SPAWN_TILE = { x: 4, y: 5 }; // 0.7.1: Bureau-adjacent (west of Bureau) — Editor is stationary
export const BRANCH_BUREAU_TILE = { x: 8, y: 3 }; // 0.10.0 (G-01): inside Hillside district spawnRect (6..9, 1..4)
export const BRANCH_HP = 20;                      // §15 line 916 "squishy: 1 goon takes them out in 20s" @ 1 dmg/s
export const SWITCHBOARD_TILE = { x: 3, y: 3 };   // 1.0.0 (ICD-08): NW-of-Bureau placement gives LoS coverage from goon spawn (0,0) to Bureau (5,5) — all path tiles within ±6.
export const SWITCHBOARD_HP = 30;                 // 1.0.0 defensive shape; no damage source targets the Switchboard at 1.0.0.
export const SWITCHBOARD_LOS_RADIUS = 6;          // ICD-08 §LoS rect shape — ±6 axis-aligned (medium-band).
export const BUREAU_REVEAL_RADIUS = 1;            // ICD-08 §Visibility projection rule — defensive default (Chebyshev ≤ 1 to any Bureau-family building).
// 1.0.1 (ICD-09 v0.1): archive cap + cold-news decay. Both medium-band — playtest moves them.
// Cap-full rejects the verified→archived transition (gesture silent at v0.1).
// Decay culls archived stories at EDITION_DEBRIEF_END when editions_in_archive ≥ N (flips to 'printed' with zero yields).
export const ARCHIVE_CAP = 5;                     // medium-band — ICD-09 §HUD surface
export const ARCHIVE_DECAY_EDITIONS = 10;         // medium-band — ICD-09 §Effects on adjacent contracts (cold-news rule)
// 1.1.0 (ICD-10 v0.1.1 §Notes — district-heat decay rate). Flat per-edition
// decay; simpler than mirroring global heat's quiet/stall schedule. Easy to
// tune at the 1.1.x balance pass. Used by the arc trigger predicate
// `district_heat_above` (Longshoreman's "Docks heat > 60").
export const DISTRICT_HEAT_DECAY_PER_EDITION = 5;

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

export function setIdMint(n) { nextId = n; }
export function getIdMint() { return nextId; }

// 1.1.0 (ICD-10 v0.1.1) — stable 32-bit hash of a story id. Used to seed the
// per-parent RNG for Investigation chain follow-up spawns so save/load
// reproduces the successor's tile + headline word picks. FNV-1a 32-bit.
function hashId(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

export class World {
  constructor(opts = {}) {
    // 0.8 restore path (ICD-04 v0.1). When opts.snap is provided the
    // constructor skips fresh-construct seeding and rebuilds from the blob.
    if (opts.snap) {
      this._loadFromSnap(opts.snap);
      return;
    }
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
      {
        // 0.10.0 (G-01): Branch Bureau. Covers the Hillside district per
        // districts.js coveredByKind. Lower HP than the main Bureau (§15
        // "squishy: 1 goon takes them out in 20s"). Loss does NOT trigger
        // CYCLE_GAME_OVER — only the main Bureau (kind 'bureau') drives
        // the §17 single fail-state; branch destruction silently drops
        // Hillside back to the rumor rate. Rebuild is Tier-1 work.
        id: mkId('b'),
        tile: { ...BRANCH_BUREAU_TILE },
        kind: 'branch_bureau',
        hp: BRANCH_HP,
        hp_max: BRANCH_HP,
        tier: 1,
      },
      {
        // 1.0.0 (ICD-08): Switchboard. NW-of-Bureau intel-defense building.
        // LoS rect is ±SWITCHBOARD_LOS_RADIUS tiles axis-aligned around its
        // tile — see _isGoonVisible(). Without it, goons stay hidden until
        // they enter BUREAU_REVEAL_RADIUS of a Bureau-family building
        // (window-breaking beat — design-doc.html §10 line 1088).
        // Destruction is silent (only the main Bureau drives CYCLE_GAME_OVER).
        id: mkId('b'),
        tile: { ...SWITCHBOARD_TILE },
        kind: 'switchboard',
        hp: SWITCHBOARD_HP,
        hp_max: SWITCHBOARD_HP,
        tier: 1,
      },
    ];

    for (const b of this.buildings) this.grid.walkable[b.tile.y][b.tile.x] = false;

    const reporterStart = { x: 5, y: 4 };
    const photogStart = { x: 5, y: 6 }; // 0.4: mirror of reporter, south of Bureau
    // 0.9.3 (PR-A audit D-02): HP fields ride extras for every unit kind that
    // can take damage — Reporter 2, Photog 1, Fixer 3, Editor 2 (Design Doc §17
    // unit stats table). The fields are sim-internal only — UnitView intentionally
    // omits them at 0.9.3; the stat-badge surface lands at ICD-01 v0.6 in PRE-0.10.
    // makeUnit threads `extras` straight into the unit object.
    // 1.0.1 (ICD-01 v0.6 §UnitView.stats): the Reporter trio (Design Doc §08
    // "three substats: nerve · nose · legs"; §13 mock — "Nerve 6 · Nose 8 ·
    // Legs 4"). Medium-band starter values shared across all reporters at
    // Tier-0; named reporters with rolled stats stay Tier-1.x. Non-reporter
    // kinds carry no `stats` field on the Unit record — the projection
    // naturally produces `stats: undefined` per the ICD-01 contract.
    this.units = [
      makeUnit(mkId('u'), 'reporter', reporterStart,            { hp: 2, hp_max: 2, stats: { nerve: 6, nose: 8, legs: 4 } }),
      makeUnit(mkId('u'), 'photog',   photogStart,              { hp: 1, hp_max: 1 }),
      // 0.7.0: Fixer spawns east of Bureau. Walk 3.0 u/s (Design Doc §17).
      // One static fixer at 0.7 — hire cost is fuzzy until the economy buys it.
      makeUnit(mkId('u'), 'fixer',    { ...FIXER_SPAWN_TILE },  { hp: 3, hp_max: 3 }),
      // 0.7.1: Editor stationary at Bureau-west (Design Doc §17 "Stationed at the
      // Bureau"). Speed 0 + dispatch reject keeps it pinned to EDITOR_SPAWN_TILE.
      // Its load-bearing role is plating: at DEADLINE_FIRE _fireDebrief substitutes
      // its UnitId for AUTO_PLATE_SENTINEL on Story.plated_by (ICD-05 v0.4 §Notes).
      makeUnit(mkId('u'), 'editor',   { ...EDITOR_SPAWN_TILE }, { hp: 2, hp_max: 2 }),
    ];

    // 0.10.0 (C-04): LeadSpawner owns the spawn cadence end-to-end. One
    // starter lead seeds the Docks so the player has something to chase
    // before the first 90 s interval elapses (same tile as the legacy 0.3
    // spawn so visual layout doesn't shift). Subsequent leads come from
    // _runSpawnerTick during World.tick. The hand-written starter headline
    // sets the tone before the synth takes over.
    this.spawnerRng = new SeededRng(opts.spawnerSeed ?? 0xBEEF1ED);
    this.leadSpawner = new LeadSpawner();
    this.stories = [{
      id: mkId('s'),
      state: 'lead',
      district: DEFAULT_DISTRICT_ID,
      flavor: 'vice',
      tier: 'whisper',
      truthful: true,
      spawned_at_ms: 0,
      tile: { ...LEAD_SPAWN_TILE },
      picked_up_by: null,
      held_by_building: null,
      headline: 'DOCKHAND TIPS THE WIRE',
    }];

    // 0.7.0: Evening Star rival (ICD-02 v0.2). Deterministic seed → replay-safe.
    // Seed is constructor-overridable so tests can pin behavior. Production uses
    // the default seed at 0.7; player-driven seeds land at PRE-0.8 / save schema.
    // 1.0.0 (ICD-02 v0.3): Herald added — ticks 1/EDITION via onEditionEnd.
    // Observer added in the next commit. Iteration order is
    // [evening_star, herald, observer] and pinned for save-load determinism.
    const bureauId = this.buildings.find((b) => b.kind === 'bureau').id;
    this.rivals = [
      new EveningStar({ seed: opts.rivalSeed ?? 0xC0FFEE, bureauId }),
      new Herald({ seed: opts.heraldSeed ?? 0xB0BBED }),
      new Observer({ seed: opts.observerSeed ?? 0x0B5E81 }),
    ];

    // 0.7.0: rolling list of edition deltas the rival projection can read.
    // Cap at 10 entries per ICD-02 §RivalView edition_history.
    this.editionHistory = [];
    // 0.7.0: per-edition rival event digest accumulator. Flushed into
    // EditionSummary.rival_events at DEADLINE_FIRE, cleared at CYCLE_BEGIN.
    this._pendingRivalEvents = [];

    // 0.9.3 (PR-A audit C-02): per-raid bookkeeping. Map<raid_id, {rivalId,
    // damageDealt}>. Populated when _reconcileIntent commits a RAID_BUREAU;
    // read by _goonDamageTick (first damage tick → emit raid_succeeded) and
    // by _pruneDeadUnits (last-goon prune with no damage → emit raid_wiped).
    // Intentionally NOT persisted in the save blob — on restore, in-flight
    // goons lose their outcome event (the raid_attempted digest already saved
    // remains the only artifact for that raid). See ICD-04 §Notes — save
    // cadence is CYCLE_BEGIN + CYCLE_GAME_OVER; raids are short-lived.
    this._activeRaids = new Map();
    this._nextRaidId = 1;

    // 0.7.0: fail-state flag. World.tick() short-circuits when set (matches the
    // debrief pause pattern). Set when bureau.hp ≤ 0.
    this.gameOver = false;

    this.effects = [];

    // 0.10.0 (G-13): rolling run stats fed by _buildEditionSummary. Read by
    // the game-over overlay to render run-end summary + write a high-score
    // entry. Persisted in the save blob so a mid-run resume keeps the count
    // honest.
    this.runStats = {
      total_revenue:     0,
      editions_survived: 0,
      top_story:         null, // { headline, cash } | null
    };

    // 1.1.0 (ICD-10 v0.1.1): arc framework + per-district trackers.
    //
    // - activeArcs: one ActiveArc per in-progress arc; one-instance-per-arc-id
    //   enforced at dispatch in _runSpawnerTick. Snap → ICD-04 v0.1.4
    //   §SaveBlobV1.active_arcs[].
    // - districtHeat: per-district accumulator powering the
    //   `district_heat_above` trigger predicate. Accumulated at _fireDebrief
    //   (sum admitted printed stories' heat_yield partitioned by Story.district);
    //   decayed at ackDebrief (flat DISTRICT_HEAT_DECAY_PER_EDITION = 5).
    // - districtDispositions: terminal-state effect of arc outcomes
    //   (loyal | grudging | bitter | open hostility); stored + displayed at
    //   1.1.0; spawn-rate / raid-prob modifiers deferred to the 1.1.x
    //   balance pass per ICD-10 v0.1.1 §Notes.
    this.activeArcs = [];
    this.districtHeat = {};
    for (const d of DISTRICTS) this.districtHeat[d.id] = 0;
    this.districtDispositions = {};
  }

  // 0.8 restore path (ICD-04 v0.1). Rebuilds every authoritative field from
  // a SaveBlobV1 snapshot. The constructor delegates here when opts.snap is
  // present so the fresh-construct seeding (buildings, units, stories,
  // rivals) is skipped. The blob's id_mint.next restores the module-scoped
  // counter so post-load mkId() doesn't collide with anything in the blob.
  // _warningFired / _fireFired on the restored CycleClock are carried
  // verbatim so DEADLINE_WARNING / DEADLINE_FIRE don't double-emit on resume.
  _loadFromSnap(blob) {
    setIdMint(blob.id_mint.next);
    this.grid = {
      width: blob.grid.width,
      height: blob.grid.height,
      walkable: blob.grid.walkable.map((row) => row.slice()),
    };
    this.sim_time_ms = blob.sim_time_ms;
    this.cycle = CycleClock.fromSnap(blob.cycle);
    this.cycleSubscribers = [];
    this.debriefOpen = blob.debrief_open;
    this.gameOver = blob.game_over;
    this.resources = {
      ink:  blob.resources.ink,
      cash: blob.resources.cash,
      heat: blob.resources.heat,
    };
    this.buildings = blob.buildings.map(restoreBuilding);
    this.units = blob.units.map(restoreUnit);
    this.stories = blob.stories.map(restoreStory);
    // 1.0.0: kind-keyed dispatch matching rivalsSnap (save.js). Iteration
    // order pinned [evening_star, herald, observer] for save-load determinism.
    // The migration (save.js migrate_1_0_to_1_1) ensures herald + observer
    // are present on every loaded blob — defaults if the source was pre-1.0.
    this.rivals = [
      EveningStar.fromSnap(blob.rivals.evening_star),
      Herald.fromSnap(blob.rivals.herald),
      Observer.fromSnap(blob.rivals.observer),
    ];
    this.editionHistory = blob.edition_history.slice();
    this._pendingRivalEvents = blob.pending_rival_events.slice();
    // 0.9.3: raid bookkeeping is ephemeral (see constructor comment). On
    // restore we start fresh; any in-flight goons keep walking but their
    // raid_id is lost — outcomes (raid_succeeded / raid_wiped) won't fire.
    this._activeRaids = new Map();
    this._nextRaidId = 1;
    this.effects = [];
    // 0.10.0 (C-04): restore the spawner PRNG state + per-district
    // accumulators. ICD-04 §Notes — rng_seed (renamed to world_rng for
    // clarity in v0.6 of ICD-04) carries the spawner stream's `.state`,
    // not the initial seed.
    const rngState = blob.world_rng?.state ?? blob.rng_seed ?? 0;
    this.spawnerRng = new SeededRng(rngState || 0xBEEF1ED);
    this.leadSpawner = blob.lead_spawner
      ? LeadSpawner.fromSnap(blob.lead_spawner)
      : new LeadSpawner();
    // 0.10.0 (G-13): run stats survive resume so a mid-edition save/load
    // doesn't lose the high-score-bound counters.
    this.runStats = blob.run_stats
      ? {
          total_revenue:     blob.run_stats.total_revenue     ?? 0,
          editions_survived: blob.run_stats.editions_survived ?? 0,
          top_story:         blob.run_stats.top_story         ?? null,
        }
      : { total_revenue: 0, editions_survived: 0, top_story: null };

    // 1.1.0 (ICD-04 v0.1.4 · ICD-10 v0.1.1): arc framework restore.
    // All three blocks are optional on the wire — pre-1.1.0 saves resume
    // cleanly with empty activeArcs / all-zero districtHeat / empty
    // dispositions via the ?? fallbacks. migrate_1_2_to_1_3 in save.js
    // pre-fills the blob shape for forward-compat readers.
    this.activeArcs = (blob.active_arcs ?? []).map(ActiveArc.fromSnap);
    this.districtHeat = {};
    for (const d of DISTRICTS) {
      this.districtHeat[d.id] = blob.district_heat?.[d.id] ?? 0;
    }
    this.districtDispositions = { ...(blob.district_dispositions ?? {}) };
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

  // 1.0.1 (ICD-09 v0.1.1) — Archive UI player gesture. Toggles a story
  // between 'verified' and 'archived' at the Darkroom. The gesture is
  // player-initiated only (no rival action moves stories into / out of
  // archive); the dossier wires this through the per-story row click
  // listener in hud.js. Caps + decay-anchor enforced here so the HUD stays
  // a projection-only read.
  //
  //   verified → archived: rejects if !at-Darkroom or cap is full.
  //                        On success: stamps archived_at_ms = sim_time_ms,
  //                        held_by_building unchanged (stays at Darkroom).
  //   archived → verified: clears archived_at_ms. Story re-enters the
  //                        ink-budget walk at next DEADLINE_FIRE.
  //
  // Returns { ok, reason? } so future toast UX can surface cap-full; at
  // v0.1 the reject is silent per ICD-09 §HUD surface.
  toggleArchive(storyId) {
    const story = this.stories.find((s) => s.id === storyId);
    if (!story) return { ok: false, reason: 'not_found' };
    const darkroom = this.buildings.find((b) => b.kind === 'darkroom');
    if (!darkroom || story.held_by_building !== darkroom.id) {
      return { ok: false, reason: 'not_at_darkroom' };
    }
    if (story.state === 'verified') {
      const archivedCount = this.stories.filter((s) => s.state === 'archived').length;
      if (archivedCount >= ARCHIVE_CAP) return { ok: false, reason: 'cap_full' };
      story.state = 'archived';
      story.archived_at_ms = this.sim_time_ms;
      return { ok: true };
    }
    if (story.state === 'archived') {
      story.state = 'verified';
      delete story.archived_at_ms;
      return { ok: true };
    }
    return { ok: false, reason: story.state === 'lead' ? 'not_verified' : 'not_archived' };
  }

  // 1.1.0 (ICD-10 v0.1.1 §Open-Q3 close): branch-choice gesture for an arc
  // story. Records intent; effects fire at the verified → plated boundary
  // inside _fireDebrief. Un-picked arc stories are gated out of the plating
  // queue (§HUD surface — "the player must pick a branch before the story
  // can plate"). Returns { ok, reason? } so the dossier click handler can
  // surface future toast UX; v1.1.0 is silent on reject.
  pickArcBranch(storyId, label) {
    const story = this.stories.find((s) => s.id === storyId);
    if (!story) return { ok: false, reason: 'not_found' };
    if (story.tier !== 'arc' || !story.arc_episode_id) {
      return { ok: false, reason: 'not_arc' };
    }
    // Validate the label against the current episode's branch table.
    const arcId = story.arc_episode_id.split('.')[0];
    const episode = findArcEpisode(arcId, story.arc_episode_id);
    if (!episode) return { ok: false, reason: 'no_episode' };
    const choice = episode.branch_table.choices.find((c) => c.label === label);
    if (!choice) return { ok: false, reason: 'invalid_choice' };
    story.arc_branch_label = label;
    return { ok: true };
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

    // 0.10.0 (C-04): lead-spawn engine. Cadence + decay live in
    // js/sim/lead-spawner.js (Design Doc §19 1 per ~90s per covered
    // district · 180 s decay · ×0.5 rate when uncovered).
    this._runSpawnerTick(dtMs);

    const events = this.cycle.advance(dt * 1000);
    for (const ev of events) {
      this._emitCycle(ev);
      if (ev.kind === 'DEADLINE_FIRE') this._fireDebrief();
    }
  }

  _bureau() {
    return this.buildings.find((b) => b.kind === 'bureau');
  }

  // ICD-02 §RivalView projection (v0.2; v0.3.1 adds player.printed_lies).
  // Read-only snapshot the world hands each rival on tick / edition end.
  // Filters honor §Visibility filter (0.7 = all-shared).
  _buildRivalView(rival) {
    const heat = this.resources.heat;
    const heatNoise = rival.rng ? (rival.rng.next() * 40 - 20) : 0;
    // v0.3.1 (1.0.0 · ICD-02): printed_lies surfaces the player's recent
    // printed stories with truthful === false. Observer reads this at the
    // INVESTIGATE → PUBLISH transition (per ICD-02 v0.3 §Observer state
    // machine §Notes — "fixates on the worst recent player lie at
    // INVESTIGATE entry, last N=5 player Story records where truthful ===
    // false, weighted by heat_yield"). The 5-edition window is the
    // medium-band cap.
    const RECENT_LIE_EDITIONS = 5;
    const cutoff = this.cycle.edition - RECENT_LIE_EDITIONS;
    const printedLies = this.stories
      .filter((s) =>
        s.state === 'printed' &&
        s.truthful === false &&
        (s.printed_in ?? 0) > cutoff,
      )
      .map((s) => ({
        id:         s.id,
        heat_yield: s.heat_yield ?? 0,
        printed_in: s.printed_in,
      }));
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
          .map((u) => ({ id: u.id, district: districtForTile(u.tile) })),
        printed_lies: printedLies,
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
      // 0.9.3 (PR-A audit C-02): mint a raid_id, tag every goon with it,
      // and register the raid in _activeRaids so the damage tick + prune
      // step can emit raid_succeeded / raid_wiped against the right window.
      const raidId = `r-${this._nextRaidId++}`;
      this._activeRaids.set(raidId, { rivalId: rival.id, damageDealt: false });
      const target = { x: this._bureau().tile.x - 1, y: this._bureau().tile.y };
      for (let i = 0; i < intent.goons; i++) {
        const goon = makeUnit(mkId('u'), 'goon', { ...GOON_SPAWN_TILE }, { hp: 1, hp_max: 1, raid_id: raidId });
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
      // 0.10.2 (C-07): FxEvent emit. ICD-01 v0.6 §FxEvent — `raid_warning`
      // is the discrete pre-raid trigger; the renderer pulses red over the
      // goon spawn so the player has a one-frame heads-up before the goons
      // visibly walk in. One emit per raid (not per goon).
      this.effects.push({
        kind:  'raid_warning',
        at:    tileToWorld(GOON_SPAWN_TILE),
        rival: rival.id,
      });
      return;
    }
    // 1.0.0 (ICD-02 v0.3 — Observer intents). PUBLISH_COUNTER, INVESTIGATE_LEAD,
    // and POISON_LEAD wire here. Other intent kinds (BRIBE / RUSH / FILE_STORY
    // / OFFER_*) remain caller-triggered until their callers land at Tier-1.x.
    if (intent.kind === 'PUBLISH_COUNTER') {
      // ICD-02 v0.3 §Observer §PUBLISH: +25 player heat (effect rule applied
      // by reconciler, not rival). "Discredit lie" and "burn source" are
      // shape-committed for Tier-1.x — discredit needs the printed-story
      // cash-refund mechanism; burn source needs reporter tracking on
      // Story.verified_by. At 1.0.0 we apply heat + log the digest.
      this.resources.heat += 25;
      this._pendingRivalEvents.push({
        rival: rival.id,
        kind:  'publish_counter',
        text:  `THE DAILY OBSERVER COUNTERS — +25 HEAT`,
      });
      return;
    }
    if (intent.kind === 'INVESTIGATE_LEAD' || intent.kind === 'POISON_LEAD') {
      // Tracked rival-internal; no world-side effect at 1.0.0. The Observer
      // updates its observingLeadId on emit; the player feels the impact
      // only when WARN's POISON_LEAD effect (lead poisoning + +5 heat
      // penalty on pickup) wires at Tier-1.x.
      this._pendingRivalEvents.push({
        rival: rival.id,
        kind:  intent.kind.toLowerCase(),
        text:  intent.kind === 'INVESTIGATE_LEAD'
          ? `THE OBSERVER STARTS A SLOW INVESTIGATION`
          : `THE OBSERVER POISONS A LEAD`,
      });
      return;
    }
    // Other intent kinds are caller-triggered (BRIBE / RUSH / etc.) — when
    // their bodies land at Tier-1 they'll add reconciler branches here.
  }

  // Damage tick: each living goon at Manhattan distance 1 from the Bureau
  // deals GOON_DAMAGE_PER_SECOND × dt. Damage accumulates per-tick; the
  // fail-state check at end-of-tick converts ≤ 0 HP into CYCLE_GAME_OVER.
  // 0.9.3 (PR-A audit C-02): the first damaging goon of any raid_id flips
  // its activeRaid record's damageDealt flag and emits raid_succeeded once.
  // De-dup is single-state (the flag); the second damage tick is a no-op.
  _goonDamageTick(dt) {
    const bureau = this._bureau();
    let total = 0;
    const succeededRaids = new Set();
    for (const u of this.units) {
      if (u.kind !== 'goon') continue;
      if ((u.hp ?? 0) <= 0) continue;
      const d = Math.abs(u.tile.x - bureau.tile.x) + Math.abs(u.tile.y - bureau.tile.y);
      if (d !== 1) continue;
      total += GOON_DAMAGE_PER_SECOND * dt;
      if (u.raid_id && this._activeRaids.has(u.raid_id)) succeededRaids.add(u.raid_id);
    }
    if (total > 0) bureau.hp = Math.max(0, bureau.hp - total);
    for (const raidId of succeededRaids) {
      const raid = this._activeRaids.get(raidId);
      if (raid.damageDealt) continue;
      raid.damageDealt = true;
      this._pendingRivalEvents.push({
        rival: raid.rivalId,
        kind:  'raid_succeeded',
        text:  `${raid.rivalId.replace('_', ' ').toUpperCase()} BREACHES THE BUREAU`,
      });
    }
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
      // 0.10.2 (C-07): FxEvent emit. Capture the dying units' positions and
      // kinds before the filter drops them — `death` is ICD-01 v0.6's hook
      // for goon-down / fixer-down beats. Reporter + Photog never reach the
      // prune filter (their HP path is sim-internal, no death fx at Tier-0).
      for (const u of this.units) {
        if (u.kind === 'reporter' || u.kind === 'photog') continue;
        if ((u.hp ?? 1) > 0) continue;
        this.effects.push({ kind: 'death', at: tileToWorld(u.tile), unit_kind: u.kind });
      }
      this.units = this.units.filter((u) =>
        u.kind === 'reporter' || u.kind === 'photog' || (u.hp ?? 1) > 0,
      );
      // Deselect any selection that was on a removed unit.
      const stillSelected = this.units.some((u) => u.selected);
      if (!stillSelected) {
        for (const u of this.units) u.selected = false;
      }
    }
    // 0.9.3 (PR-A audit C-02): close out any raid whose goons are all gone.
    // raid_wiped fires only when no damage was dealt — the raid_succeeded path
    // already emitted otherwise. Either emit retires the raid from the map.
    if (this._activeRaids.size > 0) {
      for (const [raidId, raid] of this._activeRaids) {
        const goonsRemaining = this.units.some(
          (u) => u.kind === 'goon' && u.raid_id === raidId && (u.hp ?? 0) > 0,
        );
        if (goonsRemaining) continue;
        if (!raid.damageDealt) {
          this._pendingRivalEvents.push({
            rival: raid.rivalId,
            kind:  'raid_wiped',
            text:  `${raid.rivalId.replace('_', ' ').toUpperCase()} RAID WIPED`,
          });
        }
        this._activeRaids.delete(raidId);
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

  // 0.10.0 (C-04): builds the per-tick context the spawner needs, runs it,
  // and applies the results to this.stories. Occupied-tile filter prevents
  // two leads stacking on the same tile. New stories get an id minted here
  // (spawner stays free of mkId concerns); expired stories are removed and
  // any unit currently pathing toward one falls back to idle (the lead
  // pickup check inside _handleReporterArrival also no-ops cleanly).
  _runSpawnerTick(dtMs) {
    const occupied = new Set();
    for (const s of this.stories) {
      if (s.state === 'lead' && !s.picked_up_by && !s.held_by_building) {
        occupied.add(`${s.tile.x},${s.tile.y}`);
      }
    }
    const ctx = {
      grid:      this.grid,
      buildings: this.buildings,
      stories:   this.stories,
      simTimeMs: this.sim_time_ms,
      rng:       this.spawnerRng,
      occupiedTiles: occupied,
    };
    const { spawns, expiredIds } = this.leadSpawner.tick(dtMs, ctx);
    for (const partial of spawns) {
      this.stories.push({ id: mkId('s'), ...this._dispatchArcSpawn(partial) });
    }
    if (expiredIds.length > 0) {
      const dead = new Set(expiredIds);
      this.stories = this.stories.filter((s) => !dead.has(s.id));
    }
  }

  // 1.1.0 (ICD-10 v0.1.1): arc dispatch. When the spawner returns a
  // tier='arc' partial story, consult the registry. Fire the first arc whose
  // (a) trigger predicate is satisfied, (b) target district matches (or has
  // no constraint), and (c) is not already active. On success, override the
  // headline with the episode's authored string and stamp arc_episode_id on
  // the Story; an ActiveArc joins this.activeArcs. On miss, downgrade to
  // tier='investigation' (preserving the 70/25/5 distribution behavior the
  // placeholder collapse approximated).
  _dispatchArcSpawn(partial) {
    if (partial.tier !== 'arc') return partial;
    const ctx = this._buildArcContext();
    const eligible = ARCS.find((arc) => {
      if (arc.district && arc.district !== partial.district) return false;
      if (this.activeArcs.some((a) => a.arcId === arc.id)) return false;
      return evalTrigger(arc.trigger, ctx);
    });
    if (!eligible) {
      // No arc fires here — downgrade. Headline was synthesized as 'arc'
      // tier (FRONT PAGE prefix); resynthesize for the investigation tier
      // so the readout matches.
      const fallback = { ...partial, tier: 'investigation' };
      fallback.headline = synthesizeHeadline(fallback, this.spawnerRng);
      return fallback;
    }
    const firstEpisode = eligible.episodes[0];
    this.activeArcs.push(new ActiveArc({
      arcId:          eligible.id,
      currentEpisode: firstEpisode.id,
      spawnEdition:   this.cycle.edition,
    }));
    return {
      ...partial,
      headline:       firstEpisode.headline,
      arc_episode_id: firstEpisode.id,
    };
  }

  // 1.1.0 (ICD-10 v0.1.1 §Open-Q3): apply a plated arc story's outcome.
  // The branch label was set by pickArcBranch; the plate step fires the
  // ActiveArc.pickBranch advance/terminal result here. Terminal outcomes
  // mutate the world (cash / heat / districtDispositions) and retire the
  // ActiveArc; advance outcomes spawn the next episode's lead in the same
  // district.
  _applyArcPlate(story) {
    const arcId = story.arc_episode_id.split('.')[0];
    const arc = findArc(arcId);
    if (!arc) return;
    const activeArc = this.activeArcs.find((a) => a.arcId === arcId);
    if (!activeArc) return;
    const result = activeArc.pickBranch(story.arc_branch_label);
    if (!result.ok) return;
    if (result.kind === 'terminal') {
      const outcome = findArcOutcome(arcId, result.outcomeId);
      if (outcome) {
        if (outcome.cash_one_time) this.resources.cash += outcome.cash_one_time;
        if (outcome.heat_one_time) this.resources.heat += outcome.heat_one_time;
        if (outcome.district_disposition) {
          // ICD-10 v0.1.1 §Open-Q4 close (last-writer-wins). Mechanical
          // effect of disposition (spawn-rate / raid-prob modifiers) is
          // deferred to the 1.1.x balance pass per §Notes; at 1.1.0 we
          // store + display only.
          this.districtDispositions[outcome.district_disposition.district] =
            outcome.district_disposition.value;
        }
      }
      // Retire the arc instance — one-arc-per-id rule clears here so the
      // arc can fire again on a future trigger evaluation.
      this.activeArcs = this.activeArcs.filter((a) => a !== activeArc);
    } else if (result.kind === 'advance') {
      // Advance: spawn the next episode's lead in the same district. The
      // spawn uses spawnerRng so it's deterministic across save round-trips
      // (the RNG state is captured in the save blob).
      this._spawnArcEpisode(arc, activeArc.currentEpisode, story.district);
    }
  }

  // 1.1.0 (ICD-10 v0.1.1): mint a fresh 'lead'-state story for the named
  // arc episode. Headline is the episode's authored canonical string (slot
  // grammar does NOT apply per ICD-10 §ArcEpisode shape). Tile + flavor
  // drawn from the district via spawnerRng for determinism.
  _spawnArcEpisode(arc, episodeId, districtId) {
    const district = getDistrict(districtId);
    if (!district) return;
    const episode = findArcEpisode(arc.id, episodeId);
    if (!episode) return;
    const occupied = new Set();
    for (const s of this.stories) {
      if (s.state === 'lead' && !s.picked_up_by && !s.held_by_building) {
        occupied.add(`${s.tile.x},${s.tile.y}`);
      }
    }
    const tile = pickSpawnTile(
      district,
      { grid: this.grid, occupiedTiles: occupied },
      this.spawnerRng,
    );
    if (!tile) return;
    const flavor = pickWeighted(district.flavorWeights, this.spawnerRng);
    this.stories.push({
      id:               mkId('s'),
      state:            'lead',
      district:         districtId,
      flavor,
      tier:             'arc',
      truthful:         true,
      spawned_at_ms:    this.sim_time_ms,
      tile,
      picked_up_by:     null,
      held_by_building: null,
      headline:         episode.headline,
      arc_episode_id:   episodeId,
    });
  }

  // 1.1.0 (ICD-10 v0.1.1): arc trigger evaluation context. Pure projection
  // of the world's current state for the arcs.js evaluator. Built once per
  // spawn dispatch call so per-arc trigger evaluations share the snapshot.
  _buildArcContext() {
    const coveredDistricts = new Set();
    for (const d of DISTRICTS) {
      const covered = this.buildings.some(
        (b) => b.kind === d.coveredByKind && (b.hp === undefined || b.hp > 0),
      );
      if (covered) coveredDistricts.add(d.id);
    }
    const observer = this.rivals.find((r) => r.id === 'observer');
    const rivalStates = {};
    for (const r of this.rivals) rivalStates[r.id] = r.state;
    return {
      heat:                 this.resources.heat,
      edition:              this.cycle.edition,
      districtHeat:         this.districtHeat,
      coveredDistricts,
      observerRecentStates: observer?.recentStates ?? [],
      rivalStates,
    };
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
    // 1.0.1 (ICD-09 §Effects on adjacent contracts): the ink-budget walk
    // pins state === 'verified', so archived stories (held at the same
    // Darkroom under state 'archived') are naturally excluded. Player must
    // explicitly release archive → verified to re-enter plating.
    // 1.1.0 (ICD-10 v0.1.1 §HUD surface): arc stories need a branch pick
    // to plate. Un-picked arc stories stay verified at the Darkroom and
    // wait for the player's click (or for archive, which freezes the chain).
    const verifiedStories = darkroom
      ? this.stories.filter((s) =>
          s.state === 'verified' &&
          s.held_by_building === darkroom.id &&
          (s.tier !== 'arc' || s.arc_branch_label),
        )
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

    const printAnchor = darkroom ? tileToWorld(darkroom.tile) : { x: 0, y: 0, z: 0 };
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
      // 0.10.2 (C-07): FxEvent emit. ICD-01 v0.6 §FxEvent — `print` carries
      // the edition number for the renderer's paper-page sprite cue.
      this.effects.push({ kind: 'print', at: printAnchor, edition: this.cycle.edition });
    }

    // 1.1.0 (ICD-10 v0.1.1 §Notes): per-district heat accumulator. Sum the
    // admitted printed stories' heat_yield partitioned by Story.district.
    // Trigger predicate `district_heat_above` reads this map at the next
    // spawn-cycle tick. Decay at ackDebrief, below.
    for (const story of printing) {
      if (this.districtHeat[story.district] !== undefined) {
        this.districtHeat[story.district] += (story.heat_yield ?? 0);
      }
    }

    // 1.1.0 (ICD-10 v0.1.1 §Open-Q3 close): apply arc outcomes / advance
    // arc chains for any arc story that just plated. Iterate `printing`
    // (only arc stories with arc_branch_label reach here per the gate
    // above). Terminal outcomes mutate cash / heat / districtDispositions
    // and retire the ActiveArc; advance outcomes spawn the next episode's
    // lead in the same district.
    for (const story of printing) {
      if (story.tier !== 'arc' || !story.arc_branch_label) continue;
      this._applyArcPlate(story);
    }

    const summary = this._buildEditionSummary(printing);
    // Apply the edition deltas to the running balances. With the 0.7.1 gate in
    // place, summary.ink_consumed is exactly the admitted set's total — so
    // resources.ink stays ≥ 0 after this subtraction.
    this.resources.cash += summary.cash_earned;
    this.resources.ink  -= summary.ink_consumed;
    this.resources.heat += summary.heat_applied;
    // 0.9.3 (PR-A audit D-04): stash the summary for ackDebrief's heat decay
    // branch — the "no controversial stories" check reads heat_applied.
    this._lastSummary = summary;
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
    // 0.9.3 (PR-A audit D-04): full §19 heat decay rules.
    //   - heat > 80 pre-decay → decay stalls at 0 ("the room won't cool" beat).
    //   - else if no controversial stories this edition → bonus decay (12).
    //   - else → baseline decay (8).
    // Clamped at zero. The pre-decay snapshot lives in this._lastSummary
    // (set inside _fireDebrief) so we can read heat_applied at edition end.
    const summary = this._lastSummary;
    if (this.resources.heat <= HEAT_DECAY_STALL_THRESHOLD) {
      const decay = summary && summary.heat_applied > 0
        ? HEAT_DECAY_PER_EDITION
        : HEAT_DECAY_QUIET_EDITION;
      this.resources.heat = Math.max(0, this.resources.heat - decay);
    }

    // 0.9.3 (PR-A audit C-01): repair the Press between editions. The Bureau
    // rebuilds presses overnight; only a destroyed press (already game-over)
    // stays dead. Design Doc §17 single-fail-state — the run continues as long
    // as bureau.hp > 0 on the morning side of the deadline.
    const bureau = this._bureau();
    if (bureau && bureau.hp > 0) bureau.hp = bureau.hp_max;

    // 1.1.0 (ICD-10 v0.1.1 §Notes — district-heat decay): flat per-edition
    // decay on each district's accumulator, clamped at zero. Decay is
    // symmetric across all districts at 1.1.0; the 1.1.x balance pass may
    // differentiate by districtDispositions.
    for (const id of Object.keys(this.districtHeat)) {
      this.districtHeat[id] = Math.max(
        0,
        this.districtHeat[id] - DISTRICT_HEAT_DECAY_PER_EDITION,
      );
    }

    // 1.0.1 (ICD-09 §Effects on adjacent contracts): cold-news decay. Walk the
    // archive at EDITION_DEBRIEF_END; any story whose editions-in-archive has
    // reached the medium-band cap flips to 'printed' with zero yields (the
    // "the news goes cold" beat — design-doc.html §06 line 888). editionAtArchive
    // is recovered from archived_at_ms via cycle.editionFromMs(). The story
    // becomes inert through the same terminal state the print rule uses; an
    // alternative sixth Story.state value 'expired' was rejected at v0.1 for scope.
    for (const story of this.stories) {
      if (story.state !== 'archived') continue;
      const editionAtArchive = this.cycle.editionFromMs(story.archived_at_ms ?? this.sim_time_ms);
      const editionsInArchive = this.cycle.edition - editionAtArchive;
      if (editionsInArchive < ARCHIVE_DECAY_EDITIONS) continue;
      story.state = 'printed';
      story.cash_yield = 0;
      story.heat_yield = 0;
      story.printed_in = this.cycle.edition;
      delete story.archived_at_ms;
    }

    // 0.7.0: rivals tick their edition-boundary state (ICD-02 §Notes
    // "rival manages it from … EDITION_DEBRIEF_END callbacks").
    // 1.0.0 (ICD-02 v0.3): onEditionEnd now returns Intent[] so edition-cadence
    // rivals (Herald, Observer) can emit per-edition intents. The world
    // reconciles each rival's intents in deterministic iteration order
    // [evening_star, herald, observer]. Reconciliation runs BEFORE
    // cycle.start(next) so heat/state changes are visible at the next
    // snapshot (e.g. PUBLISH_COUNTER's +25 heat shows up at edition N+1 open).
    for (const rival of this.rivals) {
      const view = this._buildRivalView(rival);
      const intents = rival.onEditionEnd(view) ?? [];
      for (const intent of intents) this._reconcileIntent(rival, intent);
    }

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

    const digests = printed.map(storyDigest);

    // 0.10.0 (G-13): rolling run stats. editions_survived counts each
    // completed printing (a press-destroyed edition still counts if a
    // summary was built before the fail-state — Tier-0 has no such
    // ordering today; the count stays a faithful "printed editions" tally).
    this.runStats.total_revenue += cashEarned;
    this.runStats.editions_survived = this.cycle.edition;
    for (const d of digests) {
      if (!this.runStats.top_story || d.cash > this.runStats.top_story.cash) {
        this.runStats.top_story = { headline: d.headline, cash: d.cash };
      }
    }

    return {
      edition: this.cycle.edition,
      stories_printed: digests,
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
        // 0.10.2 (C-07): FxEvent emit. ICD-01 v0.6 §FxEvent — `pickup`
        // carries the world-space tile anchor + story_id so the SFX layer
        // can correlate. Drained queue: this.effects.splice(0) at snapshot.
        this.effects.push({ kind: 'pickup', at: tileToWorld(u.tile), story_id: lead.id });
      }
      return;
    }
    if (u.carrying === 'lead') {
      // 0.10.0 (G-01): drop is accepted at any bureau-family building. The
      // reporter picks the closest one that's Manhattan-adjacent — when both
      // bureaus are equidistant the find-order wins, which is harmless.
      const dropAt = this.buildings.find((b) =>
        isBureauFamily(b) &&
        Math.abs(b.tile.x - u.tile.x) + Math.abs(b.tile.y - u.tile.y) === 1,
      );
      if (dropAt) {
        const story = this.stories.find((s) => s.id === u.carryingStoryId);
        if (story) {
          story.held_by_building = dropAt.id;
          story.picked_up_by = null;
        }
        u.carrying = null;
        u.carryingStoryId = null;
      }
    }
  }

  _handlePhotogArrival(u) {
    if (u.carrying === null) {
      // 0.10.0 (G-01): pickup from either bureau-family building.
      const bureau = this.buildings.find((b) =>
        isBureauFamily(b) &&
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
          // 0.10.2 (C-07): FxEvent emit. ICD-01 v0.6 §FxEvent — `verify`
          // carries the photog's tile + story_id. The renderer renders the
          // camera-flash at the photog's position, not the darkroom's.
          this.effects.push({ kind: 'verify', at: tileToWorld(u.tile), story_id: story.id });
          // 1.1.0 (ICD-10 v0.1.1 — Investigation 3-step chain): on
          // `lead → verified` for an investigation-tier story, spawn the
          // chain successor in the same district. Capped at chain depth 3
          // (parent → child → grandchild); deterministic from parent.id so
          // save/load reproduces the chain.
          this._maybeSpawnInvestigationFollowup(story);
        }
        u.carrying = null;
        u.carryingStoryId = null;
      }
    }
  }

  // 1.1.0 (ICD-10 v0.1.1): Investigation chain follow-up spawn. Fired from
  // the `lead → verified` transition in _handlePhotogArrival. Procedural-
  // not-authored — the chain has no StoryArc record, no branches, no
  // outcomes; the spawner emits one successor per verify until the chain
  // caps at depth 3.
  _maybeSpawnInvestigationFollowup(parent) {
    if (parent.tier !== 'investigation') return;
    // Walk the parent_story_id chain to count depth. Cap at 3.
    if (this._chainDepth(parent) >= 3) return;
    const district = getDistrict(parent.district);
    if (!district) return;
    // Deterministic per-parent RNG so save/load reproduces the successor
    // tile + headline word picks.
    const rng = new SeededRng(hashId(parent.id) || 1);
    const occupied = new Set();
    for (const s of this.stories) {
      if (s.state === 'lead' && !s.picked_up_by && !s.held_by_building) {
        occupied.add(`${s.tile.x},${s.tile.y}`);
      }
    }
    const tile = pickSpawnTile(district, { grid: this.grid, occupiedTiles: occupied }, rng);
    if (!tile) return;
    const child = {
      id:               mkId('s'),
      state:            'lead',
      district:         parent.district,
      flavor:           parent.flavor,
      tier:             'investigation',
      truthful:         parent.truthful,
      spawned_at_ms:    this.sim_time_ms,
      tile,
      picked_up_by:     null,
      held_by_building: null,
      parent_story_id:  parent.id,
    };
    child.headline = synthesizeHeadline(child, rng);
    this.stories.push(child);
  }

  // Walks parent_story_id pointers up the chain; returns 1 for a root story,
  // 2 for one-with-parent, 3 for the third in a chain. Stops at the first
  // root or at depth 4 (defensive against cycles, which shouldn't happen).
  _chainDepth(story) {
    let depth = 1;
    let current = story;
    while (current && current.parent_story_id && depth < 4) {
      depth += 1;
      const parent = this.stories.find((s) => s.id === current.parent_story_id);
      if (!parent) break;
      current = parent;
    }
    return depth;
  }

  // ICD-08 §Visibility projection rule. Returns true if the unit is not a
  // goon (other kinds are always visible) OR if at least one live Switchboard's
  // ±SWITCHBOARD_LOS_RADIUS rect contains the unit's tile, OR if the unit is
  // within BUREAU_REVEAL_RADIUS (Chebyshev) of any live Bureau-family building
  // (defensive default: "window breaking"). Destroyed buildings (hp ≤ 0) do
  // not contribute LoS — a downed Switchboard "goes dead" on the next frame
  // per ICD-08 §Notes.
  _isUnitVisible(u) {
    if (u.kind !== 'goon') return true;
    for (const b of this.buildings) {
      if ((b.hp ?? 0) <= 0) continue;
      if (b.kind === 'switchboard') {
        if (Math.abs(u.tile.x - b.tile.x) <= SWITCHBOARD_LOS_RADIUS &&
            Math.abs(u.tile.y - b.tile.y) <= SWITCHBOARD_LOS_RADIUS) return true;
      } else if (isBureauFamily(b)) {
        const dx = Math.abs(u.tile.x - b.tile.x);
        const dy = Math.abs(u.tile.y - b.tile.y);
        if (Math.max(dx, dy) <= BUREAU_REVEAL_RADIUS) return true;
      }
    }
    return false;
  }

  snapshot() {
    const leads = this.stories
      .filter((s) => s.state === 'lead' && !s.picked_up_by && !s.held_by_building)
      .map((s) => leadView(s, this.sim_time_ms));
    const storyCount = this.stories.filter(
      (s) => s.state === 'verified' || s.state === 'plated',
    ).length;
    // 1.0.1 (ICD-09 §HUD surface · ICD-01 v0.6.5 §WorldFrame.stories): project
    // every verified + archived story held at Darkroom as a per-row entry so
    // the Story queue dossier can render headline + state chip and route the
    // left-click toggle gesture through World.toggleArchive(id). Plated and
    // printed stories don't appear here — plated is mid-edition transit;
    // printed is terminal.
    const darkroomId = this.buildings.find((b) => b.kind === 'darkroom')?.id ?? null;
    const storyRows = this.stories
      .filter((s) =>
        (s.state === 'verified' || s.state === 'archived') &&
        s.held_by_building === darkroomId,
      )
      .map((s) => storyQueueView(s, this));
    const archivedCount = this.stories.filter((s) => s.state === 'archived').length;
    // 0.10.2 (C-06 + D-09): continuous rain/fog ramps derived from the
    // cycle clock — see ICD-01 v0.6.2 §Notes. Rain intensity sits at 1
    // and climbs to 2 across the last 30 s of the edition (audit C-06).
    // Fog `near` pulls from 22 in to 14 across the last 60 s (audit D-09).
    // Both clamp to baseline when the debrief panel pauses the cycle.
    const remaining = this.cycle.remainingMs;
    const rainPhase = Math.max(0, Math.min(1, (30000 - remaining) / 30000));
    const fogPhase  = Math.max(0, Math.min(1, (60000 - remaining) / 60000));
    const rainIntensity = 1 + rainPhase;            // 1 → 2
    const fogNear       = 22 - 8 * fogPhase;        // 22 → 14
    return {
      cameraTarget: { x: 0, y: 0, z: 0 },
      buildings: this.buildings.map(buildingView),
      // ICD-08 §Visibility projection rule. Goons outside any Switchboard LoS
      // rect and outside any Bureau-family 1-tile reveal radius are omitted
      // from WorldFrame.units entirely — neither rendered nor HUD-listed. The
      // underlying Unit records stay authoritative in this.units; the filter
      // is a pure projection at snapshot time.
      units: this.units.filter((u) => this._isUnitVisible(u)).map(unitView),
      leads,
      // 1.0.1 (ICD-01 v0.6.5 §WorldFrame.stories): top-level per-story rows
      // for the Story queue dossier (see storyQueueView above for filter).
      stories: storyRows,
      // 0.10.0 (audit G-12 · ICD-01 v0.6 line 23): RivalStatusView[] as a
      // top-level WorldFrame field (not nested in `hud`). RivalStatusView
      // type is owned by ICD-02 — id/state/posture today; the dossier
      // Threats card reads this to render "Evening Star: scheming".
      rivals: this.rivals.map((r) => ({ id: r.id, state: r.state, posture: r.posture })),
      rain: { intensity: rainIntensity },
      fog: { near: fogNear, far: 60, color: 0xc8c4bc },
      hud: {
        edition: this.cycle.edition,
        deadline_ms: this.cycle.remainingMs,
        // ICD-01 v0.5 §HudState. leads/stories are derived from the live state
        // (same lead filter as frame.leads; stories = verified+plated count).
        // ink/cash/heat read from the running balances accumulated at print.
        // 1.0.1 (ICD-09 §HUD surface): archived sibling-count surfaces the
        // medium-band cap to the Story queue header.
        resources: {
          leads: leads.length,
          stories: storyCount,
          archived: archivedCount,
          ink: this.resources.ink,
          cash: this.resources.cash,
          heat: this.resources.heat,
        },
      },
      effects: this.effects.splice(0),
    };
  }
}

// 0.8 (ICD-04 v0.1) — convenience static so save.js can call
// World.fromSnap(blob) without threading the opts shape.
World.fromSnap = (blob) => new World({ snap: blob });

function bakeGrid() {
  const walkable = Array.from({ length: GRID_H }, () => Array(GRID_W).fill(true));
  return { width: GRID_W, height: GRID_H, walkable };
}

// 0.10.0 (G-01): two BuildingKinds count as "bureau-family" — the central
// Bureau (kind 'bureau') and the Branch Bureau (kind 'branch_bureau'). Both
// can receive a reporter's drop and yield a lead to a photog; only 'bureau'
// drives the §17 single fail-state (a Branch loss is recoverable in the
// sense that the run continues).
function isBureauFamily(b) {
  return b.kind === 'bureau' || b.kind === 'branch_bureau';
}

// 0.8 (ICD-04 v0.1) — snap → live projectors. Snake_case is the wire
// convention; the live World uses camelCase. ICD §Notes — Unit.selected
// resets on load (UI state, not sim state). Story.version is per-record
// schema metadata on the persisted snap only — the in-memory Story shape
// is byte-for-byte identical to v0.4 (ICD-05 v0.4.1 §Open-questions close).

function restoreBuilding(b) {
  return {
    id: b.id,
    kind: b.kind,
    tile: { x: b.tile.x, y: b.tile.y },
    hp: b.hp,
    hp_max: b.hp_max,
    tier: b.tier,
  };
}

function restoreUnit(u) {
  const live = {
    id: u.id,
    kind: u.kind,
    tile: { x: u.tile.x, y: u.tile.y },
    pos: { x: u.pos.x, y: u.pos.y, z: u.pos.z },
    facing: u.facing,
    state: u.state,
    selected: false,
    carrying: u.carrying,
    carryingStoryId: u.carrying_story_id,
    path: u.path.map((c) => ({ x: c.x, y: c.y })),
    pathIdx: u.path_idx,
  };
  if (u.hp !== undefined)     live.hp = u.hp;
  if (u.hp_max !== undefined) live.hp_max = u.hp_max;
  if (u.stats !== undefined)  live.stats = { ...u.stats };   // 1.0.1 (ICD-01 v0.6 · ICD-04 v0.1.3)
  return live;
}

function restoreStory(s) {
  // Strip the per-record `version` — the live Story shape has no such field
  // (ICD-05 v0.4.1 close: version lives on the persisted StorySnap only).
  const live = {
    id: s.id,
    state: s.state,
    district: resolveDistrictId(s.district),
    flavor: s.flavor,
    tier: s.tier,
    truthful: s.truthful,
    spawned_at_ms: s.spawned_at_ms,
    tile: { x: s.tile.x, y: s.tile.y },
    picked_up_by: s.picked_up_by,
    held_by_building: s.held_by_building,
  };
  if (s.headline !== undefined)        live.headline = s.headline;
  if (s.verified_by !== undefined)     live.verified_by = s.verified_by;
  if (s.plated_by !== undefined)       live.plated_by = s.plated_by;
  if (s.printed_in !== undefined)      live.printed_in = s.printed_in;
  if (s.cash_yield !== undefined)      live.cash_yield = s.cash_yield;
  if (s.heat_yield !== undefined)      live.heat_yield = s.heat_yield;
  if (s.ink_cost !== undefined)        live.ink_cost = s.ink_cost;
  if (s.archived_at_ms !== undefined)  live.archived_at_ms = s.archived_at_ms;   // 1.0.1 (ICD-09 §Save surface)
  if (s.parent_story_id !== undefined) live.parent_story_id = s.parent_story_id; // 1.1.0 (ICD-10 §Investigation chain)
  if (s.arc_episode_id !== undefined)  live.arc_episode_id = s.arc_episode_id;   // 1.1.0 (ICD-10 §Save surface)
  if (s.arc_branch_label !== undefined) live.arc_branch_label = s.arc_branch_label; // 1.1.0 (ICD-10 §Open-Q3 close)
  return live;
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
  // 1.0.1 (ICD-01 v0.6 §UnitView.stats projector): the field is `undefined`-
  // allowed by the contract — non-Reporter kinds carry no `stats` on the Unit
  // record, so `u.stats ?? undefined` projects clean. Object spread keeps
  // the field omitted entirely when undefined so frame.units[i].hasOwnProperty
  // ('stats') stays correct for the §13 mock's "no line for Photog/Editor/etc"
  // rendering rule.
  const view = {
    id: u.id,
    pos: { x: u.pos.x, y: u.pos.y, z: u.pos.z },
    facing: u.facing,
    kind: u.kind,
    state: u.state,
    selected: u.selected,
    carrying: u.carrying,
  };
  if (u.stats !== undefined) view.stats = { ...u.stats };
  return view;
}

function leadView(s, simTime) {
  return {
    id: s.id,
    pos: tileToWorld(s.tile),
    tier: s.tier,
    flavor: s.flavor,
    // 0.10.0 (audit G-11 · ICD-01 v0.6 line 131): district lifts from the
    // sim-layer Story.district so per-district HUD readouts have the data
    // they need. Legacy 'd-default' (pre-0.10 saves) resolves to the
    // central Docks via districts.js.
    district: resolveDistrictId(s.district),
    age_ms: simTime - s.spawned_at_ms,
  };
}

// 1.0.1 (ICD-01 v0.6.5 §WorldFrame.stories · ICD-09 §HUD surface). One row per
// Story sitting at the Darkroom in 'verified' or 'archived' state. The
// dossier reads `id` to route the left-click toggle gesture, `state` to
// render the HOLD chip, and `headline / flavor / district` for the row caption.
//
// 1.1.0 (ICD-10 v0.1.1 §HUD surface): arc + chain breadcrumb extension.
// Arc stories surface arc_episode_id and the available branch choices (until
// picked, then arc_branch_label appears). Investigation-tier stories with a
// parent_story_id surface their chain_depth (1/3 = root, 2/3 = middle, 3/3 =
// terminal step). HUD reads these to render the breadcrumb chip and route
// branch-pick clicks through World.pickArcBranch.
function storyQueueView(s, world) {
  const out = {
    id: s.id,
    state: s.state,
    headline: s.headline ?? `${s.flavor.toUpperCase()} ${s.tier.toUpperCase()} HITS WIRE`,
    flavor: s.flavor,
    tier: s.tier,
    district: resolveDistrictId(s.district),
  };
  if (s.tier === 'investigation' && s.parent_story_id) {
    out.chain_depth = world._chainDepth(s);
  }
  if (s.tier === 'arc' && s.arc_episode_id) {
    out.arc_episode_id = s.arc_episode_id;
    if (s.arc_branch_label) {
      out.arc_branch_label = s.arc_branch_label;
    } else {
      const arcId = s.arc_episode_id.split('.')[0];
      const episode = findArcEpisode(arcId, s.arc_episode_id);
      if (episode) {
        out.branch_choices = episode.branch_table.choices.map((c) => ({ label: c.label }));
      }
    }
  }
  return out;
}

// ICD-06 v0.2 StoryDigest projection. Headline grammar lives in
// js/sim/headlines.js (audit G-05). The digest carries the load-bearing
// id / flavor / tier / cash plus the synthesized headline string for the
// debrief panel + run-summary readout. A pre-synthesized `headline` field
// on the Story is preferred (lets headline generation be deterministic in
// the spawner) — if absent the digest falls back to the literal flavor/tier
// shape used pre-0.10. RNG is unused in this fallback path.
function storyDigest(s) {
  const headline = s.headline ?? `${s.flavor.toUpperCase()} ${s.tier.toUpperCase()} HITS WIRE`;
  return {
    id: s.id,
    headline,
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
