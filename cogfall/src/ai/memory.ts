// Per-faction AI scratch space. The prototype stores grudges (per-target
// grievance scores), the current strategicPhase, a (currently unused)
// targetEnemy slot, and the turn of the last war declaration so the AI
// doesn't immediately re-declare.

import { G } from '../core/state';
import type { AIMemory, FactionIdx } from '../core/types';

export function initAIMemory(factionIdx: FactionIdx): AIMemory {
  const mem: AIMemory = {
    grudges: {},
    strategicPhase: 'expand',
    targetEnemy: null,
    lastDeclareWarTurn: 0,
  };
  G.aiMemory[factionIdx] = mem;
  return mem;
}
