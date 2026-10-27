import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { LAMP, beamOrigin, toScreen, createRenderer } from '../js/renderer.js';

test('renderer imports in Node without reading browser globals', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    for (const name of ['window', 'document', 'navigator']) {
      Object.defineProperty(globalThis, name, { get() { throw new Error(name + ' read during import'); } });
    }
    await import(${JSON.stringify(new URL('../js/renderer.js', import.meta.url).href)});
  `], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(typeof createRenderer, 'function');
});

test('beam origin is the immutable lamp at every bearing, including multiple turns', () => {
  assert.deepEqual(LAMP, { x: 0, y: 0 });
  assert.ok(Object.isFrozen(LAMP));
  for (let bearing = -1080; bearing <= 1080; bearing += 0.5) {
    assert.strictEqual(beamOrigin(bearing), LAMP, `bearing ${bearing}`);
  }
  for (const bearing of [Number.MAX_VALUE, -Number.MAX_VALUE, Number.MIN_VALUE, -0]) {
    assert.strictEqual(beamOrigin(bearing), LAMP);
  }
});

test('beam origin rejects non-finite and non-numeric bearings', () => {
  for (const bearing of [NaN, Infinity, -Infinity, undefined, null, '90', {}, 90n]) {
    assert.throws(() => beamOrigin(bearing), { name: 'TypeError', message: 'Beam bearing must be finite.' });
  }
});

test('toScreen uses the fixed chart transform at several CSS sizes and DPRs', () => {
  for (const [width, height] of [[1280, 720], [1600, 900], [960, 600], [1537, 863]]) {
    for (const dpr of [1, 1.25, 2]) {
      const backing = { width: Math.round(width * dpr), height: Math.round(height * dpr) };
      for (const point of [LAMP, { x: 100, y: -200 }, { x: -452, y: 452 }, { x: 12.5, y: -0.25 }]) {
        const screen = toScreen(point, backing);
        assert.ok(Math.abs(screen.x - (640 + point.x * 0.86) * backing.width / 1280) < 1e-10);
        assert.ok(Math.abs(screen.y - (478 + point.y * 0.86) * backing.height / 720) < 1e-10);
      }
      const lamp = toScreen(LAMP, backing);
      for (const bearing of [0, 14, 45, 90, 180, 270, 359.9]) {
        assert.deepEqual(toScreen(beamOrigin(bearing), backing), lamp);
      }
      assert.deepEqual(toScreen(LAMP, { width: backing.width * 2, height: backing.height * 2 }), {
        x: lamp.x * 2, y: lamp.y * 2,
      });
    }
  }
});
