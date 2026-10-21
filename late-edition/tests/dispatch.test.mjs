import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD_W, WORLD_H } from '../js/config.js';
import { makeSim, arrive, rival } from './helpers.mjs';

test('nonexistent and expired leads reject dispatch without effects', () => {
  const sim = makeSim({ night: 4 });
  const expired = sim.leads[0];
  expired.timeLeft = 0.01;
  sim.step(0.05);
  assert.ok(!sim.leads.includes(expired));
  const snapshot = () => ({ hash: sim.getStateHash(), wire: structuredClone(sim.wireLog),
    callouts: structuredClone(sim.callouts) });
  const before = snapshot();
  for (const uid of [expired.uid, 'missing', null, undefined]) {
    assert.equal(sim.dispatchOperativeToLead('rep_1', uid), false);
  }
  assert.deepEqual(snapshot(), before);
});

test('unknown operative id uses the existing first-operative fallback', () => {
  const sim = makeSim({ night: 4 });
  assert.equal(sim.dispatchOperativeToLead('unknown', sim.leads[0].uid), true);
  assert.equal(sim.operatives[0].targetLeadId, sim.leads[0].uid);
  assert.ok(sim.operatives.slice(1).every((op) => op.targetLeadId === null));
  sim.operatives = [];
  assert.equal(sim.dispatchOperativeToLead('unknown', sim.leads[0].uid), false);
  assert.doesNotThrow(() => sim.dispatchOperativeToPoint('unknown', 50, 50));
});

test('all operatives busy: explicit and auto dispatch retarget instead of queuing', () => {
  const sim = makeSim({ night: 4 });
  for (const op of sim.operatives) sim.dispatchOperativeToLead(op.id, sim.leads[0].uid);
  sim.selectedOpId = 'fixer_1';
  sim.autoDispatchBestForLead(sim.leads[1].uid);
  assert.equal(sim.operatives[0].targetLeadId, sim.leads[1].uid);
  assert.ok(sim.operatives.slice(1).every((op) => op.targetLeadId === sim.leads[0].uid));
  sim.selectedOpId = 'rep_2';
  sim.autoDispatchBestForLead(sim.leads[2].uid);
  assert.equal(sim.operatives[1].targetLeadId, sim.leads[2].uid);
  const hash = sim.getStateHash();
  sim.autoDispatchBestForLead('missing');
  assert.equal(sim.getStateHash(), hash);
});

test('auto dispatch prefers an idle reporter when the fixer is selected', () => {
  const sim = makeSim({ night: 4 });
  sim.selectedOpId = 'fixer_1';
  sim.dispatchOperativeToLead('rep_1', sim.leads[0].uid);
  sim.autoDispatchBestForLead(sim.leads[1].uid);
  assert.equal(sim.operatives[1].targetLeadId, sim.leads[1].uid);
});

test('point dispatch prioritizes leads, then rivals, then bounded street coordinates', () => {
  const sim = makeSim({ night: 4 });
  const op = sim.operatives[0];
  const lead = sim.leads[0];
  sim.rivals.push(rival({ x: lead.x, y: lead.y }));
  sim.dispatchOperativeToPoint(op.id, lead.x, lead.y);
  assert.equal(op.targetLeadId, lead.uid);
  sim.rivals[0].x = 50;
  sim.rivals[0].y = 50;
  sim.dispatchOperativeToPoint(op.id, 50, 50);
  assert.equal(op.targetLeadId, null);
  assert.equal(op.targetRivalId, 'test_rival');
  sim.dispatchOperativeToPoint('unknown', -1000, WORLD_H + 1000);
  assert.equal(op.targetRivalId, null);
  assert.equal(op.targetX, 50);
  assert.equal(op.targetY, WORLD_H - 50);
  sim.dispatchOperativeToPoint(op.id, WORLD_W + 1000, -1000);
  assert.equal(op.targetX, WORLD_W - 50);
  assert.equal(op.targetY, 50);
});

test('nonfinite or nonnumeric point coordinates cannot poison movement', () => {
  const sim = makeSim({ night: 4 });
  const before = sim.getStateHash();
  for (const bad of [NaN, Infinity, -Infinity, undefined, null, '10']) {
    sim.dispatchOperativeToPoint('rep_1', bad, 50);
    sim.dispatchOperativeToPoint('rep_1', 50, bad);
  }
  assert.equal(sim.getStateHash(), before);
});

test('a lead disappearing in transit clears the target on arrival', () => {
  const sim = makeSim({ night: 4 });
  sim.dispatchOperativeToLead('rep_1', sim.leads[0].uid);
  sim.leads.shift();
  const op = sim.operatives[0];
  arrive(op);
  sim.step(0.05);
  assert.equal(op.targetLeadId, null);
  assert.equal(op.state, 'AWAITING ORDERS');
  assert.equal(sim.scoopsTotal, 0);
});
