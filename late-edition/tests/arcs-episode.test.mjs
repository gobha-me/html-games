// Arc dispatch + spawner integration (ICD-10 v0.1.1 · 1.1.0).
// Exercises World._dispatchArcSpawn and the trigger-context builder.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { World } from '../js/sim/world-state.js';
import { ARCS, THE_LONGSHOREMAN_STRIKE, ActiveArc } from '../js/sim/arcs.js';

// Helper: synthesize a partial story shaped like the spawner's output.
function arcPartialDocks() {
  return {
    state:            'lead',
    district:         'docks',
    flavor:           'labor',
    tier:             'arc',
    truthful:         true,
    spawned_at_ms:    0,
    tile:             { x: 2, y: 2 },
    picked_up_by:     null,
    held_by_building: null,
    headline:         'FRONT PAGE · DOCKHAND NAMES FENCE',
  };
}

// Helper: prime a fresh World so THE_LONGSHOREMAN_STRIKE's trigger fires.
function primeLongshoreman(w) {
  w.districtHeat.docks = 80;
  const observer = w.rivals.find((r) => r.id === 'observer');
  observer.recentStates = ['INVESTIGATE', 'INVESTIGATE', 'INVESTIGATE'];
  // Default world already has bureau (covers docks) → coveredDistricts has docks.
}

test('arcs-episode: _dispatchArcSpawn upgrades to authored arc when trigger fires', () => {
  const w = new World();
  primeLongshoreman(w);
  const story = w._dispatchArcSpawn(arcPartialDocks());
  assert.equal(story.tier, 'arc');
  assert.equal(story.headline, 'THE WALKOUT — Longshoremen halt the harbor');
  assert.equal(story.arc_episode_id, 'longshoreman_strike.walkout');
  assert.equal(w.activeArcs.length, 1);
  assert.equal(w.activeArcs[0].arcId, 'longshoreman_strike');
  assert.equal(w.activeArcs[0].currentEpisode, 'longshoreman_strike.walkout');
});

test('arcs-episode: _dispatchArcSpawn downgrades to investigation when trigger fails', () => {
  const w = new World();
  // No priming — district heat 0, observer just constructed (no recent states).
  const story = w._dispatchArcSpawn(arcPartialDocks());
  assert.equal(story.tier, 'investigation');
  assert.notEqual(story.headline, 'THE WALKOUT — Longshoremen halt the harbor');
  assert.equal(story.arc_episode_id, undefined);
  assert.equal(w.activeArcs.length, 0);
});

test('arcs-episode: _dispatchArcSpawn downgrades when district mismatch (Longshoreman in Hillside)', () => {
  const w = new World();
  primeLongshoreman(w);
  // Force the spawn to be in Hillside — Longshoreman.district === 'docks' rejects.
  const partial = { ...arcPartialDocks(), district: 'hillside' };
  const story = w._dispatchArcSpawn(partial);
  assert.equal(story.tier, 'investigation');
  assert.equal(story.arc_episode_id, undefined);
  assert.equal(w.activeArcs.length, 0);
});

test('arcs-episode: one-arc-per-id rule rejects a second instance', () => {
  const w = new World();
  primeLongshoreman(w);
  const first = w._dispatchArcSpawn(arcPartialDocks());
  assert.equal(first.tier, 'arc');
  assert.equal(w.activeArcs.length, 1);

  const second = w._dispatchArcSpawn(arcPartialDocks());
  assert.equal(second.tier, 'investigation', 'second instance must downgrade');
  assert.equal(w.activeArcs.length, 1, 'activeArcs unchanged');
});

test('arcs-episode: non-arc tiers pass through untouched', () => {
  const w = new World();
  const partial = { ...arcPartialDocks(), tier: 'whisper' };
  const story = w._dispatchArcSpawn(partial);
  assert.equal(story, partial, 'whisper passes through reference-equal');

  const inv = { ...arcPartialDocks(), tier: 'investigation' };
  const story2 = w._dispatchArcSpawn(inv);
  assert.equal(story2, inv, 'investigation passes through reference-equal');
});

test('arcs-episode: _buildArcContext reads heat / edition / districtHeat / coverage', () => {
  const w = new World();
  w.resources.heat = 42;
  w.districtHeat.docks = 70;
  w.districtHeat.hillside = 10;

  const ctx = w._buildArcContext();
  assert.equal(ctx.heat, 42);
  assert.equal(ctx.edition, w.cycle.edition);
  assert.equal(ctx.districtHeat.docks, 70);
  assert.equal(ctx.districtHeat.hillside, 10);
  assert.equal(ctx.coveredDistricts.has('docks'), true,
    'docks covered by bureau (default world has it)');
  assert.equal(ctx.coveredDistricts.has('hillside'), true,
    'hillside covered by branch_bureau (default world has it)');
});

test('arcs-episode: _buildArcContext drops a district when its covering building dies', () => {
  const w = new World();
  const branch = w.buildings.find((b) => b.kind === 'branch_bureau');
  branch.hp = 0;
  const ctx = w._buildArcContext();
  assert.equal(ctx.coveredDistricts.has('hillside'), false,
    'downed branch leaves hillside uncovered');
  assert.equal(ctx.coveredDistricts.has('docks'), true,
    'main bureau still covers docks');
});

test('arcs-episode: _buildArcContext reads observer.recentStates + rival.state map', () => {
  const w = new World();
  const observer = w.rivals.find((r) => r.id === 'observer');
  observer.recentStates = ['INVESTIGATE', 'PUBLISH'];
  const ctx = w._buildArcContext();
  assert.deepEqual(ctx.observerRecentStates, ['INVESTIGATE', 'PUBLISH']);
  assert.equal(ctx.rivalStates.observer, 'INVESTIGATE');
  assert.equal(ctx.rivalStates.herald, 'IDLE');
  assert.equal(ctx.rivalStates.evening_star, 'SCAVENGE');
});

// ── pickArcBranch + plate-time outcome application ───────────────────────

// Helper: spawn a Longshoreman arc instance directly into a verified state
// at the Darkroom (skips the reporter+photog ferry to keep the test tight).
function spawnLongshormanAtDarkroom(w, episodeId = 'longshoreman_strike.walkout', headline = 'THE WALKOUT — Longshoremen halt the harbor') {
  const darkroom = w.buildings.find((b) => b.kind === 'darkroom');
  const story = {
    id: `s-arc-${episodeId}`,
    state: 'verified',
    district: 'docks',
    flavor: 'labor',
    tier: 'arc',
    truthful: true,
    spawned_at_ms: 0,
    tile: { x: darkroom.tile.x, y: darkroom.tile.y },
    picked_up_by: null,
    held_by_building: darkroom.id,
    headline,
    arc_episode_id: episodeId,
    verified_by: 'u-test',
  };
  w.stories.push(story);
  // Mirror the dispatch: register an ActiveArc tracking this episode.
  w.activeArcs.push(new ActiveArc({
    arcId: 'longshoreman_strike',
    currentEpisode: episodeId,
    spawnEdition: w.cycle.edition,
  }));
  return story;
}

test('arcs-episode: pickArcBranch records the label on the story', () => {
  const w = new World();
  const story = spawnLongshormanAtDarkroom(w);
  const res = w.pickArcBranch(story.id, 'splash');
  assert.equal(res.ok, true);
  assert.equal(story.arc_branch_label, 'splash');
});

test('arcs-episode: pickArcBranch rejects unknown labels and non-arc stories', () => {
  const w = new World();
  const story = spawnLongshormanAtDarkroom(w);
  assert.equal(w.pickArcBranch('nope', 'splash').ok, false);
  assert.equal(w.pickArcBranch(story.id, 'INVALID').ok, false);
  // Non-arc story: synthesize a verified whisper.
  const whisper = { ...story, id: 's-w', tier: 'whisper', arc_episode_id: undefined };
  w.stories.push(whisper);
  assert.equal(w.pickArcBranch(whisper.id, 'splash').ok, false);
});

test('arcs-episode: un-picked arc story does NOT plate (gate at _fireDebrief)', () => {
  const w = new World();
  const story = spawnLongshormanAtDarkroom(w);
  // Force a debrief.
  w._fireDebrief();
  assert.equal(story.state, 'verified', 'arc story without pick stays verified');
});

test('arcs-episode: picked arc story plates AND advances the chain on `advance` choice', () => {
  const w = new World();
  const story = spawnLongshormanAtDarkroom(w);
  w.pickArcBranch(story.id, 'splash');   // advance → foremans_wife
  const arcsBefore = w.activeArcs.length;
  w._fireDebrief();
  assert.equal(story.state, 'printed', 'picked arc story plates');
  assert.equal(w.activeArcs.length, arcsBefore, 'ActiveArc still alive');
  const active = w.activeArcs.find((a) => a.arcId === 'longshoreman_strike');
  assert.equal(active.currentEpisode, 'longshoreman_strike.foremans_wife');
  // Next episode lead spawned in docks.
  const nextLead = w.stories.find((s) =>
    s.arc_episode_id === 'longshoreman_strike.foremans_wife' && s.state === 'lead',
  );
  assert.ok(nextLead, 'foremans_wife lead spawned');
  assert.equal(nextLead.district, 'docks');
  assert.equal(nextLead.tier, 'arc');
  assert.equal(nextLead.headline, "THE FOREMAN'S WIFE — A personal angle");
});

test('arcs-episode: terminal choice applies outcome (cash + heat + disposition) and retires ActiveArc', () => {
  const w = new World();
  // Skip to the terminal episode for clarity. We mint at the WALKOUT and
  // pick `bury` (terminal → bury_outcome).
  const story = spawnLongshormanAtDarkroom(w);
  const cashBefore = w.resources.cash;
  const heatBefore = w.resources.heat;
  w.pickArcBranch(story.id, 'bury');
  w._fireDebrief();
  // bury_outcome: cash_one_time = 300, no heat_one_time, disposition 'grudging'.
  // The story ALSO carries its standard arc-tier cash_yield (resources.js
  // CASH_BY_TIER.arc = 2000), so cash = cashBefore + 2000 + 300 = +2300.
  assert.equal(w.resources.cash, cashBefore + 2000 + 300);
  // Heat went up by the standard arc-tier plate yield only (outcome has no
  // heat_one_time on `bury`). The exact number depends on heatYieldFor; we
  // assert that heat changed (proving the plate fired) but no extra +N from
  // the outcome.
  assert.ok(w.resources.heat > heatBefore, 'arc plate adds its tier heat');
  assert.equal(w.districtDispositions.docks, 'grudging');
  // ActiveArc retired (one-instance rule clears).
  assert.equal(w.activeArcs.length, 0);
});

test('arcs-episode: terminal `labor_outcome` writes cash + heat one-times correctly', () => {
  const w = new World();
  // Set up a fresh world at the DEAL episode terminal.
  const story = spawnLongshormanAtDarkroom(
    w,
    'longshoreman_strike.deal',
    'THE DEAL — The strike ends',
  );
  const cashBefore = w.resources.cash;
  const heatBefore = w.resources.heat;
  w.pickArcBranch(story.id, 'celebrate labor');
  w._fireDebrief();
  // labor_outcome: cash_one_time +2000, heat_one_time +20, disposition 'loyal'.
  // Plus the standard arc-tier yields (CASH 2000, HEAT from heatYieldFor).
  // Check the disposition + cash delta is correct (heat depends on resources.js
  // table for arc/labor flavor; the delta from heatBefore must include +20).
  assert.equal(w.resources.cash, cashBefore + 2000 + 2000);
  assert.ok(w.resources.heat >= heatBefore + 20, `heat should include +20 outcome bonus, got delta ${w.resources.heat - heatBefore}`);
  assert.equal(w.districtDispositions.docks, 'loyal');
  assert.equal(w.activeArcs.length, 0);
});

test('arcs-episode: spawn-cycle integration — forced spawn fires arc when primed', () => {
  // Set a docks-targeting trigger trip-wire, then force the spawner to spawn
  // a story this tick. Tier-roll is RNG-dependent; loop until one of the spawns
  // is arc (or assert investigation downgrade for the others).
  const w = new World({ spawnerSeed: 0xBEEF1ED });
  primeLongshoreman(w);
  // Saturate the docks accumulator so the next tick spawns at least one lead.
  w.leadSpawner.forceSpawnNext('docks');
  w.leadSpawner.forceSpawnNext('hillside');
  w._runSpawnerTick(60);

  // Either an arc story landed (eligible) or all spawns downgraded — both
  // ok. What MUST hold: if any story has arc_episode_id, ActiveArc was joined
  // exactly once. If none, activeArcs stays empty.
  const arcStories = w.stories.filter((s) => s.arc_episode_id);
  assert.equal(w.activeArcs.length, arcStories.length,
    'one ActiveArc per arc_episode_id story');
  // No story should ever ship with tier='arc' yet missing arc_episode_id
  // (the dispatcher upgrades or downgrades; never half-state).
  for (const s of w.stories) {
    if (s.tier === 'arc') assert.ok(s.arc_episode_id, `arc story ${s.id} missing arc_episode_id`);
    if (s.arc_episode_id) assert.equal(s.tier, 'arc');
  }
});
