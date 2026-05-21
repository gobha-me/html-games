import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCORES_KEY,
  SCORES_VERSION,
  MAX_HIGH_SCORES,
  loadScores,
  saveScore,
} from '../js/sim/save.js';

// 0.10.0 (audit G-13): high-score persistence — separate blob from the run
// save. Lives at SCORES_KEY = 'late-edition.scores.v1' with a sorted, capped
// list. Read by the game-over overlay (js/game-over-overlay.js) to render
// rank + scoreboard. ICD-04 §Storage adds the key in the same PR.

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => map.has(k) ? map.get(k) : null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

test('loadScores returns an empty v1 blob when nothing has been written', () => {
  const storage = makeStorage();
  const blob = loadScores(storage);
  assert.equal(blob.version, SCORES_VERSION);
  assert.deepEqual(blob.scores, []);
});

test('loadScores tolerates malformed JSON without throwing', () => {
  const storage = makeStorage();
  storage.setItem(SCORES_KEY, '{not json}');
  const blob = loadScores(storage);
  assert.deepEqual(blob.scores, []);
});

test('loadScores rejects unknown-version blobs (returns empty)', () => {
  const storage = makeStorage();
  storage.setItem(SCORES_KEY, JSON.stringify({ version: 99, scores: [{ editions_survived: 5 }] }));
  const blob = loadScores(storage);
  assert.deepEqual(blob.scores, []);
});

test('saveScore appends the entry and returns its rank', () => {
  const storage = makeStorage();
  const { rank, blob } = saveScore({
    editions_survived: 3,
    total_revenue: 1200,
    ended_at_ms: 1_000,
    cause: 'game_over',
  }, storage);
  assert.equal(rank, 1);
  assert.equal(blob.scores.length, 1);
  // Round-trip via storage.
  const reload = loadScores(storage);
  assert.equal(reload.scores.length, 1);
  assert.equal(reload.scores[0].total_revenue, 1200);
});

test('saveScore sorts descending by editions_survived then total_revenue', () => {
  const storage = makeStorage();
  saveScore({ editions_survived: 2, total_revenue: 500,  ended_at_ms: 1, cause: 'game_over' }, storage);
  saveScore({ editions_survived: 5, total_revenue: 800,  ended_at_ms: 2, cause: 'game_over' }, storage);
  saveScore({ editions_survived: 5, total_revenue: 1500, ended_at_ms: 3, cause: 'game_over' }, storage);
  const blob = loadScores(storage);
  assert.deepEqual(blob.scores.map((e) => e.editions_survived), [5, 5, 2]);
  assert.deepEqual(blob.scores.map((e) => e.total_revenue), [1500, 800, 500]);
});

test('saveScore caps the list at MAX_HIGH_SCORES', () => {
  const storage = makeStorage();
  for (let i = 0; i < MAX_HIGH_SCORES + 5; i++) {
    saveScore({
      editions_survived: i,
      total_revenue: i * 100,
      ended_at_ms: i,
      cause: 'game_over',
    }, storage);
  }
  const blob = loadScores(storage);
  assert.equal(blob.scores.length, MAX_HIGH_SCORES);
  // The five lowest entries dropped off — top entry is the highest editions_survived.
  assert.equal(blob.scores[0].editions_survived, MAX_HIGH_SCORES + 4);
});

test('saveScore returned rank reflects the entry position after sort', () => {
  const storage = makeStorage();
  saveScore({ editions_survived: 10, total_revenue: 999, ended_at_ms: 1, cause: 'game_over' }, storage);
  const { rank } = saveScore({
    editions_survived: 4,
    total_revenue: 1000,
    ended_at_ms: 2,
    cause: 'game_over',
  }, storage);
  assert.equal(rank, 2);
});
