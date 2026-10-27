import assert from 'node:assert/strict';
import test from 'node:test';

import { parseSave, serializeSave } from '../js/save.js';
import { NIGHT_SECONDS, createState, step, summary } from '../js/sim.js';

test('live watch integrated with real step calls to mid-night on nights 1, 3, and 5 equals uninterrupted run through dawn', () => {
  const priorHistory = [
    { night: 1, safe: 5, wrecked: 1, unseen: 6, lost: 0, logged: 0, cumulativeWrecks: 1, relieved: false },
    { night: 2, safe: 4, wrecked: 0, unseen: 7, lost: 0, logged: 0, cumulativeWrecks: 1, relieved: false },
    { night: 3, safe: 5, wrecked: 1, unseen: 5, lost: 0, logged: 0, cumulativeWrecks: 2, relieved: false },
    { night: 4, safe: 4, wrecked: 0, unseen: 6, lost: 0, logged: 0, cumulativeWrecks: 2, relieved: false },
  ];

  // Scripted inputs from t = 0 to t = 270 s (real step integration only; no state.time writes).
  const preSaveScript = [
    [{ horn: true, hold: true }, 0.2],
    [{ fast: true }, 12],
    [{ slow: true }, 47.8],
    [{ lamp: true, hold: true }, 0.12],
    [{ hold: true }, 0.12],
    [{ lamp: true, hold: true }, 0.36],
    [{ fast: true }, 89.4],
    [{}, 119.9],
    [{ lamp: true, hold: true }, 0.1],
  ];

  // Scripted inputs from t = 270 s to dawn at t = 540 s with checkpoints at 300, 390, 480, and 540 s.
  const postSaveStages = [
    [
      [{ lamp: false, hold: true }, 0.2],
      [{ horn: true }, 0.2],
      [{ slow: true }, 29.6],
    ],
    [
      [{ fast: true }, 90],
    ],
    [
      [{ lamp: true, hold: true }, 0.12],
      [{ hold: false }, 89.88],
    ],
    [
      [{ fast: true }, 60],
    ],
  ];

  for (const night of [1, 3, 5]) {
    let uninterrupted = createState(108, { night });
    uninterrupted.run.mornings = structuredClone(priorHistory.slice(0, night - 1));
    uninterrupted.settings.incomingWpm = night === 3 ? 5 : 8;

    for (const [input, dt] of preSaveScript) {
      uninterrupted = step(uninterrupted, input, dt);
    }
    assert.ok(Math.abs(uninterrupted.time - 270) < 1e-9, `night ${night} mid-watch time ${uninterrupted.time}`);
    assert.equal(uninterrupted.phase, 'night');
    assert.equal(uninterrupted.lamp, true);
    assert.notEqual(uninterrupted.morse.down, null);

    let resumed = parseSave(serializeSave(uninterrupted));
    assert.notEqual(resumed, null);
    assert.equal(resumed.trawler, resumed.ships[0]);
    assert.deepEqual(resumed, uninterrupted);
    assert.deepEqual(summary(resumed), summary(uninterrupted));

    for (const stage of postSaveStages) {
      for (const [input, dt] of stage) {
        uninterrupted = step(uninterrupted, input, dt);
        resumed = step(resumed, input, dt);
      }
      assert.equal(resumed.trawler, resumed.ships[0]);
      assert.deepEqual(resumed, uninterrupted, `night ${night} checkpoint t=${uninterrupted.time}`);
      assert.deepEqual(summary(resumed), summary(uninterrupted), `night ${night} summary t=${uninterrupted.time}`);
    }
    assert.equal(resumed.time, NIGHT_SECONDS);
    assert.equal(resumed.phase, 'dawn');
  }
});
