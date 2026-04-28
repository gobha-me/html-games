import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createSeededRng,
  getGameRng,
  getGameRngState,
  initGameRng,
  setGameRngState,
} from '../src/core/rng';
import { loadGameState, serializeGameState } from '../src/core/save';
import { G } from '../src/core/state';
import type { FactionIdx } from '../src/core/types';

function clearGameState(): void {
  G.map = null;
  G.factions = [];
  G.units = [];
  G.cities = [];
  G.events = [];
  G.aiMemory = {};
  G.goldHegemonyCounter = {};
  G.goldHegemonyThreshold = 5000;
  G.goldHegemonyRequired = 3;
  G.turn = 1;
  G.currentFactionIdx = 0 as FactionIdx;
  G.playerFactionIdx = 0 as FactionIdx;
  G.difficulty = 'medium';
  G.cameraX = 0;
  G.cameraY = 0;
  G.zoom = 1;
  G.nextUnitId = 1;
  G.nextCityId = 1;
  G.gameOver = false;
  G.selected = null;
  G.moveTargets = [];
  G.attackTargets = [];
  G.isDragging = false;
  G.dragStart = null;
  G.seed = 0;
}

function draw(n: number): number[] {
  const rng = getGameRng();
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(rng());
  return out;
}

describe('game rng', () => {
  beforeEach(() => {
    localStorage.clear();
    clearGameState();
  });

  afterEach(() => {
    localStorage.clear();
    clearGameState();
  });

  it('produces identical sequences for two initGameRng(seed) calls with the same seed', () => {
    initGameRng(42);
    const a = draw(50);
    initGameRng(42);
    const b = draw(50);
    expect(a).toEqual(b);
  });

  it('produces different sequences for different seeds', () => {
    initGameRng(1);
    const a = draw(50);
    initGameRng(2);
    const b = draw(50);
    expect(a).not.toEqual(b);
  });

  it('round-trips the cursor: getGameRngState → setGameRngState resumes the same stream', () => {
    initGameRng(123);
    const reference: number[] = [];
    initGameRng(123);
    for (let i = 0; i < 100; i++) reference.push(getGameRng()());

    initGameRng(123);
    // Advance 50, snapshot, draw 50 — should equal reference[50..99].
    const burned = draw(50);
    expect(burned).toEqual(reference.slice(0, 50));
    const cursor = getGameRngState();
    const tail = draw(50);
    expect(tail).toEqual(reference.slice(50, 100));

    // Restore the cursor and draw again — same tail.
    setGameRngState(cursor);
    const tailAgain = draw(50);
    expect(tailAgain).toEqual(reference.slice(50, 100));
  });

  it('matches createSeededRng output bit-for-bit (singleton uses the same algorithm)', () => {
    const pure = createSeededRng(7);
    const pureSeq: number[] = [];
    for (let i = 0; i < 20; i++) pureSeq.push(pure());

    initGameRng(7);
    expect(draw(20)).toEqual(pureSeq);
  });
});

describe('save/load preserves rng cursor', () => {
  beforeEach(() => {
    localStorage.clear();
    clearGameState();
  });

  afterEach(() => {
    localStorage.clear();
    clearGameState();
  });

  it('round-trips the rng so the next 100 draws are identical after save → load', () => {
    G.seed = 9001;
    initGameRng(9001);
    // Advance the cursor mid-stream so rngState is non-trivial.
    draw(37);

    // Capture the reference sequence from this exact cursor position.
    const cursor = getGameRngState();
    const reference = draw(100);

    // Rewind so the save captures the pre-reference cursor.
    setGameRngState(cursor);
    const saved = serializeGameState();
    expect(saved.state.seed).toBe(9001);
    expect(saved.state.rngState).toBe(cursor);

    // Round-trip through JSON to mirror localStorage and force-overwrite the
    // singleton with garbage so we know loadGameState is doing the work.
    const json = JSON.stringify(saved);
    const parsed = JSON.parse(json) as ReturnType<typeof serializeGameState>;
    initGameRng(0);
    draw(500);

    loadGameState(parsed);
    expect(G.seed).toBe(9001);
    expect(draw(100)).toEqual(reference);
  });

  it('migrates a v1 save by stamping a fresh seed instead of throwing', () => {
    initGameRng(555);
    const baseline = serializeGameState();
    // Simulate a save written before Phase 2b by stripping the new fields and
    // bumping the version field down to 1.
    const v1Like = JSON.parse(JSON.stringify(baseline)) as ReturnType<
      typeof serializeGameState
    >;
    v1Like.version = 1;
    delete (v1Like.state as Partial<typeof v1Like.state>).seed;
    delete (v1Like.state as Partial<typeof v1Like.state>).rngState;

    expect(() => loadGameState(v1Like)).not.toThrow();
    // Migrated saves stamp Date.now() — just assert it's a positive int now.
    expect(G.seed).toBeGreaterThan(0);
    // And the rng should be live (drawing produces a number in [0,1)).
    const x = getGameRng()();
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(1);
  });
});
