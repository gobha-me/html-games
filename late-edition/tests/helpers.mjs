import { LateEditionSim } from '../js/sim.js';
import { STORY_CATALOG } from '../js/config.js';

// Gameplay fixtures explicitly pass onboarding through its public commands.
// Opening gates are exercised separately in onboarding.test.mjs.
export function enterDesk(sim) {
  sim.startNightShift();
  sim.finishColdOpen();
  sim.dispatchOperativeToLead('rep_1', sim.leads[0].uid);
  const op = sim.operatives[0];
  op.targetLeadId = null;
  op.targetX = op.x;
  op.targetY = op.y;
  return sim;
}

export function makeSim({ night = 1, ...options } = {}) {
  const sim = enterDesk(new LateEditionSim({ seed: 82, now: () => 0, ...options }));
  sim.edition = night;
  return sim;
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
