import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DISTRICTS,
  DEFAULT_DISTRICT_ID,
  getDistrict,
  resolveDistrictId,
  pickSpawnTile,
  pickWeighted,
  pickFromList,
  districtForTile,
} from '../js/sim/districts.js';
import { SeededRng } from '../js/sim/seeded-rng.js';

// 0.10.0 (G-04): districts as data. Lock the Tier-0 shape (docks + hillside)
// so the spawner + headline grammar have stable inputs.

test('DISTRICTS exports at least docks + hillside (Tier-0 shape)', () => {
  const ids = DISTRICTS.map((d) => d.id).sort();
  assert.deepEqual(ids, ['docks', 'hillside']);
  for (const d of DISTRICTS) {
    assert.equal(typeof d.name, 'string');
    assert.equal(typeof d.coveredByKind, 'string');
    assert.ok(d.spawnRect && typeof d.spawnRect.x === 'number');
    assert.ok(d.flavorWeights && typeof d.flavorWeights === 'object');
    assert.ok(Array.isArray(d.actorPool) && d.actorPool.length > 0);
  }
});

test('DEFAULT_DISTRICT_ID is the first authored district', () => {
  assert.equal(DEFAULT_DISTRICT_ID, DISTRICTS[0].id);
});

test('getDistrict returns the matching record, null on miss', () => {
  assert.equal(getDistrict('docks')?.id, 'docks');
  assert.equal(getDistrict('hillside')?.id, 'hillside');
  assert.equal(getDistrict('atlantis'), null);
});

test('resolveDistrictId folds the legacy d-default literal to the default district', () => {
  assert.equal(resolveDistrictId('d-default'), DEFAULT_DISTRICT_ID);
  assert.equal(resolveDistrictId('docks'), 'docks');
  assert.equal(resolveDistrictId('hillside'), 'hillside');
  assert.equal(resolveDistrictId('unknown'), DEFAULT_DISTRICT_ID);
});

test('pickSpawnTile honors the grid bounds + walkable mask', () => {
  const grid = makeGrid(10, 10);
  const docks = getDistrict('docks');
  const rng = new SeededRng(1);
  const tile = pickSpawnTile(docks, { grid, occupiedTiles: new Set() }, rng);
  assert.ok(tile);
  // Tile must be inside Docks rect (1..4, 1..4).
  assert.ok(tile.x >= docks.spawnRect.x && tile.x < docks.spawnRect.x + docks.spawnRect.w);
  assert.ok(tile.y >= docks.spawnRect.y && tile.y < docks.spawnRect.y + docks.spawnRect.h);
});

test('pickSpawnTile skips occupied tiles', () => {
  const grid = makeGrid(10, 10);
  // Block every tile in the Docks rect except (2,2).
  const docks = getDistrict('docks');
  const occupied = new Set();
  for (let y = docks.spawnRect.y; y < docks.spawnRect.y + docks.spawnRect.h; y++) {
    for (let x = docks.spawnRect.x; x < docks.spawnRect.x + docks.spawnRect.w; x++) {
      if (!(x === 2 && y === 2)) occupied.add(`${x},${y}`);
    }
  }
  const rng = new SeededRng(7);
  const tile = pickSpawnTile(docks, { grid, occupiedTiles: occupied }, rng);
  assert.deepEqual(tile, { x: 2, y: 2 });
});

test('pickSpawnTile returns null when the district has no free tile', () => {
  const grid = makeGrid(10, 10);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) grid.walkable[y][x] = false;
  const rng = new SeededRng(1);
  const tile = pickSpawnTile(getDistrict('docks'), { grid, occupiedTiles: new Set() }, rng);
  assert.equal(tile, null);
});

test('pickWeighted distribution converges to the table over many draws', () => {
  const rng = new SeededRng(42);
  const counts = { a: 0, b: 0, c: 0 };
  const N = 5000;
  for (let i = 0; i < N; i++) counts[pickWeighted({ a: 70, b: 25, c: 5 }, rng)]++;
  assert.ok(Math.abs(counts.a / N - 0.70) < 0.03, `a: ${counts.a / N}`);
  assert.ok(Math.abs(counts.b / N - 0.25) < 0.03, `b: ${counts.b / N}`);
  assert.ok(Math.abs(counts.c / N - 0.05) < 0.03, `c: ${counts.c / N}`);
});

test('pickWeighted handles zero-weight and empty tables', () => {
  const rng = new SeededRng(1);
  assert.equal(pickWeighted({}, rng), null);
  assert.equal(pickWeighted({ a: 0, b: 0 }, rng), null);
});

test('pickFromList returns null on empty input', () => {
  const rng = new SeededRng(1);
  assert.equal(pickFromList([], rng), null);
  assert.equal(pickFromList(null, rng), null);
});

test('districtForTile resolves rect membership; falls back to default', () => {
  assert.equal(districtForTile({ x: 2, y: 2 }), 'docks');
  assert.equal(districtForTile({ x: 8, y: 2 }), 'hillside');
  assert.equal(districtForTile({ x: 5, y: 5 }), DEFAULT_DISTRICT_ID); // central HQ tile sits between rects
});

function makeGrid(w, h) {
  const walkable = Array.from({ length: h }, () => Array(w).fill(true));
  return { width: w, height: h, walkable };
}
