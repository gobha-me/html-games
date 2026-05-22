// Late Edition — slow-mo controller (milestone 0.10.1, G-07).
//
// Pure module. The main loop owns one SlowMoState; input.js's Space handler
// calls trigger(); the loop calls speedFactor() each frame and multiplies
// TICK_DT before passing to world.tick(). State is real-time only (no sim
// coupling, no save persistence) so we avoid an ICD-04 bump — acceptable
// because the cooldown is short (5 s active + 25 s cooldown) and only
// meaningful within an edition.
//
// Design Doc §19 line 1168: "Space toggles slow-mo (50% speed for 5 real
// seconds, with a 30s cooldown — never pause; pause kills RTS texture)."
// We interpret the 30 s as "from trigger" — total recharge cycle is 30 s,
// of which the first 5 s are slow.

export const SLOW_MO_ACTIVE_MS = 5_000;
export const SLOW_MO_COOLDOWN_MS = 30_000;
export const SLOW_MO_FACTOR = 0.5;

export function newSlowMoState() {
  return {
    activeUntilMs: 0,    // performance.now() ms when slow-mo expires
    cooldownUntilMs: 0,  // performance.now() ms when next trigger is allowed
  };
}

// Returns the state after attempting to trigger. If still on cooldown,
// returns the input state unchanged (so callers can `state = trigger(state, now)`
// without conditional bookkeeping). Pure — no side effects, no Date.now.
export function triggerSlowMo(state, now) {
  if (now < state.cooldownUntilMs) return state;
  return {
    activeUntilMs:   now + SLOW_MO_ACTIVE_MS,
    cooldownUntilMs: now + SLOW_MO_COOLDOWN_MS,
  };
}

// Current sim-tick multiplier. 0.5 while active; 1 otherwise.
export function speedFactor(state, now) {
  return now < state.activeUntilMs ? SLOW_MO_FACTOR : 1;
}

// For HUD debug / future visual cue: how much of the active window remains,
// in ms. Returns 0 when not active.
export function activeRemainingMs(state, now) {
  return Math.max(0, state.activeUntilMs - now);
}
