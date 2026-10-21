import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ESLint } from 'eslint';
import { LateEditionSim, MAX_SUBSTEP_SEC, MAX_CATCHUP_SEC } from '../js/sim.js';
import { mulberry32 } from '../js/rng.js';
import { createAudioAdapter, createStorageAdapter, resolveSeed } from '../js/adapters.js';
import { makeSim, enterDesk } from './helpers.mjs';
import { isUnlocked, EDITION_DURATION_SEC } from '../js/config.js';
import { presentation } from '../js/presentation.js';

function playFiveEditions(options = {}) {
  const sim = makeSim({ seed: 81, ...options });
  const hashes = [];
  for (let edition = 0; edition < 5; edition++) {
    for (let tick = 0; tick < 4200; tick++) {
      if (tick % 160 === 0 && sim.phase === 'desk') {
        for (const [index, id] of ['rep_1', 'rep_2', 'photog_1'].entries()) {
          const lead = sim.leads[index % sim.leads.length];
          if (lead && isUnlocked(id === 'photog_1' ? 'photographer' : 'reporter', sim.edition)) assert.equal(sim.dispatchOperativeToLead(id, lead.uid), true);
        }
      }
      if (tick % 400 === 0) sim.fortifyPressRoom();
      if (tick === 1900) sim.resolveDilemma(edition % 2 === 0);
      if (sim.phase === 'paste-up') {
        for (const slot of ['banner', 'above_fold', 'photo_expose', 'editorial']) {
          const story = sim.scoopedStories[0];
          if (story && !sim.frontPage[slot]) assert.equal(sim.placeStory(story.uid, slot).ok, true);
        }
      }
      sim.step(MAX_SUBSTEP_SEC);
      assert.equal(sim.gameOver, false, sim.gameOverReason);
    }
    sim.publishEdition();
    hashes.push(sim.getStateHash());
    if (edition < 4) sim.editionSummary = null;
  }
  assert.equal(sim.editionsPrinted, 5);
  assert.equal(sim.edition, 6);
  assert.ok(sim.scoopsTotal > 5, 'Replay must exercise investigation and plating');
  assert.ok(sim.nextRivalUid > 5, 'Replay must exercise rivals');
  assert.equal(sim.dilemmaIdx, 2, 'Only nights four and five place automatic calls');
  assert.equal(sim.editionSummary.edition, 5);
  return { sim, hashes };
}

test('five-edition scripted replay matches the golden gameplay hashes', () => {
  const first = playFiveEditions();
  assert.deepEqual(first.hashes, playFiveEditions().hashes);
  assert.deepEqual(first.hashes, [
    // #86: subjects, their publication status/progress, pending burns and raid
    // protection join canonical state. Replay inputs remain unchanged.
    '6d444dc1', 'cfe9d143', 'e6043995', '72c219ce', 'f250819d',
  ]);
  assert.notEqual(first.sim.getStateHash(), playFiveEditions({ seed: 82 }).sim.getStateHash());
});

test('sim source contains no forbidden entropy or browser identifiers', () => {
  const source = readFileSync(new URL('../js/sim.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bMath\s*(?:\.\s*random|\[\s*['"]random['"]\s*\])/);
  assert.doesNotMatch(source, /\b(?:Date|window|document|localStorage|performance)\b/);
});

test('production ESLint rejects forbidden globals and properties in sim only', async () => {
  const eslint = new ESLint({ cwd: new URL('../', import.meta.url).pathname });
  for (const code of ['Math.random();', 'Math["random"]();', 'Date.now();',
    'new Date();', 'window.alert();', 'document.querySelector("x");',
    'localStorage.getItem("x");', 'performance.now();', 'globalThis.Date.now();']) {
    const [result] = await eslint.lintText(code, { filePath: 'js/sim.js' });
    assert.ok(result.messages.some((message) => message.ruleId.startsWith('no-restricted-')), code);
  }
  const [renderer] = await eslint.lintText('Math.random();', { filePath: 'js/renderer.js' });
  assert.equal(renderer.errorCount, 0);
});

for (const dt of [NaN, -1, 0, Infinity, -Infinity, undefined, '1']) {
  test(`dt ${String(dt)} changes no state and consumes no random values`, () => {
    const sim = makeSim({ seed: 3 });
    sim.dispatchOperativeToLead('rep_1', sim.leads[0].uid);
    sim.triggerRotaryDilemma();
    const before = sim.getStateHash();
    const wire = structuredClone(sim.wireLog);
    sim.step(dt);
    assert.equal(sim.getStateHash(), before);
    assert.deepEqual(sim.wireLog, wire);
    assert.equal(sim.rng.getState(), mulberry32(3).getState());
  });
}

test('10 seconds subdivides identically to 200 ticks without teleporting', () => {
  const big = makeSim({ seed: 42 });
  const small = makeSim({ seed: 42 });
  for (const sim of [big, small]) sim.dispatchOperativeToLead('rep_1', sim.leads[0].uid);
  big.step(10);
  for (let i = 0; i < 200; i++) small.step(0.05);
  assert.equal(big.getStateHash(), small.getStateHash());
  assert.ok(Math.abs(big.time - 10) < 1e-10);
  assert.equal(big.nextRivalUid, 1, 'Rebalanced first rival arrives at 21 seconds');
  big.step(10);
  big.step(1.05);
  assert.equal(big.nextRivalUid, 2, 'First rival spawns after the scaled interval');
  assert.ok(big.scoopsTotal > 0, 'Travel and investigation both advance');
});

test('huge finite dt is bounded and fractional remainder is retained', () => {
  const sim = makeSim();
  const bounded = makeSim();
  sim.step(Number.MAX_VALUE);
  bounded.step(MAX_CATCHUP_SEC);
  assert.equal(sim.getStateHash(), bounded.getStateHash());
  sim.step(0.123);
  bounded.step(0.05);
  bounded.step(0.05);
  bounded.step(0.123 - 2 * 0.05);
  assert.equal(sim.getStateHash(), bounded.getStateHash());
});

for (const flag of ['paused', 'gameOver']) {
  test(`${flag} blocks every substep`, () => {
    const sim = makeSim();
    sim[flag] = true;
    const hash = sim.getStateHash();
    sim.step(10);
    assert.equal(sim.getStateHash(), hash);
  });
}

for (const value of [null, undefined, '', '  ', 'garbage', '{broken', 'NaN',
  'Infinity', '-1', NaN, Infinity, -1, {}, true]) {
  test(`corrupt or absent stored score ${String(value)} becomes zero`, () => {
    const storage = createStorageAdapter(() => ({ getItem: () => value }));
    assert.equal(storage.readBest(), 0);
    const sim = makeSim({ storage });
    assert.equal(sim.highCirculation, 0);
    const custom = makeSim({ storage: { readBest: () => value } });
    assert.equal(custom.highCirculation, 0, 'Custom ports must be sanitized too');
    assert.doesNotThrow(() => sim.publishEdition());
    assert.equal(sim.highCirculation, sim.circulation);
  });
}

test('valid stored score is retained and writes keep the existing key', () => {
  const writes = [];
  const storage = createStorageAdapter(() => ({
    getItem(key) {
      assert.equal(key, 'lateEdition.bestCirculation.v2');
      return '20000';
    },
    setItem: (...args) => writes.push(args),
  }));
  const sim = makeSim({ storage });
  sim.publishEdition();
  assert.equal(sim.highCirculation, 20000);
  assert.equal(writes.length, 0, 'Lower scores must not overwrite a best');
  sim.editionSummary = null;
  sim.completeLeadScoop(sim.leads[0]);
  sim.lockUp();
  sim.placeStory(sim.scoopedStories[0].uid, 'banner');
  sim.step(MAX_SUBSTEP_SEC);
  sim.publishEdition();
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], ['lateEdition.bestCirculation.v2', String(sim.highCirculation)]);
});

test('throwing storage access, reads and quota-exceeded writes cannot stop play', () => {
  let writes = 0;
  const quota = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
  const ports = [
    createStorageAdapter(),
    createStorageAdapter(() => { throw new Error('access denied'); }),
    createStorageAdapter(() => ({
      getItem() { throw new Error('read denied'); },
      setItem() { writes++; throw quota; },
    })),
    { readBest() { throw new Error('read failed'); }, writeBest() { writes++; throw quota; } },
  ];
  for (const storage of ports) {
    const sim = makeSim({ storage });
    assert.equal(sim.highCirculation, 0);
    assert.doesNotThrow(() => sim.publishEdition());
    assert.equal(sim.editionsPrinted, 1);
    assert.equal(sim.highCirculation, sim.circulation);
  }
  assert.equal(writes, 2, 'Both quota failure paths must be exercised');
});

test('adapters, saved records, clocks and cosmetics do not change gameplay', () => {
  let timestamp = 100;
  const sounds = [];
  const baseline = playFiveEditions();
  const adapted = playFiveEditions({
    now: () => timestamp++,
    storage: { readBest: () => 999999, writeBest() { throw new Error('full'); } },
    audio: { dispatch() { sounds.push(this); } },
  });
  assert.deepEqual(baseline.hashes, adapted.hashes);
  assert.ok(sounds.length > 0);
  assert.ok(adapted.sim.wireLog.some((entry) => entry.at >= 100));
  const { sim } = adapted;
  const hash = sim.getStateHash();
  sim.cabs.length = 0;
  sim.flashes.push({ x: 1, y: 2 });
  sim.callouts.length = 0;
  sim.banner.title = 'changed';
  sim.operatives[0].angle = 999;
  sim.operatives[0].state = 'cosmetic';
  sim.wireLog.length = 0;
  assert.equal(sim.getStateHash(), hash);
  sim.cash++;
  assert.notEqual(sim.getStateHash(), hash);
});

test('canonical hashing ignores object key order but detects RNG advancement', () => {
  const sim = makeSim({ seed: 12 });
  const hash = sim.getStateHash();
  sim.frontPage = Object.fromEntries(Object.entries(sim.frontPage).reverse());
  assert.equal(sim.getStateHash(), hash);
  sim.nextFloat();
  assert.notEqual(sim.getStateHash(), hash);
});

test('dilemma effect copy is cosmetic but effect values affect the hash', () => {
  const sim = makeSim({ night: 4 });
  sim.triggerRotaryDilemma();
  // Clone nested config effects so this adversarial mutation stays run-local.
  sim.activeDilemma = structuredClone(sim.activeDilemma);
  const hash = sim.getStateHash();
  sim.activeDilemma.acceptEffect.wire = 'alternate copy';
  sim.activeDilemma.rejectEffect.wire = 'alternate copy';
  assert.equal(sim.getStateHash(), hash);
  sim.activeDilemma.acceptEffect.cash = 999;
  assert.notEqual(sim.getStateHash(), hash);
});

test('injected RNG is used and seeded reset restarts the default stream', () => {
  const rng = mulberry32(24);
  const sim = makeSim({ seed: 1, rng });
  assert.equal(sim.rng, rng);
  assert.equal(sim.nextFloat(), mulberry32(24).nextFloat());
  const seeded = new LateEditionSim({ seed: 2 });
  const hash = seeded.getStateHash();
  enterDesk(seeded);
  seeded.step(10);
  seeded.reset();
  assert.equal(seeded.getStateHash(), hash);
});

test('missing/partial audio is a no-op and methods retain their receiver', () => {
  const audio = { count: 0, dispatch() { this.count++; } };
  const adapter = createAudioAdapter(audio);
  adapter.dispatch();
  adapter.phoneRing();
  assert.equal(audio.count, 1);
  const sim = makeSim();
  assert.doesNotThrow(() => {
    sim.dispatchOperativeToLead('rep_1', sim.leads[0].uid);
    sim.triggerWiretap();
    sim.acceptSyndicateBribe();
    sim.fortifyPressRoom();
    sim.triggerRotaryDilemma();
    sim.resolveDilemma();
    sim.completeLeadScoop(sim.leads[0]);
    sim.publishEdition();
    sim.step(10);
  });
});

test('URL seed parsing retains zero and rejects malformed/nonfinite seeds', () => {
  for (const value of [null, '', ' ', 'abc', '1.2', '1e3', 'Infinity', '9007199254740992']) {
    assert.equal(resolveSeed(value, 123), 123);
  }
  assert.equal(resolveSeed('0', 123), 0);
  assert.equal(resolveSeed('-42', 123), -42);
});

test('presentation preserves newsroom clock and grouped numbers', () => {
  assert.equal(presentation.clock(0), '06:00 PM');
  assert.equal(presentation.clock(EDITION_DURATION_SEC / 2), '09:00 PM');
  assert.equal(presentation.clock(EDITION_DURATION_SEC), '12:00 AM');
  assert.equal(presentation.clock(EDITION_DURATION_SEC + 10), '12:00 AM');
  assert.equal(presentation.editionPrinted(1, -1800, 110),
    'EDITION #1 PRINTED: -1,800 readers, +$110 revenue.');
});
