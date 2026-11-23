import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { DIFFICULTY, TRACK_ROSTER } from '../js/config.js';
import { buildTrackChart, generateProceduralChart } from '../js/chart.js';
import { Game } from '../js/game.js';
import { chartGoldenCases } from './chart-golden-79053cc.mjs';

const note = (time, lane = 0, duration = 0) => ({ time, lane, duration });
const chartTrack = { id: 'adapter-fixture', bpm: 120, duration: 4, chartUrl: 'fixture.json' };

function fetched(t, raw, track = chartTrack, difficulty = 'tour') {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => raw }));
  return buildTrackChart(track, difficulty);
}

for (const fixture of chartGoldenCases) {
  test(`shared chart parity: ${fixture.track}/${fixture.difficulty}/${fixture.seed || 'default'}`, () => {
    const track = TRACK_ROSTER.find(item => item.id === fixture.track);
    assert.ok(track, `shared track ID ${fixture.track} must remain resolvable`);
    const chart = generateProceduralChart(track, DIFFICULTY[fixture.difficulty], fixture.seed);
    const gameplay = {
      bpm: chart.bpm,
      offset: chart.offset,
      duration: chart.duration,
      notes: chart.notes.map(n => [n.time, n.lane, n.duration, n.chord]),
    };
    assert.equal(chart.notes.length, fixture.count);
    assert.equal(createHash('sha256').update(JSON.stringify(gameplay)).digest('hex'), fixture.sha256);
  });
}

test('adapter admits lane 3 and filters nonfinite times and out-of-range lanes', async t => {
  const chart = await fetched(t, { notes: [
    note(0, 3), note(NaN), note(Infinity), note(1, -1), note(2, 4),
  ] });
  assert.deepEqual(chart.notes.map(n => [n.time, n.lane]), [[0, 1], [0, 3]]);
  assert.ok(chart.notes.every(n => n.chord));
});

test('adapter accepts a missing notes list and keeps an empty chart at track duration', async t => {
  const chart = await fetched(t, {});
  assert.deepEqual(chart.notes, []);
  assert.equal(chart.duration, 4);
  assert.equal(chart.bpm, 120);
  assert.equal(chart.offset, 0);
});

for (const [gap, duration] of [[0.674, 0], [0.675, 0.495], [0.929, 0.749], [0.93, 0.75], [2, 0.75]]) {
  test(`adapter hold space ${gap}s produces ${duration}s sustain`, async t => {
    const chart = await fetched(t, { bpm: 120, notes: [note(0, 0), note(0, 1), note(0, 2), note(gap, 3)] });
    const held = chart.notes.find(n => n.time === 0 && n.lane === 2);
    assert.equal(held.duration, duration);
    assert.equal(held.chord, false);
  });
}

for (const [rawBpm, trackBpm, hold] of [[180, 120, 0.5], [undefined, 150, 0.6], [undefined, undefined, 0.75]]) {
  test(`adapter hold beat uses raw BPM ${rawBpm}, track BPM ${trackBpm}, then 120 fallback`, async t => {
    const chart = await fetched(t, { bpm: rawBpm, notes: [note(0, 0), note(0, 1), note(0, 2)] },
      { ...chartTrack, bpm: trackBpm });
    assert.equal(chart.notes.find(n => n.lane === 2).duration, hold);
    if (rawBpm || trackBpm) assert.equal(chart.bpm, rawBpm || trackBpm);
  });
}

for (const [gap, chord] of [[0.32, false], [0.321, true]]) {
  test(`adapter chord space ${gap}s is ${chord ? 'eligible' : 'too tight'}`, async t => {
    const chart = await fetched(t, { notes: [note(0, 3), note(gap, 0)] });
    const atStart = chart.notes.filter(n => n.time === 0);
    assert.equal(atStart.length, chord ? 2 : 1);
    assert.ok(atStart.every(n => n.chord === chord));
    if (chord) assert.deepEqual(atStart.map(n => n.lane), [1, 3]);
  });
}

for (const [difficulty, times] of [['tour', [0, 8]], ['hyperdrive', [0, 5, 10]]]) {
  test(`adapter ${difficulty} chords follow their downbeat cadence`, async t => {
    const chart = await fetched(t, { notes: Array.from({ length: 11 }, (_, i) => note(i, i % 4)) },
      chartTrack, difficulty);
    assert.deepEqual([...new Set(chart.notes.filter(n => n.chord).map(n => n.time))], times);
  });
}

for (const [gap, fill] of [[0.459, false], [0.46, true]]) {
  test(`Encore's half-beat fill requires gap ${gap}s`, async t => {
    const chart = await fetched(t, { bpm: 120, notes: [note(0, 0), note(gap, 3)] }, chartTrack, 'encore');
    assert.equal(chart.notes.some(n => n.time === 0.25 && n.lane === 1 && !n.chord), fill);
  });
}

test('adapter orders chord lanes and extends short tracks by three seconds rounded upward', async t => {
  const raw = { notes: [note(10.25, 3)] };
  const short = await fetched(t, raw, { ...chartTrack, duration: 1 });
  assert.deepEqual(short.notes.map(n => [n.time, n.lane]), [[10.25, 1], [10.25, 3]]);
  assert.equal(short.duration, 14);
  const long = await buildTrackChart({ ...chartTrack, duration: 30 });
  assert.equal(long.duration, 30);
});

test('unsuccessful HTTP response ignores its JSON body and uses the procedural fallback', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, json: async () => ({ notes: [note(999)] }) }));
  assert.deepEqual(await buildTrackChart(chartTrack), generateProceduralChart(chartTrack, DIFFICULTY.tour));
});

test('unknown synth genre uses the synthwave pattern without changing the seed identity', () => {
  const track = { ...TRACK_ROSTER[1], synthStyle: 'unknown-genre' };
  assert.deepEqual(generateProceduralChart(track, DIFFICULTY.tour, 'same'),
    generateProceduralChart({ ...track, synthStyle: 'synthwave' }, DIFFICULTY.tour, 'same'));
});

test('fresh game leaves every lane unheld and invalid press/release leaves the lane arrays untouched', () => {
  const game = new Game({ notes: [note(0)] });
  assert.deepEqual(game.laneHeld, [false, false, false, false]);
  assert.deepEqual(game.activeHolds, [null, null, null, null]);
  for (const lane of [-1, 4]) {
    assert.equal(game.press(lane, 0), null);
    game.release(lane, 0);
  }
  assert.deepEqual(Reflect.ownKeys(game.laneHeld), ['0', '1', '2', '3', 'length']);
  assert.deepEqual(game.laneHeld, [false, false, false, false]);
  assert.equal(game.score, 0);
});

test('press respects another lane, chooses nearest over last, and breaks equal-offset ties by chart order', () => {
  const game = new Game({ notes: [note(0, 0), note(0.0625, 1), note(0.125, 0)] }, 'club');
  game.press(0, 0.03125);
  assert.equal(game.notes[0].judged, 'perfect');
  assert.equal(game.notes[1].judged, null);
  assert.equal(game.notes[2].judged, null);
  const tie = new Game({ notes: [note(0), note(0.125)] }, 'club');
  tie.press(0, 0.0625);
  assert.equal(tie.notes[0].judged, 'perfect');
  assert.equal(tie.notes[1].judged, null);
});

test('press accepts exactly the good window in either timing direction but rejects beyond it', () => {
  for (const offset of [-0.12, 0.12]) {
    const game = new Game({ notes: [note(0)] }, 'tour');
    assert.equal(game.press(0, offset), 'good');
    assert.equal(game.notes[0].offsetMs, Math.round(offset * 1000));
  }
  for (const offset of [-0.120001, 0.120001]) {
    const game = new Game({ notes: [note(0)] }, 'tour');
    assert.equal(game.press(0, offset), null);
    assert.equal(game.notes[0].judged, null);
  }
});

test('tap notes never become active holds and misses store the actual difficulty window', () => {
  const game = new Game({ notes: [note(0), note(1)] }, 'encore');
  game.press(0, 0);
  assert.equal(game.notes[0].holding, false);
  assert.equal(game.activeHolds[0], null);
  game.update(2);
  assert.equal(game.notes[1].judged, 'miss');
  assert.equal(game.notes[1].offsetMs, 78);
  assert.equal(game.offsetCount, 1);
});

test('scaled hold tick cadence and natural/released completion award the same completion bonus', () => {
  for (const fever of [false, true]) {
    const game = new Game({ notes: [note(0, 2, 1)] }, 'encore');
    game.overdriveActive = fever;
    game.overdriveTimer = fever ? 5 : 0;
    game.press(2, 0);
    assert.equal(game.score, fever ? 1680 : 840);
    game.update(0.065);
    assert.equal(game.score, fever ? 1848 : 924);
    game.update(0.1);
    assert.equal(game.score, fever ? 1848 : 924);
    game.update(0.135);
    assert.equal(game.score, fever ? 2016 : 1008);
    game.update(1);
    assert.equal(game.score, fever ? 2592 : 1296);
    assert.equal(game.tally.holds, 3);
    const released = new Game({ notes: [note(0, 2, 1)] }, 'encore');
    released.overdriveActive = fever;
    released.press(2, 0);
    released.release(2, 1);
    assert.equal(released.score, fever ? 2256 : 1128);
    assert.equal(released.notes[0].holdCompleted, true);
  }
});

test('Overdrive expires at exact zero and inactive timers do not decay', () => {
  const game = new Game({ notes: [] });
  game.overdriveCharge = 100;
  game.activateOverdrive();
  game.overdriveTimer = 0.0625;
  game.update(0.0625);
  assert.equal(game.overdriveTimer, 0);
  assert.equal(game.overdriveActive, false);
  game.overdriveTimer = 2;
  game.update(0.125);
  assert.equal(game.overdriveTimer, 2);
});

test('Overdrive decays only forward elapsed time and caps a catch-up update at 100ms', () => {
  const game = new Game({ notes: [] });
  game.overdriveCharge = 100;
  game.activateOverdrive();
  game.update(0.0625);
  assert.equal(game.overdriveTimer, 7.4375);
  game.update(0.0625);
  assert.equal(game.overdriveTimer, 7.4375);
  game.update(0);
  assert.equal(game.overdriveTimer, 7.4375);
  game.update(1);
  assert.equal(game.overdriveTimer, 7.3375);
});

test('Auto-DJ leaves future notes and sub-full charge alone, then sustains an already-hit hold', () => {
  const game = new Game({ notes: [note(1, 1, 1), note(3, 2)] }, 'club');
  game.autoPlay = true;
  game.overdriveCharge = 50;
  const calls = [];
  game.update(0.9, (...args) => calls.push(args));
  assert.equal(game.notes[0].judged, null);
  assert.equal(game.notes[0].holding, false);
  assert.equal(game.activeHolds[1], null);
  assert.equal(game.laneHeld[1], false);
  assert.equal(game.overdriveActive, false);
  assert.equal(game.overdriveCharge, 50);
  game.update(1, (...args) => calls.push(args));
  assert.equal(calls.length, 1);
  assert.equal(game.laneHeld[1], true);
  assert.equal(game.activeHolds[1], game.notes[0]);
  // An input release followed by Auto-DJ's next frame should resume the hold.
  game.laneHeld[1] = false;
  game.update(1.07, (...args) => calls.push(args));
  assert.equal(calls.length, 1);
  assert.equal(game.laneHeld[1], true);
  assert.equal(game.notes[0].holding, true);
  assert.equal(game.score, 385);
  assert.equal(game.notes[1].judged, null);
});

test('a released hold is finished early, while an active hold finishes exactly at its end', () => {
  const early = new Game({ notes: [note(0, 0, 1)] }, 'club');
  early.press(0, 0);
  early.release(0, 0.1);
  assert.equal(early.checkFinished(5, 0.2), true);
  const held = new Game({ notes: [note(0, 0, 1)] }, 'club');
  held.press(0, 0);
  assert.equal(held.checkFinished(5, 0.999), false);
  assert.equal(held.checkFinished(5, 1), true);
});
