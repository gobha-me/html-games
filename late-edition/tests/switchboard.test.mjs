import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  World,
  SWITCHBOARD_TILE,
  SWITCHBOARD_HP,
  SWITCHBOARD_LOS_RADIUS,
  BUREAU_REVEAL_RADIUS,
} from '../js/sim/world-state.js';

// 1.0.0 (ICD-08): Switchboard is the Tier-1 intel-defense building.
// Goons are filtered out of WorldFrame.units unless visible (covered by
// a Switchboard's ±SWITCHBOARD_LOS_RADIUS rect OR within
// BUREAU_REVEAL_RADIUS Chebyshev of any Bureau-family building).

test('Switchboard is constructed at SWITCHBOARD_TILE with SWITCHBOARD_HP', () => {
  const w = new World();
  const sb = w.buildings.find((b) => b.kind === 'switchboard');
  assert.ok(sb, 'expected switchboard at construction');
  assert.deepEqual(sb.tile, SWITCHBOARD_TILE);
  assert.equal(sb.hp, SWITCHBOARD_HP);
  assert.equal(sb.hp_max, SWITCHBOARD_HP);
});

test('Switchboard tile is marked unwalkable on the bake', () => {
  const w = new World();
  assert.equal(w.grid.walkable[SWITCHBOARD_TILE.y][SWITCHBOARD_TILE.x], false);
});

test('Switchboard destruction does not trigger CYCLE_GAME_OVER', () => {
  const w = new World();
  const events = [];
  w.subscribeCycle((ev) => events.push(ev));
  const sb = w.buildings.find((b) => b.kind === 'switchboard');
  sb.hp = 0;
  w.tick(0.1);
  assert.equal(w.gameOver, false);
  assert.equal(events.filter((e) => e.kind === 'CYCLE_GAME_OVER').length, 0);
});

test('_isUnitVisible returns true for non-goon kinds regardless of position', () => {
  const w = new World();
  for (const u of w.units) {
    assert.equal(w._isUnitVisible(u), true);
  }
});

test('_isUnitVisible covers goons inside the Switchboard ±6 LoS rect', () => {
  const w = new World();
  const sb = w.buildings.find((b) => b.kind === 'switchboard');
  // Build a synthetic goon at the corner of the LoS rect.
  const corner = { x: sb.tile.x + SWITCHBOARD_LOS_RADIUS, y: sb.tile.y + SWITCHBOARD_LOS_RADIUS };
  const goon = { id: 'g-1', kind: 'goon', tile: corner, hp: 1 };
  assert.equal(w._isUnitVisible(goon), true);
});

test('_isUnitVisible hides goons outside both Switchboard LoS and Bureau reveal radius', () => {
  const w = new World();
  // Destroy the Switchboard so only the defensive default is in play.
  const sb = w.buildings.find((b) => b.kind === 'switchboard');
  sb.hp = 0;
  // Goon at the NW grid edge — far from every Bureau-family building.
  const goon = { id: 'g-2', kind: 'goon', tile: { x: 0, y: 0 }, hp: 1 };
  assert.equal(w._isUnitVisible(goon), false);
});

test('_isUnitVisible reveals goons inside the Bureau 1-tile defensive default', () => {
  const w = new World();
  // Destroy the Switchboard so only the defensive default fires.
  const sb = w.buildings.find((b) => b.kind === 'switchboard');
  sb.hp = 0;
  const bureau = w.buildings.find((b) => b.kind === 'bureau');
  // Adjacent (Chebyshev distance 1) to the Bureau.
  const adj = { x: bureau.tile.x + BUREAU_REVEAL_RADIUS, y: bureau.tile.y };
  const goon = { id: 'g-3', kind: 'goon', tile: adj, hp: 1 };
  assert.equal(w._isUnitVisible(goon), true);
});

test('_isUnitVisible reveals goons inside the Branch Bureau defensive default', () => {
  const w = new World();
  const sb = w.buildings.find((b) => b.kind === 'switchboard');
  sb.hp = 0;
  const branch = w.buildings.find((b) => b.kind === 'branch_bureau');
  const adj = { x: branch.tile.x, y: branch.tile.y + BUREAU_REVEAL_RADIUS };
  const goon = { id: 'g-4', kind: 'goon', tile: adj, hp: 1 };
  assert.equal(w._isUnitVisible(goon), true);
});

test('Destroyed Switchboard stops contributing LoS coverage', () => {
  const w = new World();
  const sb = w.buildings.find((b) => b.kind === 'switchboard');
  // Pick a tile inside the Switchboard rect but outside every Bureau-family
  // ±1 reveal box (Bureau at (5,5), Branch at (8,3)). (0, 6) qualifies:
  // Switchboard ±6 (dx=3, dy=3) covers it; Bureau ±1 (dx=5, dy=1) does not;
  // Branch ±1 (dx=8, dy=3) does not.
  const farTile = { x: 0, y: 6 };
  const goon = { id: 'g-5', kind: 'goon', tile: farTile, hp: 1 };
  assert.equal(w._isUnitVisible(goon), true);
  sb.hp = 0;
  assert.equal(w._isUnitVisible(goon), false);
});

test('snapshot() filters out invisible goons from frame.units', () => {
  const w = new World();
  // Destroy the Switchboard so the defensive default is the only filter.
  const sb = w.buildings.find((b) => b.kind === 'switchboard');
  sb.hp = 0;
  // Push a synthetic goon at the NW corner — far from Bureau & Branch.
  w.units.push({
    id: 'g-far',
    kind: 'goon',
    tile: { x: 0, y: 0 },
    pos: { x: -27, y: 0, z: -27 },
    facing: 0,
    state: 'idle',
    selected: false,
    carrying: null,
    carryingStoryId: null,
    path: [],
    pathIdx: 0,
    hp: 1,
    hp_max: 1,
  });
  const f = w.snapshot();
  assert.equal(f.units.find((u) => u.id === 'g-far'), undefined);
});

test('snapshot() includes goons that are visible through the Switchboard', () => {
  const w = new World();
  const sb = w.buildings.find((b) => b.kind === 'switchboard');
  // Inside the LoS rect. (4,4) is one tile inside the rect.
  const tile = { x: sb.tile.x + 1, y: sb.tile.y + 1 };
  w.units.push({
    id: 'g-seen',
    kind: 'goon',
    tile,
    pos: { x: tile.x * 6 - 27, y: 0, z: tile.y * 6 - 27 },
    facing: 0,
    state: 'idle',
    selected: false,
    carrying: null,
    carryingStoryId: null,
    path: [],
    pathIdx: 0,
    hp: 1,
    hp_max: 1,
  });
  const f = w.snapshot();
  assert.ok(f.units.find((u) => u.id === 'g-seen'), 'expected switchboard-covered goon in frame.units');
});
