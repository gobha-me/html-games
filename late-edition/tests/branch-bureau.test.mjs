import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, BRANCH_BUREAU_TILE, BRANCH_HP } from '../js/sim/world-state.js';

// 0.10.0 (audit G-01): Branch Bureau. Covers the Hillside district per
// districts.js coveredByKind. Reporters can drop at either bureau-family
// building. Branch destruction does NOT trigger CYCLE_GAME_OVER.

test('Branch Bureau is constructed at BRANCH_BUREAU_TILE with BRANCH_HP', () => {
  const w = new World();
  const branch = w.buildings.find((b) => b.kind === 'branch_bureau');
  assert.ok(branch, 'expected branch_bureau at construction');
  assert.deepEqual(branch.tile, BRANCH_BUREAU_TILE);
  assert.equal(branch.hp, BRANCH_HP);
  assert.equal(branch.hp_max, BRANCH_HP);
});

test('Branch tile is marked unwalkable on the bake', () => {
  const w = new World();
  assert.equal(w.grid.walkable[BRANCH_BUREAU_TILE.y][BRANCH_BUREAU_TILE.x], false);
});

test('Branch destruction does not trigger CYCLE_GAME_OVER', () => {
  const w = new World();
  const events = [];
  w.subscribeCycle((ev) => events.push(ev));
  const branch = w.buildings.find((b) => b.kind === 'branch_bureau');
  branch.hp = 0;
  // Run a tick — fail-state check only fires on bureau.hp ≤ 0.
  w.tick(0.1);
  assert.equal(w.gameOver, false);
  assert.equal(events.filter((e) => e.kind === 'CYCLE_GAME_OVER').length, 0);
});

test('Main Bureau destruction still triggers CYCLE_GAME_OVER (Branch existing does not change rule)', () => {
  const w = new World();
  const events = [];
  w.subscribeCycle((ev) => events.push(ev));
  const bureau = w.buildings.find((b) => b.kind === 'bureau');
  bureau.hp = 0;
  w.tick(0.1);
  assert.equal(w.gameOver, true);
  assert.equal(events.filter((e) => e.kind === 'CYCLE_GAME_OVER').length, 1);
});

test('Reporter can drop a lead at the Branch Bureau (drop accepted at either bureau-family)', () => {
  const w = new World();
  const reporter = w.units.find((u) => u.kind === 'reporter');
  const branch = w.buildings.find((b) => b.kind === 'branch_bureau');

  // Synthesize a lead adjacent to the Branch + a reporter carrying it.
  const carryingStory = {
    id: 's-test',
    state: 'lead',
    district: 'hillside',
    flavor: 'money',
    tier: 'whisper',
    truthful: true,
    spawned_at_ms: 0,
    tile: { x: branch.tile.x - 1, y: branch.tile.y },
    picked_up_by: reporter.id,
    held_by_building: null,
    headline: 'BANKER BRIBES JUDGE',
  };
  w.stories.push(carryingStory);
  reporter.carrying = 'lead';
  reporter.carryingStoryId = carryingStory.id;
  reporter.tile = { x: branch.tile.x - 1, y: branch.tile.y };

  w._handleArrival(reporter);

  assert.equal(carryingStory.held_by_building, branch.id);
  assert.equal(carryingStory.picked_up_by, null);
  assert.equal(reporter.carrying, null);
});
