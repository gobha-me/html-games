import assert from 'node:assert/strict';
import test from 'node:test';
import { clampLabelBox, placeLabel } from '../js/label-placement.js';

function assertContained({ box, leader }, anchor, bounds) {
  assert.ok(box.x >= bounds.x && box.y >= bounds.y, JSON.stringify(box));
  assert.ok(box.x + box.w <= bounds.x + bounds.w && box.y + box.h <= bounds.y + bounds.h, JSON.stringify(box));
  assert.ok(box.w > 0 && box.h > 0);
  assert.deepEqual(leader.from, { x: anchor.x, y: anchor.y }, 'Never move the address to fix its label');
  assert.equal(leader.to.x, Math.max(box.x, Math.min(anchor.x, box.x + box.w)));
  assert.equal(leader.to.y, Math.max(box.y, Math.min(anchor.y, box.y + box.h)));
}

test('every edge/corner and far-outside anchor stays contained even when all candidates are blocked', () => {
  const bounds = { x: 17, y: -23, w: 400, h: 300 };
  const size = { w: 210, h: 129 };
  for (const x of [-1e6, bounds.x, bounds.x + bounds.w / 2, bounds.x + bounds.w, 1e6]) {
    for (const y of [-1e6, bounds.y, bounds.y + bounds.h / 2, bounds.y + bounds.h, 1e6]) {
      const anchor = { x, y, w: 1e9, h: 1e9 }; // Anchor extent is not a label/hit-target resize.
      for (const obstacles of [[], [{ ...bounds }]]) {
        const snapshot = structuredClone({ anchor, size, obstacles, bounds });
        const placement = placeLabel(anchor, size, obstacles, bounds);
        assertContained(placement, anchor, bounds);
        assert.deepEqual({ w: placement.box.w, h: placement.box.h }, size, 'Translation preserves ordinary label size');
        assert.deepEqual(placeLabel(anchor, size, obstacles, bounds), placement, 'Deterministic even with no clear space');
        assert.deepEqual({ anchor, size, obstacles, bounds }, snapshot);
      }
    }
  }
});

test('oversized labels and tiny canvases bound both dimensions and keep the anchor thread', () => {
  for (const bounds of [{ x: 0, y: 0, w: 1, h: 1 }, { x: -10, y: 20, w: 5, h: 200 },
    { x: 50, y: -30, w: 300, h: 2 }]) {
    for (const size of [{ w: 5000, h: 5000 }, { w: 1, h: 5000 }, { w: 5000, h: 1 }]) {
      for (const anchor of [{ x: 0, y: 0 }, { x: -10000, y: 10000 }]) {
        const placement = placeLabel(anchor, size, [{ ...bounds }], bounds);
        assertContained(placement, anchor, bounds);
        assert.equal(placement.box.w, Math.min(size.w, bounds.w));
        assert.equal(placement.box.h, Math.min(size.h, bounds.h));
      }
    }
  }
});

test('copy growth reclamps an existing box; corrupt bounds and dimensions reject instead of emitting NaN', () => {
  const bounds = { x: 0, y: 0, w: 400, h: 300 };
  assert.deepEqual(clampLabelBox({ x: 350, y: 280, w: 200, h: 100 }, bounds), { x: 200, y: 200, w: 200, h: 100 });
  for (const bad of [null, {}, { ...bounds, w: 0 }, { ...bounds, h: -1 },
    { ...bounds, x: NaN }, { ...bounds, y: Infinity }]) {
    assert.throws(() => clampLabelBox(bad, bounds), RangeError);
    assert.throws(() => clampLabelBox(bounds, bad), RangeError);
    assert.throws(() => placeLabel({ x: 0, y: 0 }, { w: 20, h: 20 }, [], bad), RangeError);
  }
});
