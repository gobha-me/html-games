import assert from 'node:assert/strict';
import test from 'node:test';
import { LateEditionSim } from '../js/sim.js';
import { STORAGE_KEY_RUN, createStorageAdapter } from '../js/adapters.js';
import { decodeSaveState, MAX_SAVE_LENGTH } from '../js/save.js';
import { makeSim } from './helpers.mjs';

function checkpoint() {
  const sim = makeSim({ seed: 87 });
  for (let i = 0; i < 4; i++) sim.completeLeadScoop(sim.leads[0]);
  sim.lockUp();
  sim.spike(sim.scoopedStories[0].uid);
  const burnedUid = sim.spikedStories[0].uid;
  for (let attempt = 0; attempt < 5 && sim.spikedStories.length; attempt++) {
    assert.equal(sim.useFile(burnedUid, 'squeeze', 'cash').ok, true);
  }
  assert.equal(sim.pendingBurns.length, 1, 'Checkpoint must carry a real seeded burned-source consequence');
  sim.spike(sim.scoopedStories[0].uid);
  sim.placeStory(sim.scoopedStories[0].uid, 'banner');
  sim.publishEdition();
  sim.editionSummary = null;
  return sim;
}

function playEdition(sim) {
  const night = sim.edition;
  for (let tick = 0; !sim.editionSummary && tick < 4300; tick++) {
    if (tick % 160 === 0 && sim.phase === 'desk') {
      for (const [i, op] of sim.operatives.entries()) {
        const lead = sim.leads[i % sim.leads.length];
        if (lead && sim.operativeAvailable(op)) sim.dispatchOperativeToLead(op.id, lead.uid);
      }
    }
    if (tick % 400 === 0) sim.fortifyPressRoom();
    if (sim.activeDilemma) sim.resolveDilemma(false);
    if (sim.phase === 'paste-up') {
      if (!sim.spikedStories.length && sim.scoopedStories.length > 2) sim.spike(sim.scoopedStories[0].uid);
      for (const slot of Object.keys(sim.frontPage)) {
        if (!sim.frontPage[slot] && sim.scoopedStories[0]) sim.placeStory(sim.scoopedStories[0].uid, slot);
      }
    }
    sim.step(0.05);
    assert.equal(sim.gameOver, false, sim.gameOverReason);
  }
  assert.equal(sim.edition, night + 1);
  assert.ok(sim.editionSummary);
  sim.editionSummary = null;
}

test('versioned round-trip preserves hash, drawer, arcs, consequences and display history', () => {
  const sim = checkpoint();
  sim.subjectStates['Captain Horgan'] = 'exposed';
  sim.subjectProgress['Captain Horgan'] = 2;
  sim.raidBlocked = true;
  const before = sim.getStateHash();
  const json = sim.serialize();
  const result = LateEditionSim.deserialize(json);
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.sim.getStateHash(), before);
  assert.equal(result.sim.serialize(), json);
  assert.notEqual(result.sim.spikedStories, sim.spikedStories);
  assert.deepEqual(result.sim.lastPrintedFrontPage, JSON.parse(JSON.stringify(sim.lastPrintedFrontPage)));
  assert.equal(result.sim.spikedStories.length, 1);
  assert.equal(Object.getPrototypeOf(result.sim.subjectStates), null);
  const startEdition = sim.edition;
  const callEdition = sim.pendingBurns[0].dueEdition;
  for (let night = startEdition; night <= callEdition; night++) {
    playEdition(sim);
    playEdition(result.sim);
    assert.equal(result.sim.getStateHash(), sim.getStateHash());
  }
  assert.equal(result.sim.pendingBurns.length, 0, 'Restored source call must arrive and resolve');
});

test('save after edition 2, then play three editions: equality with uninterrupted play', () => {
  const original = makeSim({ seed: 87 });
  playEdition(original);
  playEdition(original);
  assert.equal(original.editionsPrinted, 2);
  const loaded = LateEditionSim.deserialize(original.serialize());
  assert.equal(loaded.ok, true, loaded.reason);
  assert.equal(loaded.sim.getStateHash(), original.getStateHash());
  for (let night = 0; night < 3; night++) {
    playEdition(original);
    playEdition(loaded.sim);
    assert.equal(loaded.sim.getStateHash(), original.getStateHash());
    assert.equal(loaded.sim.serialize(), original.serialize());
  }
  assert.equal(loaded.sim.editionsPrinted, 5);
});

for (const [name, mutate] of [
  ['wrong format', (s) => { s.format = 'another-game'; }],
  ['negative funds', (s) => { s.state.cash = -1; }],
  ['NaN becomes null in JSON', (s) => { s.state.cash = NaN; }],
  ['credibility 500', (s) => { s.state.credibility = 500; }],
  ['drawer of 50', (s) => { s.state.spikedStories = Array(50).fill(s.state.spikedStories[0]); }],
  ['duplicate live uids', (s) => { s.state.leads[0].uid = s.state.spikedStories[0].uid; }],
  ['duplicate tray uid', (s) => { s.state.scoopedStories.push(s.state.scoopedStories[0]); }],
  ['invalid seed', (s) => { s.seed = 1.5; }],
  ['invalid RNG', (s) => { s.rngState = -1; }],
  ['oversized RNG', (s) => { s.rngState = 2 ** 32; }],
  ['missing field', (s) => { delete s.state.arcProgress; }],
  ['fractional edition', (s) => { s.state.edition = 2.5; }],
  ['edition mismatch', (s) => { s.state.edition = 3; }],
  ['mid-edition clock', (s) => { s.state.clockSec = 10; }],
  ['title phase', (s) => { s.state.phase = 'title'; }],
  ['counter collision', (s) => { s.state.nextLeadUid = 1; }],
  ['invalid file weight', (s) => { s.state.spikedStories[0].weight = 99; }],
  ['invalid file age', (s) => { s.state.spikedStories[0].freshness = -1; }],
  ['mismatched source uid', (s) => { s.state.spikedStories[0].story.uid = 'lead_99'; }],
  ['invalid operative speed', (s) => { s.state.operatives[0].speed = 999; }],
  ['non-array inventory', (s) => { s.state.leads = {}; }],
  ['null file', (s) => { s.state.spikedStories[0] = null; }],
]) {
  test(`tampering: ${name} is refused atomically`, () => {
    const sim = checkpoint();
    const hash = sim.getStateHash();
    const save = JSON.parse(sim.serialize());
    mutate(save);
    const result = LateEditionSim.deserialize(JSON.stringify(save));
    assert.equal(result.ok, false);
    assert.match(result.reason, /The morgue file is damaged/);
    assert.equal(result.sim, undefined);
    assert.equal(sim.getStateHash(), hash);
  });
}

for (const json of [null, undefined, '', '{', 'null', '[]', 'true', '{"format":', 'x'.repeat(MAX_SAVE_LENGTH + 1)]) {
  test(`malformed input (${typeof json}, length ${json?.length}) is refused`, () => {
    const result = LateEditionSim.deserialize(json);
    assert.equal(result.ok, false);
    assert.match(result.reason, /damaged/);
  });
}

for (const [version, message] of [[0, /older.*version 0/], [2, /not supported/], [-1, /not supported/], ['1', /not supported/]]) {
  test(`version ${version} is refused with a useful message`, () => {
    const save = JSON.parse(checkpoint().serialize());
    save.version = version;
    const result = LateEditionSim.deserialize(JSON.stringify(save));
    assert.equal(result.ok, false);
    assert.match(result.reason, message);
  });
}

test('prototype pollution and unknown instance keys are ignored at every depth', () => {
  const sim = checkpoint();
  const save = JSON.parse(sim.serialize());
  for (const record of [save, save.state, save.state.subjectStates, save.state.subjectProgress,
    save.state.leads[0], save.state.spikedStories[0], save.state.spikedStories[0].story]) {
    Object.defineProperty(record, '__proto__', { value: { polluted: true }, enumerable: true });
    record.constructor = { prototype: { polluted: true } };
  }
  save.state.storage = { writeRun: 'hostile' };
  save.state.reset = 'hostile';
  const result = LateEditionSim.deserialize(JSON.stringify(save));
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.sim.getStateHash(), sim.getStateHash());
  assert.equal({}.polluted, undefined);
  assert.equal(result.sim.polluted, undefined);
  assert.equal(typeof result.sim.reset, 'function');
  assert.equal(result.sim.storage, undefined);
});

test('serialize rejects non-finite values before JSON can silently convert them', () => {
  const sim = checkpoint();
  for (const value of [NaN, Infinity, -Infinity]) {
    sim.cash = value;
    assert.throws(() => sim.serialize(), /Invalid save/);
  }
  const state = JSON.parse(checkpoint().serialize()).state;
  state.cash = '340';
  assert.throws(() => decodeSaveState(state), /Invalid save/);
});

test('only dismissed reports can be saved; injected RNGs cannot be restored', () => {
  const sim = makeSim();
  assert.throws(() => sim.serialize(), /between editions/);
  sim.publishEdition();
  assert.throws(() => sim.serialize(), /between editions/);
  const before = sim.getStateHash();
  sim.step(10);
  assert.equal(sim.getStateHash(), before, 'A report freezes all remaining substeps');
  sim.editionSummary = null;
  assert.doesNotThrow(() => sim.serialize());
  sim.step(0.05);
  assert.throws(() => sim.serialize(), /between editions/);
  const checkpointSim = checkpoint();
  checkpointSim.injectedRng = { nextFloat: () => 0 };
  assert.throws(() => checkpointSim.serialize(), /injected RNG/);
});

test('deadline catch-up stops at the report, leaving a saveable next edition', () => {
  const sim = makeSim();
  sim.clockSec = 209.99;
  sim.step(10);
  assert.equal(sim.editionsPrinted, 1);
  assert.equal(sim.clockSec, 0);
  sim.editionSummary = null;
  assert.doesNotThrow(() => sim.serialize());
});

test('run storage round-trips, deletes only the run and leaves the score alone', () => {
  const items = new Map();
  const adapter = createStorageAdapter(() => ({
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
  }));
  assert.deepEqual(adapter.readRun(), { ok: true, json: null });
  adapter.writeBest(22222);
  const json = checkpoint().serialize();
  assert.deepEqual(adapter.writeRun(json), { ok: true });
  assert.equal(items.get(STORAGE_KEY_RUN), json);
  assert.equal(adapter.readRun().json, json);
  assert.deepEqual(adapter.clearRun(), { ok: true });
  assert.equal(adapter.readRun().json, null);
  assert.equal(adapter.readBest(), 22222);
});

test('storage access, reads, quota writes and deletion failures are non-fatal', () => {
  let writes = 0;
  const json = checkpoint().serialize();
  const ports = [
    createStorageAdapter(),
    createStorageAdapter(() => { throw new Error('Blocked'); }),
    createStorageAdapter(() => ({
      getItem() { throw new Error('Read denied'); },
      setItem() { writes++; throw Object.assign(new Error('Full'), { name: 'QuotaExceededError' }); },
      removeItem() { throw new Error('Delete denied'); },
    })),
  ];
  for (const adapter of ports) {
    const read = adapter.readRun();
    assert.ok(read.ok ? read.json === null : /cannot be read/.test(read.reason));
    assert.match(adapter.writeRun(json).reason, /full or unavailable/);
    assert.match(adapter.clearRun().reason, /could not be removed/);
  }
  assert.equal(writes, 1, 'The quota path must actually reach setItem');
});
