// Phase 3 S1 — animation event bus.
//
// Pure pub-sub leaf module: no game state, no DOM. The bus must stay
// pixi-free so the import boundary established by the 2n-1 incident
// (combat → movement → unitTweens transitively pulling pixi.ts into the
// test environment) doesn't regress.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAllAnimSubscribers, emit, off, on } from '../src/render/animations';

afterEach(() => {
  clearAllAnimSubscribers();
});

describe('animation bus', () => {
  it('fires registered handlers with the event payload', () => {
    const handler = vi.fn();
    on('combatHit', handler);
    emit({ type: 'combatHit', attackerId: 1, defenderUnitId: 2, playerInvolved: true });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      type: 'combatHit',
      attackerId: 1,
      defenderUnitId: 2,
      playerInvolved: true,
    });
  });

  it('does nothing when no subscriber is registered', () => {
    expect(() =>
      emit({ type: 'turnEnd', factionIdx: 0 as never, turn: 1 })
    ).not.toThrow();
  });

  it('fans out to multiple subscribers in registration order', () => {
    const calls: string[] = [];
    on('unitMoved', () => calls.push('a'));
    on('unitMoved', () => calls.push('b'));
    emit({ type: 'unitMoved', unitId: 7, fromQ: 0, fromR: 0 });
    expect(calls).toEqual(['a', 'b']);
  });

  it('isolates handlers across event types', () => {
    const moved = vi.fn();
    const killed = vi.fn();
    on('unitMoved', moved);
    on('unitKilled', killed);
    emit({ type: 'unitMoved', unitId: 1, fromQ: 0, fromR: 0 });
    expect(moved).toHaveBeenCalledTimes(1);
    expect(killed).not.toHaveBeenCalled();
  });

  it('removes a subscriber via the returned unsub function', () => {
    const handler = vi.fn();
    const unsub = on('combatHit', handler);
    unsub();
    emit({ type: 'combatHit', attackerId: 1, defenderUnitId: null, playerInvolved: false });
    expect(handler).not.toHaveBeenCalled();
  });

  it('removes a subscriber via off()', () => {
    const handler = vi.fn();
    on('combatHit', handler);
    off('combatHit', handler);
    emit({ type: 'combatHit', attackerId: 1, defenderUnitId: null, playerInvolved: false });
    expect(handler).not.toHaveBeenCalled();
  });

  it('clearAllAnimSubscribers wipes every type', () => {
    const a = vi.fn();
    const b = vi.fn();
    on('unitMoved', a);
    on('unitKilled', b);
    clearAllAnimSubscribers();
    emit({ type: 'unitMoved', unitId: 1, fromQ: 0, fromR: 0 });
    emit({ type: 'unitKilled', unitId: 2, factionIdx: 0 as never, q: 0, r: 0 });
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });
});
