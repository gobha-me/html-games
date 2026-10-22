import assert from 'node:assert/strict';
import test from 'node:test';
import { summarize, supportsFrameBudget } from '../e2e/performance-metrics.js';

const fast = summarize(Array(90).fill(1000 / 60));
test('performance percentiles retain tail spikes and reject empty/corrupt probes', () => {
  assert.equal(summarize([...Array(94).fill(1), ...Array(6).fill(40)]).p95, 40);
  for (const samples of [[], [NaN], [Infinity], [-1]]) assert.throws(() => summarize(samples), RangeError);
});

test('frame budget calibration cannot hide game regressions or waive missing probes', () => {
  assert.equal(supportsFrameBudget({ empty: fast, canvas: fast }), true);
  const slow = summarize(Array(30).fill(50));
  assert.equal(supportsFrameBudget({ empty: slow, canvas: fast }), false);
  assert.equal(supportsFrameBudget({ empty: fast, canvas: slow }), false, '60Hz idle callbacks cannot conceal slow raster');
  const jitter = summarize([...Array(84).fill(16), ...Array(6).fill(30)]);
  assert.equal(supportsFrameBudget({ empty: jitter, canvas: fast }), false);
  for (const broken of [undefined, {}, { ...fast, samples: 0 }, { ...fast, samples: Infinity }, { ...fast, total: NaN },
    { ...fast, total: 999 }, { ...fast, p95: Infinity }, { ...fast, p95: 0 }]) {
    assert.throws(() => supportsFrameBudget({ empty: fast, canvas: broken }), RangeError);
  }
  // Validate BOTH probes, even when the first already establishes a slow host.
  assert.throws(() => supportsFrameBudget({ empty: slow, canvas: {} }), RangeError);
});
