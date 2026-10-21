import assert from 'node:assert/strict';
import test from 'node:test';
import { LateEditionSim } from '../js/sim.js';
import { EDITION_DURATION_SEC, PASTE_UP_START_SEC } from '../js/config.js';
import { makeSim, story, parkOperatives } from './helpers.mjs';

function layout() {
  const sim = makeSim();
  assert.equal(sim.lockUp().ok, true);
  sim.scoopedStories.push(story('first'), story('second'), story('third'));
  return sim;
}

function rejectedUnchanged(sim, command, reason) {
  const before = sim.getStateHash();
  assert.deepEqual(command(), { ok: false, reason });
  assert.equal(sim.getStateHash(), before, 'Rejected actions must be atomic');
}

test('scoops stay unplaced, even with empty slots and photographic proof', () => {
  const sim = makeSim();
  const lead = sim.leads[0];
  lead.photoVerified = true;
  sim.completeLeadScoop(lead);
  assert.equal(sim.scoopedStories[0].uid, lead.uid);
  assert.ok(Object.values(sim.frontPage).every((story) => story === null));
});

test('11 PM enters paste-up, first-dispatch and opening gates cannot be bypassed', () => {
  const opening = new LateEditionSim();
  for (const command of [() => opening.lockUp(), () => opening.placeStory('missing', 'banner'),
    () => opening.unplace('missing'), () => opening.spike('missing'), () => opening.assistLayout()]) {
    const before = opening.getStateHash();
    assert.equal(command().ok, false);
    assert.equal(opening.getStateHash(), before);
  }
  opening.startNightShift();
  opening.finishColdOpen();
  assert.equal(opening.lockUp().ok, false);
  const sim = makeSim();
  sim.clockSec = PASTE_UP_START_SEC - 0.05;
  sim.step(0.025);
  assert.equal(sim.phase, 'desk');
  sim.step(0.05);
  assert.equal(sim.phase, 'paste-up');
  assert.equal(sim.dispatchOperativeToLead('rep_1', sim.leads[0].uid), false);
});

test('one story cannot occupy two slots; occupied slots reject copy without displacement', () => {
  const sim = layout();
  assert.deepEqual(sim.placeStory('first', 'banner'), { ok: true, reason: null });
  rejectedUnchanged(sim, () => sim.placeStory('first', 'above_fold'), 'already-placed');
  rejectedUnchanged(sim, () => sim.placeStory('first', 'inside'), 'already-placed');
  rejectedUnchanged(sim, () => sim.placeStory('second', 'banner'), 'slot-occupied');
  assert.equal(sim.frontPage.banner.uid, 'first');
  assert.deepEqual(sim.scoopedStories.map((s) => s.uid), ['second', 'third']);
  assert.equal(sim.unplace('first').ok, true);
  rejectedUnchanged(sim, () => sim.unplace('first'), 'not-placed');
  assert.equal(sim.placeStory('first', 'above_fold').ok, true);
});

test('unknown uid, unknown/prototype slot, and malformed slot never consume copy', () => {
  const sim = layout();
  for (const slot of ['missing', '__proto__', 'constructor', '', null, undefined, {}, 1]) {
    rejectedUnchanged(sim, () => sim.placeStory('first', slot), 'unknown-slot');
  }
  for (const uid of ['missing', null, undefined, {}, 1]) {
    rejectedUnchanged(sim, () => sim.placeStory(uid, 'banner'), 'unknown-story');
    rejectedUnchanged(sim, () => sim.spike(uid), 'unknown-story');
    rejectedUnchanged(sim, () => sim.unplace(uid), 'not-placed');
  }
});

test('SPIKE removes plated, buried and queued stories once; files persist across editions', () => {
  const sim = layout();
  sim.placeStory('first', 'banner');
  sim.placeStory('second', 'inside');
  for (const uid of ['first', 'second', 'third']) {
    assert.equal(sim.spike(uid).ok, true);
    rejectedUnchanged(sim, () => sim.spike(uid), 'unknown-story');
    rejectedUnchanged(sim, () => sim.placeStory(uid, 'banner'), 'unknown-story');
  }
  assert.equal(sim.frontPage.banner, null);
  assert.deepEqual(sim.insideStories, []);
  assert.deepEqual(sim.scoopedStories, []);
  assert.deepEqual(sim.spikedStories.map((s) => s.uid), ['first', 'second', 'third']);
  assert.equal(sim.calculateEditionProjection().platedCount, 0);
  sim.publishEdition();
  assert.equal(sim.spikedStories.length, 3);
  sim.reset();
  assert.deepEqual(sim.spikedStories, []);
});

test('Inside allows any count, reduces story and series value/heat/trust, and can be unplaced', () => {
  const sim = layout();
  for (const uid of ['first', 'second', 'third']) assert.equal(sim.placeStory(uid, 'inside').ok, true);
  assert.equal(sim.insideStories.length, 3);
  const projection = sim.calculateEditionProjection();
  assert.equal(projection.cashDelta, 110 + 3 * 41);
  assert.equal(projection.heatDelta, 9);
  assert.equal(projection.credDelta, 0, 'Three rounded quarter trust gains offset the empty banner');
  sim.unplace('second');
  assert.equal(sim.insideStories.length, 2);
  assert.equal(sim.scoopedStories[0].uid, 'second');
  sim.insideStories[0] = story('first', { arcId: 'red_hook', arcPart: 3 });
  const beforePrint = sim.calculateEditionProjection();
  assert.equal(beforePrint.seriesBonusReaders, 1125);
  sim.publishEdition();
  assert.equal(sim.arcProgress.red_hook, 3);
  for (const key of ['cashDelta', 'circDelta', 'credDelta', 'heatDelta']) assert.equal(sim.editionSummary[key], beforePrint[key]);
});

for (const tag of ['CRIME', 'GRAFT', 'SYNDICATE']) {
  test(`banner accusation (${tag}) adds 8 heat and respects case-insensitive tags`, () => {
    const sim = layout();
    sim.scoopedStories[0] = story('first', { beat: 'CITY', tags: [tag.toLowerCase()] });
    sim.placeStory('first', 'banner');
    assert.equal(sim.calculateEditionProjection().heatDelta, 26);
    sim.unplace('first');
    sim.scoopedStories.find((s) => s.uid === 'first').tags = ['city'];
    sim.placeStory('first', 'banner');
    assert.equal(sim.calculateEditionProjection().heatDelta, 18);
  });
}

test('empty banner publishes a wire stand-in and -6 trust even with other copy', () => {
  const sim = layout();
  sim.placeStory('first', 'above_fold');
  const projection = sim.calculateEditionProjection();
  assert.equal(projection.credDelta, 7 + 4 - 6);
  sim.publishEdition();
  assert.equal(sim.lastPrintedFrontPage.banner, null, 'Null banner renders the wire stand-in');
  assert.equal(sim.editionSummary.emptyBanner, true);
  assert.equal(sim.editionSummary.credDelta, projection.credDelta);
});

test('assist fills only empty slots, flags scoring once, retains manual copy and resets next night', () => {
  const sim = layout();
  sim.placeStory('first', 'banner');
  sim.scoopedStories.push(story('photo', { photoVerified: true, baseValue: 1000 }));
  const baseline = sim.getStateHash();
  assert.equal(sim.assistLayout().ok, true);
  assert.notEqual(sim.getStateHash(), baseline);
  assert.equal(sim.frontPage.banner.uid, 'first');
  assert.equal(sim.editionLayout.assisted, true);
  const assistedProjection = sim.calculateEditionProjection();
  sim.editionLayout.assisted = false;
  assert.equal(sim.calculateEditionProjection().circDelta - assistedProjection.circDelta, 500);
  sim.editionLayout.assisted = true;
  const hash = sim.getStateHash();
  sim.assistLayout();
  assert.equal(sim.getStateHash(), hash, 'Repeated assist is idempotent on a full page');
  sim.publishEdition();
  assert.equal(sim.editionSummary.assisted, true);
  assert.equal(sim.editionSummary.circDelta, assistedProjection.circDelta);
  assert.equal(sim.editionLayout.assisted, false);
});

test('deadline mid-drag prints only placed copy; the late drop cannot change either edition', () => {
  const sim = layout();
  parkOperatives(sim);
  sim.placeStory('first', 'banner');
  // A pointer drag holds only a UID in the UI. No speculative sim move is made.
  const dragging = 'second';
  sim.clockSec = EDITION_DURATION_SEC - 0.01;
  sim.step(0.05);
  assert.equal(sim.editionsPrinted, 1);
  assert.equal(sim.editionSummary.slottedCount, 1);
  assert.equal(sim.lastPrintedFrontPage.banner.uid, 'first');
  rejectedUnchanged(sim, () => sim.placeStory(dragging, 'above_fold'), 'layout-closed');
  assert.ok(sim.scoopedStories.some((s) => s.uid === dragging));
  assert.equal(sim.lastPrintedFrontPage.above_fold, null);
});

for (const gate of ['gameOver', 'deskTooSmall', 'deadline', 'summary']) {
  test(`all layout commands reject atomically behind ${gate}`, () => {
    const sim = layout();
    sim.placeStory('first', 'banner');
    if (gate === 'deadline') sim.clockSec = EDITION_DURATION_SEC;
    else if (gate === 'summary') sim.editionSummary = { edition: 1 };
    else sim[gate] = true;
    for (const command of [() => sim.placeStory('second', 'above_fold'), () => sim.spike('first'),
      () => sim.unplace('first'), () => sim.assistLayout()]) rejectedUnchanged(sim, command, 'layout-closed');
  });
}
