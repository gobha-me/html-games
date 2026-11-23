import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIFFICULTY, LANE_KEYS, LANE_ALT_KEYS, LANES, TRACK_ROSTER, TOUR_VENUES,
  computeLetterGrade, judgeOffset,
} from '../js/config.js';
import { Game } from '../js/game.js';
import { buildTrackChart, generateProceduralChart } from '../js/chart.js';

const note = (time = 1, lane = 0, duration = 0) => ({ time, lane, duration });
const makeGame = (notes = [note()], difficulty = 'club', extra = {}) =>
  new Game({ notes, ...extra }, difficulty);

for (const [id, perfect, good] of [
  ['club', 85, 155], ['tour', 60, 120], ['hyperdrive', 45, 95], ['encore', 34, 78],
]) {
  test(`${id} judgement windows include their boundaries`, () => {
    assert.equal(judgeOffset(0, id), 'perfect');
    assert.equal(judgeOffset(perfect, id), 'perfect');
    assert.equal(judgeOffset(perfect + 0.001, id), 'good');
    assert.equal(judgeOffset(good, id), 'good');
    assert.equal(judgeOffset(good + 0.001, id), null);
  });
}

test('difficulty aliases and unknown identifiers preserve normal judgement behavior', () => {
  assert.equal(DIFFICULTY.easy, DIFFICULTY.club);
  assert.equal(DIFFICULTY.normal, DIFFICULTY.tour);
  assert.equal(DIFFICULTY.hard, DIFFICULTY.hyperdrive);
  assert.equal(judgeOffset(60, 'unknown'), 'perfect');
  assert.equal(judgeOffset(61, 'unknown'), 'good');
  assert.equal(judgeOffset(121, 'unknown'), null);
  const game = makeGame([note(0)], 'unknown');
  assert.equal(game.press(0, 0), 'perfect');
  assert.equal(game.score, 438);
});

test('letter grades change exactly at the public accuracy thresholds', () => {
  for (const [accuracy, grade] of [
    [0, 'C'], [71.999, 'C'], [72, 'B'], [83.999, 'B'], [84, 'A'],
    [91.999, 'A'], [92, 'S'], [96.999, 'S'], [97, 'S+'], [100, 'S+'],
  ]) assert.equal(computeLetterGrade(accuracy).grade, grade);
});

test('lane maps and tour stages reference supported lanes, tracks and difficulties', () => {
  assert.equal(LANES, 4);
  assert.deepEqual(LANE_KEYS, ['KeyD', 'KeyF', 'KeyJ', 'KeyK']);
  assert.deepEqual(LANE_ALT_KEYS, ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight']);
  assert.equal(new Set(TRACK_ROSTER.map(track => track.id)).size, TRACK_ROSTER.length);
  for (const venue of TOUR_VENUES) {
    assert.ok(TRACK_ROSTER.some(track => track.id === venue.trackId));
    assert.ok(DIFFICULTY[venue.diffId]);
    assert.ok(venue.goalScore > 0);
  }
});

test('constructor copies note state and combines chart/audio calibration offsets', () => {
  const chart = Object.freeze({
    offset: 0.125,
    notes: Object.freeze([Object.freeze({ time: 1, lane: 2, duration: 0.5, chord: true })]),
  });
  const game = new Game(chart, 'club', 25);
  assert.ok(Math.abs(game.now(1.15) - 1) < 1e-12);
  assert.equal(game.press(2, 1.15), 'perfect');
  assert.equal(game.notes[0].holding, true);
  assert.equal(chart.notes[0].judged, undefined);
  assert.equal(chart.notes[0].duration, 0.5);
  const other = new Game(chart);
  assert.equal(other.notes[0].judged, null);
  assert.equal(other.notes[0].holding, false);
  assert.equal(new Game({}).notes.length, 0);
});

test('press chooses the closest unjudged note in the selected lane and reports signed timing', () => {
  const game = makeGame([note(1, 0), note(1.05, 1), note(1.1, 0)]);
  const callbacks = [];
  assert.equal(game.press(0, 1.09, (...args) => callbacks.push(args)), 'perfect');
  assert.equal(game.notes[0].judged, null);
  assert.equal(game.notes[1].judged, null);
  assert.equal(game.notes[2].judged, 'perfect');
  assert.equal(game.notes[2].offsetMs, -10);
  assert.equal(game.notes[2].hitTime, 1.09);
  assert.equal(callbacks.length, 1);
  assert.deepEqual(callbacks[0].slice(0, 3), [0, 'perfect', -10]);
  assert.equal(callbacks[0][3], game.notes[2]);
  assert.equal(game.lastJudgement.lane, 0);
  assert.equal(game.lastJudgement.offsetMs, -10);
  assert.ok(Number.isFinite(game.lastJudgement.at));
  game.press(1, 1.06);
  assert.equal(game.getMeanOffsetMs(), 0);
});

test('press rejects invalid lanes, distant notes, repeats and finished games without scoring', () => {
  const game = makeGame([note(0)]);
  for (const lane of [-1, 4]) assert.equal(game.press(lane, 0), null);
  assert.equal(game.press(0, -1), null);
  assert.equal(game.score, 0);
  assert.equal(game.press(0, 0.1), 'good');
  assert.equal(game.score, 140);
  assert.equal(game.press(0, 0.1), null);
  assert.equal(game.score, 140);
  const finished = makeGame();
  finished.finished = true;
  assert.equal(finished.press(0, 1), null);
  assert.equal(finished.laneHeld[0], false);
  finished.update(100);
  assert.equal(finished.notes[0].judged, null);
});

test('perfect and good hits accumulate weighted accuracy, combo, timing and score', () => {
  const game = makeGame([note(1), note(2), note(3)]);
  assert.equal(game.getAccuracy(), 100);
  assert.equal(game.getMeanOffsetMs(), 0);
  game.press(0, 1.02);
  game.press(0, 2.1);
  game.update(4);
  assert.deepEqual(game.tally, { perfect: 1, good: 1, miss: 1, holds: 0 });
  assert.equal(game.score, 490);
  assert.equal(game.combo, 0);
  assert.equal(game.maxCombo, 2);
  assert.equal(game.getAccuracy(), 51.7);
  assert.equal(game.getMeanOffsetMs(), 60);
  assert.equal(game.lastOffsetMs, 100);
  assert.equal(game.getGradeInfo().grade, 'C');
  assert.deepEqual(game.results(), {
    score: 490, maxCombo: 2, accuracy: 51.7, grade: 'C', gradeColor: '#ff4d6d',
    perfect: 1, good: 1, holds: 0, miss: 1, meanOffsetMs: 60,
  });
});

test('combo bonus begins on the tenth hit and caps at four times base score', () => {
  const game = makeGame(Array.from({ length: 122 }, (_, index) => note(index)));
  for (let i = 0; i < 9; i++) game.press(0, i);
  assert.equal(game.score, 3150);
  game.press(0, 9);
  assert.equal(game.score, 3588);
  for (let i = 10; i < 120; i++) game.press(0, i);
  const before = game.score;
  game.press(0, 120);
  game.press(0, 121);
  assert.equal(game.score - before, 2800);
  assert.equal(game.maxCombo, 122);
  assert.equal(game.overdriveCharge, 100);
});

test('misses occur strictly after the good window and do not count as timing observations', () => {
  const game = makeGame([note(0), note(1)], 'tour');
  const calls = [];
  game.update(0.12, (...args) => calls.push(args));
  assert.equal(game.notes[0].judged, null);
  game.update(0.121, (...args) => calls.push(args));
  assert.equal(game.notes[0].judged, 'miss');
  assert.equal(game.notes[1].judged, null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 0);
  assert.equal(calls[0][1], 'miss');
  assert.equal(calls[0][3], game.notes[0]);
  assert.equal(game.getMeanOffsetMs(), 0);
  assert.equal(game.getAccuracy(), 0);
  assert.equal(game.overdriveCharge, 0);
});

test('simultaneous chords score each lane independently', () => {
  const game = makeGame([note(1, 0), note(1, 2)]);
  game.press(0, 1);
  game.press(2, 1);
  assert.equal(game.score, 700);
  assert.equal(game.combo, 2);
  assert.equal(game.tally.perfect, 2);
  assert.equal(game.checkFinished(10, 1), true);
});

test('hold ticks start at 65 ms, complete once, and release cannot award twice', () => {
  const game = makeGame([note(1, 0, 1)]);
  game.press(0, 1);
  game.update(1.064);
  assert.equal(game.score, 350);
  game.update(1.065);
  assert.equal(game.score, 385);
  assert.equal(game.tally.holds, 1);
  assert.equal(game.checkFinished(10, 1.5), false);
  game.update(2);
  assert.equal(game.score, 505);
  assert.equal(game.tally.holds, 2);
  assert.equal(game.notes[0].holdCompleted, true);
  assert.equal(game.notes[0].holding, false);
  assert.equal(game.activeHolds[0], null);
  game.release(0, 2);
  game.update(2.1);
  assert.equal(game.score, 505);
  assert.equal(game.checkFinished(10, 2), true);
});

test('early release ends a hold without a completion bonus; near-end release earns it', () => {
  const early = makeGame([note(0, 0, 1)]);
  early.press(0, 0);
  early.release(0, 0.5);
  early.update(2);
  assert.equal(early.score, 350);
  assert.equal(early.notes[0].holdCompleted, false);
  assert.equal(early.notes[0].holding, false);
  assert.equal(early.activeHolds[0], null);
  assert.equal(early.laneHeld[0], false);
  const nearEnd = makeGame([note(0, 0, 1)]);
  nearEnd.press(0, 0);
  nearEnd.release(0, 0.845);
  assert.equal(nearEnd.score, 470);
  assert.equal(nearEnd.tally.holds, 1);
  assert.equal(nearEnd.notes[0].holdCompleted, true);
  nearEnd.release(0, 1);
  nearEnd.release(-1, 1);
  nearEnd.release(4, 1);
  assert.equal(nearEnd.score, 470);
});

test('Overdrive requires 50 charge, scales its timer and doubles note/hold scores', () => {
  const game = makeGame([note(0, 0, 1)]);
  game.overdriveCharge = 49.9;
  assert.equal(game.activateOverdrive(), false);
  game.overdriveCharge = 50;
  assert.equal(game.activateOverdrive(), true);
  assert.equal(game.overdriveTimer, 3.75);
  assert.equal(game.overdriveCharge, 0);
  assert.equal(game.activateOverdrive(), false);
  game.press(0, 0);
  assert.equal(game.score, 700);
  assert.equal(game.overdriveCharge, 0);
  game.update(0.07);
  assert.equal(game.score, 770);
  game.release(0, 0.9);
  assert.equal(game.score, 1010);
  game.overdriveTimer = 0.01;
  game.update(0.09);
  assert.equal(game.overdriveActive, false);
  assert.equal(game.overdriveTimer, 0);
});

test('good hits charge Overdrive by 2.5 and perfect hits by 4.5, capped at 100', () => {
  const game = makeGame([note(0), note(1), note(2)]);
  game.press(0, 0.1);
  assert.equal(game.overdriveCharge, 2.5);
  game.press(0, 1);
  assert.equal(game.overdriveCharge, 7);
  game.overdriveCharge = 99;
  game.press(0, 2);
  assert.equal(game.overdriveCharge, 100);
});

for (const [difficulty, perfectScore, goodScore] of [
  ['club', 350, 140], ['tour', 438, 175], ['hyperdrive', 525, 210], ['encore', 840, 336],
]) {
  test(`${difficulty} multiplies and rounds perfect/good base scores`, () => {
    const game = makeGame([note(0), note(1)], difficulty);
    game.press(0, 0);
    assert.equal(game.score, perfectScore);
    game.press(0, 1 + (DIFFICULTY[difficulty].perfect + 5) / 1000);
    assert.equal(game.score, perfectScore + goodScore);
    assert.deepEqual(game.tally, { perfect: 1, good: 1, miss: 0, holds: 0 });
  });
}

test('Auto-DJ activates a full Overdrive meter after on-beat input', () => {
  const game = makeGame([note(1)]);
  game.autoPlay = true;
  game.overdriveCharge = 99;
  game.update(1);
  assert.equal(game.score, 350);
  assert.equal(game.overdriveActive, true);
  assert.equal(game.overdriveCharge, 0);
  assert.equal(game.overdriveTimer, 7.5);
});

test('Auto-DJ hits on-beat chords and sustains holds without manual input', () => {
  const game = makeGame([note(1, 0, 0.5), note(1, 2), note(2, 1)]);
  const callbacks = [];
  game.autoPlay = true;
  game.update(1, (...args) => callbacks.push(args));
  assert.equal(game.tally.perfect, 2);
  assert.equal(game.laneHeld[2], false);
  assert.equal(game.activeHolds[0], game.notes[0]);
  game.update(1.1);
  game.update(1.5);
  assert.equal(game.notes[0].holdCompleted, true);
  assert.equal(game.laneHeld[0], false);
  game.update(2, (...args) => callbacks.push(args));
  assert.equal(game.getAccuracy(), 100);
  assert.equal(game.tally.miss, 0);
  assert.equal(callbacks.length, 3);
  assert.equal(game.checkFinished(5, 2), true);
});

test('finished status includes end padding, is sticky and accepts an empty chart', () => {
  const game = makeGame([note(100)]);
  assert.equal(game.checkFinished(10, 10.6), false);
  assert.equal(game.checkFinished(10, 10.601), true);
  assert.equal(game.checkFinished(100, 0), true);
  assert.equal(makeGame([]).checkFinished(10, 0), true);
});

for (const track of TRACK_ROSTER) for (const diffId of ['club', 'tour', 'hyperdrive', 'encore']) {
  test(`${track.id}/${diffId} generated chart is repeatable, ordered and playable`, () => {
    const frozenTrack = Object.freeze({ ...track });
    const diff = Object.freeze({ ...DIFFICULTY[diffId] });
    const chart = generateProceduralChart(frozenTrack, diff, 'test-seed');
    assert.deepEqual(chart, generateProceduralChart(frozenTrack, diff, 'test-seed'));
    assert.notDeepEqual(chart.notes, generateProceduralChart(frozenTrack, diff, 'other-seed').notes);
    assert.ok(chart.notes.length > 0);
    assert.equal(chart.duration, track.duration);
    assert.equal(chart.bpm, track.bpm);
    assert.equal(new Set(chart.notes.map(n => n.id)).size, chart.notes.length);
    const ends = [0, 0, 0, 0];
    for (let index = 0; index < chart.notes.length; index++) {
      const n = chart.notes[index];
      assert.ok(Number.isInteger(n.lane) && n.lane >= 0 && n.lane < 4);
      assert.ok(Number.isFinite(n.time) && n.time >= 0 && n.time < track.duration);
      assert.ok(n.duration >= 0 && n.time + n.duration < track.duration);
      assert.ok(n.time >= ends[n.lane], 'same-lane hold must end before the next note');
      ends[n.lane] = n.time + n.duration;
      if (index > 0) assert.ok(n.time >= chart.notes[index - 1].time);
      if (diffId === 'club') assert.equal(n.chord, false);
      if (n.chord) assert.ok(chart.notes.some(other => other !== n && other.time === n.time && other.lane !== n.lane));
    }
    assert.equal(JSON.stringify(frozenTrack), JSON.stringify(track));
  });
}

test('chart adapter filters invalid records, orders notes, preserves inputs and adds musical features', async t => {
  const raw = { bpm: 120, offset: '0.02', notes: [
    { time: 3, lane: 2 }, { time: 1, lane: 0 }, { time: 2, lane: 1 },
    { time: 'bad', lane: 0 }, { time: 4, lane: 4 },
  ] };
  const snapshot = structuredClone(raw);
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, 'fake-chart.json');
    return { ok: true, json: async () => raw };
  });
  const track = { ...TRACK_ROSTER[0], chartUrl: 'fake-chart.json' };
  const chart = await buildTrackChart(track, 'tour');
  assert.deepEqual(raw, snapshot);
  assert.equal(chart.offset, 0.02);
  assert.deepEqual(chart.notes.map(n => [n.time, n.lane]), [[1, 0], [1, 2], [2, 1], [3, 2]]);
  assert.equal(chart.notes[0].chord, true);
  assert.equal(chart.notes[1].chord, true);
  assert.equal(chart.notes[3].duration, 0.75);
  assert.equal(chart.title, track.title);
});

test('offline/error chart fetch falls back to the same procedural chart, while custom seeds bypass fetch', async t => {
  const track = { ...TRACK_ROSTER[1], chartUrl: 'unavailable.json' };
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  assert.deepEqual(await buildTrackChart(track, 'tour'), generateProceduralChart(track, DIFFICULTY.tour));
  fetch.mock.mockImplementation(async () => ({ ok: false }));
  assert.deepEqual(await buildTrackChart(track, 'unknown'), generateProceduralChart(track, DIFFICULTY.tour));
  const calls = fetch.mock.callCount();
  assert.deepEqual(await buildTrackChart(track, 'tour', 'custom'), generateProceduralChart(track, DIFFICULTY.tour, 'custom'));
  assert.equal(fetch.mock.callCount(), calls);
});

test('Encore adds half-beat fills and Club removes dense notes from a fetched chart', async t => {
  const raw = { bpm: 120, notes: [note(1, 0), note(2, 1), note(3, 2)] };
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => raw }));
  const track = { ...TRACK_ROSTER[0], chartUrl: 'local.json' };
  const encore = await buildTrackChart(track, 'encore');
  assert.ok(encore.notes.some(n => n.time === 1.25 && n.lane === 1 && n.duration === 0));
  const club = await buildTrackChart(track, 'club');
  assert.deepEqual(club.notes.map(n => n.time), [1, 3]);
  assert.ok(club.notes.every(n => !n.chord));
});

test('hold tick score should depend on elapsed audio time rather than update frequency', {
  skip: process.env.BACKBEAT_RUN_KNOWN_BUGS !== '1' &&
    'Finding: update awards at most one overdue hold tick per call, so lower frame rates lose hold score.',
}, () => {
  const frequent = makeGame([note(0, 0, 1)]);
  const sparse = makeGame([note(0, 0, 1)]);
  frequent.press(0, 0);
  sparse.press(0, 0);
  for (let milliseconds = 70; milliseconds <= 980; milliseconds += 70) frequent.update(milliseconds / 1000);
  sparse.update(0.98);
  frequent.update(1);
  sparse.update(1);
  assert.equal(sparse.score, frequent.score);
});
