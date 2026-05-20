import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, TILE, REPORTER_SPEED, tileToWorld } from '../js/sim/world-state.js';

test('Reporter starts idle at tile (5,4)', () => {
  const w = new World();
  const r = w.units[0];
  assert.equal(r.kind, 'reporter');
  assert.equal(r.state, 'idle');
  assert.deepEqual(r.tile, { x: 5, y: 4 });
  assert.deepEqual(r.pos, tileToWorld({ x: 5, y: 4 }));
  assert.equal(r.path.length, 0);
});

test('dispatch sets path + state walking; tick(dt) advances toward target', () => {
  const w = new World();
  const r = w.units[0];
  const ok = w.dispatch(r.id, { x: 5, y: 0 });
  assert.equal(ok, true);
  assert.equal(r.state, 'walking');
  assert.ok(r.path.length >= 2);

  const startX = r.pos.x;
  const startZ = r.pos.z;
  w.tick(0.5);
  const traveled = Math.hypot(r.pos.x - startX, r.pos.z - startZ);
  assert.ok(
    Math.abs(traveled - REPORTER_SPEED * 0.5) < 1e-6,
    `expected to travel ${REPORTER_SPEED * 0.5} world-units in 0.5s, got ${traveled}`,
  );
});

test('Reporter reaches destination and transitions back to idle', () => {
  const w = new World();
  const r = w.units[0];
  w.dispatch(r.id, { x: 5, y: 0 });
  // Path is 5 tiles (5,4)→(5,0) → 4 hops × 6 units = 24 units. At 3.5u/s → ~6.86s.
  for (let i = 0; i < 100; i++) w.tick(0.1);
  assert.equal(r.state, 'idle');
  assert.deepEqual(r.tile, { x: 5, y: 0 });
  assert.equal(r.path.length, 0);
});

test('dispatch to unreachable cell returns false; unit stays idle', () => {
  const w = new World();
  const r = w.units[0];
  // Bureau at (5,5) is non-walkable — dispatching to it fails.
  const ok = w.dispatch(r.id, { x: 5, y: 5 });
  assert.equal(ok, false);
  assert.equal(r.state, 'idle');
  assert.equal(r.path.length, 0);
});

test('dispatch overwrites in-flight path (no queueing at 0.2)', () => {
  const w = new World();
  const r = w.units[0];
  w.dispatch(r.id, { x: 9, y: 4 });
  w.tick(0.1);
  const firstPath = r.path;
  w.dispatch(r.id, { x: 0, y: 4 });
  assert.notStrictEqual(r.path, firstPath, 'path was not replaced');
  assert.deepEqual(r.path.at(-1), { x: 0, y: 4 });
});

test('selectUnit toggles only the targeted unit', () => {
  const w = new World();
  const r = w.units[0];
  w.selectUnit(r.id);
  assert.equal(r.selected, true);
  w.deselectAll();
  assert.equal(r.selected, false);
});

test('tile-world conversion is consistent for cell (0,0) and (9,9)', () => {
  const c1 = tileToWorld({ x: 0, y: 0 });
  const c2 = tileToWorld({ x: 9, y: 9 });
  assert.equal(c1.x, -27);
  assert.equal(c1.z, -27);
  assert.equal(c2.x, 9 * TILE - 27); // 27
  assert.equal(c2.z, 9 * TILE - 27);
});

test('Photog dispatch + arrival cycle mirrors Reporter (idle → walking → idle)', () => {
  const w = new World();
  const p = w.units.find((u) => u.kind === 'photog');
  assert.equal(p.state, 'idle');
  assert.deepEqual(p.tile, { x: 5, y: 6 });

  assert.equal(w.dispatch(p.id, { x: 5, y: 9 }), true);
  assert.equal(p.state, 'walking');

  for (let i = 0; i < 100; i++) w.tick(0.1);
  assert.equal(p.state, 'idle');
  assert.deepEqual(p.tile, { x: 5, y: 9 });
});
