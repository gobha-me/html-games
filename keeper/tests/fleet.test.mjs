import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, summary, bearingTo } from '../js/sim.js';

const DT = 1 / 60;

test('unseen ships of every status are excluded from the dawn tally', () => {
  const ships = ['safe', 'wrecked', 'underway'].flatMap((status) =>
    [false, true].map((everSeen) => ({ status, everSeen })));
  assert.deepEqual(summary({ ships }), { safe: 1, wrecked: 1, unseen: 3 });
});

test('sightings latch only from beam or running lights, including wrecks', () => {
  let state = createState(); state.schedule = []; state.beam = 180;
  state.trawler.smuggler = true;
  state = step(state, { hold: true, horn: true }, DT);
  assert.equal(state.trawler.everSeen, false, 'hearing a rescue horn is not seeing');
  state.beam = bearingTo(state.trawler);
  state = step(state, { hold: true }, DT);
  assert.equal(state.trawler.everSeen, true);
  state.beam = 180;
  state = step(state, { hold: true }, 3);
  assert.equal(state.trawler.afterimage, 0);
  assert.equal(state.trawler.everSeen, true);

  state = createState(); state.schedule = []; state.beam = 180;
  state.trawler.x = 100; state.trawler.y = 0;
  state = step(state, { hold: true }, DT);
  assert.equal(state.trawler.everSeen, true, 'running lights without a hull count');
});

test('outbound ship can physically pass safely without ever becoming visible', () => {
  let state = createState(); state.schedule = []; state.beam = 180;
  Object.assign(state.trawler, { x: 480, y: 0, heading: 90, smuggler: true });
  state = step(state, { hold: true }, 180);
  assert.equal(state.trawler.status, 'safe');
  assert.equal(state.trawler.everSeen, false);
  assert.deepEqual(summary(state), { safe: 0, wrecked: 0, unseen: 1 });
});
