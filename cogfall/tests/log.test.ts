// Phase 2n-2 — totalLogCount monotonicity.
//
// The AI action banner relies on totalLogCount() incrementing on every
// player-visible log() call (and NOT incrementing for visibleToPlayer=false
// calls). turn.ts snapshots before/after the AI's act and slices G.events
// for the banner; if this counter regressed, the banner would silently
// show stale or missing entries.

import { beforeEach, describe, expect, it } from 'vitest';
import { G } from '../src/core/state';
import { log, totalLogCount } from '../src/core/log';

describe('totalLogCount', () => {
  beforeEach(() => {
    G.events = [];
    G.turn = 1;
  });

  it('increments on visible log calls', () => {
    const before = totalLogCount();
    log('one');
    log('two');
    log('three');
    expect(totalLogCount() - before).toBe(3);
  });

  it('does not increment on non-visible log calls', () => {
    const before = totalLogCount();
    log('hidden', '', false);
    log('also hidden', 'combat', false);
    expect(totalLogCount() - before).toBe(0);
    expect(G.events.length).toBe(0);
  });

  it('captures count even when the events array overflows the cap', () => {
    // The G.events array is capped at 100 entries (oldest popped). The
    // banner's slice math relies on totalLogCount staying truthful past
    // the cap.
    const before = totalLogCount();
    for (let i = 0; i < 150; i++) log(`entry ${i}`);
    expect(totalLogCount() - before).toBe(150);
    expect(G.events.length).toBe(100);
  });
});
