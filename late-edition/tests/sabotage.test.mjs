import assert from 'node:assert/strict';
import test from 'node:test';
import { makeSim, rival, parkOperatives, arrive } from './helpers.mjs';

test('press HP hitting zero on the deadline tick ends play after that tick\'s print', () => {
  const sim = makeSim({ night: 4 });
  parkOperatives(sim);
  sim.clockSec = 209.99;
  sim.pressHp = 0.1;
  sim.rivals.push(rival({ type: 'goon', x: sim.hq.x + sim.hq.w / 2,
    y: sim.hq.y + sim.hq.h / 2 }));
  sim.step(0.05);
  assert.equal(sim.editionsPrinted, 1, 'Deadline print precedes sabotage in existing tick order');
  assert.equal(sim.cash, 450);
  assert.equal(sim.pressHp, 0);
  assert.equal(sim.gameOver, true);
  assert.equal(sim.gameOverReason, 'ROTARY PRESS DESTROYED BY OBSERVER SYNDICATE SABOTEURS');
  const hash = sim.getStateHash();
  assert.equal(sim.publishEdition(), false, 'A destroyed press cannot keep printing');
  sim.step(10);
  assert.equal(sim.getStateHash(), hash);
  sim.fortifyPressRoom();
  assert.equal(sim.pressHp, 100);
  assert.equal(sim.gameOver, true, 'Repairs cannot resurrect a finished run');
  assert.equal(sim.publishEdition(), false);
});

test('a press already at zero cannot publish even before game-over detection', () => {
  const sim = makeSim({ night: 4 });
  sim.pressHp = 0;
  const hash = sim.getStateHash();
  assert.equal(sim.publishEdition(), false);
  assert.equal(sim.getStateHash(), hash);
});

test('fortification at exact price repairs the press and clears only goons', () => {
  const sim = makeSim({ night: 4 });
  sim.cash = 75;
  sim.pressHp = 1;
  sim.rivals.push(rival({ id: 'herald' }), rival({ id: 'goon', type: 'goon' }));
  assert.equal(sim.fortifyPressRoom(), true);
  assert.equal(sim.cash, 0);
  assert.equal(sim.pressHp, 100);
  assert.deepEqual(sim.rivals.map((r) => r.id), ['herald']);
});

test('fixer intercept pays exactly one bounty and releases a removed rival target', () => {
  const sim = makeSim({ night: 4 });
  parkOperatives(sim);
  const fixer = sim.operatives.find((o) => o.role === 'fixer');
  sim.rivals.push(rival({ type: 'goon', x: fixer.x, y: fixer.y }));
  sim.step(0.05);
  assert.equal(sim.rivals.length, 0);
  assert.equal(sim.cash, 375);
  assert.equal(fixer.targetRivalId, null);
  sim.step(0.05);
  assert.equal(sim.cash, 375);
  fixer.targetRivalId = 'missing';
  sim.step(0.05);
  assert.equal(fixer.targetRivalId, null);
});

test('photographer stuns a rival but cannot stun again during cooldown', () => {
  const sim = makeSim({ night: 4 });
  parkOperatives(sim);
  const photographer = sim.operatives.find((o) => o.role === 'photographer');
  photographer.x = photographer.targetX = 300;
  photographer.y = photographer.targetY = 300;
  const enemy = rival({ type: 'goon', x: 320, y: 300 });
  sim.rivals.push(enemy);
  sim.step(0.05);
  assert.equal(photographer.flashCooldown, 7);
  assert.equal(enemy.stunTimer, 4.45);
  assert.equal(enemy.x, 320, 'Stunned rivals cannot move');
  enemy.stunTimer = 0;
  sim.step(0.05);
  assert.equal(photographer.flashCooldown, 6.95);
  assert.equal(enemy.stunTimer, 0);
  assert.notEqual(enemy.x, 320, 'An unstunned goon advances toward HQ');
});

test('photographer captures proof once, then assists an already verified lead', () => {
  const sim = makeSim({ night: 4 });
  parkOperatives(sim);
  const lead = sim.leads[0];
  const photographer = sim.operatives.find((o) => o.role === 'photographer');
  sim.dispatchOperativeToLead(photographer.id, lead.uid);
  arrive(photographer);
  sim.step(0.05);
  assert.equal(lead.photoVerified, true);
  assert.equal(lead.progress, 28);
  assert.equal(photographer.targetLeadId, null);
  sim.dispatchOperativeToLead(photographer.id, lead.uid);
  arrive(photographer);
  sim.step(0.05);
  assert.equal(lead.progress, 28.8);
  assert.equal(photographer.targetLeadId, lead.uid);
  sim.completeLeadScoop(lead);
  assert.equal(sim.frontPage.photo_expose.photoVerified, true);
});
