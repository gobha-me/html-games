import assert from 'node:assert/strict';
import test from 'node:test';
import { LateEditionSim } from '../js/sim.js';
import { isUnlocked, deskFits, EDITION_DURATION_SEC, LEAD_LIFETIME_SEC } from '../js/config.js';
import { ColdOpen, LOU_LINES } from '../js/opening.js';
import { makeSim } from './helpers.mjs';

for (const [feature, night] of Object.entries({
  reporter: 1, photographer: 2, fixer: 3, fortify: 3, wiretap: 4, bribe: 4, phone: 4,
})) {
  test(`${feature} unlocks on night ${night}, never a night early`, () => {
    for (let n = 0; n <= 6; n++) assert.equal(isUnlocked(feature, n), n >= night);
  });
}

test('invalid nights and unknown/prototype features fail closed', () => {
  for (const n of [NaN, Infinity, '4', 3.9, null, undefined, -1]) {
    assert.equal(isUnlocked('reporter', n), false);
  }
  for (const feature of ['unknown', 'toString', '__proto__', undefined]) {
    assert.equal(isUnlocked(feature, 4), false);
  }
});

test('title, cold open and an idle first desk consume no time, lead life or entropy', () => {
  const sim = new LateEditionSim({ seed: 84 });
  for (const phase of ['title', 'cold-open', 'desk']) {
    assert.equal(sim.phase, phase);
    const before = sim.getStateHash();
    for (let i = 0; i < 30; i++) sim.step(10);
    assert.equal(sim.getStateHash(), before);
    assert.equal(sim.time, 0);
    assert.equal(sim.clockSec, 0);
    assert.equal(sim.publishEdition(), false);
    if (phase !== 'desk') assert.equal(sim.dispatchOperativeToLead('rep_1', sim.leads[0].uid), false);
    if (phase === 'title') sim.startNightShift();
    else if (phase === 'cold-open') sim.finishColdOpen();
  }
  const before = sim.getStateHash();
  assert.equal(sim.dispatchOperativeToLead('rep_1', 'expired'), false);
  assert.equal(sim.dispatchOperativeToLead('photog_1', sim.leads[0].uid), false);
  assert.equal(sim.getStateHash(), before);
  sim.selectedOpId = null;
  assert.equal(sim.dispatchOperativeToLead(null, sim.leads[0].uid), true);
  assert.equal(sim.selectedOpId, 'rep_1', 'No selection deliberately dispatches the first reporter');
  sim.step(1);
  assert.ok(sim.clockSec > 0);
  assert.ok(sim.leads[0].timeLeft < LEAD_LIFETIME_SEC);
});

test('locked operative selection, lead/point orders and passive abilities are inert', () => {
  const sim = makeSim();
  sim.rivals.push({ id: 'bait', x: sim.operatives[3].x, y: sim.operatives[3].y,
    type: 'goon', hp: 100, stunTimer: 0, speed: 0 });
  const locked = structuredClone(sim.operatives.slice(2));
  const cash = sim.cash;
  for (const op of locked) {
    const before = sim.getStateHash();
    assert.equal(sim.selectOperative(op.id), false);
    assert.equal(sim.dispatchOperativeToLead(op.id, sim.leads[0].uid), false);
    assert.equal(sim.dispatchOperativeToPoint(op.id, 200, 200), false);
    assert.equal(sim.getStateHash(), before);
  }
  sim.step(0.05);
  assert.deepEqual(sim.operatives.slice(2), locked);
  assert.equal(sim.cash, cash, 'Locked fixer cannot earn automatic bounties');
});

for (const [method, night] of Object.entries({
  triggerWiretap: 4, acceptSyndicateBribe: 4, fortifyPressRoom: 3, triggerRotaryDilemma: 4,
})) {
  test(`${method} refuses early calls without mutations, then works at unlock`, () => {
    const sim = makeSim({ night: night - 1 });
    const before = sim.getStateHash();
    assert.equal(sim[method](), false);
    assert.equal(sim.getStateHash(), before);
    sim.edition = night;
    assert.ok(sim[method]());
  });
}

for (const [role, night] of [['photographer', 2], ['fixer', 3]]) {
  test(`${role} accepts real dispatch only after joining the payroll`, () => {
    const sim = makeSim({ night: night - 1 });
    const op = sim.operatives.find((op) => op.role === role);
    assert.equal(sim.dispatchOperativeToLead(op.id, sim.leads[0].uid), false);
    sim.edition = night;
    assert.equal(sim.selectOperative(op.id), true);
    assert.equal(sim.dispatchOperativeToLead(op.id, sim.leads[0].uid), true);
  });
}

test('automatic dilemmas wait until night four, even past the call time', () => {
  for (let night = 1; night <= 4; night++) {
    const sim = makeSim({ night });
    sim.clockSec = EDITION_DURATION_SEC * 0.4;
    sim.step(0.05);
    assert.equal(Boolean(sim.activeDilemma), night >= 4);
    assert.equal(sim.dilemmaTriggeredThisEdition, night >= 4);
  }
});

test('undersized desk pauses active play without changing the user pause choice', () => {
  const sim = makeSim();
  sim.deskTooSmall = true;
  const before = sim.getStateHash();
  sim.step(10);
  assert.equal(sim.dispatchOperativeToLead('rep_1', sim.leads[0].uid), false);
  assert.equal(sim.getStateHash(), before);
  assert.equal(sim.paused, false);
  sim.deskTooSmall = false;
  sim.step(0.5);
  assert.ok(sim.time > 0);
  sim.paused = true;
  sim.deskTooSmall = true;
  sim.deskTooSmall = false;
  const paused = sim.getStateHash();
  sim.step(1);
  assert.equal(sim.getStateHash(), paused);
  assert.equal(deskFits(1279, 720), false);
  assert.equal(deskFits(1280, 719), false);
  assert.equal(deskFits(1280, 720), true);
  assert.equal(deskFits(NaN, Infinity), false);
});

test('cold open types partial lines, finishes at 30 seconds and rejects bad deltas', () => {
  const opening = new ColdOpen();
  for (const dt of [NaN, -1, 0, Infinity, '1']) assert.equal(opening.advance(dt), false);
  assert.deepEqual(opening.lines, ['', '', '']);
  assert.equal(opening.advance(0.1), false);
  assert.equal(opening.lines[0], LOU_LINES[0].slice(0, 3));
  assert.equal(opening.advance(29.8), false);
  assert.equal(opening.advance(0.2), true);
  assert.equal(opening.elapsed, 30);
  assert.deepEqual(opening.lines, LOU_LINES);
});

test('reduced-motion flag reveals all dialogue immediately and supports live changes', () => {
  const opening = new ColdOpen(true);
  assert.deepEqual(opening.lines, LOU_LINES);
  opening.reducedMotion = false;
  assert.equal(opening.lines[0], '');
  opening.reducedMotion = true;
  assert.deepEqual(opening.lines, LOU_LINES);
});


test('saboteurs cannot spawn before the fixer and fortification unlock', () => {
  for (const night of [1, 2, 3]) {
    const sim = makeSim({ night, rng: { nextFloat: () => 0 } });
    sim.syndicateHeat = 100;
    sim.spawnRivalAgent();
    assert.equal(sim.rivals[0].type, night < 3 ? 'herald' : 'goon');
  }
});
