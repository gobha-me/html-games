import assert from 'node:assert/strict';
import test from 'node:test';
import { EDITORIAL_DILEMMAS } from '../js/config.js';
import { makeSim } from './helpers.mjs';

test('an unanswered call applies the reject outcome exactly once at timeout', () => {
  let rings = 0;
  const sim = makeSim({ night: 4, audio: { phoneRing: () => rings++ } });
  const dilemma = sim.triggerRotaryDilemma();
  assert.equal(sim.triggerRotaryDilemma(), dilemma, 'Ringing again does not reset the timer');
  assert.equal(rings, 2, 'Opening call and dilemma each ring once');
  assert.equal(sim.dilemmaIdx, 1);
  dilemma.timer = 0.1;
  sim.step(0.05);
  assert.equal(sim.activeDilemma, dilemma);
  assert.equal(sim.circulation, 18400);
  sim.step(0.05);
  assert.equal(sim.activeDilemma, null);
  assert.equal(sim.cash, 340);
  assert.equal(sim.circulation, 21200);
  assert.equal(sim.credibility, 78);
  assert.equal(sim.syndicateHeat, 36);
  const hash = sim.getStateHash();
  assert.equal(sim.resolveDilemma(), false);
  assert.equal(sim.resolveDilemma(false), false);
  assert.equal(sim.getStateHash(), hash);
});

test('clock triggers one call per edition; publishing clears an unanswered call', () => {
  const sim = makeSim({ night: 4 });
  sim.clockSec = 83.99;
  sim.step(0.05);
  assert.ok(sim.activeDilemma);
  assert.equal(sim.dilemmaTriggeredThisEdition, true);
  sim.resolveDilemma();
  sim.step(0.05);
  assert.equal(sim.activeDilemma, null);
  assert.equal(sim.dilemmaIdx, 1);
  sim.triggerRotaryDilemma();
  sim.publishEdition();
  assert.equal(sim.activeDilemma, null);
  assert.equal(sim.dilemmaTriggeredThisEdition, false);
});

for (const [index, template] of EDITORIAL_DILEMMAS.entries()) {
  for (const accept of [false, true]) {
    test(`${template.id}: ${accept ? 'accept' : 'reject'} applies authored effects`, () => {
      const sim = makeSim({ night: 4 });
      sim.dilemmaIdx = index;
      sim.triggerRotaryDilemma();
      const effect = accept ? template.acceptEffect : template.rejectEffect;
      assert.equal(sim.resolveDilemma(accept), true);
      assert.equal(sim.cash, 340 + effect.cash);
      assert.equal(sim.circulation, 18400 + effect.circulation);
      assert.equal(sim.credibility, 74 + effect.credibility);
      assert.equal(sim.syndicateHeat, 22 + effect.heat);
      assert.equal(sim.wireLog[0].text, effect.wire);
      assert.equal(sim.activeDilemma, null);
    });
  }
}

test('call templates wrap after the last dilemma', () => {
  const sim = makeSim({ night: 4 });
  sim.dilemmaIdx = EDITORIAL_DILEMMAS.length;
  assert.equal(sim.triggerRotaryDilemma().id, EDITORIAL_DILEMMAS[0].id);
});
