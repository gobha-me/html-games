import assert from 'node:assert/strict';
import test from 'node:test';
import { INVESTIGATIVE_ARCS } from '../js/config.js';
import { makeSim, story } from './helpers.mjs';

test('plating an arc out of order preserves the highest published part', () => {
  const sim = makeSim();
  const arc = INVESTIGATIVE_ARCS[0];
  const arcStory = (part) => story(`part_${part}`, { ...arc.parts[part - 1],
    arcId: arc.id, arcPart: part, arcTitle: arc.title });
  sim.scoopedStories.push(arcStory(3));
  sim.lockUp();
  assert.equal(sim.placeStory('part_3', 'banner').ok, true);
  assert.equal(sim.arcProgress[arc.id], 0, 'Plating alone does not unlock the next part');
  assert.equal(sim.calculateEditionProjection().seriesBonusReaders, 4500);
  sim.publishEdition();
  assert.equal(sim.arcProgress[arc.id], 3, 'Legacy progress records the highest published part');
  assert.equal(sim.editionSummary.cashDelta, 880);
  assert.equal(sim.editionSummary.circDelta, 12620);
  assert.equal(sim.editionSummary.heatDelta, 22, 'Finale reduces heat by 12');
  sim.step(0.05);
  sim.scoopedStories.push(arcStory(1));
  sim.lockUp();
  sim.placeStory('part_1', 'editorial');
  sim.publishEdition();
  assert.equal(sim.arcProgress[arc.id], 3, 'An older part cannot regress progress');
});

test('parts 1 and 2 get exact bonuses and unlock only after publication', () => {
  const sim = makeSim();
  const arc = INVESTIGATIVE_ARCS[0];
  for (const [part, cashBonus, readerBonus] of [[1, 60, 1200], [2, 110, 2500]]) {
    sim.frontPage.banner = story(`part_${part}`, { ...arc.parts[part - 1],
      arcId: arc.id, arcPart: part });
    const projection = sim.calculateEditionProjection();
    assert.equal(sim.arcProgress[arc.id], part - 1);
    assert.equal(projection.cashDelta, 110 + arc.parts[part - 1].baseValue * 2 + cashBonus);
    assert.equal(projection.seriesBonusReaders, readerBonus);
    sim.publishEdition();
    assert.equal(sim.arcProgress[arc.id], part);
    assert.equal(sim.editionSummary.cashDelta, projection.cashDelta);
    assert.equal(sim.editionSummary.circDelta, projection.circDelta);
    sim.step(0.05);
  }
});

test('arc spawning avoids duplicates on the map, in the queue and on the page', () => {
  const sim = makeSim();
  const arc = INVESTIGATIVE_ARCS[0];
  sim.leads = [];
  sim.arcRotation = 0;
  sim.scoopedStories.push(story('queued', { arcId: arc.id, arcPart: 1 }));
  const first = sim.spawnLead();
  assert.equal(first.arcId, INVESTIGATIVE_ARCS[1].id);
  const second = sim.spawnLead();
  assert.equal(second.arcId, INVESTIGATIVE_ARCS[2].id);
  const third = sim.spawnLead('nonexistent-district');
  assert.equal(third.arcId, null, 'Two active arcs force a standalone story');
  assert.equal(third.districtId, 'docks', 'Unknown districts use the first neutral district');
  sim.spawnLead();
  assert.equal(sim.spawnLead(), null, 'The map holds at most four leads');
  sim.leads = [];
  sim.lockUp();
  sim.placeStory('queued', 'banner');
  sim.arcRotation = 0;
  assert.notEqual(sim.spawnLead().arcId, arc.id, 'A plated unpublished part blocks another copy');
  sim.arcProgress = Object.fromEntries(INVESTIGATIVE_ARCS.map((a) => [a.id, 3]));
  sim.leads = [];
  assert.equal(sim.spawnLead().arcId, null, 'Completed arcs do not spawn part four');
});

test('a scoop cannot be completed twice or fabricate a nonexistent lead', () => {
  const sim = makeSim();
  const lead = sim.leads[0];
  sim.completeLeadScoop(lead);
  const hash = sim.getStateHash();
  assert.equal(sim.completeLeadScoop(lead), false);
  assert.equal(sim.completeLeadScoop({ ...lead, uid: 'missing' }), false);
  assert.equal(sim.getStateHash(), hash);
  assert.equal(sim.scoopsTotal, 1);
  assert.equal(Object.values(sim.frontPage).filter(Boolean).length, 0);
});

test('when all slots are full, scoops stay queued instead of displacing plates', () => {
  const sim = makeSim();
  for (const slot of Object.keys(sim.frontPage)) sim.frontPage[slot] = story(slot);
  const before = structuredClone(sim.frontPage);
  sim.completeLeadScoop(sim.leads[0]);
  assert.deepEqual(sim.frontPage, before);
  assert.equal(sim.scoopedStories.length, 1);
  assert.equal(sim.scoopsTotal, 1);
});
