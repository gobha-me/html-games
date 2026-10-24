import test from 'node:test';
import assert from 'node:assert/strict';
import { encode, decodeLetter, decodeKeying, keyingFor, parseMessage } from '../js/morse.js';
import { RECORD_KEY, parseRecord } from '../js/record.js';

test('Morse input errors distinguish invalid text, letter codes, timing and incoming speed', () => {
  for (const input of ['', '   ', 'SOS!', null, 123]) {
    assert.throws(() => encode(input), { name: 'RangeError', message: 'Expected nonempty letters, digits and spaces' });
  }
  assert.throws(() => decodeLetter(null), { name: 'TypeError', message: 'Expected a Morse string' });
  for (const [events, initialUnit] of [[null, 125], [[], 0], [[], -1], [[], Infinity]]) {
    assert.throws(() => decodeKeying(events, { initialUnit }), {
      name: 'RangeError', message: 'Expected events and a positive finite dot unit',
    });
  }
  for (const events of [
    [null], [{ down: 0, up: 0 }], [{ down: -1, up: 1 }], [{ down: 0, up: Infinity }],
    [{ down: 0, up: 100 }, { down: 100, up: 200 }],
    [{ down: 100, up: 200 }, { down: 0, up: 50 }],
  ]) {
    assert.throws(() => decodeKeying(events), {
      name: 'RangeError', message: 'Keying events must be finite, positive-length, sorted and separate',
    });
  }
  for (const wpm of [0, 5.001, 7, 9, '8', null]) {
    assert.throws(() => keyingFor('SOS', wpm), { name: 'RangeError', message: 'Incoming speed must be 5 or 8 WPM' });
  }
});

test('STEER is a complete command: neither prefixes nor suffixes are accepted', () => {
  for (const dir of ['N', 'S', 'E', 'W']) {
    assert.deepEqual(parseMessage(`  STEER\t${dir}\n`), { type: 'STEER', dir });
    for (const text of [`SOS STEER ${dir}`, `XSTEER ${dir}`, `STEER ${dir} SOS`, `STEER ${dir}X`]) {
      assert.equal(parseMessage(text), null, text);
    }
  }
  assert.equal(parseMessage('STEER NE'), null);
});

test('record identity and uint32 endpoints retain zero seeds and both safe/wrecked outcomes', () => {
  assert.equal(RECORD_KEY, 'keeper.record.v1');
  for (const seed of [0, 0xffffffff]) {
    for (const [safe, wrecked] of [[1, 0], [0, 1]]) {
      const record = { version: 1, seed, safe, wrecked };
      assert.deepEqual(parseRecord(JSON.stringify(record)), record);
    }
  }
  const empty = { version: 2, seed: 0, safe: 0, wrecked: 0 };
  assert.deepEqual(parseRecord(JSON.stringify(empty)), empty);
  const fleet = { version: 2, seed: 108, safe: 2, wrecked: 1 };
  assert.deepEqual(parseRecord(JSON.stringify(fleet)), fleet);
  for (const [safe, wrecked] of [[2, 1], [0, 0], [1, 1]]) {
    assert.equal(parseRecord(JSON.stringify({ version: 1, seed: 0, safe, wrecked })), null);
  }
  assert.equal(parseRecord(JSON.stringify({ ...fleet, safe: Number.MAX_SAFE_INTEGER, wrecked: 1 })), null);
  for (const seed of [-1, 0x100000000, 0.5]) assert.equal(parseRecord(JSON.stringify({ ...fleet, seed })), null);
  assert.equal(parseRecord('null'), null);
});
