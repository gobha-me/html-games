// Late Edition — save / load (ICD-04 v0.1).
// Single versioned localStorage blob captures full sim state. Serializer
// lifts ICD-04 v0.1 verbatim; deserializer rebuilds a World via the snap
// path. Mid-edition resume works because continuous pos + remaining path +
// CycleClock.remainingMs + _warningFired / _fireFired guards survive a
// round-trip. Per-rival RNG state captured so post-load decisions match
// the pre-save run (replay determinism).
//
// 0.8 trigger cadence (ICD-04 §Save-trigger-surface settles here at the 0.8
// code session — the ICD authorizes a different concrete cadence than its
// recommendation without an ICD bump):
//   - on CYCLE_BEGIN       — fires immediately after EDITION_DEBRIEF_END
//                            inside ackDebrief, capturing the just-started
//                            edition with a fresh clock. The ICD's
//                            EDITION_DEBRIEF_END recommendation can't be
//                            used as-is because cycle.start() runs AFTER
//                            that emit, so the saved cycle would be stuck
//                            at fire_fired=true / remainingMs=0.
//   - on CYCLE_GAME_OVER   — terminal integrity.
// No autosave-every-N, no pre-DEADLINE_FIRE checkpoint at 0.8 — ICD-04
// §Open-questions explicitly defers those.

import { World, getIdMint } from './world-state.js';

export const SAVE_KEY = 'late-edition.save.v1';
export const SCORES_KEY = 'late-edition.scores.v1';   // 0.10.0 (G-13)
export const CURRENT_VERSION = '1.0';
export const SCORES_VERSION = 1;                       // 0.10.0 (G-13)
export const STORY_VERSION = 1;
export const MAX_HIGH_SCORES = 10;                     // 0.10.0 (G-13)
// ICD §Open-questions: compression deferred until size shows up. The guard
// surfaces the trigger as a console.warn when a playtest blob crosses the
// rough localStorage practical ceiling on older browsers (~1 MB).
const SIZE_GUARD_BYTES = 500_000;

// World → SaveBlobV1 projector (ICD-04 §Core shape). Snake_case is the wire
// convention; the live World uses camelCase. The projector handles both
// directions symmetrically.
//
// 0.10.0 (C-04): the rng_seed slot (reserved at ICD-04 v0.1 for the
// "lead spawn jitter at milestone 0.9+ first plausible caller") now carries
// the spawner stream's live PRNG state, plus a sibling `lead_spawner` block
// for the per-district accumulator. ICD-04 §Notes calls this out in v0.1.1
// alongside the same PR per Constraint #4.
export function serialize(world) {
  return {
    version: CURRENT_VERSION,
    saved_at_ms: Date.now(),
    sim_time_ms: world.sim_time_ms,
    rng_seed: world.spawnerRng?.state ?? 0,
    world_rng: { state: world.spawnerRng?.state ?? 0 },
    lead_spawner: world.leadSpawner?.snap() ?? null,
    id_mint: { next: getIdMint() },
    cycle: cycleSnap(world.cycle),
    resources: { cash: world.resources.cash, ink: world.resources.ink, heat: world.resources.heat },
    grid: gridSnap(world.grid),
    buildings: world.buildings.map(buildingSnap),
    units: world.units.map(unitSnap),
    stories: world.stories.map(storySnap),
    rivals: rivalsSnap(world.rivals),
    edition_history: world.editionHistory.slice(),
    pending_rival_events: world._pendingRivalEvents.slice(),
    game_over: world.gameOver,
    debrief_open: world.debriefOpen,
    run_stats: {                         // 0.10.0 (G-13)
      total_revenue:     world.runStats?.total_revenue     ?? 0,
      editions_survived: world.runStats?.editions_survived ?? 0,
      top_story:         world.runStats?.top_story ?? null,
    },
  };
}

export function deserialize(blob) {
  return new World({ snap: blob });
}

// v0.1 migration chain is empty — "1.0" is the floor. The first schema bump
// after 0.8 lands a migrate_1_0_to_1_1 here in the same PR (Constraint #4).
// Unknown future version → null surfaces the ICD §Notes graceful-refusal.
export function runMigrations(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.version === CURRENT_VERSION) return raw;
  // No prior versions exist at v0.1 — anything not "1.0" is a future blob.
  return null;
}

export function saveNow(world, storage = globalThis.localStorage) {
  if (!storage) return;
  const blob = serialize(world);
  const json = JSON.stringify(blob);
  if (json.length > SIZE_GUARD_BYTES) {
    console.warn(`[late-edition] save blob ${json.length} bytes exceeds ${SIZE_GUARD_BYTES} guard — consider compression (ICD-04 §Open-questions)`);
  }
  storage.setItem(SAVE_KEY, json);
}

export function loadSave(storage = globalThis.localStorage) {
  if (!storage) return null;
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const blob = runMigrations(parsed);
  if (!blob) {
    if (parsed && parsed.version) {
      console.error(`[late-edition] save blob version "${parsed.version}" is newer than this build understands — refusing to load`);
    }
    return null;
  }
  return deserialize(blob);
}

function cycleSnap(c) {
  return {
    edition: c.edition,
    remaining_ms: c.remainingMs,
    edition_duration_ms: c.editionDurationMs,
    warning_offset_ms: c.warningOffsetMs,
    warning_fired: c._warningFired,
    fire_fired: c._fireFired,
  };
}

function gridSnap(g) {
  return {
    width: g.width,
    height: g.height,
    walkable: g.walkable.map((row) => row.slice()),
  };
}

function buildingSnap(b) {
  return {
    id: b.id,
    kind: b.kind,
    tile: { x: b.tile.x, y: b.tile.y },
    hp: b.hp,
    hp_max: b.hp_max,
    tier: b.tier,
  };
}

function unitSnap(u) {
  const snap = {
    id: u.id,
    kind: u.kind,
    tile: { x: u.tile.x, y: u.tile.y },
    pos: { x: u.pos.x, y: u.pos.y, z: u.pos.z },
    facing: u.facing,
    state: u.state,
    carrying: u.carrying,
    carrying_story_id: u.carryingStoryId,
    path: u.path.map((c) => ({ x: c.x, y: c.y })),
    path_idx: u.pathIdx,
  };
  if (u.hp !== undefined) snap.hp = u.hp;
  if (u.hp_max !== undefined) snap.hp_max = u.hp_max;
  return snap;
}

function storySnap(s) {
  // ICD-05 v0.4.1 close: the per-record version field lives on the
  // persisted StorySnap, not the in-memory Story (the in-memory shape
  // stays byte-for-byte identical to v0.4).
  const snap = {
    id: s.id,
    version: STORY_VERSION,
    state: s.state,
    district: s.district,
    flavor: s.flavor,
    tier: s.tier,
    truthful: s.truthful,
    spawned_at_ms: s.spawned_at_ms,
    tile: { x: s.tile.x, y: s.tile.y },
    picked_up_by: s.picked_up_by,
    held_by_building: s.held_by_building,
  };
  if (s.headline !== undefined) snap.headline = s.headline;       // 0.10.0 (G-05)
  if (s.verified_by !== undefined) snap.verified_by = s.verified_by;
  if (s.plated_by !== undefined) snap.plated_by = s.plated_by;
  if (s.printed_in !== undefined) snap.printed_in = s.printed_in;
  if (s.cash_yield !== undefined) snap.cash_yield = s.cash_yield;
  if (s.heat_yield !== undefined) snap.heat_yield = s.heat_yield;
  if (s.ink_cost !== undefined) snap.ink_cost = s.ink_cost;
  return snap;
}

// 0.10.0 (G-13) — high-score persistence (ICD-04 §Storage adds key).
// Separate blob from the save blob: save = a single in-progress run,
// scores = the run history. Same versioning shape so a future migration
// pass can mirror the run-save migration chain.

export function loadScores(storage = globalThis.localStorage) {
  if (!storage) return emptyScoresBlob();
  const raw = storage.getItem(SCORES_KEY);
  if (!raw) return emptyScoresBlob();
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return emptyScoresBlob(); }
  if (!parsed || typeof parsed !== 'object') return emptyScoresBlob();
  if (parsed.version !== SCORES_VERSION) return emptyScoresBlob();
  const scores = Array.isArray(parsed.scores) ? parsed.scores.slice() : [];
  return { version: SCORES_VERSION, scores: sortAndCap(scores) };
}

export function saveScore(entry, storage = globalThis.localStorage) {
  if (!storage) return { rank: null, blob: null };
  const blob = loadScores(storage);
  blob.scores = sortAndCap([...blob.scores, entry]);
  storage.setItem(SCORES_KEY, JSON.stringify(blob));
  const rank = blob.scores.findIndex((e) =>
    e.editions_survived === entry.editions_survived &&
    e.total_revenue === entry.total_revenue &&
    e.ended_at_ms === entry.ended_at_ms,
  );
  return { rank: rank >= 0 ? rank + 1 : null, blob };
}

function emptyScoresBlob() {
  return { version: SCORES_VERSION, scores: [] };
}

function sortAndCap(scores) {
  return scores
    .slice()
    .sort((a, b) => {
      if (b.editions_survived !== a.editions_survived) {
        return b.editions_survived - a.editions_survived;
      }
      return b.total_revenue - a.total_revenue;
    })
    .slice(0, MAX_HIGH_SCORES);
}

function rivalsSnap(rivals) {
  // v0.1 roster: Evening Star only. Herald + Observer arrive at Tier-1.
  const star = rivals.find((r) => r.id === 'evening_star');
  return {
    evening_star: {
      id: star.id,
      bureau_id: star.bureauId,
      tick_interval_ms: star.tickInterval,
      state: star.state,
      editions_since_raid: star.editionsSinceRaid,
      past_intents: star.pastIntents.slice(),
      tick_accum_ms: star._tickAccumMs,
      rng: { state: star.rng.state },
    },
  };
}
