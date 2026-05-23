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

// Pan speed in world units / sec. TILE=6; 24 u/s ≈ 4 tiles/sec — a brisk
// RTS pan that crosses the 10-tile grid in under three seconds at City zoom.
export const PAN_SPEED = TILE * 4;

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

  root.addEventListener('mousedown', (e) => {
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
    // Normalize so diagonal pan isn't faster than axis-aligned.
    const mag = Math.hypot(vx, vz);
    if (mag > 0) { vx = (vx / mag) * PAN_SPEED; vz = (vz / mag) * PAN_SPEED; }
    renderer.setPanVelocity(vx, vz);
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) {
      // Ignore key-repeat for everything: pan velocity already integrates
      // while the key is held, and Space slow-mo should fire once per
      // press, not auto-trigger via OS key-repeat.
      return;
    }
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
