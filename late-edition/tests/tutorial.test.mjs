import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentTutorialBeat, BEAT_COPY, TUTORIAL_BEATS } from '../js/sim/tutorial.js';

// 0.10.1 (audit G-09): diegetic tutorial beat derivation. Pure function of
// WorldFrame — no persistence, re-derives every frame, so save/load lands
// on the correct note.

const CYCLE_FULL_MS = 12 * 60 * 1000;

function makeFrame({ edition = 1, deadline_ms = CYCLE_FULL_MS, stories = 0, units = [] } = {}) {
  return {
    units,
    hud: {
      edition,
      deadline_ms,
      resources: { leads: 0, stories, ink: 20, cash: 0, heat: 0 },
    },
  };
}

test('every TUTORIAL_BEATS entry has copy', () => {
  for (const beat of TUTORIAL_BEATS) {
    assert.ok(typeof BEAT_COPY[beat] === 'string' && BEAT_COPY[beat].length > 0,
      `missing copy for beat ${beat}`);
  }
});

test("'send-reporter' on fresh edition 1 with no reporter carrying", () => {
  const frame = makeFrame({
    edition: 1,
    deadline_ms: CYCLE_FULL_MS,
    stories: 0,
    units: [{ kind: 'reporter', carrying: null }],
  });
  assert.equal(currentTutorialBeat(frame), 'send-reporter');
});

test("'send-reporter' beat-1 copy includes the control hint paren (couples G-09 ↔ G-07)", () => {
  assert.match(BEAT_COPY['send-reporter'], /WASD/);
  assert.match(BEAT_COPY['send-reporter'], /\[/);
  assert.match(BEAT_COPY['send-reporter'], /Space/);
});

test("'verify' when a reporter is carrying a lead", () => {
  const frame = makeFrame({
    edition: 1,
    units: [
      { kind: 'reporter', carrying: 'lead' },
      { kind: 'photog',   carrying: null },
    ],
  });
  assert.equal(currentTutorialBeat(frame), 'verify');
});

test("'verify' takes precedence over 'plate' when reporter actively carrying", () => {
  // A second story already verified at the darkroom + the reporter is still
  // carrying another lead → the active carry is the player's current verb.
  const frame = makeFrame({
    edition: 1,
    stories: 1,
    units: [{ kind: 'reporter', carrying: 'lead' }],
  });
  assert.equal(currentTutorialBeat(frame), 'verify');
});

test("'plate' when a verified story sits at the darkroom and no reporter carrying", () => {
  const frame = makeFrame({
    edition: 1,
    stories: 1,
    units: [{ kind: 'reporter', carrying: null }],
  });
  assert.equal(currentTutorialBeat(frame), 'plate');
});

test("'welcome' for the first 30 s of edition 2", () => {
  const frame = makeFrame({
    edition: 2,
    deadline_ms: CYCLE_FULL_MS - 10_000, // 10 s into edition 2
  });
  assert.equal(currentTutorialBeat(frame), 'welcome');
});

test('welcome window closes after 30 s', () => {
  const frame = makeFrame({
    edition: 2,
    deadline_ms: CYCLE_FULL_MS - 31_000, // 31 s into edition 2
  });
  assert.equal(currentTutorialBeat(frame), null);
});

test('null on edition 3 and beyond — tutorial done', () => {
  for (const edition of [3, 4, 10]) {
    const frame = makeFrame({ edition, deadline_ms: CYCLE_FULL_MS });
    assert.equal(currentTutorialBeat(frame), null, `edition ${edition} should be null`);
  }
});

test('non-reporter unit carrying does NOT trigger verify (only reporters scout)', () => {
  // A photog with carrying 'lead' is not a tutorial state we narrate — only
  // a reporter's pickup walks the player through the first edition spine.
  const frame = makeFrame({
    edition: 1,
    units: [{ kind: 'photog', carrying: 'lead' }],
  });
  assert.equal(currentTutorialBeat(frame), 'send-reporter');
});
