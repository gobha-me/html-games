// Late Edition — input glue.
// Bridges the renderer (which can project screen → GridCell) and the sim
// (which owns selection + dispatch). Input itself holds no state; it converts
// DOM events to sim calls.
//
// Locked at 0.2 (design-doc §13, decision §17):
//   left-click on unit         → select
//   left-click on empty ground → deselect
//   right-click on cell        → dispatch selected unit there (no queueing)

import { GRID_W, GRID_H } from './sim/world-state.js';

export function attachInput(root, renderer, world) {
  // Suppress the browser context menu so right-click can be used as an order.
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  root.addEventListener('mousedown', (e) => {
    const cell = renderer.screenToGridCell(e.clientX, e.clientY, GRID_W, GRID_H);
    if (!cell) return;

    if (e.button === 0) {
      const hit = world.unitAtTile(cell);
      if (hit) world.selectUnit(hit.id);
      else world.deselectAll();
    } else if (e.button === 2) {
      const selected = world.units.find((u) => u.selected);
      if (selected) world.dispatch(selected.id, cell);
    }
  });
}
