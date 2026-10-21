import assert from 'node:assert/strict';
import test from 'node:test';
import { makeSim, story, enterDesk } from './helpers.mjs';

test('zero plated slots earn base sales and exact blank-page penalties', () => {
  const sim = makeSim();
  sim.scoopedStories.push(story());
  assert.deepEqual(sim.calculateEditionProjection(), {
    cashDelta: 110, circDelta: -1800, credDelta: -18, heatDelta: 0,
    platedCount: 0, seriesBonusReaders: 0,
  });
  assert.equal(sim.publishEdition(), true);
  assert.equal(sim.cash, 450);
  assert.equal(sim.circulation, 16600);
  assert.equal(sim.credibility, 56);
  assert.equal(sim.syndicateHeat, 22);
  assert.equal(sim.editionsPrinted, 1);
  assert.equal(sim.edition, 2);
  assert.equal(sim.clockSec, 0);
  assert.equal(sim.scoopedStories.length, 1, 'Unplated stories are retained');
  assert.deepEqual(sim.editionSummary, {
    edition: 1, reason: 'PRESS RUN COMPLETE', slottedCount: 0,
    assisted: false, emptyBanner: true, insideCount: 0,
    circDelta: -1800, cashDelta: 110, credDelta: -18, heatDelta: 0,
    totalCirculation: 16600, totalFunds: 450, credibility: 56, heat: 22,
  });
});

test('double publish in one tick is a complete no-op, even if summary is dismissed', () => {
  let sounds = 0;
  let writes = 0;
  const sim = makeSim({ audio: { pressRun: () => sounds++ },
    storage: { writeBest: () => writes++ } });
  sim.frontPage.banner = story();
  assert.equal(sim.publishEdition(), true);
  sim.editionSummary = null;
  const before = sim.getStateHash();
  const wire = structuredClone(sim.wireLog);
  assert.equal(sim.publishEdition(), false);
  assert.equal(sim.getStateHash(), before);
  assert.deepEqual(sim.wireLog, wire);
  assert.equal(sounds, 1);
  assert.equal(writes, 1);
  sim.step(0.05);
  assert.equal(sim.publishEdition(), true, 'Next tick can print normally');
  assert.equal(sim.editionsPrinted, 2);
  sim.reset();
  assert.equal(sim.publishEdition(), false, 'Reset returns to title');
  enterDesk(sim);
  assert.equal(sim.publishEdition(), true, 'First dispatch after reset clears the guard');
});

test('deadline publish and a manual publish in the same tick count once', () => {
  const sim = makeSim();
  sim.clockSec = 209.99;
  sim.step(0.05);
  const before = sim.getStateHash();
  assert.equal(sim.publishEdition(), false);
  assert.equal(sim.getStateHash(), before);
  assert.equal(sim.editionsPrinted, 1);
});

test('reentrant audio cannot publish another edition during the press run', () => {
  let nested;
  const sim = makeSim({ audio: { pressRun: () => { nested = sim.publishEdition(); } } });
  assert.equal(sim.publishEdition(), true);
  assert.equal(nested, false);
  assert.equal(sim.editionsPrinted, 1);
});

test('publishing replenishes a depleted map to three fresh leads', () => {
  const sim = makeSim();
  sim.leads = [];
  const firstNewUid = sim.nextLeadUid;
  sim.publishEdition();
  assert.equal(sim.leads.length, 3);
  assert.deepEqual(sim.leads.map((lead) => lead.uid),
    [0, 1, 2].map((offset) => `lead_${firstNewUid + offset}`));
});

test('canonical state includes the guard because it affects the next publish command', () => {
  const sim = makeSim();
  const hash = sim.getStateHash();
  sim.lastPublishedTime = sim.time;
  assert.notEqual(sim.getStateHash(), hash);
  assert.equal(sim.publishEdition(), false);
});

for (const [slot, photo, scooped, expectedCash] of [
  ['banner', false, false, 440], ['banner', false, true, 275],
  ['banner', true, true, 589], ['photo_expose', true, true, 598],
]) {
  test(`${slot}, photo=${photo}, rival=${scooped}: projection equals publication`, () => {
    const sim = makeSim();
    sim.frontPage[slot] = story('s', { photoVerified: photo, scoopedByRival: scooped });
    const projected = sim.calculateEditionProjection();
    assert.equal(projected.cashDelta, expectedCash);
    sim.publishEdition();
    for (const key of ['cashDelta', 'circDelta', 'credDelta', 'heatDelta']) {
      assert.equal(sim.editionSummary[key], projected[key]);
    }
    assert.ok(Object.values(sim.frontPage).every((value) => value === null));
  });
}
