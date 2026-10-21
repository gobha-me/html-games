import assert from 'node:assert/strict';
import test from 'node:test';
import { mulberry32 } from '../js/rng.js';

test('mulberry32 matches a known sequence and wraps unsigned seeds', () => {
  const rng = mulberry32(1);
  assert.deepEqual(Array.from({ length: 5 }, () => rng.nextFloat()), [
    0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
    0.9810509674716741, 0.9683778982143849,
  ]);
  assert.equal(mulberry32(-1).nextFloat(), mulberry32(4294967295).nextFloat());
  assert.notEqual(mulberry32(1).nextFloat(), mulberry32(2).nextFloat());
});

test('integer and pick methods respect exclusive bounds and share the stream', () => {
  const rng = mulberry32(123);
  const reference = mulberry32(123);
  const choices = ['a', 'b', 'c'];
  const seen = new Set();
  for (let i = 0; i < 1000; i++) {
    const integer = rng.nextInt(-3, 4);
    seen.add(integer);
    assert.equal(integer, -3 + Math.floor(reference.nextFloat() * 7));
    assert.equal(rng.pick(choices), choices[Math.floor(reference.nextFloat() * choices.length)]);
  }
  assert.deepEqual([...seen].sort(), [-1, -2, -3, 0, 1, 2, 3].sort());
  assert.equal(rng.nextInt(5, 6), 5);
  assert.equal(rng.pick(['only']), 'only');
});

for (const seed of [NaN, Infinity, -Infinity, 1.5, '1', null, Number.MAX_SAFE_INTEGER + 1]) {
  test(`invalid seed ${String(seed)} is rejected`, () => {
    assert.throws(() => mulberry32(seed), RangeError);
  });
}

for (const bounds of [[0, 0], [2, 1], [NaN, 4], [0, Infinity], [-Infinity, 4],
  [0.5, 2], [0, 1.5], ['0', 2], [0, undefined],
  [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]]) {
  test(`invalid bounds ${String(bounds)} throw without consuming entropy`, () => {
    const rng = mulberry32(7);
    const before = rng.getState();
    assert.throws(() => rng.nextInt(...bounds), RangeError);
    assert.equal(rng.getState(), before);
  });
}

for (const array of [[], undefined, null, 'abc', { length: 1 }, new Set([1])]) {
  test(`invalid pick argument ${String(array)} throws without consuming entropy`, () => {
    const rng = mulberry32(7);
    const before = rng.getState();
    assert.throws(() => rng.pick(array), RangeError);
    assert.equal(rng.getState(), before);
  });
}
