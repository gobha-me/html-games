// Arc framework — trigger predicate evaluator + ActiveArc (ICD-10 v0.1.1).
// Pure module tests — no World construction needed.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  evalTrigger,
  findArc,
  findArcEpisode,
  findArcOutcome,
  ActiveArc,
  ARCS,
  THE_LONGSHOREMAN_STRIKE,
} from '../js/sim/arcs.js';

test('arcs: heat_above compares world.heat to threshold', () => {
  const p = { kind: 'heat_above', threshold: 50 };
  assert.equal(evalTrigger(p, { heat: 60 }), true);
  assert.equal(evalTrigger(p, { heat: 50 }), false);
  assert.equal(evalTrigger(p, { heat: 0  }), false);
  assert.equal(evalTrigger(p, {}),           false);
});

test('arcs: district_heat_above reads the per-district map', () => {
  const p = { kind: 'district_heat_above', district: 'docks', threshold: 30 };
  assert.equal(evalTrigger(p, { districtHeat: { docks: 50 } }), true);
  assert.equal(evalTrigger(p, { districtHeat: { docks: 30 } }), false);
  assert.equal(evalTrigger(p, { districtHeat: { hillside: 99 } }), false);
  assert.equal(evalTrigger(p, {}), false);
});

test('arcs: district_uncovered reads the coverage set', () => {
  const p = { kind: 'district_uncovered', district: 'docks' };
  assert.equal(evalTrigger(p, { coveredDistricts: new Set(['docks']) }),    false);
  assert.equal(evalTrigger(p, { coveredDistricts: new Set(['hillside']) }), true);
  assert.equal(evalTrigger(p, { coveredDistricts: new Set() }),             true);
  assert.equal(evalTrigger(p, {}),                                          true);
});

test('arcs: observer_silent_n_editions reads the tail (not-loud semantics)', () => {
  const p = { kind: 'observer_silent_n_editions', n: 3 };
  // Silent states pass (loud = PUBLISH or WARN; everything else is silent).
  assert.equal(evalTrigger(p, { observerRecentStates: ['SILENCED', 'SILENCED', 'SILENCED'] }), true);
  assert.equal(evalTrigger(p, { observerRecentStates: ['INVESTIGATE', 'INVESTIGATE', 'INVESTIGATE'] }), true);
  assert.equal(evalTrigger(p, { observerRecentStates: ['DESPERATE', 'INVESTIGATE', 'SILENCED'] }), true);
  // A loud state in the tail breaks the predicate.
  assert.equal(evalTrigger(p, { observerRecentStates: ['PUBLISH', 'INVESTIGATE', 'INVESTIGATE'] }), false);
  assert.equal(evalTrigger(p, { observerRecentStates: ['INVESTIGATE', 'WARN', 'INVESTIGATE'] }), false);
  // Older loud states are ignored — only the last N matter.
  assert.equal(evalTrigger(p, { observerRecentStates: ['PUBLISH', 'INVESTIGATE', 'INVESTIGATE', 'INVESTIGATE'] }), true);
  // Not enough history yet.
  assert.equal(evalTrigger(p, { observerRecentStates: ['SILENCED', 'SILENCED'] }), false);
  assert.equal(evalTrigger(p, {}), false);
});

test('arcs: rival_state matches by rival id + state name', () => {
  const p = { kind: 'rival_state', rival: 'herald', state: 'WIRED' };
  assert.equal(evalTrigger(p, { rivalStates: { herald: 'WIRED', observer: 'INVESTIGATE' } }), true);
  assert.equal(evalTrigger(p, { rivalStates: { herald: 'IDLE' } }), false);
  assert.equal(evalTrigger(p, {}), false);
});

test('arcs: edition_at_least compares against cycle edition', () => {
  const p = { kind: 'edition_at_least', edition: 5 };
  assert.equal(evalTrigger(p, { edition: 10 }), true);
  assert.equal(evalTrigger(p, { edition: 5  }), true);
  assert.equal(evalTrigger(p, { edition: 4  }), false);
  assert.equal(evalTrigger(p, {}),              false);
});

test('arcs: all_of short-circuits on the first false child', () => {
  const p = { kind: 'all_of', children: [
    { kind: 'heat_above',       threshold: 50 },
    { kind: 'edition_at_least', edition: 3    },
  ]};
  assert.equal(evalTrigger(p, { heat: 60, edition: 5 }), true);
  assert.equal(evalTrigger(p, { heat: 60, edition: 2 }), false);
  assert.equal(evalTrigger(p, { heat: 40, edition: 5 }), false);
  assert.equal(evalTrigger(p, { heat: 40, edition: 2 }), false);
});

test('arcs: any_of short-circuits on the first true child', () => {
  const p = { kind: 'any_of', children: [
    { kind: 'heat_above',       threshold: 50 },
    { kind: 'edition_at_least', edition: 3    },
  ]};
  assert.equal(evalTrigger(p, { heat: 60, edition: 0 }), true);
  assert.equal(evalTrigger(p, { heat: 40, edition: 5 }), true);
  assert.equal(evalTrigger(p, { heat: 60, edition: 5 }), true);
  assert.equal(evalTrigger(p, { heat: 40, edition: 2 }), false);
});

test('arcs: negate flag flips the nested-NOT idiom (ICD-10 v0.1.1 §Notes)', () => {
  // Longshoreman's "Docks must have a covering Bureau" → an all_of wrapper
  // with negate: true around district_uncovered. Uncovered → predicate
  // TRUE → negated FALSE; covered → predicate FALSE → negated TRUE.
  const p = { kind: 'all_of', negate: true, children: [
    { kind: 'district_uncovered', district: 'docks' },
  ]};
  assert.equal(evalTrigger(p, { coveredDistricts: new Set() }),         false);
  assert.equal(evalTrigger(p, { coveredDistricts: new Set(['docks']) }), true);
});

test('arcs: nested composers (depth 3) evaluate correctly', () => {
  // any_of[ all_of[heat>50, edition≥3], all_of[rival_state(herald,WIRED)] ]
  const p = { kind: 'any_of', children: [
    { kind: 'all_of', children: [
      { kind: 'heat_above',       threshold: 50 },
      { kind: 'edition_at_least', edition: 3    },
    ]},
    { kind: 'all_of', children: [
      { kind: 'rival_state', rival: 'herald', state: 'WIRED' },
    ]},
  ]};
  // Right branch only.
  assert.equal(evalTrigger(p, { heat: 0, edition: 0, rivalStates: { herald: 'WIRED' } }), true);
  // Left branch only.
  assert.equal(evalTrigger(p, { heat: 60, edition: 5, rivalStates: { herald: 'IDLE' } }), true);
  // Neither.
  assert.equal(evalTrigger(p, { heat: 10, edition: 1, rivalStates: { herald: 'IDLE' } }), false);
});

test('arcs: THE_LONGSHOREMAN_STRIKE trigger fires when all three conditions hold', () => {
  const ctx = {
    districtHeat:         { docks: 70 },
    coveredDistricts:     new Set(['docks']),
    observerRecentStates: ['SILENCED', 'SILENCED', 'SILENCED'],
  };
  assert.equal(evalTrigger(THE_LONGSHOREMAN_STRIKE.trigger, ctx), true);
});

test('arcs: THE_LONGSHOREMAN_STRIKE trigger fails when Docks is uncovered', () => {
  const ctx = {
    districtHeat:         { docks: 70 },
    coveredDistricts:     new Set(),    // no Bureau in Docks
    observerRecentStates: ['SILENCED', 'SILENCED', 'SILENCED'],
  };
  assert.equal(evalTrigger(THE_LONGSHOREMAN_STRIKE.trigger, ctx), false);
});

test('arcs: THE_LONGSHOREMAN_STRIKE trigger fails when Observer was noisy', () => {
  const ctx = {
    districtHeat:         { docks: 70 },
    coveredDistricts:     new Set(['docks']),
    observerRecentStates: ['INVESTIGATE', 'PUBLISH', 'SILENCED'],
  };
  assert.equal(evalTrigger(THE_LONGSHOREMAN_STRIKE.trigger, ctx), false);
});

test('arcs: findArc / findArcEpisode / findArcOutcome return registered records', () => {
  assert.equal(findArc('longshoreman_strike'), THE_LONGSHOREMAN_STRIKE);
  assert.equal(findArc('unknown'), null);

  const walkout = findArcEpisode('longshoreman_strike', 'longshoreman_strike.walkout');
  assert.equal(walkout.headline, 'THE WALKOUT — Longshoremen halt the harbor');
  assert.equal(walkout.branch_table.choices.length, 2);
  assert.equal(findArcEpisode('longshoreman_strike', 'unknown'), null);

  const labor = findArcOutcome('longshoreman_strike', 'labor_outcome');
  assert.equal(labor.cash_one_time, 2000);
  assert.equal(labor.district_disposition.value, 'loyal');
  assert.equal(findArcOutcome('longshoreman_strike', 'unknown'), null);
});

test('arcs: ARCS registry contains the authored arc', () => {
  assert.equal(ARCS.length, 1);
  assert.equal(ARCS[0].id, 'longshoreman_strike');
});

test('arcs: ActiveArc.pickBranch advances by label', () => {
  const arc = new ActiveArc({
    arcId:          'longshoreman_strike',
    currentEpisode: 'longshoreman_strike.walkout',
    spawnEdition:   1,
  });
  const res = arc.pickBranch('splash');
  assert.equal(res.ok, true);
  assert.equal(res.kind, 'advance');
  assert.equal(arc.currentEpisode, 'longshoreman_strike.foremans_wife');
  assert.deepEqual(arc.chosenPath, ['splash']);
});

test('arcs: ActiveArc.pickBranch on terminal returns outcomeId', () => {
  const arc = new ActiveArc({
    arcId:          'longshoreman_strike',
    currentEpisode: 'longshoreman_strike.walkout',
    spawnEdition:   1,
  });
  const res = arc.pickBranch('bury');
  assert.equal(res.ok, true);
  assert.equal(res.kind, 'terminal');
  assert.equal(res.outcomeId, 'bury_outcome');
  assert.deepEqual(arc.chosenPath, ['bury']);
});

test('arcs: ActiveArc.pickBranch rejects unknown labels and unknown episodes', () => {
  const arc = new ActiveArc({
    arcId:          'longshoreman_strike',
    currentEpisode: 'longshoreman_strike.walkout',
    spawnEdition:   1,
  });
  const bad = arc.pickBranch('nope');
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'invalid_choice');
  // No mutation on reject.
  assert.equal(arc.currentEpisode, 'longshoreman_strike.walkout');
  assert.deepEqual(arc.chosenPath, []);

  arc.currentEpisode = 'longshoreman_strike.unknown';
  const stale = arc.pickBranch('splash');
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, 'no_episode');
});

test('arcs: ActiveArc snap / fromSnap round-trip preserves state', () => {
  const arc = new ActiveArc({
    arcId:          'longshoreman_strike',
    currentEpisode: 'longshoreman_strike.company_man',
    chosenPath:     ['splash', 'humanize'],
    spawnEdition:   3,
  });
  const snap = arc.snap();
  assert.deepEqual(snap, {
    arc_id:          'longshoreman_strike',
    current_episode: 'longshoreman_strike.company_man',
    chosen_path:     ['splash', 'humanize'],
    spawn_edition:   3,
  });
  const restored = ActiveArc.fromSnap(snap);
  assert.equal(restored.arcId, 'longshoreman_strike');
  assert.equal(restored.currentEpisode, 'longshoreman_strike.company_man');
  assert.deepEqual(restored.chosenPath, ['splash', 'humanize']);
  assert.equal(restored.spawnEdition, 3);
});
