// Late Edition — entry point.
// Wires sim, renderer, input. Drives a fixed-step sim loop with
// renderer interpolation between ticks (ICD-01 v0.3 §Animation playhead).

import { Renderer } from './render/renderer.js';
import { World } from './sim/world-state.js';
import { attachInput } from './input.js';
import { HudCorkboard } from './hud.js';
import { DebriefPanel } from './debrief-panel.js';
import { GameOverOverlay } from './game-over-overlay.js';
import { loadSave, saveNow } from './sim/save.js';
import { hasWebGL, mountWebGLUnavailable } from './webgl-unavailable.js';
import { newSlowMoState, triggerSlowMo, speedFactor } from './slow-mo.js';

const TICK_HZ = 30;
const TICK_DT = 1 / TICK_HZ;

const root = document.getElementById('world');
if (!root) throw new Error('world root not found');
const hudRoots = {
  topCards: document.getElementById('hud-top-cards'),
  deadline: document.getElementById('hud-deadline-strip'),
  dossier:  document.getElementById('hud-dossier'),
  tutorial: document.getElementById('hud-tutorial-note'),
};
for (const [k, el] of Object.entries(hudRoots)) {
  if (!el) throw new Error(`hud root ${k} not found`);
}
const panelRoot = document.getElementById('debrief-panel');
if (!panelRoot) throw new Error('debrief-panel root not found');
const gameOverRoot = document.getElementById('gameover-overlay');
if (!gameOverRoot) throw new Error('gameover-overlay root not found');

// v0.9.1 (#293): WebGL context creation can fail on Mesa llvmpipe, Chrome
// with hardware acceleration disabled, over-the-limit tabs, etc. Pre-flight
// probe short-circuits cleanly; the catch is the last-resort for failures
// that get past the probe (e.g. driver crash inside THREE construction).
if (!hasWebGL()) {
  mountWebGLUnavailable(root, new Error('WebGL not supported in this browser'));
  throw new Error('WebGL not supported in this browser');
}
let renderer;
try {
  renderer = new Renderer(root);
} catch (err) {
  mountWebGLUnavailable(root, err);
  throw err;
}
// 0.8 (ICD-04 v0.1): attempt to restore from localStorage; fall through to
// a fresh World on no-save / parse-fail / unknown-future-version.
const world = loadSave() ?? new World();
// 1.0.1 (ICD-09 v0.1.1): wire the Archive UI hold/release gesture as a
// callback so the HUD stays projection-only and the World holds the mutator.
const hud = new HudCorkboard(hudRoots, {
  toggleArchive: (storyId) => world.toggleArchive(storyId),
  // 1.1.0 (ICD-10 v0.1.1 §Open-Q3 close): arc branch-pick gesture from the
  // dossier chip strip. World records the label; effects fire at the
  // verified → plated boundary in _fireDebrief.
  pickArcBranch: (storyId, label) => world.pickArcBranch(storyId, label),
});
new DebriefPanel(panelRoot, world);
new GameOverOverlay(gameOverRoot, world);

// 0.10.1 (G-07): slow-mo state is real-time only (no save persistence) —
// triggered by input.js's Space handler, consumed by the loop multiplier.
let slowMo = newSlowMoState();
attachInput(root, renderer, world, {
  triggerSlowMo: () => { slowMo = triggerSlowMo(slowMo, performance.now()); },
});

// 0.8 save trigger cadence (ICD-04 §Save-trigger-surface settles here —
// the ICD recommendation is sim-external and may be settled by the 0.8
// session without an ICD bump):
//   - on CYCLE_BEGIN       — fires immediately after EDITION_DEBRIEF_END
//                            inside ackDebrief, capturing the just-started
//                            edition with a fresh clock. Saving on
//                            EDITION_DEBRIEF_END itself would capture the
//                            cycle mid-transition (fire_fired=true,
//                            remainingMs=0, edition=N before cycle.start
//                            advances to N+1) and the load would be stuck.
//                            The constructor-time start(1) is dispatched
//                            before subscribers attach, so this subscriber
//                            never fires for the initial edition.
//   - on CYCLE_GAME_OVER   — terminal round-trip integrity.
// Autosave-every-N, multi-slot, compression deferred per ICD §Open-questions.
world.subscribeCycle((ev) => {
  if (ev.kind === 'CYCLE_BEGIN' || ev.kind === 'CYCLE_GAME_OVER') {
    saveNow(world);
  }
});

let lastFrameTime = performance.now();
let lastTickTime = lastFrameTime;
let accumulator = 0;

// Latch initial interp endpoints so the first frame doesn't lerp from origin.
renderer.noteTick(world.snapshot(), TICK_DT);

function loop() {
  const now = performance.now();
  const frameDt = Math.min(0.1, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  accumulator += frameDt;

  // 0.10.1 (G-07): slow-mo multiplies the per-tick dt. The accumulator
  // drains at real-time TICK_DT (loop cadence unchanged) but the world
  // advances by TICK_DT * factor — so the deadline counts at half-speed
  // when active, sim units move half-distance per tick, and the renderer
  // interp window stays full TICK_DT real seconds (smooth playback).
  const factor = speedFactor(slowMo, now);
  const simDt = TICK_DT * factor;

  while (accumulator >= TICK_DT) {
    world.tick(simDt);
    accumulator -= TICK_DT;
    lastTickTime = now - accumulator * 1000;
    renderer.noteTick(world.snapshot(), TICK_DT);
  }

  const alpha = accumulator / TICK_DT;
  const frame = world.snapshot();
  renderer.apply(frame, alpha);
  hud.apply(frame);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
