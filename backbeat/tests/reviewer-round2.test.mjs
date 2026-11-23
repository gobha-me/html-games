import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTrackChart } from '../js/chart.js';
import { Game } from '../js/game.js';

// PR #149 FINDINGS round 2 provides these public-API acceptance examples.
// Fetch is the true external boundary; chart adaptation and gameplay are real.
const note = (time, lane = 0) => ({ time, lane, duration: 0 });

async function fetchedChart(t, count, difficulty) {
  const track = { id: 'round2-fixture', bpm: 120, duration: count + 4, chartUrl: 'round2.json' };
  const raw = { bpm: 120, notes: Array.from({ length: count }, (_, index) => note(index, index % 4)) };
  const original = structuredClone(raw);
  const fetch = t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, 'round2.json');
    return { ok: true, json: async () => raw };
  });
  const chart = await buildTrackChart(track, difficulty);
  assert.equal(fetch.mock.callCount(), 1);
  assert.deepEqual(raw, original, 'adaptation preserves the caller chart');
  return chart;
}

test('Encore keeps its complete later fill cadence and excludes fills during holds', async t => {
  const chart = await fetchedChart(t, 9, 'encore');
  const fills = chart.notes.filter(n => !Number.isInteger(n.time));
  assert.deepEqual(fills.map(n => n.time), [0.25, 4.25, 6.25, 8.25]);
  assert.ok(fills.every(n => n.duration === 0 && n.chord === false), 'fills stay single taps');
  const held = chart.notes.find(n => n.time === 2 && n.duration > 0);
  assert.ok(held, 'the time-2 hold makes hold exclusion nonvacuous');
  assert.ok(chart.notes.some(n => n.time > held.time + held.duration), 'the chart continues after the hold');
  for (const hold of chart.notes.filter(n => n.duration > 0)) {
    assert.ok(fills.every(fill => fill.time <= hold.time || fill.time >= hold.time + hold.duration),
      `no fill inside the hold beginning at ${hold.time}`);
  }
});

test('Tour leaves the time-32 downbeat hold free of a simultaneous chord partner', async t => {
  const chart = await fetchedChart(t, 33, 'tour');
  assert.deepEqual(chart.notes.filter(n => n.time === 32).map(n => [n.time, n.lane, n.duration, n.chord]),
    [[32, 0, 0.75, false]]);
});

test('enabling Auto-DJ after an early judged tap cannot create a hold or completion bonus', () => {
  const game = new Game({ notes: [note(1)] }, 'club');
  assert.equal(game.press(0, 0.9), 'good');
  assert.equal(game.score, 140);
  assert.equal(game.notes[0].judged, 'good');
  game.autoPlay = true;
  for (const time of [0.9, 1]) {
    game.update(time);
    assert.equal(game.score, 140, `tap score stays unchanged at ${time}`);
    assert.equal(game.tally.holds, 0, 'a tap has no hold ticks or completion bonus');
    assert.deepEqual(game.activeHolds, [null, null, null, null]);
    assert.equal(game.notes[0].holding, false);
    assert.equal(game.notes[0].holdCompleted, false);
    assert.equal(game.notes[0].judged, 'good');
  }
});
