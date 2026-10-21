import assert from 'node:assert/strict';
import test from 'node:test';
import { makeSim, story } from './helpers.mjs';

test('hush-money bribe at zero funds pays the player and clamps trust/heat at zero', () => {
  const sim = makeSim();
  sim.cash = 0;
  sim.credibility = 5;
  sim.syndicateHeat = 8;
  assert.equal(sim.acceptSyndicateBribe(), true);
  assert.equal(sim.cash, 160, 'The syndicate pays us; accepting has no purchase cost');
  assert.equal(sim.credibility, 0);
  assert.equal(sim.syndicateHeat, 0);
});

test('buying the tipster vouchers without enough funds floors cash at zero', () => {
  const sim = makeSim();
  sim.cash = 10;
  sim.dilemmaIdx = 2;
  sim.triggerRotaryDilemma();
  assert.equal(sim.resolveDilemma(true), true);
  assert.equal(sim.cash, 0, 'Existing dilemma design permits the choice, with no debt');
  assert.equal(sim.circulation, 20900);
  assert.equal(sim.credibility, 82);
  assert.equal(sim.syndicateHeat, 32);
});

for (const [method, cost] of [['triggerWiretap', 65], ['fortifyPressRoom', 75]]) {
  test(`${method} rejects insufficient funds without any mutation`, () => {
    const sim = makeSim();
    sim.cash = cost - 1;
    const hash = sim.getStateHash();
    const wire = structuredClone(sim.wireLog);
    assert.equal(sim[method](), false);
    assert.equal(sim.getStateHash(), hash);
    assert.deepEqual(sim.wireLog, wire);
    sim.cash = cost;
    assert.equal(sim[method](), true);
    assert.equal(sim.cash, 0, 'Exact price is affordable');
  });
}

test('publication clamps heat above 100 and trust below zero; circulation has a floor', () => {
  const sim = makeSim();
  sim.syndicateHeat = 99;
  sim.credibility = 5;
  sim.frontPage.banner = story('bad', { credibility: -30, heat: 25 });
  sim.publishEdition();
  assert.equal(sim.syndicateHeat, 100);
  assert.equal(sim.credibility, 0);
  sim.step(0.05);
  assert.equal(sim.gameOver, true);
  assert.equal(sim.gameOverReason, 'PUBLIC TRUST COLLAPSED — READERS ABANDONED THE EVENING STAR');
  const blank = makeSim();
  blank.circulation = 2100;
  blank.publishEdition();
  assert.equal(blank.circulation, 2000);
});

test('publication and dilemma effects also enforce the opposite bounds', () => {
  const sim = makeSim();
  sim.credibility = 99;
  sim.syndicateHeat = 1;
  sim.frontPage.editorial = story('good', { heat: -30 });
  sim.publishEdition();
  assert.equal(sim.credibility, 100);
  assert.equal(sim.syndicateHeat, 0);
  sim.triggerRotaryDilemma();
  sim.resolveDilemma(false);
  assert.equal(sim.credibility, 100);
  sim.syndicateHeat = 99;
  sim.triggerRotaryDilemma();
  sim.resolveDilemma(false);
  assert.equal(sim.syndicateHeat, 100);
  sim.credibility = 1;
  sim.dilemmaIdx = 1;
  sim.triggerRotaryDilemma();
  sim.resolveDilemma();
  assert.equal(sim.credibility, 0);
});
