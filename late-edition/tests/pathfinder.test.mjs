import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathfind } from '../js/sim/pathfinder.js';

function openGrid(w, h) {
  const walkable = Array.from({ length: h }, () => Array(w).fill(true));
  return { width: w, height: h, walkable };
}

test('pathfind: straight line on open 10x10 grid', () => {
  const grid = openGrid(10, 10);
  const res = pathfind({ from: { x: 0, y: 0 }, to: { x: 3, y: 0 }, unitKind: 'reporter' }, grid);
  assert.equal(res.found, true);
  assert.equal(res.cells.length, 4);
  assert.deepEqual(res.cells[0], { x: 0, y: 0 });
  assert.deepEqual(res.cells.at(-1), { x: 3, y: 0 });
  assert.equal(res.cost, 3);
  assert.deepEqual(res.recomputeOn, []);
});

test('pathfind: routes around a blocked cell', () => {
  const grid = openGrid(5, 5);
  grid.walkable[0][1] = false;
  const res = pathfind({ from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, unitKind: 'reporter' }, grid);
  assert.equal(res.found, true);
  for (const c of res.cells) {
    assert.ok(grid.walkable[c.y][c.x], `path stepped through blocked cell (${c.x},${c.y})`);
  }
  assert.deepEqual(res.cells[0], { x: 0, y: 0 });
  assert.deepEqual(res.cells.at(-1), { x: 2, y: 0 });
  assert.ok(res.cost >= 4, `expected cost >= 4 for detour, got ${res.cost}`);
});

test('pathfind: returns found=false + cells=[] when unreachable', () => {
  const grid = openGrid(5, 5);
  for (let y = 0; y < 5; y++) grid.walkable[y][2] = false;
  const res = pathfind({ from: { x: 0, y: 0 }, to: { x: 4, y: 4 }, unitKind: 'reporter' }, grid);
  assert.equal(res.found, false);
  assert.deepEqual(res.cells, []);
  assert.deepEqual(res.recomputeOn, []);
});

test('pathfind: destination is the source — single-cell path, cost 0', () => {
  const grid = openGrid(5, 5);
  const res = pathfind({ from: { x: 2, y: 2 }, to: { x: 2, y: 2 }, unitKind: 'reporter' }, grid);
  assert.equal(res.found, true);
  assert.deepEqual(res.cells, [{ x: 2, y: 2 }]);
  assert.equal(res.cost, 0);
});

test('pathfind: destination is blocked → found=false', () => {
  const grid = openGrid(5, 5);
  grid.walkable[3][3] = false;
  const res = pathfind({ from: { x: 0, y: 0 }, to: { x: 3, y: 3 }, unitKind: 'reporter' }, grid);
  assert.equal(res.found, false);
  assert.deepEqual(res.cells, []);
});

test('pathfind: recomputeOn is always an array (empty at 0.2)', () => {
  const grid = openGrid(3, 3);
  const res = pathfind({ from: { x: 0, y: 0 }, to: { x: 2, y: 2 }, unitKind: 'reporter' }, grid);
  assert.ok(Array.isArray(res.recomputeOn));
});
