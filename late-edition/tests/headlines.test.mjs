import { test } from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeHeadline } from '../js/sim/headlines.js';
import { DISTRICTS } from '../js/sim/districts.js';
import { SeededRng } from '../js/sim/seeded-rng.js';

// 0.10.0 (audit G-05): slot-grammar headlines (Design Doc §18). The synth
// reads district + flavor + tier and produces a player-facing string for
// the EditionSummary digest + run-summary top-headline readout.

test('synthesizeHeadline returns a non-empty string for every district / flavor / tier triple', () => {
  const rng = new SeededRng(1);
  for (const d of DISTRICTS) {
    for (const flavor of ['vice', 'violence', 'money', 'labor']) {
      for (const tier of ['whisper', 'investigation', 'arc']) {
        const story = { district: d.id, flavor, tier };
        const line = synthesizeHeadline(story, rng);
        assert.equal(typeof line, 'string');
        assert.ok(line.length > 0, `${d.id} / ${flavor} / ${tier} produced an empty headline`);
      }
    }
  }
});

test('Investigation tier carries an EXCLUSIVE register cue; whisper does not', () => {
  const rngA = new SeededRng(2);
  const rngB = new SeededRng(2);
  const whisper = synthesizeHeadline({ district: 'docks', flavor: 'vice', tier: 'whisper' }, rngA);
  const invest  = synthesizeHeadline({ district: 'docks', flavor: 'vice', tier: 'investigation' }, rngB);
  assert.ok(!whisper.startsWith('EXCLUSIVE'), `whisper should not get prefix: ${whisper}`);
  assert.ok(invest.startsWith('EXCLUSIVE'), `investigation should get prefix: ${invest}`);
});

test('synthesizeHeadline is deterministic for the same rng state', () => {
  const a1 = synthesizeHeadline({ district: 'docks', flavor: 'vice', tier: 'whisper' }, new SeededRng(99));
  const a2 = synthesizeHeadline({ district: 'docks', flavor: 'vice', tier: 'whisper' }, new SeededRng(99));
  assert.equal(a1, a2);
});

test('Docks actors and Hillside actors are distinct pools', () => {
  // Sample 200 headlines per district and look at the leading actor token.
  const seen = { docks: new Set(), hillside: new Set() };
  for (let i = 0; i < 200; i++) {
    const docksLine = synthesizeHeadline({ district: 'docks', flavor: 'vice', tier: 'whisper' }, new SeededRng(i));
    const hillsideLine = synthesizeHeadline({ district: 'hillside', flavor: 'money', tier: 'whisper' }, new SeededRng(i + 99999));
    seen.docks.add(docksLine.split(' ')[0]);
    seen.hillside.add(hillsideLine.split(' ')[0]);
  }
  // No overlap of actor leads — districts.js actor pools are disjoint.
  for (const actor of seen.docks) {
    assert.ok(!seen.hillside.has(actor), `${actor} appears in both districts`);
  }
});

test('Unknown district falls back to a sensible default (does not throw)', () => {
  const rng = new SeededRng(1);
  const line = synthesizeHeadline({ district: 'atlantis', flavor: 'vice', tier: 'whisper' }, rng);
  assert.equal(typeof line, 'string');
  assert.ok(line.length > 0);
});
