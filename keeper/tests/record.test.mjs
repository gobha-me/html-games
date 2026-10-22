import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecord } from '../js/record.js';

test('fleet morning records round-trip while legacy one-ship records remain readable', () => {
  for (const record of [
    { version: 1, seed: 108, safe: 1, wrecked: 0 },
    { version: 2, seed: 108, safe: 1, wrecked: 2 },
    { version: 2, seed: 0xffffffff, safe: 4, wrecked: 0 },
  ]) assert.deepEqual(parseRecord(JSON.stringify(record)), record);
  for (const changes of [
    { version: 3 }, { safe: -1 }, { wrecked: 1.5 }, { safe: '1' },
    { safe: 0, wrecked: 0 }, { safe: Number.MAX_SAFE_INTEGER, wrecked: 1 },
    { version: 1, safe: 1, wrecked: 1 },
  ]) assert.equal(parseRecord(JSON.stringify({ version: 2, seed: 108, safe: 1, wrecked: 2, ...changes })), null);
});
