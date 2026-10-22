import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { LAMP, beamOrigin, toScreen } from '../js/renderer.js';

// Logical frame stated for the overhead chart and for toScreen().
const LOGICAL_W = 1280;
const LOGICAL_H = 720;
const ORIGIN_X = 640;
const ORIGIN_Y = 478;
const CHART_SCALE = 0.86;

const SEEDS = Array.from({ length: 200 }, (_, i) => i);

const NON_FINITE = [NaN, Infinity, -Infinity, Number.NaN, 1 / 0, -1 / 0, 0 / 0];

const FINITE_BOUNDARIES = [
  0,
  -0,
  360,
  -360,
  720,
  -720,
  180,
  -180,
  90,
  -90,
  270,
  359,
  360.0001,
  -0.0001,
  0.5,
  Math.PI,
  1e-10,
  -1e-10,
  Number.MIN_VALUE,
  -Number.MIN_VALUE,
  Number.EPSILON,
  Number.MAX_SAFE_INTEGER,
  Number.MIN_SAFE_INTEGER,
  Number.MAX_VALUE,
  -Number.MAX_VALUE,
  0.1 + 0.2,
  199.999,
  -199,
  400,
  -45.25,
];

function lamp() {
  return { x: LAMP.x, y: LAMP.y };
}

/** Chart point -> backing pixels: translate (640,478), scale 0.86, then fit width/height. */
function screenOf(point, width, height) {
  return {
    x: (ORIGIN_X + CHART_SCALE * point.x) * (width / LOGICAL_W),
    y: (ORIGIN_Y + CHART_SCALE * point.y) * (height / LOGICAL_H),
  };
}

function assertNear(actual, expected, label) {
  assert.equal(typeof actual, 'number', label);
  assert.ok(Number.isFinite(actual), label);
  assert.ok(Number.isFinite(expected), label);
  const tol = 1e-6 * Math.max(1, Math.abs(expected));
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label}: ${actual} vs ${expected}`,
  );
}

function assertPointNear(actual, expected, label) {
  assert.ok(actual && typeof actual === 'object', label);
  assertNear(actual.x, expected.x, `${label}.x`);
  assertNear(actual.y, expected.y, `${label}.y`);
}

function assertSameChartPoint(actual, expected, label) {
  assert.ok(actual && typeof actual === 'object', label);
  assert.equal(typeof actual.x, 'number', label);
  assert.equal(typeof actual.y, 'number', label);
  assert.equal(actual.x, expected.x, `${label}.x`);
  assert.equal(actual.y, expected.y, `${label}.y`);
}

describe('LAMP', () => {
  test('is one finite chart-space centre {x, y}', () => {
    assert.ok(LAMP && typeof LAMP === 'object');
    assert.equal(typeof LAMP.x, 'number');
    assert.equal(typeof LAMP.y, 'number');
    assert.ok(Number.isFinite(LAMP.x));
    assert.ok(Number.isFinite(LAMP.y));
  });
});

describe('beamOrigin', () => {
  test('returns LAMP for every bearing in 0..199 and wrapped copies', () => {
    const centre = lamp();
    for (const deg of SEEDS) {
      for (const bearing of [deg, deg - 360, deg + 360, deg + 720, -deg, deg + 0.5]) {
        assert.ok(Number.isFinite(bearing));
        assert.doesNotThrow(() => beamOrigin(bearing));
        assertSameChartPoint(beamOrigin(bearing), centre, `bearing ${bearing}`);
      }
    }
  });

  test('returns LAMP at finite boundaries, including outside 0..360', () => {
    const centre = lamp();
    for (const deg of FINITE_BOUNDARIES) {
      assert.ok(Number.isFinite(deg));
      const point = beamOrigin(deg);
      assertSameChartPoint(point, centre, `boundary ${deg}`);
      assertSameChartPoint(beamOrigin(deg), point, `repeat ${deg}`);
    }
  });

  test('stays on the lamp across dense angles and does not move LAMP', () => {
    const x = LAMP.x;
    const y = LAMP.y;
    for (const s of SEEDS) {
      const deg = (s * 360) / 199 - 180;
      assertSameChartPoint(beamOrigin(deg), { x, y }, `circle ${deg}`);
      assertSameChartPoint(beamOrigin(s * Math.PI), { x, y }, `pi ${s}`);
      assertSameChartPoint(beamOrigin(s * 17.5 - 1000), { x, y }, `wide ${s}`);
    }
    assert.equal(LAMP.x, x);
    assert.equal(LAMP.y, y);
  });

  test('non-finite bearings throw TypeError', () => {
    for (const deg of NON_FINITE) {
      assert.equal(typeof deg, 'number');
      assert.ok(!Number.isFinite(deg));
      assert.throws(() => beamOrigin(deg), TypeError);
      assert.throws(() => beamOrigin(deg), TypeError);
    }
  });
});

describe('toScreen', () => {
  test('applies translate (640, 478) and scale 0.86 on a 1280x720 backing', () => {
    const size = { width: LOGICAL_W, height: LOGICAL_H };
    assertPointNear(toScreen({ x: 0, y: 0 }, size), { x: ORIGIN_X, y: ORIGIN_Y }, 'origin');
    assertPointNear(
      toScreen({ x: 1, y: 0 }, size),
      { x: ORIGIN_X + CHART_SCALE, y: ORIGIN_Y },
      'unit x',
    );
    assertPointNear(
      toScreen({ x: 0, y: 1 }, size),
      { x: ORIGIN_X, y: ORIGIN_Y + CHART_SCALE },
      'unit y',
    );
    assertPointNear(
      toScreen({ x: -1, y: -2 }, size),
      { x: ORIGIN_X - CHART_SCALE, y: ORIGIN_Y - 2 * CHART_SCALE },
      'negative chart',
    );
    assertPointNear(toScreen(lamp(), size), screenOf(lamp(), LOGICAL_W, LOGICAL_H), 'lamp');
  });

  test('lamp screen position scales linearly with width and height', () => {
    const baseSize = { width: LOGICAL_W, height: LOGICAL_H };
    const base = toScreen(lamp(), baseSize);
    const dpr2 = toScreen(lamp(), { width: LOGICAL_W * 2, height: LOGICAL_H * 2 });
    assertPointNear(dpr2, { x: base.x * 2, y: base.y * 2 }, 'dpr 2');
    assertPointNear(base, screenOf(lamp(), LOGICAL_W, LOGICAL_H), 'dpr 1 formula');
    assertPointNear(dpr2, screenOf(lamp(), LOGICAL_W * 2, LOGICAL_H * 2), 'dpr 2 formula');

    for (const s of SEEDS) {
      const k = (s + 1) / 40;
      const scaled = toScreen(lamp(), { width: LOGICAL_W * k, height: LOGICAL_H * k });
      assertPointNear(scaled, { x: base.x * k, y: base.y * k }, `uniform k=${k}`);
      assertPointNear(scaled, screenOf(lamp(), LOGICAL_W * k, LOGICAL_H * k), `formula k=${k}`);
    }
  });

  test('screen x scales with width and screen y scales with height', () => {
    const base = toScreen(lamp(), { width: LOGICAL_W, height: LOGICAL_H });
    for (const s of SEEDS) {
      const kw = (s + 1) / 50;
      const kh = ((s * 3) % 50 + 1) / 10;
      const wide = toScreen(lamp(), { width: LOGICAL_W * kw, height: LOGICAL_H });
      assertNear(wide.x, base.x * kw, `wide x ${s}`);
      assertNear(wide.y, base.y, `wide y ${s}`);
      const tall = toScreen(lamp(), { width: LOGICAL_W, height: LOGICAL_H * kh });
      assertNear(tall.x, base.x, `tall x ${s}`);
      assertNear(tall.y, base.y * kh, `tall y ${s}`);
    }
  });

  test('matches the logical transform for many points and backing sizes', () => {
    const awkward = [
      { x: 0, y: 0 },
      { x: 1e-8, y: -1e-8 },
      { x: 1e6, y: -1e6 },
      { x: -1e6, y: 1e6 },
      lamp(),
    ];
    const sizes = [
      { width: LOGICAL_W, height: LOGICAL_H },
      { width: LOGICAL_W * 2, height: LOGICAL_H * 2 },
      { width: 1920, height: 1080 },
      { width: 1, height: 1 },
      { width: LOGICAL_W * 2, height: LOGICAL_H },
      { width: LOGICAL_W, height: LOGICAL_H * 2 },
      { width: 640, height: 360 },
      { width: 100, height: 4000 },
    ];
    for (const point of awkward) {
      for (const size of sizes) {
        assertPointNear(
          toScreen({ x: point.x, y: point.y }, size),
          screenOf(point, size.width, size.height),
          `awkward ${point.x},${point.y} @ ${size.width}x${size.height}`,
        );
      }
    }

    for (const s of SEEDS) {
      const point = {
        x: (s - 100) * 1.5 + (s % 5) * 0.2,
        y: (s % 40) - 20 + (s % 3) * 0.25,
      };
      const width = 13 + s * 7;
      const height = 5 + (s % 17) * 11;
      const size = { width, height };
      const got = toScreen(point, size);
      assertPointNear(got, screenOf(point, width, height), `seed ${s}`);
      const again = toScreen({ x: point.x, y: point.y }, { width, height });
      assert.equal(again.x, got.x, `determinism x ${s}`);
      assert.equal(again.y, got.y, `determinism y ${s}`);
    }
  });

  test('beam origin and lamp share one screen position at every seed and backing size', () => {
    const dprs = [0.5, 1, 1.25, 1.5, 2, 3];
    const centre = lamp();
    for (const deg of SEEDS) {
      const origin = beamOrigin(deg);
      assertSameChartPoint(origin, centre, `chart ${deg}`);
      for (const dpr of dprs) {
        const size = { width: LOGICAL_W * dpr, height: LOGICAL_H * dpr };
        const fromBeam = toScreen({ x: origin.x, y: origin.y }, size);
        const fromLamp = toScreen(centre, size);
        assert.equal(fromBeam.x, fromLamp.x, `screen x ${deg} dpr ${dpr}`);
        assert.equal(fromBeam.y, fromLamp.y, `screen y ${deg} dpr ${dpr}`);
        assertPointNear(fromLamp, screenOf(centre, size.width, size.height), `lamp dpr ${dpr}`);
      }
    }
  });

  test('screen position is homogeneous in backing size', () => {
    const samples = [lamp(), { x: 0, y: 0 }, { x: 10, y: -4 }, { x: -3.5, y: 8.25 }];
    for (const s of SEEDS) {
      const w1 = 100 + s;
      const w2 = 50 + (s % 17) * 3;
      const h1 = 80 + (s % 11);
      const h2 = 40 + (s % 13);
      for (const point of samples) {
        const p = { x: point.x, y: point.y };
        const a = toScreen(p, { width: w1, height: h1 });
        const b = toScreen(p, { width: w2, height: h2 });
        const sum = toScreen(p, { width: w1 + w2, height: h1 + h2 });
        assertNear(sum.x, a.x + b.x, `add x ${s}`);
        assertNear(sum.y, a.y + b.y, `add y ${s}`);
      }
    }
  });
});
