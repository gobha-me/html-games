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
// 1.0.0: schema bump to "1.1" — RivalsSnap widens from {evening_star} to
// {evening_star, herald, observer}. migrate_1_0_to_1_1 synthesizes default
// Herald + Observer state for pre-1.0.0 saves; the rest of the blob is
// untouched (single-field migration, soft-restart of adversarial counters).
// 1.0.1: schema bump to "1.2" — StorySnap.state widens to include
// 'archived' + optional archived_at_ms field; UnitSnap.stats widens
// (optional Reporter trio). migrate_1_1_to_1_2 is a pass-through — both
// additions are optional and read safely on pre-1.0.1 blobs.
// 1.1.0: schema bump to "1.3" — SaveBlobV1 gains active_arcs[],
// district_heat, district_dispositions; StorySnap gains optional
// parent_story_id / arc_episode_id / arc_branch_label; ObserverSnap gains
// optional recent_states (cap 5). migrate_1_2_to_1_3 stamps the version and
// fills the new collections with empty defaults — all fields are optional
// so pre-1.1.0 blobs resume cleanly via _loadFromSnap's ?? fallbacks.
// 1.2.0: schema bump to "1.4" — SaveBlobV1 gains optional partner_offer,
// active_partner_deal, observer_publish_suppressed (ICD-02 v0.3.3 Observer
// DESPERATE / SILENCED bodies). migrate_1_3_to_1_4 stamps the version and
// defaults all three to null/0; the _loadFromSnap path also reads via ??
// fallbacks so the migration is double-safe.
export const CURRENT_VERSION = '1.4';
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
    // 1.1.0 (ICD-04 v0.1.4 · ICD-10 v0.1.1): arc framework persistence.
    // ActiveArc snap carries {arc_id, current_episode, chosen_path,
    // spawn_edition}. district_heat is a simple {[id]: number}. Disposition
    // values follow ICD-10 §Spec-validation: 'loyal' | 'grudging' | 'bitter'
    // | 'open hostility'.
    active_arcs:           (world.activeArcs ?? []).map((a) => a.snap()),
    district_heat:         { ...(world.districtHeat ?? {}) },
    district_dispositions: { ...(world.districtDispositions ?? {}) },
    // 1.2.0 (ICD-04 v0.1.5 · ICD-02 v0.3.3): Observer DESPERATE/SILENCED body
    // persistence. All three fields are optional on the wire — pre-1.2.0 saves
    // resume cleanly via _loadFromSnap's ?? null defaults; migrate_1_3_to_1_4
    // stamps them so forward-compat readers don't see `undefined` where
    // null/0 is expected.
    partner_offer: world.partnerOffer
      ? {
          edition_emitted: world.partnerOffer.editionEmitted,
          district:        world.partnerOffer.district,
        }
      : null,
    active_partner_deal: world.activePartnerDeal
      ? {
          accepted_at_edition: world.activePartnerDeal.acceptedAtEdition,
          district:            world.activePartnerDeal.district,
          editions_remaining:  world.activePartnerDeal.editionsRemaining,
        }
      : null,
    observer_publish_suppressed: world.observerPublishSuppressed ?? 0,
  };
}

export function deserialize(blob) {
  return new World({ snap: blob });
}

// v0.1.4 migration chain. "1.0" → "1.1" → "1.2" → "1.3".
//   1.0 → 1.1 synthesizes Herald + Observer default snaps for pre-1.0.0
//             saves; rest of the blob is untouched.
//   1.1 → 1.2 is a pass-through (StorySnap.state widen + archived_at_ms +
//             UnitSnap.stats are all optional; default-undefined reads
//             cleanly through _loadFromSnap).
//   1.2 → 1.3 fills active_arcs / district_heat / district_dispositions /
//             observer.recent_states with empty defaults. StorySnap optional
//             parent_story_id / arc_episode_id / arc_branch_label fields
//             read as undefined on pre-1.1.0 blobs.
// Future bumps chain through the same surface.
export function runMigrations(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.version === '1.0') raw = migrate_1_0_to_1_1(raw);
  if (raw.version === '1.1') raw = migrate_1_1_to_1_2(raw);
  if (raw.version === '1.2') raw = migrate_1_2_to_1_3(raw);
  if (raw.version === '1.3') raw = migrate_1_3_to_1_4(raw);
  if (raw.version === CURRENT_VERSION) return raw;
  // Anything not matching the current version is a future blob — refuse.
  return null;
}

// 1.0.0: v1.0 saves carry rivals = {evening_star: ...} only. The 1.1 schema
// widens to {evening_star, herald, observer}. Synthesizes default Herald
// and Observer state — counters at zero, RNG seeded fresh. Adversarial
// behavior soft-resets on load (documented behavior; an explicit pre-1.0
// run cannot preserve Herald + Observer state that didn't exist).
function migrate_1_0_to_1_1(blob) {
  const rivals = blob.rivals && typeof blob.rivals === 'object' ? blob.rivals : {};
  return {
    ...blob,
    version: '1.1',
    rivals: {
      evening_star: rivals.evening_star,
      herald:       rivals.herald ?? defaultHeraldSnap(),
      observer:     rivals.observer ?? defaultObserverSnap(),
    },
  };
}

// 1.0.1: v1.1 saves predate the Archive state value and the Reporter trio.
// Both additions are optional fields, so the migration is a pure version
// stamp — the load path reads `archived_at_ms` and `stats` via ?? fallbacks.
function migrate_1_1_to_1_2(blob) {
  return { ...blob, version: '1.2' };
}

// 1.1.0: v1.2 saves predate active_arcs / district_heat / district_dispositions
// and observer.recent_states. All collections default empty; the StorySnap
// optional foreign-key fields (parent_story_id / arc_episode_id /
// arc_branch_label) read as undefined on pre-1.1.0 blobs through the
// restoreStory ?? fallbacks. Migration explicitly fills the new collection
// fields so forward-compat readers don't see undefined where {}/[] is expected.
function migrate_1_2_to_1_3(blob) {
  const rivals = (blob.rivals && typeof blob.rivals === 'object') ? blob.rivals : {};
  const observer = (rivals.observer && typeof rivals.observer === 'object') ? rivals.observer : null;
  return {
    ...blob,
    version: '1.3',
    active_arcs:           blob.active_arcs           ?? [],
    district_heat:         blob.district_heat         ?? {},
    district_dispositions: blob.district_dispositions ?? {},
    rivals: observer
      ? { ...rivals, observer: { ...observer, recent_states: observer.recent_states ?? [] } }
      : rivals,
  };
}

// 1.2.0 (ICD-04 v0.1.5): v1.3 saves predate the Observer DESPERATE/SILENCED
// body surfaces. All three new fields default null/0 so pre-1.2.0 blobs come
// online with no pending offer, no active deal, and no PUBLISH suppression
// — equivalent to the Observer never having entered DESPERATE on the prior
// run. Same migration shape as 1.2 → 1.3: version stamp + defaults.
function migrate_1_3_to_1_4(blob) {
  return {
    ...blob,
    version: '1.4',
    partner_offer:               blob.partner_offer               ?? null,
    active_partner_deal:         blob.active_partner_deal         ?? null,
    observer_publish_suppressed: blob.observer_publish_suppressed ?? 0,
  };
}

function defaultHeraldSnap() {
  return {
    id: 'herald',
    state: 'IDLE',
    consecutive_high_heat_editions: 0,
    editions_in_court: 0,
    editions_in_punish: 0,
    is_wired: false,
    past_intents: [],
    rng: { state: 1 },
  };
}

function defaultObserverSnap() {
  return {
    id: 'observer',
    state: 'INVESTIGATE',
    cash: 500,
    observing_lead_id: null,
    editions_in_state: 0,
    edition_tick: 0,
    past_intents: [],
    rng: { state: 1 },
  };
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
  if (u.stats !== undefined) snap.stats = { ...u.stats };   // 1.0.1 (ICD-04 v0.1.3 · ICD-01 v0.6)
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
  if (s.archived_at_ms !== undefined) snap.archived_at_ms = s.archived_at_ms;  // 1.0.1 (ICD-04 v0.1.3 · ICD-09)
  // 1.1.0 (ICD-04 v0.1.4 · ICD-10 v0.1.1): Investigation chain + arc-episode
  // foreign keys + arc branch-pick intent. All optional — present only on
  // chained / arc-tier stories. Round-trip via restoreStory's ?? fallbacks.
  if (s.parent_story_id !== undefined) snap.parent_story_id = s.parent_story_id;
  if (s.arc_episode_id !== undefined) snap.arc_episode_id = s.arc_episode_id;
  if (s.arc_branch_label !== undefined) snap.arc_branch_label = s.arc_branch_label;
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
  // v0.1.2 (1.0.0): full Tier-1 roster — Evening Star + Herald + Observer.
  // Kind-keyed dispatch keeps the schema typed by kind; new rival kinds
  // attach as sibling helpers + a new key here.
  const star     = rivals.find((r) => r.id === 'evening_star');
  const herald   = rivals.find((r) => r.id === 'herald');
  const observer = rivals.find((r) => r.id === 'observer');
  return {
    evening_star: star     ? eveningStarSnap(star)   : null,
    herald:       herald   ? heraldSnap(herald)      : null,
    observer:     observer ? observerSnap(observer)  : null,
  };
}

function eveningStarSnap(star) {
  return {
    id: star.id,
    bureau_id: star.bureauId,
    tick_interval_ms: star.tickInterval,
    state: star.state,
    editions_since_raid: star.editionsSinceRaid,
    past_intents: star.pastIntents.slice(),
    tick_accum_ms: star._tickAccumMs,
    rng: { state: star.rng.state },
  };
}

function heraldSnap(herald) {
  return {
    id: herald.id,
    state: herald.state,
    consecutive_high_heat_editions: herald.consecutiveHighHeatEditions,
    editions_in_court: herald.editionsInCourt,
    editions_in_punish: herald.editionsInPunish,
    is_wired: herald.isWired,
    past_intents: herald.pastIntents.slice(),
    rng: { state: herald.rng.state },
  };
}

function observerSnap(observer) {
  return {
    id: observer.id,
    state: observer.state,
    cash: observer.cash,
    observing_lead_id: observer.observingLeadId,
    editions_in_state: observer.editionsInState,
    edition_tick: observer._editionTick,
    past_intents: observer.pastIntents.slice(),
    rng: { state: observer.rng.state },
    // 1.1.0 (ICD-02 v0.3.2): per-edition state ring for the
    // observer_silent_n_editions trigger predicate. Cap 5 enforced in
    // observer.js; the snap carries whatever's there at write time.
    recent_states: (observer.recentStates ?? []).slice(),
  };
}
