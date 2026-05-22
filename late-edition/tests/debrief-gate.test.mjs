import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DebriefPanel, MIN_DEBRIEF_MS } from '../js/debrief-panel.js';

// 1.0.1 (ICD-06 v0.4 §Cycle timing · audit C-05) — renderer-side debrief gate.
// The 30 s minimum-elapsed clamp lives in DebriefPanel; World.ackDebrief is
// untouched and unguarded. These tests construct the panel with a fake
// clock + DOM stub so the gate logic can run in node without jsdom.

function makeMockEl() {
  const listeners = {};
  return {
    listeners,
    hidden: true,
    innerHTML: '',
    addEventListener(name, fn) { (listeners[name] ??= []).push(fn); },
    querySelector(_) {
      return { textContent: '', classList: { add() {}, remove() {} } };
    },
    dispatch(name, ev = {}) {
      for (const fn of listeners[name] ?? []) fn(ev);
    },
  };
}

function makeMockWorld() {
  const cycleSubs = [];
  return {
    cycleSubs,
    ackCount: 0,
    subscribeCycle(fn) { cycleSubs.push(fn); },
    ackDebrief() { this.ackCount += 1; },
  };
}

const SUMMARY = { edition: 5, stories_printed: [] };

test('MIN_DEBRIEF_MS exports as 30_000 (ICD-06 v0.4 §Cycle timing 30 s minimum)', () => {
  assert.equal(MIN_DEBRIEF_MS, 30_000);
});

test('click before MIN_DEBRIEF_MS does not ack', () => {
  let now = 1000;
  const root = makeMockEl();
  const world = makeMockWorld();
  new DebriefPanel(root, world, { clock: () => now });
  // Mount.
  world.cycleSubs[0]({ kind: 'EDITION_DEBRIEF_BEGIN', edition: 5, summary: SUMMARY });
  // Advance the fake clock by 1 second (under the 30 s gate).
  now += 1_000;
  root.dispatch('click');
  assert.equal(world.ackCount, 0);
  // Advance to just-under the gate (29.999 s).
  now += 28_999;
  root.dispatch('click');
  assert.equal(world.ackCount, 0);
});

test('click after MIN_DEBRIEF_MS acks World.ackDebrief', () => {
  let now = 1000;
  const root = makeMockEl();
  const world = makeMockWorld();
  new DebriefPanel(root, world, { clock: () => now });
  world.cycleSubs[0]({ kind: 'EDITION_DEBRIEF_BEGIN', edition: 5, summary: SUMMARY });
  now += MIN_DEBRIEF_MS;
  root.dispatch('click');
  assert.equal(world.ackCount, 1);
});

test('clicks pre-mount and post-unmount are silent no-ops', () => {
  let now = 1000;
  const root = makeMockEl();
  const world = makeMockWorld();
  new DebriefPanel(root, world, { clock: () => now });
  // No EDITION_DEBRIEF_BEGIN yet — the panel hasn't latched a mount time.
  root.dispatch('click');
  assert.equal(world.ackCount, 0);
  // Mount + ack.
  world.cycleSubs[0]({ kind: 'EDITION_DEBRIEF_BEGIN', edition: 5, summary: SUMMARY });
  now += MIN_DEBRIEF_MS + 100;
  root.dispatch('click');
  assert.equal(world.ackCount, 1);
  // Unmount via the cycle event the World would fire from ackDebrief.
  world.cycleSubs[0]({ kind: 'EDITION_DEBRIEF_END' });
  // A stray click after unmount is silent.
  root.dispatch('click');
  assert.equal(world.ackCount, 1);
});

test('repeated clicks past the gate ack only on each post-gate click (no auto-suppression)', () => {
  // The panel intentionally does not collapse repeat clicks — World.ackDebrief
  // is idempotent (it bails on !this.debriefOpen). The gate only filters
  // pre-window clicks; post-window clicks pass through every time.
  let now = 1000;
  const root = makeMockEl();
  const world = makeMockWorld();
  new DebriefPanel(root, world, { clock: () => now });
  world.cycleSubs[0]({ kind: 'EDITION_DEBRIEF_BEGIN', edition: 5, summary: SUMMARY });
  now += MIN_DEBRIEF_MS + 100;
  root.dispatch('click');
  root.dispatch('click');
  assert.equal(world.ackCount, 2);
});
