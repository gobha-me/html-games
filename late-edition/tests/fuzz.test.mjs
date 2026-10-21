import assert from 'node:assert/strict';
import test from 'node:test';
import { mulberry32 } from '../js/rng.js';
import { makeSim, rival, parkOperatives } from './helpers.mjs';

function assertInvariants(sim, wasGameOver) {
  function visit(value, path) {
    if (typeof value === 'number') assert.ok(Number.isFinite(value), `${path} = ${value}`);
    else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`);
    }
  }
  visit(sim, 'sim');
  for (const key of ['credibility', 'syndicateHeat', 'pressHp']) {
    assert.ok(sim[key] >= 0 && sim[key] <= 100, `${key} outside 0..100: ${sim[key]}`);
  }
  assert.ok(sim.cash >= 0, 'No action may create debt');
  const plated = Object.values(sim.frontPage).filter(Boolean).map((s) => s.uid);
  assert.equal(new Set(plated).size, plated.length, 'One story per slot at most');
  const allStories = [...plated, ...sim.scoopedStories.map((s) => s.uid),
    ...sim.insideStories.map((s) => s.uid), ...sim.spikedStories.map((s) => s.uid)];
  assert.equal(new Set(allStories).size, allStories.length, 'Plated stories cannot remain queued');
  if (wasGameOver) assert.equal(sim.gameOver, true, 'Game over is sticky until explicit reset');
}

for (let seed = 0; seed < 50; seed++) {
  test(`seed ${seed}: full payroll: random legal/illegal commands through three editions and game over`, () => {
    // Keep command entropy separate: extra gameplay RNG draws must not change inputs.
    const commands = mulberry32(seed ^ 0x82f022);
    // Start with the full payroll so the action fuzzer exercises every mechanic.
    // Golden and onboarding suites separately cover progression from night one.
    const sim = makeSim({ seed, night: 4 });
    const pick = (values) => commands.pick(values);
    const leadId = () => pick([...sim.leads.map((l) => l.uid), 'expired_lead', null]);
    const opId = () => pick([...sim.operatives.map((op) => op.id), 'unknown_op']);
    const actions = [
      () => sim.dispatchOperativeToLead(opId(), leadId()),
      () => sim.autoDispatchBestForLead(leadId()),
      () => sim.dispatchOperativeToPoint(opId(), commands.nextInt(-500, 2000), commands.nextInt(-500, 2000)),
      () => sim.dispatchOperativeToPoint(opId(), pick([NaN, Infinity, -Infinity, '50', null]), 50),
      () => sim.placeStory(pick([...sim.scoopedStories.map((s) => s.uid), 'missing_story']),
        pick(['inside', 'banner', 'above_fold', 'photo_expose', 'editorial', 'missing_slot', '__proto__'])),
      () => sim.lockUp(),
      () => sim.assistLayout(),
      () => sim.unplace(pick([...sim.scoopedStories, ...Object.values(sim.frontPage).filter(Boolean), ...sim.insideStories, { uid: 'missing' }]).uid),
      () => sim.spike(pick([...sim.scoopedStories, ...Object.values(sim.frontPage).filter(Boolean), ...sim.insideStories, { uid: 'missing' }]).uid),
      () => sim.triggerWiretap(),
      () => sim.fortifyPressRoom(),
      () => { if (sim.credibility >= 70 || sim.gameOver) sim.acceptSyndicateBribe(); },
      () => sim.triggerRotaryDilemma(),
      () => sim.resolveDilemma(pick([true, false])),
      () => {
        const lead = pick(sim.leads);
        if (lead) {
          sim.completeLeadScoop(lead);
          assert.equal(sim.completeLeadScoop(lead), false, 'Stale completion is rejected');
        }
      },
      () => {
        if (sim.clockSec >= 20 || sim.gameOver) {
          sim.publishEdition();
          assert.equal(sim.publishEdition(), false, 'Repeated print in one tick is rejected');
        }
      },
      () => sim.step(pick([NaN, Infinity, -Infinity, 0, -1, '1'])),
      () => { sim.paused = !sim.paused; },
      () => sim.spawnRivalAgent(),
      () => sim.spawnLead(pick([null, 'docks', 'unknown_district'])),
    ];
    let steps = 0;
    while (sim.editionsPrinted < 3 && steps < 1200) {
      assert.equal(sim.gameOver, false, `Unexpected early loss: ${sim.gameOverReason}, action ${steps}`);
      pick(actions)();
      sim.editionSummary = null;
      assertInvariants(sim, false);
      sim.step(pick([0.05, 0.25, 1, 3]));
      assertInvariants(sim, false);
      steps++;
    }
    assert.equal(sim.editionsPrinted, 3, 'Every seed must actually run three editions');

    // Force both real terminal paths, then attack them with every command type.
    sim.paused = false;
    sim.phase = 'desk';
    sim.editionSummary = null;
    if (seed % 2 === 0) {
      parkOperatives(sim);
      sim.pressHp = 0.1;
      sim.rivals = [rival({ type: 'goon', x: sim.hq.x + sim.hq.w / 2,
        y: sim.hq.y + sim.hq.h / 2 })];
    } else {
      while (sim.credibility > 0) sim.acceptSyndicateBribe();
    }
    sim.step(0.05);
    assert.equal(sim.gameOver, true, 'Terminal condition must have been reached');
    for (const action of actions) {
      action();
      assertInvariants(sim, true);
      sim.step(10);
      assertInvariants(sim, true);
    }
  });
}
