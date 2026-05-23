// Late Edition — input glue.
// Bridges the renderer (which can project screen → GridCell) and the sim
// (which owns selection + dispatch). Input itself holds no state for the
// sim; for the view layer it tracks which pan keys are currently held so
// the resultant velocity vector can be recomputed on every key edge.
//
// Locked at 0.2 (design-doc §13, decision §17):
//   left-click on unit         → select
//   left-click on building     → select (1.1.1 — Option A, ICD-01 v0.6.6)
//   left-click on empty ground → deselect
//   right-click on cell        → dispatch selected unit there (no queueing)
//
// 0.10.1 (G-07 minimum control surface — Design Doc §12 + §19):
//   W / A / S / D              → camera pan (1.1.1 #333: screen-aligned, not world XZ)
//   [                          → zoom step in  (one rung; clamps at innermost)
//   ]                          → zoom step out (one rung; clamps at outermost)
//   Space (non-repeat)         → slow-mo trigger (loop owns cooldown)

import { GRID_W, GRID_H, TILE } from './sim/world-state.js';
import { getPanSpeedMultiplier } from './preferences.js';

// Pan speed in world units / sec. TILE=6; 60 u/s ≈ 10 tiles/sec — crosses
// the 10-tile grid in ~0.9 s held, ~10 brisk taps. 1.3.1 (#playtest-bug-4):
// bumped from TILE*4 (24 u/s) after the v1.3.0 playtest reported "20 taps
// to cross a single tile" — at 24 u/s, a fast tap (≤16ms) only nets ~0.4u.
// At TILE*10 the same tap nets ~1u, so even tapping play crosses the map
// in well under 60 inputs. Hold-to-pan was already wired (see syncPanVelocity
// per-frame integration in renderer._updateView); the issue was magnitude.
//
// 1.3.1: PAN_SPEED is the BASE; the actual runtime velocity is
// PAN_SPEED * getPanSpeedMultiplier() (default 1.0; player-tunable via
// localStorage 'lateEdition.panSpeedMultiplier'). The base stays an export
// so tests can lock the calibration and tooling can compute against the
// design value without reaching through the preferences layer.
export const PAN_SPEED = TILE * 10;

// 1.1.1 (#333): exported so tests/input-pan.test.mjs can assert each key
// maps to its screen-aligned axis under the iso camera (W=up · A=left ·
// S=down · D=right) without simulating DOM events. The vectors are
// pre-normalize world XZ deltas; syncPanVelocity then normalizes the
// resultant magnitude to PAN_SPEED.
export const KEY_PAN = {
  w: { x: -1, z: -1 },  // screen up
  a: { x: -1, z:  1 },  // screen left
  s: { x:  1, z:  1 },  // screen down
  d: { x:  1, z: -1 },  // screen right
};

export function attachInput(root, renderer, world, hooks = {}) {
  // Suppress the browser context menu so right-click can be used as an order.
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  // 1.3.0 (ICD-07 first caller): browser autoplay policy blocks audio
  // playback until a user gesture. The first mousedown OR keydown
  // unlocks the bus; subsequent unlocks are no-ops (idempotent).
  const tryUnlockAudio = () => { if (hooks.audioBus) hooks.audioBus.unlock(); };

  root.addEventListener('mousedown', (e) => {
    tryUnlockAudio();
    const cell = renderer.screenToGridCell(e.clientX, e.clientY, GRID_W, GRID_H);
    if (!cell) return;

    if (e.button === 0) {
      // 1.1.1 (#334 · ICD-01 v0.6.6 SelectedBuildingView): try unit first,
      // then building, then deselect. Bureau/Branch Bureau/Switchboard tiles
      // are otherwise unselectable and players read the unresponsive click
      // as broken (Switchboard + Branch Bureau have no other HP surface).
      const unitHit = world.unitAtTile(cell);
      if (unitHit) { world.selectUnit(unitHit.id); return; }
      const buildingHit = world.buildingAtTile(cell);
      if (buildingHit) { world.selectBuilding(buildingHit.id); return; }
      world.deselectAll();
    } else if (e.button === 2) {
      const selected = world.units.find((u) => u.selected);
      if (selected) world.dispatch(selected.id, cell);
    }
  });

  // 0.10.1 — keyboard view + slow-mo. Listener lives on window so a focused
  // canvas isn't required. The pan key set is recomputed → velocity vector
  // each edge; the renderer integrates the velocity per frame.
  const panKeys = new Set();
  // 1.1.1 (#333): KEY_PAN is hoisted to module scope (above) so tests can
  // import it. The unit vectors are pre-normalize world XZ deltas rotated
  // 45° from the v0.1 axis-aligned set so each key maps to its screen
  // axis under the iso camera (W=up · A=left · S=down · D=right).
  // syncPanVelocity's Math.hypot normalization keeps |v| at PAN_SPEED
  // regardless of how many keys are held — including single-key
  // √2-magnitude inputs.

  function syncPanVelocity() {
    let vx = 0, vz = 0;
    for (const k of panKeys) {
      const v = KEY_PAN[k];
      if (v) { vx += v.x; vz += v.z; }
    }
    // Normalize so diagonal pan isn't faster than axis-aligned. 1.3.1: the
    // user-tunable multiplier reads from preferences each sync so a console
    // tweak takes effect on the next keypress (no reload strictly needed).
    const mag = Math.hypot(vx, vz);
    if (mag > 0) {
      const speed = PAN_SPEED * getPanSpeedMultiplier();
      vx = (vx / mag) * speed;
      vz = (vz / mag) * speed;
    }
    renderer.setPanVelocity(vx, vz);
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) {
      // Ignore key-repeat for everything: pan velocity already integrates
      // while the key is held, and Space slow-mo should fire once per
      // press, not auto-trigger via OS key-repeat.
      return;
    }
    tryUnlockAudio();
    const k = e.key.toLowerCase();
    if (k in KEY_PAN) {
      panKeys.add(k);
      syncPanVelocity();
      e.preventDefault();
    } else if (e.key === '[') {
      // 1.1.1 (#335): step one rung inward. Clamps silently at the
      // innermost step so repeated mashes after the limit are no-ops.
      renderer.stepZoom(+1);
      e.preventDefault();
    } else if (e.key === ']') {
      renderer.stepZoom(-1);
      e.preventDefault();
    } else if (e.code === 'Space') {
      if (hooks.triggerSlowMo) hooks.triggerSlowMo();
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k in KEY_PAN) {
      panKeys.delete(k);
      syncPanVelocity();
    }
  });

  // Pause-on-blur: drop pan velocity so the viewport doesn't keep drifting
  // when the user alt-tabs (keyup events don't fire across focus loss).
  window.addEventListener('blur', () => {
    if (panKeys.size > 0) {
      panKeys.clear();
      syncPanVelocity();
    }
  });
}
