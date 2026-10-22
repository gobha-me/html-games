import assert from 'node:assert/strict';
import test from 'node:test';
import { makeSim, story } from './helpers.mjs';

test('run peak includes the initial readership and survives circulation losses', () => {
  const sim = makeSim({ storage: { readBest: () => 999999 } });
  assert.equal(sim.peakCirculation, 18400, 'Saved best belongs to a different run');
  sim.publishEdition();
  assert.equal(sim.circulation, 16600);
  assert.equal(sim.peakCirculation, 18400, 'A blank first edition cannot erase the initial peak');
  sim.editionSummary = null; // Continue from the now-frozen press report.
  sim.step(0.05);
  sim.frontPage.banner = story();
  sim.publishEdition();
  const peak = sim.circulation;
  assert.ok(peak > 18400);
  assert.equal(sim.peakCirculation, peak);
  sim.activeDilemma = { rejectEffect: { circulation: -3000, wire: 'Readers depart' } };
  sim.resolveDilemma(false);
  assert.equal(sim.peakCirculation, peak);
  sim.activeDilemma = { acceptEffect: { circulation: 10000, wire: 'New readers' } };
  sim.resolveDilemma(true);
  assert.equal(sim.peakCirculation, sim.circulation, 'Phone circulation counts too');
  sim.reset();
  assert.equal(sim.peakCirculation, 18400);
  assert.equal(sim.highCirculation, 999999, 'Restart preserves the saved record');
});

test('printed page is a snapshot, unchanged by later plating or rejected publication', () => {
  const sim = makeSim();
  assert.equal(sim.lastPrintedFrontPage, null);
  const copy = story();
  sim.frontPage.banner = copy;
  sim.publishEdition();
  const printed = structuredClone(sim.lastPrintedFrontPage);
  assert.equal(printed.banner.headline, copy.headline);
  assert.equal(sim.frontPage.banner, null);
  copy.headline = 'Mutated after printing';
  sim.frontPage.banner = story('replacement');
  assert.equal(sim.publishEdition(), false, 'Same-tick double publish is rejected');
  assert.deepEqual(sim.lastPrintedFrontPage, printed);
  sim.step(0.05);
  sim.gameOver = true;
  assert.equal(sim.publishEdition(), false, 'A folded paper cannot replace the final copy');
  assert.deepEqual(sim.lastPrintedFrontPage, printed);
  sim.reset();
  assert.equal(sim.lastPrintedFrontPage, null);
});
