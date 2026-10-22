import assert from 'node:assert/strict';
import test from 'node:test';
import { generateDistrict, CITY_SEED } from '../js/city.js';
import { DISTRICTS } from '../js/config.js';
import { NoirCityRenderer } from '../js/renderer.js';
import { LateEditionSim } from '../js/sim.js';

const district = DISTRICTS[0];
test('cosmetic seed is repeatable, isolated from order, and changes silhouettes', () => {
  const expected = generateDistrict(district);
  generateDistrict(DISTRICTS[1], 99);
  assert.deepEqual(generateDistrict(district, CITY_SEED), expected);
  assert.notDeepEqual(generateDistrict(district, CITY_SEED + 1), expected);
  assert.notDeepEqual(generateDistrict({ ...district, id: 'other' }), expected);
  // Identity must change the actual architecture, not just its map position.
  const shape = (list) => list.map(({ height, setback, tank, escape, windows }) => ({ height, setback, tank, escape, windows }));
  assert.notDeepEqual(shape(generateDistrict({ ...district, id: 'other' })), shape(expected));
  for (const d of DISTRICTS) for (const b of generateDistrict(d)) {
    assert.ok(b.width > 0 && b.depth > 0 && b.height >= 24 && b.height < 67);
    assert.equal(b.windows.length, 15);
    assert.ok(b.windows.every((lit) => typeof lit === 'boolean'));
  }
  expected[0].windows.fill(false);
  assert.notDeepEqual(generateDistrict(district), expected, 'No shared mutable generator output');
});

test('cosmetic generator rejects corrupt geometry and invalid seeds', () => {
  for (const invalid of [null, {}, { ...district, id: '' }, { ...district, x: NaN },
    { ...district, y: Infinity }, { ...district, w: -1 }, { ...district, h: 0 }]) {
    assert.throws(() => generateDistrict(invalid), RangeError);
  }
  for (const seed of [NaN, Infinity, 1.2, '1947', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => generateDistrict(district, seed), RangeError);
  }
});

// A recording canvas exercises the real renderer, including the cold-cache path;
// it does not replace render() with a stub that could hide simulation mutations.
function canvasFixture(t) {
  const calls = [];
  const ctx = new Proxy({}, { get: (_, key) => {
    if (key === 'measureText') return (text) => ({ width: text.length * 7 });
    if (String(key).startsWith('create')) return () => ({ addColorStop() {} });
    return (...args) => calls.push([key, ...args]);
  }, set: () => true });
  const rect = { left: 12, top: 34, width: 1000, height: 650 };
  const canvas = () => ({ width: 1, height: 1, getContext: () => ctx, getBoundingClientRect: () => rect });
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.document = { createElement: canvas };
  t.after(() => {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  });
  return { canvas: canvas(), rect, calls };
}

test('rendering cold/warm/resized/DPR layers preserves gameplay and exact coordinate mapping', (t) => {
  const fixture = canvasFixture(t);
  const sim = new LateEditionSim({ seed: 81 });
  const hash = sim.getStateHash(), rng = sim.rng.getState();
  const renderer = new NoirCityRenderer(fixture.canvas);
  renderer.render(sim, 0.016);
  const cached = renderer.cache;
  renderer.render(sim, 0.016);
  assert.equal(renderer.cache, cached);
  renderer.hoverLeadId = sim.leads[0].uid;
  renderer.render(sim, NaN);
  assert.ok(Number.isFinite(renderer.cosmeticTime));
  fixture.rect.width = 800;
  renderer.render(sim, 0);
  assert.notEqual(renderer.cache, cached);
  const resized = renderer.cache;
  globalThis.window.devicePixelRatio = 2;
  renderer.render(sim, 0);
  assert.notEqual(renderer.cache, resized);
  assert.equal(fixture.canvas.width, 1600);
  assert.deepEqual(renderer.screenToWorld(412, 359), { x: 700, y: 500 });
  assert.equal(sim.getStateHash(), hash);
  assert.equal(sim.rng.getState(), rng);
  // Even a collapsed canvas cannot generate infinite/NaN input coordinates.
  fixture.rect.width = fixture.rect.height = 0;
  assert.deepEqual(renderer.screenToWorld(12, 34), { x: 0, y: 0 });
});

test('reduced motion freezes title geometry/rain, including after a live preference change', (t) => {
  const fixture = canvasFixture(t);
  const renderer = new NoirCityRenderer(fixture.canvas);
  renderer.renderTitle(0.1);
  renderer.reducedMotion = true;
  fixture.calls.length = 0;
  renderer.renderTitle(1);
  const first = fixture.calls.slice();
  fixture.calls.length = 0;
  renderer.renderTitle(10);
  assert.deepEqual(fixture.calls, first);
});


test('initial font loading cannot bake fallback signs; font failure still permits the city', (t) => {
  const fixture = canvasFixture(t);
  globalThis.document.fonts = { status: 'loading' };
  const renderer = new NoirCityRenderer(fixture.canvas);
  const sim = new LateEditionSim({ seed: 89 });
  renderer.render(sim);
  renderer.renderTitle();
  assert.equal(renderer.cache, null);
  assert.equal(fixture.calls.length, 0);
  // FontFaceSet settles to loaded even when a face failed (blocked/offline).
  globalThis.document.fonts.status = 'loaded';
  renderer.render(sim);
  assert.ok(renderer.cache);
  assert.ok(fixture.calls.some(([name]) => name === 'fillText'));
});
