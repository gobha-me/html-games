import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildTrackChart } from '../js/chart.js';
import { DIFFICULTY, TRACK_ROSTER, TOUR_VENUES } from '../js/config.js';
import { Game } from '../js/game.js';

const note = (time, lane = 0) => ({ time, lane, duration: 0 });

test('pressing an empty lane cannot hit a note in another lane or award score', () => {
  const game = new Game({ notes: [note(1, 1)] }, 'club');
  const callbacks = [];
  assert.equal(game.press(0, 1, (...args) => callbacks.push(args)), null);
  assert.equal(game.score, 0);
  assert.equal(game.combo, 0);
  assert.deepEqual(game.tally, { perfect: 0, good: 0, miss: 0, holds: 0 });
  assert.equal(game.notes[0].judged, null);
  assert.deepEqual(callbacks, []);
  assert.equal(game.press(1, 1), 'perfect');
  assert.equal(game.score, 350);
});

test('a closer note in another lane cannot displace the selected lane note', () => {
  const game = new Game({ notes: [note(1, 1), note(1.125, 0)] }, 'club');
  const callbacks = [];
  assert.equal(game.press(0, 1, (...args) => callbacks.push(args)), 'good');
  assert.equal(game.score, 140);
  assert.equal(game.notes[0].judged, null);
  assert.equal(game.notes[1].judged, 'good');
  assert.equal(game.notes[1].offsetMs, -125);
  assert.equal(callbacks.length, 1);
  assert.deepEqual(callbacks[0].slice(0, 3), [0, 'good', -125]);
  assert.equal(callbacks[0][3], game.notes[1]);
});

for (const [gap, duration] of [[0.5, 0], [0.75, 0.57], [1, 0.75]]) {
  test(`hold gap ${gap}s is unchanged after translating the chart away from zero`, async t => {
    const track = { id: 'translated-gap', bpm: 120, duration: 30, chartUrl: 'translated.json' };
    const shapes = [];
    for (const origin of [0, 4, 20]) {
      const raw = { bpm: 120, notes: [
        note(origin, 0), note(origin, 1), note(origin, 2), note(origin + gap, 3),
      ] };
      const fetch = t.mock.method(globalThis, 'fetch', async url => {
        assert.equal(url, track.chartUrl);
        return { ok: true, json: async () => raw };
      });
      const chart = await buildTrackChart(track, 'tour');
      fetch.mock.restore();
      const held = chart.notes.find(n => n.time === origin && n.lane === 2);
      assert.ok(held);
      assert.equal(held.duration, duration);
      assert.equal(held.chord, false);
      shapes.push(chart.notes.map(n => [n.time - origin, n.lane, n.duration, n.chord]));
    }
    assert.deepEqual(shapes[1], shapes[0]);
    assert.deepEqual(shapes[2], shapes[0]);
  });
}

test('the shipped anthem fetch preserves its sparse hold count and playable note count', async t => {
  const track = TRACK_ROSTER.find(item => item.id === 'anthem');
  assert.ok(track);
  const raw = JSON.parse(await readFile(new URL('../charts/backbeat-anthem.json', import.meta.url), 'utf8'));
  const original = structuredClone(raw);
  const fetch = t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, 'charts/backbeat-anthem.json');
    return { ok: true, json: async () => raw };
  });
  const chart = await buildTrackChart(track, 'tour');
  assert.equal(fetch.mock.callCount(), 1);
  // Reviewer independently reproduced main's 169 notes / one hold. This pins
  // shipped gameplay parity; hand-written translated fixtures above separately
  // establish why a dense gap must not become a hold at a later song time.
  assert.equal(chart.notes.length, 169);
  assert.equal(chart.notes.filter(n => n.duration > 0).length, 1);
  assert.deepEqual(raw, original);
});

test('the exported tour contains distinct stages with playable public references', () => {
  assert.ok(TOUR_VENUES.length > 0, 'a staged tour must contain at least one playable venue');
  assert.equal(new Set(TOUR_VENUES.map(venue => venue.id)).size, TOUR_VENUES.length);
  for (const venue of TOUR_VENUES) {
    assert.equal(typeof venue.id, 'string');
    assert.ok(venue.id.length > 0, 'each stage needs a nonempty public identifier');
    assert.ok(TRACK_ROSTER.some(track => track.id === venue.trackId));
    assert.ok(Object.hasOwn(DIFFICULTY, venue.diffId));
    assert.ok(Number.isFinite(venue.goalScore) && venue.goalScore > 0);
  }
});
