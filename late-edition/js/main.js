// Late Edition — entry point.
// Wires sim, renderer, input. Drives a fixed-step sim loop with
// renderer interpolation between ticks (ICD-01 v0.3 §Animation playhead).

import { Renderer } from './render/renderer.js';
import { World } from './sim/world-state.js';
import { attachInput } from './input.js';
import { HudTicker } from './hud.js';
import { DebriefPanel } from './debrief-panel.js';

const TICK_HZ = 30;
const TICK_DT = 1 / TICK_HZ;

const root = document.getElementById('world');
if (!root) throw new Error('world root not found');
const hudRoot = document.getElementById('hud-ticker');
if (!hudRoot) throw new Error('hud-ticker root not found');
const panelRoot = document.getElementById('debrief-panel');
if (!panelRoot) throw new Error('debrief-panel root not found');

const renderer = new Renderer(root);
const world = new World();
const hud = new HudTicker(hudRoot);
new DebriefPanel(panelRoot, world);
attachInput(root, renderer, world);

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
