import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, BUREAU_TILE, LEAD_SPAWN_TILE, getIdMint } from '../js/sim/world-state.js';
import {
  saveNow,
  loadSave,
  serialize,
  deserialize,
  SAVE_KEY,
  CURRENT_VERSION,
  STORY_VERSION,
} from '../js/sim/save.js';
import { ActiveArc } from '../js/sim/arcs.js';

// Milestone 0.8 — save / load (ICD-04 v0.1).
// Single versioned localStorage blob captures full sim state. Tests cover
// round-trip identity, mid-edition resume, duplicate-event suppression,
// EveningStar determinism, Story.version on the snap only, future-version
// graceful refusal, id_mint round-trip, debriefOpen + gameOver round-trip,
// missing-storage tolerance, and the size-guard stretch case.

function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _map: m,
  };
}

function reporter(w) { return w.units.find((u) => u.kind === 'reporter'); }
function photog(w)   { return w.units.find((u) => u.kind === 'photog'); }

function tickUntilIdle(w, unit, maxSeconds = 30) {
  const dt = 0.05;
  for (let i = 0; i < maxSeconds / dt; i++) {
    w.tick(dt);
    if (unit.state === 'idle') return;
  }
  throw new Error(`${unit.kind} did not reach idle within budget`);
}

function advanceSeconds(w, seconds) {
  const dt = 1 / 30;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) w.tick(dt);
}

// Drives the existing 0.3+0.4 ferry so a verified story sits at the darkroom,
// ready to be plated+printed at the next deadline. Copied from print-cycle.test.mjs.
function stageVerifiedAtDarkroom(w) {
  const r = reporter(w);
  w.dispatch(r.id, { ...LEAD_SPAWN_TILE });
  tickUntilIdle(w, r);
  w.dispatch(r.id, { x: BUREAU_TILE.x, y: BUREAU_TILE.y - 1 });
  tickUntilIdle(w, r);

  const p = photog(w);
  w.dispatch(p.id, { x: 4, y: 5 });
  tickUntilIdle(w, p);
  w.dispatch(p.id, { x: 6, y: 7 });
  tickUntilIdle(w, p);
}

// ---- 1. round-trip identity --------------------------------------------------

test('serialize → deserialize round-trips a fresh World to a shape-identical snapshot', () => {
  const w1 = new World();
  const f1 = w1.snapshot();

  const blob = serialize(w1);
  const w2 = deserialize(blob);
  const f2 = w2.snapshot();

  assert.deepEqual(f2.buildings, f1.buildings);
  assert.deepEqual(f2.units, f1.units);
  assert.deepEqual(f2.leads, f1.leads);
  assert.deepEqual(f2.hud, f1.hud);
});

// ---- 2. mid-edition resume ---------------------------------------------------

test('mid-edition resume: reporter mid-walk → save → load → advance → arrives at original destination', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  const storage = memStorage();
  const r = reporter(w);
  w.dispatch(r.id, { ...LEAD_SPAWN_TILE });

  // Two seconds of motion — well short of arrival (~9s for that walk).
  advanceSeconds(w, 2);
  assert.notEqual(r.state, 'idle', 'reporter should still be walking pre-save');
  assert.ok(r.path.length > 0, 'reporter should have remaining path');
  const savedSimMs = w.sim_time_ms;
  const savedTile = { x: r.tile.x, y: r.tile.y };
  const savedPos = { x: r.pos.x, z: r.pos.z };

  saveNow(w, storage);
  const w2 = loadSave(storage);
  assert.ok(w2, 'loadSave returns a World');
  const r2 = reporter(w2);
  assert.equal(r2.state, 'walking', 'restored reporter resumes in walking state');
  assert.equal(r2.tile.x, savedTile.x);
  assert.equal(r2.tile.y, savedTile.y);
  assert.ok(Math.abs(r2.pos.x - savedPos.x) < 1e-9);
  assert.ok(Math.abs(r2.pos.z - savedPos.z) < 1e-9);
  assert.equal(w2.sim_time_ms, savedSimMs);

  // Finish the walk on the loaded World.
  tickUntilIdle(w2, r2);
  assert.equal(r2.tile.x, LEAD_SPAWN_TILE.x);
  assert.equal(r2.tile.y, LEAD_SPAWN_TILE.y);
  assert.equal(r2.carrying, 'lead', 'reporter picks up the lead on arrival');
});

// ---- 3. duplicate-event suppression -----------------------------------------

test('duplicate-event suppression: load with warning_fired=true, fire_fired=false → only DEADLINE_FIRE emits', () => {
  // Build a World whose CycleClock has crossed the warning threshold but
  // not yet fired the deadline. Save, then load — the restored clock
  // remembers the warning has already been emitted.
  const w = new World({ cycle: { editionDurationMs: 5_000, warningOffsetMs: 2_000 } });
  advanceSeconds(w, 4); // crosses T-1s — warning fired, fire not yet.
  assert.equal(w.cycle._warningFired, true);
  assert.equal(w.cycle._fireFired, false);

  const storage = memStorage();
  saveNow(w, storage);
  const w2 = loadSave(storage);

  const events = [];
  w2.subscribeCycle((ev) => events.push(ev));
  advanceSeconds(w2, 2); // crosses T-0 on the loaded clock.

  const warnings = events.filter((ev) => ev.kind === 'DEADLINE_WARNING');
  const fires = events.filter((ev) => ev.kind === 'DEADLINE_FIRE');
  assert.equal(warnings.length, 0, 'warning must not re-emit after load');
  assert.equal(fires.length, 1, 'fire emits exactly once on the loaded clock');
});

// ---- 4. EveningStar determinism ---------------------------------------------

test('EveningStar determinism: rng.state round-trips, next() produces the same value pre- and post-load', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  // Drive some sim ticks so the rival's view-build consumes rng.next() calls.
  advanceSeconds(w, 25);
  const star = w.rivals[0];
  const preSaveState = star.rng.state;
  const preSaveAccum = star._tickAccumMs;

  const storage = memStorage();
  saveNow(w, storage);
  const w2 = loadSave(storage);
  const star2 = w2.rivals[0];

  assert.equal(star2.rng.state, preSaveState, 'rng.state survives the round-trip');
  assert.equal(star2._tickAccumMs, preSaveAccum, '_tickAccumMs survives the round-trip');
  assert.equal(star2.state, star.state);
  assert.equal(star2.editionsSinceRaid, star.editionsSinceRaid);
  assert.deepEqual(star2.pastIntents, star.pastIntents);

  // Determinism check: same next() call on both produces the same value.
  // (Clone the pre-save rng so we don't mutate w's star.)
  const preClone = { state: preSaveState };
  // Manually run Mulberry32 step on the clone for comparison.
  function step(rngLike) {
    let t = (rngLike.state = (rngLike.state + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  assert.equal(star2.rng.next(), step(preClone));
});

// ---- 5. Story.version -------------------------------------------------------

test('Story.version: every StorySnap carries version=1; loaded Story has no .version field', () => {
  const w = new World();
  const blob = serialize(w);
  assert.ok(blob.stories.length > 0, 'fresh World has at least the seeded lead');
  for (const s of blob.stories) {
    assert.equal(s.version, STORY_VERSION, 'every StorySnap carries the per-record version');
    assert.equal(s.version, 1);
  }

  const w2 = deserialize(blob);
  for (const s of w2.stories) {
    assert.equal(s.version, undefined, 'live in-memory Story has no .version (ICD-05 v0.4.1)');
  }
});

// ---- 6. unknown future version ---------------------------------------------

test('unknown future version: loadSave on a blob with version="2.0" returns null', () => {
  const storage = memStorage();
  storage.setItem(SAVE_KEY, JSON.stringify({ version: '2.0', sim_time_ms: 0 }));
  // Swallow the expected console.error so test output stays clean.
  const originalError = console.error;
  let errored = false;
  console.error = (...args) => { errored = true; };
  try {
    const w = loadSave(storage);
    assert.equal(w, null);
    assert.ok(errored, 'unknown future version surfaces a console.error');
  } finally {
    console.error = originalError;
  }
});

// ---- 7. id_mint round-trip -------------------------------------------------

test('id_mint round-trip: getIdMint() restores from blob.id_mint.next; no collision with loaded entities', () => {
  const w = new World();
  const preSaveMint = getIdMint();
  // Confirm no entity in the world has an id >= preSaveMint (mkId mints
  // strictly increasing integer suffixes).
  function maxIdSuffix(world) {
    let max = 0;
    const scan = (id) => {
      const m = /-(\d+)$/.exec(id);
      if (m) max = Math.max(max, Number(m[1]));
    };
    world.buildings.forEach((b) => scan(b.id));
    world.units.forEach((u) => scan(u.id));
    world.stories.forEach((s) => scan(s.id));
    return max;
  }
  const preSaveMax = maxIdSuffix(w);
  assert.ok(preSaveMint > preSaveMax, 'pre-save mint counter is past the highest used id');

  const storage = memStorage();
  saveNow(w, storage);
  const w2 = loadSave(storage);

  assert.equal(getIdMint(), preSaveMint, 'id-mint counter restores from blob.id_mint.next');
  assert.ok(getIdMint() > maxIdSuffix(w2), 'restored mint counter is past every loaded entity id');
});

// ---- 8. save during debriefOpen --------------------------------------------

test('save during debriefOpen: terminal pause round-trips, tick() short-circuits on the loaded world', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  stageVerifiedAtDarkroom(w);
  const remaining = w.snapshot().hud.deadline_ms;
  advanceSeconds(w, remaining / 1000 + 0.5);
  assert.equal(w.debriefOpen, true, 'debrief panel is open after deadline');

  const storage = memStorage();
  saveNow(w, storage);
  const w2 = loadSave(storage);
  assert.equal(w2.debriefOpen, true, 'debriefOpen survives the round-trip');

  // tick() short-circuits while debrief is open.
  const simBefore = w2.sim_time_ms;
  const cycleBefore = w2.cycle.remainingMs;
  advanceSeconds(w2, 1);
  assert.equal(w2.sim_time_ms, simBefore, 'sim_time_ms must not advance during debrief');
  assert.equal(w2.cycle.remainingMs, cycleBefore, 'cycle clock must not advance during debrief');
});

// ---- 9. save after gameOver ------------------------------------------------

test('save after gameOver: terminal blob round-trips, tick() inert, CYCLE_GAME_OVER not re-emitted', () => {
  const w = new World({ cycle: { editionDurationMs: 60_000, warningOffsetMs: 2_000 } });
  // Manually drain the press to trigger CYCLE_GAME_OVER on the next tick.
  const bureau = w.buildings.find((b) => b.kind === 'bureau');
  bureau.hp = 0;
  const events = [];
  w.subscribeCycle((ev) => events.push(ev));
  w.tick(1 / 30);
  assert.equal(w.gameOver, true);
  assert.ok(events.some((e) => e.kind === 'CYCLE_GAME_OVER'), 'CYCLE_GAME_OVER fired pre-save');

  const storage = memStorage();
  saveNow(w, storage);
  const w2 = loadSave(storage);
  assert.equal(w2.gameOver, true, 'gameOver round-trips');

  const events2 = [];
  w2.subscribeCycle((ev) => events2.push(ev));
  const simBefore = w2.sim_time_ms;
  advanceSeconds(w2, 1);
  assert.equal(w2.sim_time_ms, simBefore, 'tick() inert while gameOver');
  assert.equal(events2.filter((e) => e.kind === 'CYCLE_GAME_OVER').length, 0, 'must not re-emit');
});

// ---- 10. localStorage missing ---------------------------------------------

test('localStorage missing: loadSave returns null without throwing when storage is undefined', () => {
  // Simulates Node without a globalThis.localStorage; no setup needed.
  const result = loadSave(undefined);
  assert.equal(result, null);
  // saveNow on undefined storage is also a no-op.
  const w = new World();
  assert.doesNotThrow(() => saveNow(w, undefined));
});

// ---- 11. size guard (stretch) ---------------------------------------------

test('size guard: console.warn fires when serialized blob exceeds 500_000 bytes', () => {
  const w = new World();
  // Inflate pastIntents on the rival with a big text payload. The pastIntents
  // buffer is normally capped at 20, but we're bypassing the API to test the
  // guard — direct write is fine here.
  const big = 'x'.repeat(2_000);
  w.rivals[0].pastIntents = Array.from({ length: 400 }, (_, i) => ({
    kind: 'PASS', filler: big + i,
  }));

  const storage = memStorage();
  const originalWarn = console.warn;
  let warned = false;
  console.warn = (...args) => { warned = true; };
  try {
    saveNow(w, storage);
    assert.ok(warned, 'size guard surfaces a console.warn for oversized blobs');
  } finally {
    console.warn = originalWarn;
  }
});

// ---- 12. version field ----------------------------------------------------

test('serialized blob carries version="1.4" at the top level', () => {
  // 1.0.0 bumped schema to "1.1" — rivals widens to {evening_star, herald, observer}.
  // 1.0.1 bumped schema to "1.2" — StorySnap.state widens with 'archived' +
  // optional archived_at_ms field; UnitSnap gains optional stats (Reporter trio).
  // 1.1.0 bumped schema to "1.3" — SaveBlobV1 gains active_arcs[],
  // district_heat, district_dispositions; StorySnap gains optional
  // parent_story_id / arc_episode_id / arc_branch_label; ObserverSnap gains
  // recent_states.
  // 1.2.0 bumped schema to "1.4" — SaveBlobV1 gains optional partner_offer,
  // active_partner_deal, observer_publish_suppressed (ICD-02 v0.3.3 Observer
  // DESPERATE/SILENCED body surfaces).
  const w = new World();
  const blob = serialize(w);
  assert.equal(blob.version, CURRENT_VERSION);
  assert.equal(blob.version, '1.4');
});

// ---- 13. 1.0.0 three-rival round-trip ------------------------------------

test('serialize → deserialize round-trips Herald and Observer state (1.0.0)', () => {
  const w1 = new World();
  // Push the rivals into non-default states so the round-trip is observable.
  const h1 = w1.rivals.find((r) => r.id === 'herald');
  const o1 = w1.rivals.find((r) => r.id === 'observer');
  h1.state = 'COURT';
  h1.consecutiveHighHeatEditions = 2;
  h1.editionsInCourt = 1;
  h1.isWired = false;
  o1.state = 'PUBLISH';
  o1.cash = 350;
  o1.observingLeadId = 'L-test';
  o1.editionsInState = 0;
  o1._editionTick = 5;

  const blob = serialize(w1);
  const w2 = deserialize(blob);
  const h2 = w2.rivals.find((r) => r.id === 'herald');
  const o2 = w2.rivals.find((r) => r.id === 'observer');

  assert.equal(h2.state, 'COURT');
  assert.equal(h2.consecutiveHighHeatEditions, 2);
  assert.equal(h2.editionsInCourt, 1);
  assert.equal(o2.state, 'PUBLISH');
  assert.equal(o2.cash, 350);
  assert.equal(o2.observingLeadId, 'L-test');
  assert.equal(o2._editionTick, 5);
});

test('three-rival iteration order survives round-trip', () => {
  const w1 = new World();
  const blob = serialize(w1);
  const w2 = deserialize(blob);
  assert.deepEqual(w2.rivals.map((r) => r.id), ['evening_star', 'herald', 'observer']);
});

// ---- 14. 1.0 → 1.1 migration synthesis -----------------------------------

test('loadSave migrates a v1.0 blob (single-rival rivals) into 1.1 with default Herald + Observer', () => {
  const w1 = new World();
  const blob = serialize(w1);
  // Synthesize a v1.0 blob by stripping Herald + Observer from the rivals
  // block and downgrading the version field.
  const legacy = { ...blob, version: '1.0', rivals: { evening_star: blob.rivals.evening_star } };
  const storage = memStorage();
  storage.setItem(SAVE_KEY, JSON.stringify(legacy));

  const w2 = loadSave(storage);
  assert.ok(w2, 'expected loadSave to return a World on v1.0 → v1.1 migration');
  const ids = w2.rivals.map((r) => r.id);
  assert.deepEqual(ids, ['evening_star', 'herald', 'observer']);
  const h = w2.rivals.find((r) => r.id === 'herald');
  const o = w2.rivals.find((r) => r.id === 'observer');
  assert.equal(h.state, 'IDLE');
  assert.equal(h.isWired, false);
  assert.equal(o.state, 'INVESTIGATE');
  assert.equal(o.cash, 500);
});

// ---- 15. 1.1.0 — arc framework + chain + per-district trackers ----------

test('arcs: active_arcs[] round-trips with current_episode and chosen_path', () => {
  const w1 = new World();
  w1.activeArcs.push(new ActiveArc({
    arcId: 'longshoreman_strike',
    currentEpisode: 'longshoreman_strike.foremans_wife',
    chosenPath: ['splash'],
    spawnEdition: 2,
  }));
  const w2 = deserialize(serialize(w1));
  assert.equal(w2.activeArcs.length, 1);
  assert.equal(w2.activeArcs[0].arcId, 'longshoreman_strike');
  assert.equal(w2.activeArcs[0].currentEpisode, 'longshoreman_strike.foremans_wife');
  assert.deepEqual(w2.activeArcs[0].chosenPath, ['splash']);
  assert.equal(w2.activeArcs[0].spawnEdition, 2);
});

test('arcs: districtHeat + districtDispositions round-trip', () => {
  const w1 = new World();
  w1.districtHeat.docks = 42;
  w1.districtHeat.hillside = 7;
  w1.districtDispositions.docks = 'loyal';
  const w2 = deserialize(serialize(w1));
  assert.equal(w2.districtHeat.docks, 42);
  assert.equal(w2.districtHeat.hillside, 7);
  assert.equal(w2.districtDispositions.docks, 'loyal');
});

test('arcs: Story.parent_story_id + arc_episode_id + arc_branch_label round-trip', () => {
  const w1 = new World();
  w1.stories.push({
    id: 's-chain-test',
    state: 'lead',
    district: 'docks',
    flavor: 'labor',
    tier: 'investigation',
    truthful: true,
    spawned_at_ms: 0,
    tile: { x: 2, y: 2 },
    picked_up_by: null,
    held_by_building: null,
    parent_story_id: 's-parent-x',
  });
  w1.stories.push({
    id: 's-arc-test',
    state: 'verified',
    district: 'docks',
    flavor: 'labor',
    tier: 'arc',
    truthful: true,
    spawned_at_ms: 0,
    tile: { x: 3, y: 3 },
    picked_up_by: null,
    held_by_building: w1.buildings.find((b) => b.kind === 'darkroom').id,
    headline: 'THE WALKOUT — Longshoremen halt the harbor',
    arc_episode_id: 'longshoreman_strike.walkout',
    arc_branch_label: 'splash',
  });
  const w2 = deserialize(serialize(w1));
  const chain = w2.stories.find((s) => s.id === 's-chain-test');
  assert.equal(chain.parent_story_id, 's-parent-x');
  const arc = w2.stories.find((s) => s.id === 's-arc-test');
  assert.equal(arc.arc_episode_id, 'longshoreman_strike.walkout');
  assert.equal(arc.arc_branch_label, 'splash');
});

test('arcs: observer.recentStates ring round-trips', () => {
  const w1 = new World();
  const observer = w1.rivals.find((r) => r.id === 'observer');
  observer.recentStates = ['INVESTIGATE', 'PUBLISH', 'INVESTIGATE'];
  const w2 = deserialize(serialize(w1));
  const observer2 = w2.rivals.find((r) => r.id === 'observer');
  assert.deepEqual(observer2.recentStates, ['INVESTIGATE', 'PUBLISH', 'INVESTIGATE']);
});

test('arcs: migrate_1_2_to_1_3 defaults active_arcs / district_heat / district_dispositions / observer.recent_states', () => {
  const w1 = new World();
  const blob = serialize(w1);
  // Synthesize a v1.2 blob (strip the new collections + downgrade version).
  const legacy = { ...blob, version: '1.2' };
  delete legacy.active_arcs;
  delete legacy.district_heat;
  delete legacy.district_dispositions;
  if (legacy.rivals?.observer) delete legacy.rivals.observer.recent_states;

  const storage = memStorage();
  storage.setItem(SAVE_KEY, JSON.stringify(legacy));
  const w2 = loadSave(storage);
  assert.ok(w2, 'v1.2 → v1.3 migration produced a World');
  assert.deepEqual(w2.activeArcs, []);
  assert.equal(w2.districtHeat.docks, 0);
  assert.deepEqual(w2.districtDispositions, {});
  const observer2 = w2.rivals.find((r) => r.id === 'observer');
  assert.deepEqual(observer2.recentStates, []);
});

test('partner-deal: migrate_1_3_to_1_4 defaults partner_offer / active_partner_deal / observer_publish_suppressed', () => {
  // 1.2.0 (ICD-04 v0.1.5): v1.3 blobs predate the Observer DESPERATE/SILENCED
  // body surfaces. The migration stamps null/0 defaults so a pre-1.2.0 save
  // resumes with no pending offer, no active deal, and PUBLISH unsuppressed.
  const w1 = new World();
  const blob = serialize(w1);
  const legacy = { ...blob, version: '1.3' };
  delete legacy.partner_offer;
  delete legacy.active_partner_deal;
  delete legacy.observer_publish_suppressed;

  const storage = memStorage();
  storage.setItem(SAVE_KEY, JSON.stringify(legacy));
  const w2 = loadSave(storage);
  assert.ok(w2, 'v1.3 → v1.4 migration produced a World');
  assert.equal(w2.partnerOffer, null);
  assert.equal(w2.activePartnerDeal, null);
  assert.equal(w2.observerPublishSuppressed, 0);
});

test('partner-deal: serialize → deserialize round-trips an active deal', () => {
  const w1 = new World();
  w1.partnerOffer = { editionEmitted: 7, district: 'hillside' };
  w1.activePartnerDeal = { acceptedAtEdition: 8, district: 'docks', editionsRemaining: 3 };
  w1.observerPublishSuppressed = 3;
  const w2 = deserialize(serialize(w1));
  assert.deepEqual(w2.partnerOffer, { editionEmitted: 7, district: 'hillside' });
  assert.deepEqual(w2.activePartnerDeal, {
    acceptedAtEdition: 8,
    district: 'docks',
    editionsRemaining: 3,
  });
  assert.equal(w2.observerPublishSuppressed, 3);
});
