import { LateEditionSim } from '../js/sim.js';
import { STORY_CATALOG } from '../js/config.js';

export function makeSim(options = {}) {
  return new LateEditionSim({ seed: 82, now: () => 0, ...options });
}

export function story(uid = 'story_1', overrides = {}) {
  return { ...STORY_CATALOG[0], uid, photoVerified: false,
    scoopedByRival: false, arcId: null, arcPart: 0, ...overrides };
}

export function rival(overrides = {}) {
  return { id: 'test_rival', type: 'herald', label: 'TEST RIVAL',
    x: 50, y: 50, speed: 90, hp: 80, angle: 0,
    stunTimer: 0, targetLeadId: null, ...overrides };
}

// Keep unrelated reinforcements/interceptions out of a single-tick scenario.
export function parkOperatives(sim) {
  sim.rivalSpawnTimer = 1000;
  for (const op of sim.operatives) {
    op.x = op.targetX = 50;
    op.y = op.targetY = 50;
    op.targetLeadId = null;
    op.targetRivalId = null;
  }
}

export function arrive(op) {
  op.x = op.targetX;
  op.y = op.targetY;
}
