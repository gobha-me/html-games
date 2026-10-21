import assert from 'node:assert/strict';
import test from 'node:test';
import { FILE_DRAWER, STORY_CATALOG, INVESTIGATIVE_ARCS } from '../js/config.js';
import { makeSim, story, rival, parkOperatives } from './helpers.mjs';

function fileDesk(options = {}, overrides = {}) {
  const sim = makeSim(options);
  sim.scoopedStories.push(story('secret', overrides));
  sim.lockUp();
  assert.equal(sim.spike('secret').ok, true);
  return sim;
}

function rejectUnchanged(sim, command, reason) {
  const before = sim.getStateHash();
  const wire = structuredClone(sim.wireLog);
  assert.equal(command().reason, reason);
  assert.equal(sim.getStateHash(), before, 'Rejected command must not mutate state or consume RNG');
  assert.deepEqual(sim.wireLog, wire);
}

function print(sim) {
  sim.time += 0.05;
  assert.equal(sim.publishEdition(), true);
  sim.editionSummary = null;
}

test('catalog and every arc part name grounded subjects in their copy', () => {
  for (const entry of [...STORY_CATALOG, ...INVESTIGATIVE_ARCS.flatMap((arc) => arc.parts)]) {
    assert.ok(entry.subject.length > 5);
    assert.ok(`${entry.headline} ${entry.subdeck}`.includes(entry.subject));
  }
});

test('spike creates a weighted dossier; full drawer rejects plated copy atomically until explicitly shredded', () => {
  const sim = fileDesk();
  const file = sim.spikedStories[0];
  assert.equal(file.subject, STORY_CATALOG[0].subject);
  assert.equal(file.freshness, 3);
  assert.equal(file.exposure, 0);
  assert.equal(file.weight, 3);
  assert.deepEqual(file.tags, ['GRAFT']);
  for (let i = 0; i < 5; i++) {
    sim.scoopedStories.push(story(`extra_${i}`));
    assert.equal(sim.spike(`extra_${i}`).ok, true);
  }
  sim.scoopedStories.push(story('overflow'));
  sim.placeStory('overflow', 'banner');
  rejectUnchanged(sim, () => sim.spike('overflow'), 'drawer-full');
  assert.equal(sim.frontPage.banner.uid, 'overflow');
  assert.equal(sim.shredFile('secret').ok, true);
  rejectUnchanged(sim, () => sim.shredFile('secret'), 'unknown-file');
  assert.equal(sim.spike('overflow').ok, true);
  assert.equal(sim.spikedStories.length, FILE_DRAWER.capacity);
  assert.equal(sim.frontPage.banner, null);
  assert.match(sim.wireLog.find((entry) => entry.text.startsWith('SHREDDED')).text, /Nothing left/);
});

test('files persist and age each publish; zero freshness auto-shreds once with a wire line', () => {
  const sim = fileDesk();
  const before = sim.getStateHash();
  sim.spikedStories[0].exposure++;
  assert.notEqual(sim.getStateHash(), before);
  print(sim);
  assert.equal(sim.spikedStories[0].freshness, 2);
  print(sim);
  assert.equal(sim.spikedStories[0].freshness, 1);
  print(sim);
  assert.deepEqual(sim.spikedStories, []);
  assert.equal(sim.wireLog.filter((entry) => entry.text.startsWith('FILE EXPIRED')).length, 1);
  rejectUnchanged(sim, () => sim.useFile('secret', 'favor', 'tip'), 'unknown-file');
  sim.reset();
  assert.deepEqual(sim.spikedStories, []);
  assert.deepEqual(sim.pendingBurns, []);
});

test('expired file cannot be used for any action, even before expiry sweep', () => {
  const sim = fileDesk();
  sim.spikedStories[0].freshness = 0;
  for (const [action, target] of [['favor', 'tip'], ['squeeze', 'cash'], ['print-later']]) {
    rejectUnchanged(sim, () => sim.useFile('secret', action, target), 'expired-file');
  }
  assert.equal(sim.shredFile('secret').ok, true, 'Expired evidence can still be shredded');
});

test('favor tip consumes once and immediately creates valuable copy in the subject district', () => {
  const sim = fileDesk({}, { district: 'wallst' });
  const result = sim.useFile('secret', 'favor', 'tip');
  assert.equal(result.ok, true);
  const lead = sim.leads.find((entry) => entry.uid === result.effects.leadUid);
  assert.equal(lead.districtId, 'wallst');
  assert.equal(lead.subject, STORY_CATALOG[0].subject);
  assert.ok(lead.baseValue >= FILE_DRAWER.tipValue);
  assert.equal(lead.arcId, null, 'A favor never invents arc progression');
  rejectUnchanged(sim, () => sim.useFile('secret', 'favor', 'tip'), 'unknown-file');
});

test('tip → scoop → spike cannot wash exposure and age into a fresh cash loop', () => {
  const sim = fileDesk({ rng: { nextFloat: () => 0.999999 } });
  for (let i = 0; i < 4; i++) assert.equal(sim.useFile('secret', 'squeeze', 'cash').effects.burned, false);
  const tip = sim.useFile('secret', 'favor', 'tip');
  assert.equal(tip.ok, true);
  const lead = sim.leads.find((entry) => entry.uid === tip.effects.leadUid);
  assert.equal(lead.dossier.exposure, 4);
  print(sim);
  assert.equal(lead.dossier.freshness, 2, 'A live tip ages with its source');
  sim.completeLeadScoop(lead);
  sim.lockUp();
  assert.equal(sim.spike(lead.uid).ok, true);
  assert.equal(sim.spikedStories[0].exposure, 4);
  assert.equal(sim.spikedStories[0].freshness, 2);
  assert.equal(sim.useFile(lead.uid, 'squeeze', 'cash').effects.burned, true);
  rejectUnchanged(sim, () => sim.useFile(lead.uid, 'squeeze', 'cash'), 'unknown-file');
});

test('tip rejects a full city without consuming evidence', () => {
  const sim = fileDesk();
  sim.spawnLead();
  rejectUnchanged(sim, () => sim.useFile('secret', 'favor', 'tip'), 'city-full');
});

test('stop removes exactly one goon, or blocks exactly one future raid across editions', () => {
  const sim = fileDesk({ night: 3 });
  sim.rivals = [rival({ id: 'first', type: 'goon' }), rival({ id: 'second', type: 'goon' }), rival()];
  assert.equal(sim.useFile('secret', 'favor', 'stop').effects.stopped, 'first');
  assert.deepEqual(sim.rivals.map((entry) => entry.id), ['second', 'test_rival']);
  const protectedSim = fileDesk({ night: 3 });
  assert.equal(protectedSim.useFile('secret', 'favor', 'stop').effects.raidBlocked, true);
  protectedSim.scoopedStories.push(story('second'));
  protectedSim.spike('second');
  rejectUnchanged(protectedSim, () => protectedSim.useFile('second', 'favor', 'stop'), 'already-protected');
  print(protectedSim);
  assert.equal(protectedSim.raidBlocked, true);
  protectedSim.syndicateHeat = 100;
  protectedSim.spawnRivalAgent();
  assert.equal(protectedSim.rivals.length, 0);
  assert.equal(protectedSim.raidBlocked, false);
  protectedSim.spawnRivalAgent();
  assert.equal(protectedSim.rivals[0].type, 'goon');
});

test('kill denies the current lead to every rival but retains player copy', () => {
  const sim = fileDesk();
  rejectUnchanged(sim, () => sim.useFile('secret', 'favor', 'kill'), 'no-rival-target');
  const lead = sim.leads[0];
  sim.rivals = [rival({ targetLeadId: lead.uid }), rival({ id: 'other', targetLeadId: lead.uid })];
  assert.equal(sim.useFile('secret', 'favor', 'kill').effects.killedLead, lead.uid);
  assert.equal(sim.leads.includes(lead), true);
  assert.equal(lead.killedForRival, true);
  parkOperatives(sim);
  sim.step(0.05);
  assert.notEqual(sim.rivals[0].targetLeadId, lead.uid);
});

test('squeeze exposure grows deterministically, burns on the fifth even with maximum RNG; burned uid rejects this tick', () => {
  const sim = fileDesk({ rng: { nextFloat: () => 0.999999 } });
  const initial = sim.cash;
  for (let i = 1; i <= 5; i++) {
    const result = sim.useFile('secret', 'squeeze', 'cash');
    assert.equal(result.ok, true);
    assert.equal(result.effects.burnChance, FILE_DRAWER.burnBase + FILE_DRAWER.burnPerExposure * i);
    assert.equal(result.effects.burned, i === 5);
    if (i < 5) assert.equal(sim.spikedStories[0].exposure, i);
  }
  assert.equal(sim.cash, initial + 5 * 12 * 3 * 3);
  assert.equal(sim.pendingBurns.length, 1);
  assert.equal(sim.pendingBurns[0].dueEdition, 3);
  rejectUnchanged(sim, () => sim.useFile('secret', 'squeeze', 'cash'), 'unknown-file');
});

test('seeded squeezes replay identical burn outcomes and consequence dates', () => {
  function squeeze(seed) {
    const sim = fileDesk({ seed });
    const results = [];
    while (sim.spikedStories.length) results.push(sim.useFile('secret', 'squeeze', 'cash'));
    return { results, hash: sim.getStateHash() };
  }
  assert.deepEqual(squeeze(86), squeeze(86));
  assert.notDeepEqual(squeeze(86), squeeze(87));
  for (const [draw, burned] of [[0.349999, true], [0.35, false]]) {
    const sim = fileDesk({ rng: { nextFloat: () => draw } });
    assert.equal(sim.useFile('secret', 'squeeze', 'cash').effects.burned, burned);
  }
});

test('protection reduces heat within bounds and pays no cash', () => {
  const sim = fileDesk({ rng: { nextFloat: () => 0.99 } });
  sim.syndicateHeat = 2;
  const result = sim.useFile('secret', 'squeeze', 'protection');
  assert.equal(result.effects.cash, 0);
  assert.equal(sim.cash, 340);
  assert.equal(sim.syndicateHeat, 0);
  assert.equal(sim.spikedStories[0].exposure, 1);
});

for (const status of ['dead', 'exposed']) {
  test(`squeeze rejects a subject already ${status}, across multiple files`, () => {
    const sim = fileDesk();
    sim.scoopedStories.push(story('second-secret'));
    sim.spike('second-secret');
    sim.subjectStates[sim.spikedStories[0].subject] = status;
    rejectUnchanged(sim, () => sim.useFile('second-secret', 'squeeze', 'cash'), 'subject-unavailable');
    rejectUnchanged(sim, () => sim.useFile('secret', 'squeeze', 'cash'), 'subject-unavailable');
    rejectUnchanged(sim, () => sim.useFile('secret', 'squeeze', 'protection'), 'subject-unavailable');
    assert.equal(sim.useFile('secret', 'print-later').ok, true);
  });
}

test('dead catalog subject and publication make blackmail unavailable without direct status mutation', () => {
  const sim = fileDesk({}, STORY_CATALOG.find((entry) => entry.subjectStatus === 'dead'));
  rejectUnchanged(sim, () => sim.useFile('secret', 'squeeze', 'cash'), 'subject-unavailable');
  const printed = fileDesk();
  printed.scoopedStories.push(story('public'));
  printed.placeStory('public', 'banner');
  print(printed);
  rejectUnchanged(printed, () => printed.useFile('secret', 'squeeze', 'cash'), 'subject-unavailable');
  assert.equal(printed.useFile('secret', 'print-later').effects.advanced, true);
});

for (const accept of [true, false]) {
  test(`burned source rings after 1 edition before phone unlock; resolve ${accept ? 'payoff' : 'trust hit'} once`, () => {
    const sim = fileDesk({ rng: { nextFloat: () => 0 } });
    sim.useFile('secret', 'squeeze', 'cash');
    sim.step(0.05);
    assert.equal(sim.activeDilemma, null, 'Consequence cannot ring on the squeeze night');
    print(sim);
    assert.equal(sim.pendingBurns.length, 1);
    sim.step(0.05);
    assert.equal(sim.activeDilemma.id, 'burned_source');
    assert.equal(sim.pendingBurns.length, 0);
    const { cash, credibility, syndicateHeat } = sim;
    assert.equal(sim.resolveDilemma(accept), true);
    assert.equal(sim.cash, cash - (accept ? FILE_DRAWER.payoff : 0));
    assert.equal(sim.credibility, credibility - (accept ? 0 : FILE_DRAWER.trustHit));
    assert.equal(sim.syndicateHeat, syndicateHeat + (accept ? 0 : FILE_DRAWER.heatSpike));
    assert.equal(sim.resolveDilemma(accept), false);
  });
}

test('burned calls wait behind other calls, reject unpaid payoffs, and cannot be escaped by printing or timeout', () => {
  for (const timeout of [true, false]) {
    const sim = fileDesk({ night: 4, rng: { nextFloat: () => 0 } });
    sim.useFile('secret', 'squeeze', 'cash');
    print(sim);
    sim.triggerRotaryDilemma();
    sim.step(0.05);
    assert.notEqual(sim.activeDilemma.id, 'burned_source');
    assert.equal(sim.pendingBurns.length, 1);
    sim.resolveDilemma(false);
    sim.step(0.05);
    assert.equal(sim.activeDilemma.id, 'burned_source');
    sim.cash = 0;
    const hash = sim.getStateHash();
    assert.equal(sim.resolveDilemma(true), false);
    assert.equal(sim.getStateHash(), hash);
    const trust = sim.credibility;
    if (timeout) { sim.activeDilemma.timer = 0.01; sim.step(0.05); }
    else print(sim);
    assert.equal(sim.credibility, trust - FILE_DRAWER.trustHit - (timeout ? 0 : 18));
    assert.equal(sim.activeDilemma, null);
  }
});

test('locking up immediately cannot postpone a due source call past paste-up', () => {
  const sim = fileDesk({ rng: { nextFloat: () => 0 } });
  sim.useFile('secret', 'squeeze', 'cash');
  print(sim);
  sim.lockUp();
  sim.step(0.05);
  assert.equal(sim.activeDilemma.id, 'burned_source');
  assert.equal(sim.phase, 'paste-up');
});

test('two-edition delay and multiple burns queue independently and are hashed', () => {
  const sim = fileDesk({ rng: { nextFloat: () => 0.9 } });
  // Fifth squeeze burns at 115%, then 0.9 chooses the two-night delay.
  while (sim.spikedStories.length) sim.useFile('secret', 'squeeze', 'cash');
  print(sim);
  sim.step(0.05);
  assert.equal(sim.activeDilemma, null);
  const hash = sim.getStateHash();
  sim.pendingBurns.push({ uid: 'second', subject: 'Captain Horgan', dueEdition: 3 });
  assert.notEqual(sim.getStateHash(), hash);
  print(sim);
  sim.step(0.05);
  assert.equal(sim.activeDilemma.uid, 'secret');
  sim.resolveDilemma(false);
  sim.step(0.05);
  assert.equal(sim.activeDilemma.uid, 'second');
});

for (const advanced of [true, false]) {
  test(`print later ${advanced ? 'rewards an advanced arc' : 'discounts stale news'} and transfers copy once`, () => {
    const sim = fileDesk({}, { baseValue: 200, arcId: 'red_hook', arcPart: 1 });
    if (advanced) sim.arcProgress.red_hook = 2;
    const result = sim.useFile('secret', 'print-later');
    assert.equal(result.effects.baseValue, advanced ? 300 : 150);
    assert.equal(sim.spikedStories.length, 0);
    assert.equal(sim.scoopedStories[0].seriesBadge, 'EXCLUSIVE — HELD');
    rejectUnchanged(sim, () => sim.useFile('secret', 'print-later'), 'unknown-file');
  });
}

test('subject progression rewards held non-arc copy; print/re-file cannot refresh leverage or compound bonuses', () => {
  const sim = fileDesk({ rng: { nextFloat: () => 0.99 } }, { baseValue: 200 });
  sim.useFile('secret', 'squeeze', 'cash');
  sim.useFile('secret', 'print-later');
  print(sim);
  sim.lockUp();
  assert.equal(sim.spike('secret').ok, true);
  assert.equal(sim.spikedStories[0].freshness, 2);
  assert.equal(sim.spikedStories[0].exposure, 1);
  assert.equal(sim.spikedStories[0].baseValue, 200);
  sim.subjectProgress[STORY_CATALOG[0].subject] = 1;
  for (let i = 0; i < 12; i++) {
    assert.equal(sim.useFile('secret', 'print-later').effects.baseValue, 300);
    assert.equal(sim.spike('secret').ok, true);
  }
  sim.useFile('secret', 'print-later');
  print(sim);
  print(sim);
  sim.lockUp();
  rejectUnchanged(sim, () => sim.spike('secret'), 'expired-file');
});

test('unknown uid/action/target and all drawer gates reject atomically', () => {
  const sim = fileDesk();
  for (const uid of [null, undefined, {}, 12, '__proto__', 'missing']) {
    rejectUnchanged(sim, () => sim.useFile(uid, 'squeeze', 'cash'), 'unknown-file');
    rejectUnchanged(sim, () => sim.shredFile(uid), 'unknown-file');
  }
  for (const action of [null, undefined, {}, 12, '__proto__', 'missing']) {
    rejectUnchanged(sim, () => sim.useFile('secret', action), 'unknown-action');
  }
  for (const target of [null, undefined, {}, 12, '__proto__', 'missing']) {
    for (const action of ['favor', 'squeeze']) rejectUnchanged(sim, () => sim.useFile('secret', action, target), 'unknown-target');
  }
  rejectUnchanged(sim, () => sim.useFile('secret', 'print-later', 'cash'), 'unknown-target');
  for (const gate of ['gameOver', 'deskTooSmall', 'summary', 'deadline', 'title', 'cold-open']) {
    const blocked = fileDesk();
    if (gate === 'summary') blocked.editionSummary = {};
    else if (gate === 'deadline') blocked.clockSec = 210;
    else if (['title', 'cold-open'].includes(gate)) blocked.phase = gate;
    else blocked[gate] = true;
    rejectUnchanged(blocked, () => blocked.useFile('secret', 'squeeze', 'cash'), 'drawer-closed');
    rejectUnchanged(blocked, () => blocked.shredFile('secret'), 'drawer-closed');
  }
});
