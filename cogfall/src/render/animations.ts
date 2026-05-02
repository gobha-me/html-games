// Phase 3 S1 — animation event bus.
//
// Systems code emits typed game-event payloads here; render-side modules
// (combatEffects, unitTweens, future turn-transition / tech-pop) subscribe
// in main.ts. The bus is a leaf module: no imports from `pixi.ts`,
// `systems/`, `core/state.ts`, or anything that would pull DOM into the
// test environment. Keeping it pixi-free preserves the import boundary
// codified by the 2n-1 incident (decision-log items 8 + the unitTweens
// header) — `tests/animations.test.ts` can import it without a #map-canvas.
//
// Fan-out is synchronous and in registration order. Subscribers that need
// a re-render or RAF tick own that themselves (combatEffects + unitTweens
// already run their own RAF loops). Emitters call `emit(...)` from inside
// the same tick the game-state mutation occurred in — this preserves the
// pre-bus call sequence so behavior stays byte-identical.
//
// Decision-log item 10 in core/state.ts codifies the seam: don't bypass
// with a direct `render/...` import from systems/ — extend AnimEvent and
// add a subscriber instead.

import type { TechId } from '../data/techs';
import type { FactionIdx, VictoryType } from '../core/types';

export type AnimEvent =
  // unit-vs-unit + unit-vs-city combat resolution. defenderUnitId is null
  // for city assaults (only the attacker flashes; cities don't flash).
  | {
      type: 'combatHit';
      attackerId: number;
      defenderUnitId: number | null;
      playerInvolved: boolean;
    }
  // a unit slid from (fromQ, fromR) to its current (q, r). Subscribers
  // resolve the unit by id from G — payload stays primitive so it's
  // serializable for future replay/debug instrumentation.
  | { type: 'unitMoved'; unitId: number; fromQ: number; fromR: number }
  // emitted from movement.killUnit before the unit is removed from G.units;
  // q/r are captured at death so subscribers can paint at the death tile.
  | {
      type: 'unitKilled';
      unitId: number;
      factionIdx: FactionIdx;
      q: number;
      r: number;
    }
  // fires once per faction's endTurn, after victory checks resolve and
  // before the rotation advances. Skipped on a victory short-circuit.
  | { type: 'turnEnd'; factionIdx: FactionIdx; turn: number }
  | { type: 'techComplete'; factionIdx: FactionIdx; techId: TechId }
  | {
      type: 'cityBuilt';
      cityId: number;
      factionIdx: FactionIdx;
      buildKind: 'unit' | 'building';
      buildId: string;
      q: number;
      r: number;
    }
  | { type: 'victoryReached'; factionIdx: FactionIdx; victoryType: VictoryType };

type AnimEventType = AnimEvent['type'];
type EventOf<K extends AnimEventType> = Extract<AnimEvent, { type: K }>;
type Handler<K extends AnimEventType> = (event: EventOf<K>) => void;
export type Unsubscribe = () => void;

const handlers: { [K in AnimEventType]?: Set<Handler<K>> } = {};

export function emit<K extends AnimEventType>(event: EventOf<K>): void {
  const set = handlers[event.type] as Set<Handler<K>> | undefined;
  if (!set) return;
  for (const h of set) h(event);
}

export function on<K extends AnimEventType>(type: K, handler: Handler<K>): Unsubscribe {
  let set = handlers[type] as Set<Handler<K>> | undefined;
  if (!set) {
    set = new Set();
    handlers[type] = set as never;
  }
  set.add(handler);
  return () => {
    set?.delete(handler);
  };
}

export function off<K extends AnimEventType>(type: K, handler: Handler<K>): void {
  const set = handlers[type] as Set<Handler<K>> | undefined;
  set?.delete(handler);
}

/** Test helper. Drops every subscriber. Not called from production code. */
export function clearAllAnimSubscribers(): void {
  for (const k of Object.keys(handlers)) {
    delete handlers[k as AnimEventType];
  }
}
