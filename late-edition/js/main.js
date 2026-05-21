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

const TICK_HZ = 30;
const TICK_DT = 1 / TICK_HZ;

const root = document.getElementById('world');
if (!root) throw new Error('world root not found');
const hudRoots = {
  topCards: document.getElementById('hud-top-cards'),
  deadline: document.getElementById('hud-deadline-strip'),
  dossier:  document.getElementById('hud-dossier'),
};
for (const [k, el] of Object.entries(hudRoots)) {
  if (!el) throw new Error(`hud root ${k} not found`);
}
const panelRoot = document.getElementById('debrief-panel');
if (!panelRoot) throw new Error('debrief-panel root not found');
const gameOverRoot = document.getElementById('gameover-overlay');
if (!gameOverRoot) throw new Error('gameover-overlay root not found');

const renderer = new Renderer(root);
// 0.8 (ICD-04 v0.1): attempt to restore from localStorage; fall through to
// a fresh World on no-save / parse-fail / unknown-future-version.
const world = loadSave() ?? new World();
const hud = new HudCorkboard(hudRoots);
new DebriefPanel(panelRoot, world);
new GameOverOverlay(gameOverRoot, world);
attachInput(root, renderer, world);

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

  while (accumulator >= TICK_DT) {
    world.tick(TICK_DT);
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
