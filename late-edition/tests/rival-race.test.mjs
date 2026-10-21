import assert from 'node:assert/strict';
import test from 'node:test';
import { makeSim, rival, parkOperatives, arrive } from './helpers.mjs';

test('simultaneous completion gives the player the scoop before rival processing', () => {
  const sim = makeSim();
  parkOperatives(sim);
  const lead = sim.leads[0];
  lead.progress = 99;
  lead.rivalProgress = 99.5;
  sim.dispatchOperativeToLead('rep_1', lead.uid);
  arrive(sim.operatives[0]);
  sim.rivals.push(rival({ x: lead.x, y: lead.y, targetLeadId: lead.uid }));
  const rivalCirculation = sim.rivalStandings[0].circulation;
  sim.step(0.05);
  assert.equal(sim.scoopsTotal, 1);
  assert.equal(sim.frontPage.banner.uid, lead.uid);
  assert.equal(sim.frontPage.banner.scoopedByRival, false);
  assert.equal(sim.rivalStandings[0].circulation, rivalCirculation);
  assert.ok(!sim.leads.some((l) => l.uid === lead.uid));
  assert.equal(sim.rivals[0].targetLeadId, sim.leads[0].uid, 'Rival retargets a remaining lead');
});

test('rival-first contested lead remains available with a half-value flag', () => {
  const sim = makeSim();
  parkOperatives(sim);
  const lead = sim.leads[0];
  lead.progress = 20;
  lead.rivalProgress = 99.5;
  sim.rivals.push(rival({ x: lead.x, y: lead.y, targetLeadId: lead.uid }));
  const circulation = sim.rivalStandings[0].circulation;
  sim.step(0.05);
  assert.equal(lead.scoopedByRival, true);
  assert.equal(lead.rivalProgress, 100);
  assert.ok(sim.leads.includes(lead));
  assert.equal(sim.rivalStandings[0].circulation, circulation + 1400);
  assert.equal(sim.rivals.length, 0);
  sim.completeLeadScoop(lead);
  assert.equal(sim.frontPage.banner.scoopedByRival, true);
  assert.equal(sim.calculateEditionProjection().cashDelta, 110 + Math.round(lead.baseValue) + 60,
    'The rival halves story sales; the part-one arc bonus is still $60');
});

test('an assigned reporter contests even with no progress; an unassigned lead is stolen', () => {
  for (const assigned of [false, true]) {
    const sim = makeSim();
    parkOperatives(sim);
    const lead = sim.leads[0];
    lead.rivalProgress = 99.5;
    if (assigned) sim.dispatchOperativeToLead('rep_1', lead.uid);
    sim.rivals.push(rival({ x: lead.x, y: lead.y, targetLeadId: lead.uid }));
    sim.step(0.05);
    assert.equal(sim.leads.includes(lead), assigned);
    assert.equal(sim.credibility, assigned ? 74 : 69);
    assert.equal(sim.rivals.length, 0);
  }
});

test('a rival without any remaining leads leaves; spawns honor type and population limits', () => {
  const sim = makeSim({ night: 4, rng: { nextFloat: () => 0.99 } });
  parkOperatives(sim);
  sim.leads = [];
  sim.rivals.push(rival());
  sim.step(0.05);
  assert.equal(sim.rivals.length, 0);
  sim.spawnRivalAgent();
  assert.equal(sim.rivals.length, 0, 'No herald can spawn without a lead');
  sim.spawnLead();
  sim.spawnRivalAgent();
  assert.equal(sim.rivals[0].type, 'herald');
  assert.equal(sim.rivals[0].targetLeadId, sim.leads[0].uid);
  sim.syndicateHeat = 35;
  sim.spawnRivalAgent();
  assert.equal(sim.rivals[1].type, 'goon');
  sim.spawnRivalAgent();
  sim.spawnRivalAgent();
  assert.equal(sim.rivals.length, 3);
});
